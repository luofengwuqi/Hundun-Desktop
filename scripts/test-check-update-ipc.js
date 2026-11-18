/**
 * 检查更新 IPC 端到端冒烟 (决策62)
 *
 * 运行: npx electron scripts/test-check-update-ipc.js  (退出码 0 = 全过)
 *
 * 验证:
 *   1. src/main/preload.js 在 contextIsolation:false 下把 checkForUpdate 挂到 window.electronAPI
 *   2. 渲染层 invoke('update:check') 能拿到主进程 update-service 的结果 (结构 {ok,...})
 *   3. 主进程侧 process.platform 正确传入 (win32/linux/darwin 之一)
 * 注意 1: 真实网络请求 —— 本机可能超时, 此时断言仍要求拿到 {ok:false, reason:'timeout'|'network'}
 * 注意 2: 本脚本以**单文件**方式启动 (`electron scripts/xxx.js`), Electron 不读项目的
 *         package.json, 故 `app.getVersion()` 返回 Electron 自身版本 (28.3.3), 于是
 *         hasUpdate 恒为 true。真实运行 (electron-vite dev 传项目目录 / 打包后读 app.asar)
 *         返回的才是 2026.4.1 —— 已用带 package.json 的最小 app 目录单独验证。
 */
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const os = require('os')
const fs = require('fs')
const updateService = require('../src/main/update-service')

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'updipc-')))

const results = []
const check = (name, cond, detail = '') => {
  results.push(!!cond)
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
}

// 与 src/main/index.js 完全一致的接线方式
let seenPlatform = null
ipcMain.handle('update:check', async () => {
  seenPlatform = process.platform
  return updateService.checkForUpdate(app.getVersion(), process.platform)
})

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../src/main/preload.js'),
      contextIsolation: false,
      nodeIntegration: true
    }
  })
  await win.loadURL('about:blank')

  const apiType = await win.webContents.executeJavaScript(
    'typeof (window.electronAPI && window.electronAPI.checkForUpdate)'
  )
  check('preload 暴露 electronAPI.checkForUpdate', apiType === 'function', apiType)

  const raw = await win.webContents.executeJavaScript(
    'window.electronAPI.checkForUpdate().then(r => JSON.stringify(r))'
  )
  let res = null
  try { res = JSON.parse(raw) } catch (e) { res = null }
  check('IPC 往返返回可序列化结果', !!res && typeof res.ok === 'boolean', raw && raw.slice(0, 160))
  check('主进程收到 platform', ['win32', 'linux', 'darwin'].includes(seenPlatform), String(seenPlatform))

  if (res && res.ok) {
    check('有网: 返回 latest.version', typeof res.latest.version === 'string', res.latest.version)
    check('有网: hasUpdate 为布尔', typeof res.hasUpdate === 'boolean', String(res.hasUpdate))
  } else if (res) {
    check('无网: 失败原因落在白名单内',
      ['timeout', 'network', 'http-403', 'http-404', 'http-500', 'bad-payload', 'feed-url-not-allowed'].includes(res.reason),
      String(res.reason))
  }

  const pass = results.filter(Boolean).length
  console.log(`\n${pass}/${results.length} 项通过`)
  win.destroy()
  app.exit(pass === results.length ? 0 : 1)
}).catch(err => {
  console.error('冒烟失败:', err)
  app.exit(1)
})
