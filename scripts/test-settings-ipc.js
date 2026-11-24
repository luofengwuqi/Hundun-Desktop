/**
 * 应用设置 IPC / preload 端到端冒烟 (决策66)
 *
 * 运行: env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron --no-sandbox scripts/test-settings-ipc.js
 *       (退出码 0 = 全过)
 *
 * 验证真实链路:
 *   1. preload 在 contextIsolation:false 下把 settings 挂到 window.electronAPI
 *   2. 同步读: get() 不需要 await (主题/语言首帧不闪的前提)
 *   3. 写入落盘到 <userData>/settings.json (主进程原子写)
 *   4. 新窗口 (模拟重启/第二个母窗口) 的 sendSync 快照能读到旧值
 *   5. 一个窗口写入 → 另一个窗口收到 settings:changed 广播
 *   6. 白名单外路径被主进程拒绝
 *
 * 注意: 本脚本以单文件方式启动, 不读项目 package.json, 但 settings-store 只依赖
 *       app.getPath('userData'), 与本脚本无关的版本号逻辑一概不涉及。
 */
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const os = require('os')
const fs = require('fs')
const { getSettingsStore } = require('../src/main/settings-store')

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'setipc-'))
app.setPath('userData', userDataDir)

const results = []
const check = (name, cond, detail = '') => {
  results.push(!!cond)
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
}

// 与 src/main/index.js 完全一致的接线
const settingsStore = getSettingsStore()
const broadcastSettings = (snapshot) => {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win && !win.isDestroyed()) win.webContents.send('settings:changed', snapshot)
  }
}
settingsStore.onChange = broadcastSettings

ipcMain.on('settings:get-sync', (event) => { event.returnValue = settingsStore.snapshot() })
ipcMain.handle('settings:get', (event, dotted, fallback = null) => settingsStore.get(dotted, fallback))
ipcMain.handle('settings:set', (event, dotted, value) => settingsStore.set(dotted, value))
ipcMain.handle('settings:set-many', (event, patch) => settingsStore.setMany(patch))
ipcMain.handle('settings:file-path', () => settingsStore.filePath)
ipcMain.handle('settings:remove', (event, dotted) => settingsStore.remove(dotted))

const PRELOAD = path.join(__dirname, '../src/main/preload.js')

const makeWindow = async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: false,
      nodeIntegration: true
    }
  })
  await win.loadURL('about:blank')
  return win
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

app.whenReady().then(async () => {
  // ---------- 第一个窗口: 首次运行 ----------
  const win1 = await makeWindow()

  const apiShape = await win1.webContents.executeJavaScript(`
    JSON.stringify({
      hasSettings: !!(window.electronAPI && window.electronAPI.settings),
      get: typeof (window.electronAPI.settings || {}).get,
      set: typeof (window.electronAPI.settings || {}).set,
      onChanged: typeof (window.electronAPI.settings || {}).onChanged
    })
  `)
  const shape = JSON.parse(apiShape)
  check('preload 暴露 electronAPI.settings', shape.hasSettings === true)
  check('settings.get 是同步函数', shape.get === 'function')
  check('settings.set 可调用', shape.set === 'function')
  check('settings.onChanged 可订阅', shape.onChanged === 'function')

  const initial = await win1.webContents.executeJavaScript(
    `JSON.stringify({ theme: window.electronAPI.settings.get('theme', 'DEFAULT'), all: window.electronAPI.settings.all() })`
  )
  const initParsed = JSON.parse(initial)
  check('首启: get 返回 fallback (同步, 无 await)', initParsed.theme === 'DEFAULT', initParsed.theme)
  check('首启: 快照为空且未创建文件', Object.keys(initParsed.all).length === 0 && !fs.existsSync(settingsStore.filePath))

  // ---------- 写入 + 同步读回 ----------
  const writeResult = await win1.webContents.executeJavaScript(
    `window.electronAPI.settings.set('theme', 'handheld').then(r => JSON.stringify(r))`
  )
  check('写入返回 {ok:true, changed:true}', writeResult.includes('"ok":true') && writeResult.includes('"changed":true'), writeResult)

  const afterWrite = await win1.webContents.executeJavaScript(
    `window.electronAPI.settings.get('theme', 'DEFAULT')`
  )
  check('同窗口同步读回新值 (乐观快照)', afterWrite === 'handheld', String(afterWrite))

  const fileOk = fs.existsSync(settingsStore.filePath)
  check('落盘到 <userData>/settings.json', fileOk, settingsStore.filePath)
  if (fileOk) {
    const raw = JSON.parse(fs.readFileSync(settingsStore.filePath, 'utf8'))
    check('文件内容含 theme 且带 schema', raw.theme === 'handheld' && raw.schema === 1, JSON.stringify(raw).slice(0, 120))
  }

  // ---------- 第二个窗口: 模拟重启 / 另一个母窗口 ----------
  const win2 = await makeWindow()
  const snapshotInNewWindow = await win2.webContents.executeJavaScript(
    `window.electronAPI.settings.get('theme', 'DEFAULT')`
  )
  check('新窗口 sendSync 快照读到旧值', snapshotInNewWindow === 'handheld', String(snapshotInNewWindow))

  // ---------- 跨窗口广播 ----------
  await win2.webContents.executeJavaScript(`
    window.__seenSettings = null
    window.electronAPI.settings.onChanged((snapshot) => { window.__seenSettings = snapshot.theme || null })
    true
  `)
  await win1.webContents.executeJavaScript(`window.electronAPI.settings.set('theme', 'contact-sheet').then(r => JSON.stringify(r))`)
  await sleep(300)
  const seen = await win2.webContents.executeJavaScript('window.__seenSettings')
  check('窗口 A 写入 → 窗口 B 收到 settings:changed', seen === 'contact-sheet', String(seen))

  // ---------- 主进程侧校验 ----------
  const badResult = await win1.webContents.executeJavaScript(
    `window.electronAPI.settings.set('hacked', 1).then(r => JSON.stringify(r))`
  )
  check('白名单外路径被拒绝', badResult.includes('path-not-allowed'), badResult)

  const badValue = await win1.webContents.executeJavaScript(
    `window.electronAPI.settings.set('locale', 'fr').then(r => JSON.stringify(r))`
  )
  check('非法枚举值被拒绝', badValue.includes('invalid-value'), badValue)

  const soundResult = await win1.webContents.executeJavaScript(
    `window.electronAPI.settings.setMany({ 'sound.soundEnabled': false, 'sound.volume': 33 }).then(r => JSON.stringify(r))`
  )
  check('setMany 一次写多个键', soundResult.includes('"ok":true'), soundResult)
  const sound = settingsStore.get('sound')
  check('setMany 结果合并正确', sound.soundEnabled === false && sound.volume === 33, JSON.stringify(sound))

  const filePath = await win1.webContents.executeJavaScript(
    `window.electronAPI.settings.filePath()`
  )
  check('settings.filePath() 返回真实路径', path.isAbsolute(String(filePath)) && filePath.endsWith('settings.json'), String(filePath))

  const pass = results.filter(Boolean).length
  console.log(`\n${pass}/${results.length} 项通过  (userData=${userDataDir})`)
  win1.destroy()
  win2.destroy()
  app.exit(pass === results.length ? 0 : 1)
}).catch(err => {
  console.error('冒烟失败:', err)
  app.exit(1)
})
