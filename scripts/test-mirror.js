/**
 * 镜像模式会话语义测试 (决策45)
 *
 * 运行: npx electron scripts/test-mirror.js  (退出码 0 = 全过)
 *
 * 覆盖:
 *   A. 打开镜像 → 两母窗口同屏, 各自会话互斥不变式成立
 *   B. 重复打开镜像 → 聚焦已存在 (全局至多一个镜像)
 *   C. A 启动 fast-txt → A母藏/a显, B母仍可见 (跨会话并行)
 *   D. B 启动 fast-txt → 被归属校验拒绝, 归属仍属 A
 *   E. B 启动 task → 成功, fast-txt 与 task 两子程序同屏并行
 *   F. getForeignPlugins 按会话视角正确 (A 只见 task, B 只见 fast-txt)
 *   G. 关闭镜像 → 其会话子程序(task)一并关闭, 镜像槽释放, A 不受影响
 *   H. 再次打开镜像 → created
 *   I. 关闭主窗口 A → 镜像升格为主窗口 (onPromoted), A 会话子程序一并关闭
 *   J. 升格后镜像槽已释放 → 可再开新镜像
 *
 * 会话内不变式: 任意时刻, 每个会话内"母窗口可见 XOR 其子程序窗口可见"
 * (跨会话不受限 — 这正是镜像并行的语义)
 */
const { app, BrowserWindow } = require('electron')
const path = require('path')
const os = require('os')
const fs = require('fs')
const { PluginManager } = require('../src/main/plugin-manager')
const { MirrorManager } = require('../src/main/mirror-manager')
const { registerSoundSettingsIPC } = require('../src/main/sound-settings')

// 隔离 userData
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-')))

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const results = []
const check = (name, cond, detail = '') => {
  results.push({ name, pass: !!cond })
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
}

const visibleWindows = () =>
  BrowserWindow.getAllWindows().filter(w => !w.isDestroyed() && w.isVisible())

// 会话内不变式: 每个会话 母可见 XOR 子可见 (且至少一个可见)
const checkSessionInvariants = (label) => {
  for (const [win, session] of pm.sessions) {
    if (win.isDestroyed()) continue
    const mainVisible = win.isVisible()
    const pluginVisible = pm.getVisiblePluginWindows(session).length
    const exclusive = !(mainVisible && pluginVisible > 0)
    const atLeastOne = mainVisible || pluginVisible > 0
    check(`${label}: 会话[${session.label}]互斥 (母=${mainVisible}, 子可见=${pluginVisible})`,
      exclusive && atLeastOne,
      !exclusive ? '双可见' : (!atLeastOne ? '全隐藏' : '无'))
  }
}

let pm = null
let mirrorMgr = null
let promotedCount = 0
let stateChangedCount = 0

app.whenReady().then(async () => {
  registerSoundSettingsIPC()

  // ---------- 真实规格的母窗口 A (与 index.js createWindow 同参数) ----------
  const winA = new BrowserWindow({
    width: 820, height: 580, show: true,
    frame: false, transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, '../src/main/preload.js'),
      additionalArguments: ['--hundun-window=main']
    }
  })
  await winA.loadFile(path.join(__dirname, 'test-sound-main.html'))

  pm = new PluginManager(winA)

  // ---------- MirrorManager (createWindow 注入, 与 index.js 接线一致) ----------
  mirrorMgr = new MirrorManager({
    pluginManager: pm,
    createWindow: (label) => {
      const w = new BrowserWindow({
        width: 820, height: 580, show: true,
        frame: false, transparent: true,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          preload: path.join(__dirname, '../src/main/preload.js'),
          additionalArguments: [`--hundun-window=${label}`]
        }
      })
      w.loadFile(path.join(__dirname, 'test-sound-main.html'))
      pm.addSession(w, label)
      w.on('closed', () => mirrorMgr.handleWindowClosed(w))
      return w
    },
    onPromoted: (win) => {
      promotedCount++
      // 与 index.js 接线一致: 升格后更新 PluginManager 主会话指针
      const s = pm.sessions.get(win)
      if (s) pm.setPrimarySession(s)
    },
    onStateChanged: () => { stateChangedCount++ }
  })
  mirrorMgr.setPrimary(winA)
  // 与 index.js createWindow 接线一致: 母窗口 closed → 会话注销/升格
  winA.on('closed', () => mirrorMgr.handleWindowClosed(winA))

  const sessionA = pm.primarySession
  check('0. 主会话注册', !!sessionA && sessionA.label === 'main')
  check('0. 母窗口 A 可见', winA.isVisible())

  // ---------- A. 打开镜像 ----------
  const r1 = mirrorMgr.open()
  await sleep(500)
  check('A. open() → created', r1 && r1.success && r1.status === 'created', JSON.stringify(r1))
  const winB = mirrorMgr.getMirror()
  check('A. 镜像窗口存在且可见', !!(winB && !winB.isDestroyed() && winB.isVisible()))
  check('A. 镜像窗口与 A 不完全重叠 (级联偏移)', (() => {
    if (!winB) return false
    const [ax] = winA.getPosition()
    const [bx] = winB.getPosition()
    return bx > ax
  })())
  check('A. 两母窗口同屏可见', winA.isVisible() && winB && winB.isVisible(),
    `A=${winA.isVisible()}, B=${!!winB && winB.isVisible()}`)
  check('A. 镜像会话已注册', !!(winB && pm.sessions.get(winB) && pm.sessions.get(winB).label === 'mirror'))
  checkSessionInvariants('A')

  // ---------- B. 重复打开 → 聚焦已存在, 仍只有一个镜像 ----------
  const r2 = mirrorMgr.open()
  await sleep(300)
  check('B. 重复 open() → exists', r2 && r2.success && r2.status === 'exists', JSON.stringify(r2))
  check('B. 仍只有一个镜像窗口', mirrorMgr.getMirror() === winB)
  const mainCount = visibleWindows().length
  check('B. 可见窗口 = 2 (A + B)', mainCount === 2, `visible=${mainCount}`)

  // ---------- C. A 启动 fast-txt → A组内互斥, B 不受影响 ----------
  const rc = await pm.launchPluginWithTransition('fast-txt', {}, sessionA)
  await sleep(600)
  check('C. A 启动 fast-txt 成功', rc && rc.success === true, JSON.stringify(rc))
  const ftWin = pm.getPluginWindow('fast-txt')
  check('C. fast-txt 可见', !!(ftWin && ftWin.isVisible()))
  check('C. A母已隐藏 (会话内互斥)', !winA.isVisible())
  check('C. B母仍可见 (跨会话并行)', !!(winB && winB.isVisible()), `B=${!!winB && winB.isVisible()}`)
  check('C. fast-txt 归属 A 会话', pm.getPluginOwner('fast-txt') === sessionA)
  checkSessionInvariants('C')

  // ---------- D. B 启动 fast-txt → 归属校验拒绝 ----------
  const sessionB = pm.sessions.get(winB)
  check('D0. B 会话已注册', !!sessionB)
  const rd = await pm.launchPluginWithTransition('fast-txt', {}, sessionB)
  await sleep(300)
  check('D. B 启动 fast-txt 被拒', rd && rd.success === false, JSON.stringify(rd))
  check('D. 错误提示含归属说明', /另一个窗口/.test((rd && rd.error) || ''), rd && rd.error)
  check('D. 归属仍属 A', pm.getPluginOwner('fast-txt') === sessionA)
  check('D. B母未被隐藏 (拦截在藏母之前)', !!(winB && winB.isVisible()))
  check('D. fast-txt 仍可见 (未被打扰)', !!(ftWin && ftWin.isVisible()))
  checkSessionInvariants('D')

  // ---------- E. B 启动 task → 两个子程序同屏并行 ----------
  const re = await pm.launchPluginWithTransition('task', {}, sessionB)
  await sleep(600)
  check('E. B 启动 task 成功', re && re.success === true, JSON.stringify(re))
  const taskWin = pm.getPluginWindow('task')
  check('E. task 可见', !!(taskWin && taskWin.isVisible()))
  check('E. B母已隐藏', !(winB && winB.isVisible()))
  check('E. fast-txt 与 task 同时可见 (并行)',
    !!(ftWin && ftWin.isVisible() && taskWin && taskWin.isVisible()))
  check('E. 可见窗口 = 2 (两个子程序)', visibleWindows().length === 2,
    `visible=${visibleWindows().length}`)
  check('E. task 归属 B 会话', pm.getPluginOwner('task') === sessionB)
  checkSessionInvariants('E')

  // ---------- F. getForeignPlugins 会话视角 ----------
  const foreignA = pm.getForeignPlugins(sessionA)
  const foreignB = pm.getForeignPlugins(sessionB)
  check('F. A 视角: task 在别处, fast-txt 不在', foreignA.includes('task') && !foreignA.includes('fast-txt'),
    JSON.stringify(foreignA))
  check('F. B 视角: fast-txt 在别处, task 不在', foreignB.includes('fast-txt') && !foreignB.includes('task'),
    JSON.stringify(foreignB))

  // ---------- G. 关闭镜像 → 其子程序一并关闭, A 不受影响 ----------
  const stateBefore = stateChangedCount
  winB.close()
  await sleep(800)
  check('G. 镜像槽已释放', !mirrorMgr.hasMirror())
  check('G. task 窗口随镜像一并关闭', !pm.getPluginWindow('task'))
  check('G. 主窗口 A 未升格 (还在)', mirrorMgr.getPrimary() === winA)
  check('G. A 会话未受影响: fast-txt 仍可见', !!(ftWin && ftWin.isVisible()))
  check('G. A母仍隐藏', !winA.isVisible())
  check('G. onStateChanged 已触发', stateChangedCount > stateBefore)
  checkSessionInvariants('G')

  // ---------- H. 再次打开镜像 ----------
  const rh = mirrorMgr.open()
  await sleep(500)
  check('H. 升格/关闭后可再开镜像 → created', rh && rh.success && rh.status === 'created', JSON.stringify(rh))
  const winB2 = mirrorMgr.getMirror()
  check('H. 新镜像可见', !!(winB2 && winB2.isVisible()))
  check('H. 新镜像会话注册', !!(winB2 && pm.sessions.get(winB2)))
  checkSessionInvariants('H')

  // ---------- I. 关闭主窗口 A → 镜像升格 ----------
  const promotedBefore = promotedCount
  winA.close()
  await sleep(800)
  check('I. onPromoted 触发 (镜像升格)', promotedCount === promotedBefore + 1, `promoted=${promotedCount}`)
  check('I. 主指针 = 原镜像窗口', mirrorMgr.getPrimary() === winB2)
  check('I. 镜像槽已释放 (可再开)', !mirrorMgr.hasMirror())
  check('I. PluginManager 主会话指向升格窗口', !!(pm.primarySession && pm.primarySession.main === winB2))
  check('I. A 会话已注销', !pm.sessions.get(winA))
  check('I. A 的子程序 fast-txt 随会话关闭', !pm.getPluginWindow('fast-txt'))
  check('I. 升格窗口可见', !!(winB2 && winB2.isVisible()))
  checkSessionInvariants('I')

  // ---------- J. 升格后可再开新镜像 ----------
  const rj = mirrorMgr.open()
  await sleep(500)
  check('J. 升格后再次 open() → created', rj && rj.success && rj.status === 'created', JSON.stringify(rj))
  check('J. 新镜像 ≠ 升格窗口', mirrorMgr.getMirror() !== winB2)
  checkSessionInvariants('J')

  const failed = results.filter(r => !r.pass)
  console.log(`\n结果: ${results.length - failed.length}/${results.length} 通过`)
  app.exit(failed.length ? 1 : 0)
}).catch(e => {
  console.error(e)
  app.exit(1)
})
