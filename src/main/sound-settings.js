/**
 * Hundun Lite - 音效设置 (主进程侧)
 *
 * 职责: 音效设置在主进程的"运行期镜像" + 跨窗口广播
 *
 * 数据流 (单一数据源 = 母程序 renderer 的 localStorage, 见 src/renderer/utils/sound-settings.js):
 *   1. 母程序启动 / 设置页保存 → renderer 调用 electronAPI.syncSoundSettings()
 *      → ipc `sound:sync` → 本模块 normalize 后写入内存缓存
 *   2. 缓存更新后广播 `sound:settings-changed` 给所有窗口 (主窗口 + 运行中的插件窗口)
 *   3. 插件窗口 preload (plugin-preload.js) 启动时 sendSync('sound:get-sync') 取初值,
 *      并监听 `sound:settings-changed` 更新本地缓存 → 插件直放音效按此设置音量
 *
 * 背景 (Bug 修复 2026-10-03): 插件直放音效曾硬编码 volume=0.5, 完全无视用户的
 * 音量滑块与静音开关 —— 用户调低音量后"进入子程序声音特别大", 静音也被绕过。
 * 修复后所有播放链路 (母程序 / IPC 转发 / 插件直放) 都以本模块镜像的设置为准。
 *
 * 注意: 本模块只做运行期镜像, 不做持久化 (持久化仍由 localStorage 负责),
 *       主进程重启后由 renderer 启动时重新推送。
 */
const { ipcMain, BrowserWindow } = require('electron')

const DEFAULT_SETTINGS = Object.freeze({ soundEnabled: true, volume: 50 })

// 运行期内存镜像
let cached = { ...DEFAULT_SETTINGS }
let registered = false

// 与 src/renderer/utils/sound-settings.js 相同的校验规则
const normalize = (raw) => {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS }
  const volume = Number(raw.volume)
  return {
    soundEnabled: raw.soundEnabled !== false,
    volume: Number.isFinite(volume)
      ? Math.max(0, Math.min(100, volume))
      : DEFAULT_SETTINGS.volume
  }
}

// 获取当前设置 (副本)
const getSettings = () => ({ ...cached })

// 广播给所有窗口 (主窗口收到可忽略, 插件窗口用于刷新直放音量)
const broadcast = () => {
  const payload = { ...cached }
  for (const win of BrowserWindow.getAllWindows()) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('sound:settings-changed', payload)
    }
  }
}

// 注册 IPC (幂等)
const registerSoundSettingsIPC = () => {
  if (registered) return
  registered = true

  // 渲染进程推送设置 (启动时一次 + 每次保存)
  ipcMain.on('sound:sync', (event, settings) => {
    cached = normalize(settings)
    broadcast()
  })

  // 同步读取 (插件窗口 preload 初始化时 sendSync 使用)
  ipcMain.on('sound:get-sync', (event) => {
    event.returnValue = { ...cached }
  })

  // 异步读取 (备用)
  ipcMain.handle('sound:get', () => getSettings())
}

module.exports = {
  registerSoundSettingsIPC,
  getSettings,
  DEFAULT_SETTINGS
}
