/**
 * 音效设置链路冒烟测试 (2026-10-03 音量 Bug 修复回归)
 *
 * 运行: npx electron scripts/test-sound-settings.js  (退出码 0 = 全过)
 *
 * 覆盖:
 *  1. renderer → 主进程同步 (sound:sync) 与主进程镜像读取 (sound:get-sync / getSettings)
 *  2. 插件 preload hundun.sound.getSettings() 初值 = 母程序设置
 *  3. 插件直放音效 volume = 用户设置 (修复前硬编码 0.5)
 *  4. 静音后插件不创建/不播放 Audio, 也不触发 IPC 兜底
 *  5. 设置变更广播到插件窗口并即时生效
 *  6. 插件 → 主进程 → 主窗口 play-sound 转发链路 (calculator 等走此路)
 */
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { registerSoundSettingsIPC, getSettings } = require('../src/main/sound-settings')

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const results = []
const check = (name, cond, detail = '') => {
  results.push({ name, pass: !!cond })
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
}

app.whenReady().then(async () => {
  // 打印渲染进程错误, 方便定位 evaluate 报错
  const hookConsole = (tag) => (e, level, message, line, sourceId) => {
    if (level >= 3) console.log(`[${tag}:error] ${message} (${sourceId}:${line})`)
  }

  // 注册两次验证幂等
  registerSoundSettingsIPC()
  registerSoundSettingsIPC()

  let mainWindow = null

  // 模拟 plugin-manager.js 的 plugin:playSound 转发 (真实实现见该文件)
  ipcMain.handle('plugin:playSound', (event, soundName) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('play-sound', soundName)
    }
  })

  // ---------- 母程序窗口 (真 preload.js) ----------
  mainWindow = new BrowserWindow({
    width: 300, height: 200, show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, '../src/main/preload.js')
    }
  })
  mainWindow.webContents.on('console-message', hookConsole('main'))
  console.log('STEP: load main window')
  await mainWindow.loadFile(path.join(__dirname, 'test-sound-main.html'))
  console.log('STEP: main window init script')
  await mainWindow.webContents.executeJavaScript(`
    window.__received = []
    window.__unsub = window.electronAPI.onPlaySound(n => window.__received.push(n))
    window.electronAPI.syncSoundSettings({ soundEnabled: true, volume: 20 })
  `)
  await sleep(100)

  const mirrored = getSettings()
  check('1. 主进程镜像同步到 {volume:20}', mirrored.volume === 20 && mirrored.soundEnabled === true, JSON.stringify(mirrored))

  // ---------- 插件窗口 (真 plugin-preload.js + fast-txt sdk.js) ----------
  const pluginWin = new BrowserWindow({
    width: 300, height: 200, show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      preload: path.join(__dirname, '../src/main/plugin-preload.js')
    }
  })
  pluginWin.webContents.on('console-message', hookConsole('plugin'))
  console.log('STEP: load plugin window')
  await pluginWin.loadFile(path.join(__dirname, 'test-sound-plugin.html'))
  console.log('STEP: plugin window loaded')

  const s1 = await pluginWin.webContents.executeJavaScript(`window.hundun.sound.getSettings()`)
  check('2. 插件读取到母程序设置 volume=20', s1 && s1.volume === 20 && s1.soundEnabled === true, JSON.stringify(s1))

  // 直放音量跟随设置 (测试页位于 scripts/, sounds 路径不存在 → play 失败 → IPC 兜底)
  await pluginWin.webContents.executeJavaScript(`playSound('click'); 'ok'`)
  await sleep(400)
  const v1 = await pluginWin.webContents.executeJavaScript(
    `_pluginAudioCache && _pluginAudioCache.click ? _pluginAudioCache.click.volume : null`)
  check('3. 插件直放音量 = 0.2 (不再硬编码 0.5)', v1 !== null && Math.abs(v1 - 0.2) < 1e-9, 'volume=' + v1)

  const recv1 = await mainWindow.webContents.executeJavaScript(`window.__received.slice()`)
  check('3b. 播放失败自动兜底 IPC → 主窗口', recv1.includes('click'), JSON.stringify(recv1))

  // 静音
  await mainWindow.webContents.executeJavaScript(`window.electronAPI.syncSoundSettings({ soundEnabled: false, volume: 20 })`)
  await sleep(100)
  const s2 = await pluginWin.webContents.executeJavaScript(`window.hundun.sound.getSettings()`)
  check('4. 变更广播到达插件窗口 (soundEnabled=false)', s2 && s2.soundEnabled === false, JSON.stringify(s2))

  await pluginWin.webContents.executeJavaScript(`playSound('OK'); 'ok'`)
  await sleep(300)
  const v2 = await pluginWin.webContents.executeJavaScript(
    `_pluginAudioCache && _pluginAudioCache.OK ? _pluginAudioCache.OK.volume : undefined`)
  check('4b. 静音时不创建/不播放 Audio', typeof v2 === 'undefined', 'cache.OK=' + String(v2))
  const recv2 = await mainWindow.webContents.executeJavaScript(`window.__received.slice()`)
  check('4c. 静音时不触发 IPC 兜底', !recv2.includes('OK'), JSON.stringify(recv2))

  // 恢复并改为 5%
  await mainWindow.webContents.executeJavaScript(`window.electronAPI.syncSoundSettings({ soundEnabled: true, volume: 5 })`)
  await sleep(100)
  await pluginWin.webContents.executeJavaScript(`playSound('click'); 'ok'`)
  await sleep(400)
  const v3 = await pluginWin.webContents.executeJavaScript(`_pluginAudioCache.click.volume`)
  check('5. 音量修改后立即生效 (0.05)', Math.abs(v3 - 0.05) < 1e-9, 'volume=' + v3)

  // IPC 转发链路 (calculator 走此路)
  await pluginWin.webContents.executeJavaScript(`window.hundun.host.playSound('change'); 'ok'`)
  await sleep(300)
  const recv3 = await mainWindow.webContents.executeJavaScript(`window.__received.slice()`)
  check('6. host.playSound → 主进程 → 主窗口', recv3.includes('change'), JSON.stringify(recv3))

  const failed = results.filter(r => !r.pass)
  console.log(`\n结果: ${results.length - failed.length}/${results.length} 通过`)
  app.exit(failed.length ? 1 : 0)
}).catch(e => {
  console.error(e)
  app.exit(1)
})
