const { contextBridge, ipcRenderer } = require('electron')

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  
  // 应用信息
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => process.platform,
  
  // 插件系统 API
  loadPlugin: (pluginId) => ipcRenderer.invoke('load-plugin', pluginId),
  unloadPlugin: (pluginId) => ipcRenderer.invoke('unload-plugin', pluginId),
  getInstalledPlugins: () => ipcRenderer.invoke('get-installed-plugins'),
  
  // 事件监听
  onPluginLoaded: (callback) => ipcRenderer.on('plugin-loaded', (event, data) => callback(data)),
  onPluginUnloaded: (callback) => ipcRenderer.on('plugin-unloaded', (event, data) => callback(data)),
  
  // 移除事件监听
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
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
