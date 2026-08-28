/**
 * Hundun Lite - 插件预加载脚本
 * 
 * 在每个插件的 BrowserWindow 中运行
 * 为插件提供安全的 API 接口
 * 
 * 注意：contextIsolation: false，直接挂载到 window 上
 */

const { ipcRenderer } = require('electron')

// 暴露插件 API 给插件窗口
window.hundun = {
  // ========== 插件信息 ==========
  pluginId: null, // 会在窗口加载后注入
  manifest: null, // 会在窗口加载后注入

  // ========== 数据存储 API ==========
  storage: {
    get: async (key, defaultValue = null) => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('plugin:getData', pluginId, key, defaultValue)
    },
    set: async (key, value) => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('plugin:setData', pluginId, key, value)
    },
    remove: async (key) => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('plugin:removeData', pluginId, key)
    },
    getAll: async () => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('plugin:getAllData', pluginId)
    }
  },

  // ========== 通信 API ==========
  messaging: {
    sendTo: async (targetPluginId, message) => {
      return await ipcRenderer.invoke('plugin:sendMessage', targetPluginId, message)
    },
    broadcast: async (message) => {
      return await ipcRenderer.invoke('plugin:broadcast', message)
    },
    onMessage: (callback) => {
      const handler = (event, message) => callback(message)
      ipcRenderer.on('plugin:message', handler)
      return () => ipcRenderer.removeListener('plugin:message', handler)
    },
    onBroadcast: (callback) => {
      const handler = (event, message) => callback(message)
      ipcRenderer.on('plugin:broadcast', handler)
      return () => ipcRenderer.removeListener('plugin:broadcast', handler)
    }
  },

  // ========== 插件信息 API ==========
  info: {
    getSelf: async () => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('plugin:getInfo', pluginId)
    },
    getInstalled: async () => {
      return await ipcRenderer.invoke('plugin:getInstalled')
    }
  },

  // ========== 窗口控制 API ==========
  window: {
    minimize: async () => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('plugin:minimize', pluginId)
    },
    maximize: async () => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('plugin:maximize', pluginId)
    },
    close: async () => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('plugin:close', pluginId)
    },
    setTitle: (title) => {
      document.title = title
    }
  },

  // ========== 权限 API ==========
  permissions: {
    check: async (permission) => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('plugin:requestPermission', pluginId, permission)
    }
  },

  // ========== 宿主 API ==========
  host: {
    returnToParent: async () => {
      return await ipcRenderer.invoke('plugin-manager:returnToParent')
    },
    getTheme: async () => {
      return new Promise((resolve) => {
        ipcRenderer.send('theme:get-request')
        ipcRenderer.once('theme:get-response', (event, theme) => {
          resolve(theme)
        })
      })
    },
    onThemeChange: (callback) => {
      const handler = (event, theme) => callback(theme)
      ipcRenderer.on('theme-changed', handler)
      return () => ipcRenderer.removeListener('theme-changed', handler)
    },
    playSound: async (soundName) => {
      return await ipcRenderer.invoke('plugin:playSound', soundName)
    },
    notify: (message, type = 'info') => {
      ipcRenderer.send('plugin:notify', { message, type })
    }
  },

  // ========== 事件系统 ==========
  events: {
    onExecute: (callback) => {
      const handler = (event, command, ...args) => callback(command, ...args)
      ipcRenderer.on('plugin:execute', handler)
      return () => ipcRenderer.removeListener('plugin:execute', handler)
    }
  }
}

// 注入插件信息（会在窗口 did-finish-load 后被 executeJavaScript 覆盖）
window.__PLUGIN_ID__ = null
window.__PLUGIN_MANIFEST__ = null
