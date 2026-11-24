/**
 * 镜像模式「子程序运行锁」边界测试 (决策65)
 *
 * 运行: npx electron scripts/test-mirror-lock.js  (退出码 0 = 全过)
 *
 * 背景:
 *   子程序「返回母程序」只是 hide, 实例仍留在 windows 里供本会话快速恢复。
 *   旧口径把「存在插件窗口」一律算作占用 → A 反复进出几个应用后,
 *   镜像窗口 B 里会有一堆应用同时显示「运行中」且启动被拒 (误锁)。
 *
 * 覆盖:
 *   1. A 运行 fast-txt → B 视角被占 (基线, 真在跑的必须锁)
 *   2. A 返回母程序 → 实例仍在但不再算占用, B 视角释放
 *   3. A 连续进出三个应用 → 占用只有当前可见的那一个
 *   4. B 接管 A 的隐藏实例 → 归属转移, 旧窗口销毁, 不会串台
 *   5. 接管后 A 再启动同一插件 → 被正确拒绝 (B 真在跑)
 *   6. 最小化的子程序仍算占用 (任务栏可恢复, 不能被抢)
 */
const { app, BrowserWindow } = require('electron')
const path = require('path')
const os = require('os')
const fs = require('fs')
const { PluginManager } = require('../src/main/plugin-manager')
const { MirrorManager } = require('../src/main/mirror-manager')

// 隔离 userData
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'mirrorlock-')))

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const results = []
const check = (name, cond, detail = '') => {
  results.push(!!cond)
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
}

const mkWin = (label) => {
  const w = new BrowserWindow({
    width: 820,
    height: 580,
    show: true,
    frame: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, '../src/main/preload.js'),
      additionalArguments: [`--hundun-window=${label}`]
    }
  })
  w.loadFile(path.join(__dirname, 'test-sound-main.html'))
  return w
}

app.whenReady().then(async () => {
  const winA = mkWin('main')
  await sleep(500)

  const pm = new PluginManager(winA)
  const mgr = new MirrorManager({
    pluginManager: pm,
    createWindow: (label) => {
      const w = mkWin(label)
      pm.addSession(w, label)
      w.on('closed', () => mgr.handleWindowClosed(w))
      return w
    },
    onPromoted: () => {},
    onStateChanged: () => {}
  })
  mgr.setPrimary(winA)
  winA.on('closed', () => mgr.handleWindowClosed(winA))

  const sessA = pm.sessions.get(winA)
  mgr.open()
  await sleep(600)
  const winB = mgr.getMirror()
  const sessB = pm.sessions.get(winB)

  // ---------- 1. 基线: A 真在跑 → B 视角被占 ----------
  await pm.launchPluginWithTransition('fast-txt', {}, sessA)
  await sleep(600)
  check('1. A 运行 fast-txt → B 视角被占',
    JSON.stringify(pm.getForeignPlugins(sessB)) === '["fast-txt"]',
    JSON.stringify(pm.getForeignPlugins(sessB)))

  // ---------- 2. 返回母程序 → 隐藏实例不锁 ----------
  await pm.returnToParent('fast-txt')
  await sleep(400)
  check('2. 返回后实例仍保留 (可快速恢复)', !!pm.getPluginWindow('fast-txt'))
  check('2. 返回后不再算占用', pm.getOccupiedPlugins().length === 0,
    JSON.stringify(pm.getOccupiedPlugins()))
  check('2. B 视角已释放', pm.getForeignPlugins(sessB).length === 0,
    JSON.stringify(pm.getForeignPlugins(sessB)))

  // ---------- 3. 连续进出多个应用 → 只锁当前那个 ----------
  await pm.launchPluginWithTransition('task', {}, sessA)
  await sleep(600)
  await pm.returnToParent('task')
  await sleep(400)
  await pm.launchPluginWithTransition('music', {}, sessA)
  await sleep(800)
  check('3. 进出三个应用后占用只有当前可见的 music',
    JSON.stringify(pm.getOccupiedPlugins()) === '["music"]', JSON.stringify(pm.getOccupiedPlugins()))
  check('3. B 只看到 music 被占', JSON.stringify(pm.getForeignPlugins(sessB)) === '["music"]',
    JSON.stringify(pm.getForeignPlugins(sessB)))

  // ---------- 4. B 接管 A 的隐藏实例 ----------
  await pm.returnToParent('music')
  await sleep(400)
  const oldFt = pm.getPluginWindow('fast-txt')
  const rTake = await pm.launchPluginWithTransition('fast-txt', {}, sessB)
  await sleep(800)
  check('4. B 接管 A 的隐藏 fast-txt 实例', rTake && rTake.success === true, JSON.stringify(rTake))
  check('4. 归属已转给 B', pm.getPluginOwner('fast-txt') === sessB)
  const ftWin = pm.getPluginWindow('fast-txt')
  check('4. 接管后窗口可见', !!(ftWin && ftWin.isVisible()))
  check('4. 旧实例已销毁 (旧 closed 不会清掉新记录)',
    !!oldFt && oldFt.isDestroyed() && ftWin !== oldFt,
    `oldDestroyed=${!!oldFt && oldFt.isDestroyed()}`)
  check('4. A 视角: fast-txt 在别处', pm.getForeignPlugins(sessA).includes('fast-txt'),
    JSON.stringify(pm.getForeignPlugins(sessA)))

  // ---------- 5. 接管后 A 再启动 → 应被拒 ----------
  const rDeny = await pm.launchPluginWithTransition('fast-txt', {}, sessA)
  await sleep(300)
  check('5. A 启动 B 正在跑的 fast-txt 被拒', rDeny && rDeny.success === false, JSON.stringify(rDeny))

  // ---------- 6. 最小化仍算占用 ----------
  pm.minimizePlugin('fast-txt')
  await sleep(700)
  check('6. 最小化仍算占用', pm.getOccupiedPlugins().includes('fast-txt'),
    JSON.stringify(pm.getOccupiedPlugins()))

  // ---------- 7. 过渡动画中 (窗口已建但还没 show) 也不能被抢 ----------
  // 这是上一次修订踩的坑: 用 isVisible() 反推占用, 动画那 900ms 里窗口不可见,
  // 镜像会判定「没人用」再建一份 → 同一个插件两个窗口
  await pm.startPlugin('fast-cmd', {}, sessA)
  await sleep(200)
  check('7. 未 show 的窗口仍算占用', pm.isPluginHeld('fast-cmd'), `visible=${pm.getPluginWindow('fast-cmd').isVisible()}`)
  const rSneak = await pm.launchPluginWithTransition('fast-cmd', {}, sessB)
  await sleep(300)
  check('7. 过渡中的实例不能被镜像抢走', rSneak && rSneak.success === false, JSON.stringify(rSneak))
  check('7. fast-cmd 仍归属 A', pm.getPluginOwner('fast-cmd') === sessA)
  await pm.closePlugin('fast-cmd')
  await sleep(400)

  // ---------- 8. 接管时通知原会话收回插槽 ----------
  await winA.webContents.executeJavaScript(
    'window.__reclaimed = []; window.electronAPI.onPluginReclaimed(d => window.__reclaimed.push(d.pluginId)); true')
  await pm.launchPluginWithTransition('calculator', {}, sessA)
  await sleep(600)
  await pm.returnToParent('calculator')
  await sleep(400)
  const oldCalc = pm.getPluginWindow('calculator')
  const rC = await pm.launchPluginWithTransition('calculator', {}, sessB)
  await sleep(600)
  const reclaimed = await winA.webContents.executeJavaScript('window.__reclaimed')
  check('8. B 接管成功', rC && rC.success === true, JSON.stringify(rC))
  check('8. A 收到 plugin-reclaimed', Array.isArray(reclaimed) && reclaimed.includes('calculator'),
    JSON.stringify(reclaimed))
  check('8. calculator 归属已转给 B', pm.getPluginOwner('calculator') === sessB)
  check('8. A 的旧实例已销毁 (不会两份同时存在)',
    !!oldCalc && oldCalc.isDestroyed() && pm.getPluginWindow('calculator') !== oldCalc,
    `oldDestroyed=${!!oldCalc && oldCalc.isDestroyed()}`)

  const passed = results.filter(Boolean).length
  console.log(`\n结果: ${passed}/${results.length} 通过`)
  app.exit(passed === results.length ? 0 : 1)
})
