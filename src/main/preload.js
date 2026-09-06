const { contextBridge, ipcRenderer } = require('electron')

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // ========== 窗口控制 ==========
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  windowResize: (width, height) => ipcRenderer.send('window-resize', { width, height }),
  
  // ========== 应用信息 ==========
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  getPlatform: () => process.platform,
  
  // ========== 插件系统 API ==========
  
  // 插件生命周期
  loadPlugin: (pluginId) => ipcRenderer.invoke('plugin-manager:load', pluginId),
  startPlugin: (pluginId, options) => ipcRenderer.invoke('plugin-manager:start', pluginId, options),
  stopPlugin: (pluginId) => ipcRenderer.invoke('plugin-manager:stop', pluginId),
  suspendPlugin: (pluginId) => ipcRenderer.invoke('plugin-manager:suspend', pluginId),
  resumePlugin: (pluginId) => ipcRenderer.invoke('plugin-manager:resume', pluginId),
  unloadPlugin: (pluginId) => ipcRenderer.invoke('plugin-manager:unload', pluginId),
  
  // 插件查询
  scanPlugins: () => ipcRenderer.invoke('plugin-manager:scan'),
  scanAllPlugins: () => ipcRenderer.invoke('plugin-manager:scanAll'),
  getInstalledPlugins: () => ipcRenderer.invoke('plugin-manager:getInstalled'),
  isPluginRunning: (pluginId) => ipcRenderer.invoke('plugin-manager:isRunning', pluginId),
  getRunningPlugins: () => ipcRenderer.invoke('plugin-manager:getRunning'),
  getActivePlugin: () => ipcRenderer.invoke('plugin-manager:getActive'),
  
  // 插件启动（带过渡动画）
  launchPlugin: (pluginId, options) => ipcRenderer.invoke('plugin-manager:launch', pluginId, options),
  returnToParent: () => ipcRenderer.invoke('plugin-manager:returnToParent'),
  
  // 主题系统
  requestTheme: () => ipcRenderer.send('theme:get-request'),
  onThemeResponse: (callback) => {
    const handler = (event, theme) => callback(theme)
    ipcRenderer.on('theme:get-response', handler)
    return () => ipcRenderer.removeListener('theme:get-response', handler)
  },
  onThemeChanged: (callback) => {
    const handler = (event, theme) => callback(theme)
    ipcRenderer.on('theme-changed', handler)
    return () => ipcRenderer.removeListener('theme-changed', handler)
  },
  
  // 插件数据存储
  getPluginData: (pluginId, key, defaultValue) => ipcRenderer.invoke('plugin:getData', pluginId, key, defaultValue),
  setPluginData: (pluginId, key, value) => ipcRenderer.invoke('plugin:setData', pluginId, key, value),
  removePluginData: (pluginId, key) => ipcRenderer.invoke('plugin:removeData', pluginId, key),
  getAllPluginData: (pluginId) => ipcRenderer.invoke('plugin:getAllData', pluginId),
  
  // 插件通信
  sendToPlugin: (targetPluginId, message) => ipcRenderer.invoke('plugin:sendMessage', targetPluginId, message),
  broadcastToPlugins: (message) => ipcRenderer.invoke('plugin:broadcast', message),
  
  // 插件窗口控制
  closePlugin: (pluginId) => ipcRenderer.invoke('plugin:close', pluginId),
  minimizePlugin: (pluginId) => ipcRenderer.invoke('plugin:minimize', pluginId),
  maximizePlugin: (pluginId) => ipcRenderer.invoke('plugin:maximize', pluginId),
  
  // 插件权限
  checkPluginPermission: (pluginId, permission) => ipcRenderer.invoke('plugin:requestPermission', pluginId, permission),
  
  // ========== 事件监听 ==========
  
  // 插件生命周期事件
  onPluginLoaded: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('plugin-loaded', handler)
    return () => ipcRenderer.removeListener('plugin-loaded', handler)
  },
  
  onPluginStarted: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('plugin-started', handler)
    return () => ipcRenderer.removeListener('plugin-started', handler)
  },
  
  onPluginClosed: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('plugin-closed', handler)
    return () => ipcRenderer.removeListener('plugin-closed', handler)
  },
  
  onPluginUnloaded: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('plugin-unloaded', handler)
    return () => ipcRenderer.removeListener('plugin-unloaded', handler)
  },
  
  onPluginError: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('plugin-error', handler)
    return () => ipcRenderer.removeListener('plugin-error', handler)
  },
  
  // 插件消息事件
  onPluginMessage: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('plugin:message', handler)
    return () => ipcRenderer.removeListener('plugin:message', handler)
  },
  
  onPluginBroadcast: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('plugin:broadcast', handler)
    return () => ipcRenderer.removeListener('plugin:broadcast', handler)
  },
  
  // 移除所有监听器
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // 监听插件音效播放
  onPlaySound: (callback) => {
    const handler = (event, soundName) => callback(soundName)
    ipcRenderer.on('play-sound', handler)
    return () => ipcRenderer.removeListener('play-sound', handler)
  }
})

// 直接监听 play-sound 并播放音效（插件窗口用）
const _audioCache = {}
const _soundFiles = {
  click: 'sounds/click.mp3', change: 'sounds/change.mp3',
  OK: 'sounds/OK.mp3', exit: 'sounds/exit.mp3', error: 'sounds/error.mp3',
  bengbeng: 'sounds/bengbeng.mp3', loading: 'sounds/loading.mp3',
  home: 'sounds/home.mp3', setting: 'sounds/setting.mp3'
}
ipcRenderer.on('play-sound', (event, soundName) => {
  try {
    const src = _soundFiles[soundName]
    if (!src) return
    if (!_audioCache[soundName]) {
      _audioCache[soundName] = new Audio(src)
    }
    const audio = _audioCache[soundName]
    audio.currentTime = 0
    audio.volume = 0.5
    audio.play().catch(() => {})
  } catch (e) {}
})

// 暴露 Node.js 环境信息
contextBridge.exposeInMainWorld('nodeInfo', {
  platform: process.platform,
  arch: process.arch,
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
    chrome: process.versions.chrome
  }
})
