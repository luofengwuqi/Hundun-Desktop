/**
 * 母程序 / 子程序 窗口互斥生命周期测试
 *
 * 运行: npx electron scripts/test-window-lifecycle.js  (退出码 0 = 全过)
 *
 * 不变式:
 *   1. 任意时刻, 母程序与子程序窗口不能同时可见
 *   2. 任意时刻, 至少有一个窗口可见 (子程序关闭后母程序必须恢复)
 *
 * 覆盖: startPlugin 直启 / 主窗口被意外 show (页面重载/HMR) / 插件切换 /
 *       返回母程序 / 再次启动 (existing-window 路径) / 插件 X 关闭 / 挂起
 */
const { app, BrowserWindow } = require('electron')
const path = require('path')
const os = require('os')
const fs = require('fs')
const { PluginManager } = require('../src/main/plugin-manager')
const { registerSoundSettingsIPC } = require('../src/main/sound-settings')

// 隔离 userData: 插件真实 storage (hundundesktop-data/*.json) 不写用户真实数据
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'winlife-')))

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const results = []
const check = (name, cond, detail = '') => {
  results.push({ name, pass: !!cond })
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
}

const visibleWindows = () =>
  BrowserWindow.getAllWindows().filter(w => !w.isDestroyed() && w.isVisible())

// 断言互斥 + "至少一个可见"
const checkInvariant = (label, mainWin) => {
  const vis = visibleWindows()
  const mainVisible = vis.includes(mainWin)
  const pluginVisible = vis.length - (mainVisible ? 1 : 0)
  const exclusive = !(mainVisible && pluginVisible > 0)
  const atLeastOne = vis.length >= 1
  check(`${label}: 互斥 (母=${mainVisible}, 子可见=${pluginVisible}, 总可见=${vis.length})`,
    exclusive && atLeastOne, `违规=${!exclusive ? '双可见' : (!atLeastOne ? '全隐藏' : '无')}`)
}

app.whenReady().then(async () => {
  // 注册音效设置 IPC (插件 preload 启动时会 sendSync 读取, 与真实主进程一致)
  registerSoundSettingsIPC()

  // ---------- 母程序窗口 (真实规格: 无边框/透明) ----------
  const mainWindow = new BrowserWindow({
    width: 820, height: 580, show: true,
    frame: false, transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, '../src/main/preload.js')
    }
  })
  await mainWindow.loadFile(path.join(__dirname, 'test-sound-main.html'))

  const pm = new PluginManager(mainWindow)

  // ---------- A. launch 启动 fast-txt → 藏母显子 ----------
  const ra = await pm.launchPluginWithTransition('fast-txt')
  await sleep(400)
  check('A. launch 启动成功且母程序隐藏', ra && ra.success === true && !mainWindow.isVisible(),
    `success=${ra && ra.success}, mainVisible=${mainWindow.isVisible()}`)
  checkInvariant('A', mainWindow)

  // ---------- B. 主窗口被意外 show (模拟 did-finish-load / HMR 页面重载) ----------
  mainWindow.show()
  await sleep(200)
  check('B. 意外 show() 被互斥拦截 (母重新隐藏)', !mainWindow.isVisible())
  checkInvariant('B', mainWindow)

  // ---------- C. 插件切换: 启动 calculator → fast-txt 必须让位 ----------
  const rc = await pm.launchPluginWithTransition('calculator')
  await sleep(400)
  check('C. 切换到 calculator 成功', rc && rc.success === true, JSON.stringify(rc))
  const ftWin = pm.getPluginWindow('fast-txt')
  check('C. 旧插件 fast-txt 已隐藏', ftWin && !ftWin.isVisible())
  check('C. 新插件 calculator 可见', (() => { const w = pm.getPluginWindow('calculator'); return w && w.isVisible() })())
  checkInvariant('C', mainWindow)

  // ---------- D. 返回母程序: 所有插件窗口隐藏, 仅母可见 ----------
  await pm.returnToParent(pm.getActivePluginId())
  await sleep(300)
  check('D. 返回后母程序可见', mainWindow.isVisible())
  check('D. 所有插件窗口已隐藏', pm.getVisiblePluginWindows().length === 0,
    `visible plugins=${pm.getVisiblePluginWindows().length}`)
  checkInvariant('D', mainWindow)

  // ---------- E. startPlugin 直启 existing-window 路径 (母可见时) ----------
  // 语义: startPlugin 对"已存在窗口"应显子藏母 (对新插件则仅创建, 由 launch 负责显示)
  check('E0. 此时母程序可见 (D 之后)', mainWindow.isVisible())
  await pm.startPlugin('fast-txt')
  await sleep(300)
  const ftVisible = (() => { const w = pm.getPluginWindow('fast-txt'); return !!(w && w.isVisible()) })()
  check('E. startPlugin existing 路径: 子显示', ftVisible)
  check('E. startPlugin existing 路径: 母已隐藏', !mainWindow.isVisible())
  checkInvariant('E', mainWindow)

  // ---------- F. 插件窗口被 X 关闭 → 母程序恢复 ----------
  const win = pm.getPluginWindow('fast-txt')
  if (win) win.close()
  await sleep(600)
  check('F. 插件关闭后母程序恢复可见', mainWindow.isVisible(),
    `visible=${mainWindow.isVisible()}, wins=${visibleWindows().length}`)
  checkInvariant('F', mainWindow)

  // ---------- G. 挂起插件 (suspend 隐藏窗口) → 母程序恢复 ----------
  await pm.launchPluginWithTransition('calculator')
  await sleep(400)
  pm.suspendPlugin('calculator')
  await sleep(300)
  check('G. 挂起后母程序恢复可见', mainWindow.isVisible(),
    `visible=${mainWindow.isVisible()}`)
  checkInvariant('G', mainWindow)

  // ---------- H. 平台拦截 (决策42): manifest.platforms 不含当前系统 → 打开前拒绝 ----------
  await pm.loadPlugin('fast-cmd')
  const fc = pm.plugins.get('fast-cmd')
  const origPlatforms = fc.manifest.platforms
  fc.manifest.platforms = ['sunos'] // 当前系统必然不在支持列表
  const rh = await pm.launchPluginWithTransition('fast-cmd')
  await sleep(300)
  check('H. 不支持平台 → launch 返回失败且提示友好', rh && rh.success === false && /不支持当前系统/.test(rh.error || ''),
    JSON.stringify(rh))
  check('H. 未创建插件窗口 (打开前拦截)', !pm.getPluginWindow('fast-cmd'))
  check('H. 母程序未被隐藏', mainWindow.isVisible(), `mainVisible=${mainWindow.isVisible()}`)
  checkInvariant('H', mainWindow)
  // 恢复 manifest (本机为 Linux, fast-cmd 实际受支持)
  fc.manifest.platforms = origPlatforms

  // ---------- I. TASK 子程序真实启动 (真实 plugin-preload + 真实 storage IPC + manifest windowSize) ----------
  const ri = await pm.launchPluginWithTransition('task')
  await sleep(500)
  check('I. launch task 成功', ri && ri.success === true, JSON.stringify(ri))
  const tWin = pm.getPluginWindow('task')
  check('I. task 窗口可见', !!(tWin && tWin.isVisible()))
  const [tw, th] = tWin ? tWin.getSize() : [0, 0]
  check('I. 窗口尺寸 = windowSize+20 (420x540)', tw === 420 && th === 540, `${tw}x${th}`)
  // 插件页数据层就绪 (init await TaskStore.load, 轮询等就绪)
  let pageOk = false
  for (let i = 0; i < 20 && !pageOk; i++) {
    pageOk = await tWin.webContents.executeJavaScript(
      `typeof TaskStore !== 'undefined' && typeof _lastListSig !== 'undefined' && _lastListSig !== null`, true
    ).catch(() => false)
    if (!pageOk) await sleep(200)
  }
  check('I. 插件页 TaskStore 初始化 (含 __PLUGIN_ID__ 注入兜底)', pageOk === true)
  check('I. 插件内 id = task', await tWin.webContents.executeJavaScript(`window.__PLUGIN_ID__`, true).catch(() => null) === 'task')
  // 真实 storage IPC 通道 (plugin:setData → database → 落盘 task.json)
  const wOk = await tWin.webContents.executeJavaScript(
    `window.hundun.storage.set('probe', { v: 1 }).then(() => true).catch(() => false)`, true
  ).catch(() => false)
  check('I. 真实 storage.set 可用', wOk === true)
  await sleep(300)
  const dbPath = path.join(app.getPath('userData'), 'hundundesktop-data', 'task.json')
  check('I. 数据落盘 task.json', fs.existsSync(dbPath), dbPath)
  await pm.returnToParent('task')
  await sleep(300)
  check('I. 返回后母程序可见', mainWindow.isVisible())
  checkInvariant('I', mainWindow)

  // ---------- J. 最小化按钮 (决策52): 子程序最小化 → 母程序恢复可见; 恢复子程序 → 母程序再隐藏 ----------
  // 逐个内置子程序: 真实点击页面里的最小化按钮 (真实 plugin-preload → plugin:minimize IPC)
  for (const pluginId of ['task', 'calculator', 'fast-cmd', 'fast-txt']) {
    const launched = await pm.launchPluginWithTransition(pluginId)
    await sleep(500)
    const pWin = pm.getPluginWindow(pluginId)
    if (!launched || !launched.success || !pWin) {
      check(`J. ${pluginId} 启动成功 (最小化测试前置)`, false, JSON.stringify(launched))
      continue
    }
    // 页面里必须存在最小化按钮 (真实 DOM 断言)
    const hasBtn = await pWin.webContents.executeJavaScript(
      `!!document.getElementById('minBtn')`, true
    ).catch(() => false)
    check(`J. ${pluginId} 头部存在最小化按钮 #minBtn`, hasBtn === true)

    // fast-txt 有两个头部 (主视图 + 编辑器视图), 编辑器视图也要有最小化按钮
    if (pluginId === 'fast-txt') {
      const hasEditorBtn = await pWin.webContents.executeJavaScript(
        `!!document.getElementById('editorMinBtn')`, true
      ).catch(() => false)
      check('J. fast-txt 编辑器视图也存在最小化按钮 #editorMinBtn', hasEditorBtn === true)
    }

    // 真实点击 → window.hundun.window.minimize() → plugin:minimize → 窗口最小化
    // (fast-cmd / fast-txt 的 init 是异步的, 监听器挂载较晚 → 轮询重试)
    let minimized = false
    for (let i = 0; i < 24 && !minimized; i++) {
      await pWin.webContents.executeJavaScript(
        `document.getElementById('minBtn').click()`, true
      ).catch(() => {})
      await sleep(250)
      minimized = pWin.isMinimized() === true
    }
    check(`J. ${pluginId} 最小化按钮生效 (窗口已最小化)`, minimized === true)
    check(`J. ${pluginId} 最小化后母程序恢复可见 (会话不变量)`, mainWindow.isVisible() === true,
      `mainVisible=${mainWindow.isVisible()}`)
    checkInvariant(`J.${pluginId}`, mainWindow)

    // 模拟任务栏恢复子程序 → 母程序必须再次隐藏 (会话内互斥)
    pWin.restore()
    await sleep(600)
    check(`J. ${pluginId} 恢复后母程序重新隐藏 (互斥保持)`, mainWindow.isVisible() === false,
      `mainVisible=${mainWindow.isVisible()}`)
    checkInvariant(`J.${pluginId} restored`, mainWindow)
    await pm.returnToParent(pluginId)
    await sleep(300)
  }
  check('J. 全部子程序最小化/恢复后母程序可见', mainWindow.isVisible() === true,
    `mainVisible=${mainWindow.isVisible()}`)
  checkInvariant('J end', mainWindow)

  // 母程序自身的最小化按钮 (静态断言: App.vue 按钮 + main.css 样式 + window-minimize IPC)
  const appVue = fs.readFileSync(path.join(__dirname, '../src/renderer/App.vue'), 'utf8')
  const mainCss = fs.readFileSync(path.join(__dirname, '../src/renderer/assets/styles/main.css'), 'utf8')
  const mainJs = fs.readFileSync(path.join(__dirname, '../src/main/index.js'), 'utf8')
  check('J. 母程序含最小化按钮 (.header-min-btn)', /header-min-btn/.test(appVue) && /header-min-btn/.test(mainCss))
  check('J. 母程序最小化走 window-minimize IPC', /window-minimize/.test(appVue) && /ipcMain\.on\('window-minimize'/.test(mainJs))

  const failed = results.filter(r => !r.pass)
  console.log(`\n结果: ${results.length - failed.length}/${results.length} 通过`)
  app.exit(failed.length ? 1 : 0)
}).catch(e => {
  console.error(e)
  app.exit(1)
})
