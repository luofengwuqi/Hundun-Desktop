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

  // ========== 文件系统 API (FastTXT 等插件使用) ==========
  fs: {
      /**
     * 获取插件数据目录的基础路径
     * @returns {Promise<string>} 如 E:\code2\huntunLite\plugins\fast-txt
     */
    getBasePath: async () => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('fasttxt:getBasePath', pluginId)
    },

    /**
     * 列出目录中的文件和子目录
     * @param {string} dirPath - 相对于 base 的路径，或空字符串表示根目录
     * @returns {Promise<Array>} [{name, isDirectory, mtime, size}]
     */
    readDir: async (dirPath = '') => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('fasttxt:readDir', pluginId, dirPath)
    },

    /**
     * 读取文件内容
     * @param {string} filePath - 相对于 base 的路径
     * @returns {Promise<string|null>} 文件内容，失败返回 null
     */
    readFile: async (filePath) => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('fasttxt:readFile', pluginId, filePath)
    },

    /**
     * 写入文件内容（不存在则创建）
     * @param {string} filePath - 相对于 base 的路径
     * @param {string} content - 文件内容
     * @returns {Promise<boolean>}
     */
    writeFile: async (filePath, content) => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('fasttxt:writeFile', pluginId, filePath, content)
    },

    /**
     * 删除文件
     * @param {string} filePath - 相对于 base 的路径
     * @returns {Promise<boolean>}
     */
    deleteFile: async (filePath) => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('fasttxt:deleteFile', pluginId, filePath)
    },

    /**
     * 创建目录（递归创建）
     * @param {string} dirPath - 相对于 base 的路径
     * @returns {Promise<boolean>}
     */
    mkdir: async (dirPath) => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('fasttxt:mkdir', pluginId, dirPath)
    },

    /**
     * 重命名/移动文件
     * @param {string} oldPath - 旧路径
     * @param {string} newPath - 新路径
     * @returns {Promise<boolean>}
     */
    rename: async (oldPath, newPath) => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('fasttxt:rename', pluginId, oldPath, newPath)
    },

    /**
     * 检查文件/目录是否存在
     * @param {string} filePath - 相对于 base 的路径
     * @returns {Promise<boolean>}
     */
    exists: async (filePath) => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('fasttxt:exists', pluginId, filePath)
    },

    /**
     * 获取文件信息
     * @param {string} filePath - 相对于 base 的路径
     * @returns {Promise<Object|null>} {size, mtime, isDirectory}
     */
    stat: async (filePath) => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('fasttxt:stat', pluginId, filePath)
    },

    /**
     * 用系统文件管理器打开当前目录
     */
    openInExplorer: async () => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('fasttxt:openInExplorer', pluginId)
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
