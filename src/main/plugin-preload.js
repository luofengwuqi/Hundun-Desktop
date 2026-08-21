/**
 * Hundun Lite - 插件预加载脚本
 * 
 * 在每个插件的 BrowserWindow 中运行
 * 为插件提供安全的 API 接口
 */

const { contextBridge, ipcRenderer } = require('electron')

// 暴露插件 API 给插件窗口
contextBridge.exposeInMainWorld('hundun', {
  // ========== 插件信息 ==========
  pluginId: null, // 会在窗口加载后注入
  manifest: null, // 会在窗口加载后注入

  // ========== 数据存储 API ==========
  storage: {
    /**
     * 获取存储的数据
     * @param {string} key - 键名
     * @param {*} defaultValue - 默认值
     * @returns {Promise<*>}
     */
    get: async (key, defaultValue = null) => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('plugin:getData', pluginId, key, defaultValue)
    },

    /**
     * 设置存储的数据
     * @param {string} key - 键名
     * @param {*} value - 值
     * @returns {Promise<boolean>}
     */
    set: async (key, value) => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('plugin:setData', pluginId, key, value)
    },

    /**
     * 删除存储的数据
     * @param {string} key - 键名
     * @returns {Promise<boolean>}
     */
    remove: async (key) => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('plugin:removeData', pluginId, key)
    },

    /**
     * 获取所有存储的数据
     * @returns {Promise<Object>}
     */
    getAll: async () => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('plugin:getAllData', pluginId)
    }
  },

  // ========== 通信 API ==========
  messaging: {
    /**
     * 发送消息到其他插件
     * @param {string} targetPluginId - 目标插件ID
     * @param {Object} message - 消息内容
     * @returns {Promise<boolean>}
     */
    sendTo: async (targetPluginId, message) => {
      return await ipcRenderer.invoke('plugin:sendMessage', targetPluginId, message)
    },

    /**
     * 广播消息给所有插件
     * @param {Object} message - 消息内容
     * @returns {Promise<boolean>}
     */
    broadcast: async (message) => {
      return await ipcRenderer.invoke('plugin:broadcast', message)
    },

    /**
     * 监听来自主程序或其他插件的消息
     * @param {Function} callback - 消息回调
     * @returns {Function} 取消监听的函数
     */
    onMessage: (callback) => {
      const handler = (event, message) => callback(message)
      ipcRenderer.on('plugin:message', handler)
      return () => ipcRenderer.removeListener('plugin:message', handler)
    },

    /**
     * 监听广播消息
     * @param {Function} callback - 消息回调
     * @returns {Function} 取消监听的函数
     */
    onBroadcast: (callback) => {
      const handler = (event, message) => callback(message)
      ipcRenderer.on('plugin:broadcast', handler)
      return () => ipcRenderer.removeListener('plugin:broadcast', handler)
    }
  },

  // ========== 插件信息 API ==========
  info: {
    /**
     * 获取当前插件信息
     * @returns {Promise<Object>}
     */
    get自身: async () => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('plugin:getInfo', pluginId)
    },

    /**
     * 获取所有已安装插件列表
     * @returns {Promise<Array>}
     */
    getInstalled: async () => {
      return await ipcRenderer.invoke('plugin:getInstalled')
    }
  },

  // ========== 窗口控制 API ==========
  window: {
    /**
     * 最小化插件窗口
     */
    minimize: async () => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('plugin:minimize', pluginId)
    },

    /**
     * 最大化/还原插件窗口
     */
    maximize: async () => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('plugin:maximize', pluginId)
    },

    /**
     * 关闭插件窗口
     */
    close: async () => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('plugin:close', pluginId)
    },

    /**
     * 设置窗口标题
     * @param {string} title - 标题
     */
    setTitle: (title) => {
      document.title = title
    }
  },

  // ========== 权限 API ==========
  permissions: {
    /**
     * 检查是否拥有某个权限
     * @param {string} permission - 权限名
     * @returns {Promise<boolean>}
     */
    check: async (permission) => {
      const pluginId = window.__PLUGIN_ID__
      return await ipcRenderer.invoke('plugin:requestPermission', pluginId, permission)
    }
  },

  // ========== 事件系统 ==========
  events: {
    /**
     * 监听插件执行命令
     * @param {Function} callback - 命令回调 (command, ...args)
     * @returns {Function} 取消监听的函数
     */
    onExecute: (callback) => {
      const handler = (event, command, ...args) => callback(command, ...args)
      ipcRenderer.on('plugin:execute', handler)
      return () => ipcRenderer.removeListener('plugin:execute', handler)
    }
  }
})

// 注入插件信息（会在窗口加载后被覆盖）
window.__PLUGIN_ID__ = null
window.__PLUGIN_MANIFEST__ = null
