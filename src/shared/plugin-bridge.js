/**
 * HundunDesktop - 插件通信桥接
 * 
 * 提供给渲染进程使用的插件通信接口
 * 通过 IPC 与主进程的 PluginManager 通信
 */

class PluginBridge {
  constructor() {
    this._callbacks = new Map()
    this._initialized = false
  }

  /**
   * 初始化桥接（检查 electronAPI 是否可用）
   */
  _init() {
    if (this._initialized) return
    
    if (window.electronAPI) {
      this._initialized = true
    } else {
      console.warn('[PluginBridge] electronAPI not available, using fallback mode')
    }
  }

  /**
   * 获取插件存储数据
   * @param {string} pluginId - 插件ID
   * @param {string} key - 键名
   * @param {*} defaultValue - 默认值
   * @returns {Promise<*>}
   */
  async getData(pluginId, key, defaultValue = null) {
    this._init()
    if (this._initialized) {
      return await window.electronAPI.invoke('plugin:getData', pluginId, key, defaultValue)
    }
    return defaultValue
  }

  /**
   * 设置插件存储数据
   * @param {string} pluginId - 插件ID
   * @param {string} key - 键名
   * @param {*} value - 值
   * @returns {Promise<boolean>}
   */
  async setData(pluginId, key, value) {
    this._init()
    if (this._initialized) {
      return await window.electronAPI.invoke('plugin:setData', pluginId, key, value)
    }
    return false
  }

  /**
   * 发送消息到插件
   * @param {string} pluginId - 目标插件ID
   * @param {Object} message - 消息内容
   * @returns {Promise<boolean>}
   */
  async sendMessage(pluginId, message) {
    this._init()
    if (this._initialized) {
      return await window.electronAPI.invoke('plugin:sendMessage', pluginId, message)
    }
    return false
  }

  /**
   * 广播消息给所有插件
   * @param {Object} message - 消息内容
   * @returns {Promise<boolean>}
   */
  async broadcast(message) {
    this._init()
    if (this._initialized) {
      return await window.electronAPI.invoke('plugin:broadcast', message)
    }
    return false
  }

  /**
   * 获取所有已安装插件
   * @returns {Promise<Array>}
   */
  async getInstalledPlugins() {
    this._init()
    if (this._initialized) {
      return await window.electronAPI.invoke('plugin:getInstalled')
    }
    return []
  }

  /**
   * 获取插件信息
   * @param {string} pluginId - 插件ID
   * @returns {Promise<Object>}
   */
  async getPluginInfo(pluginId) {
    this._init()
    if (this._initialized) {
      return await window.electronAPI.invoke('plugin:getInfo', pluginId)
    }
    return null
  }

  /**
   * 监听插件消息
   * @param {Function} callback - 消息回调 (pluginId, message)
   * @returns {Function} 取消监听的函数
   */
  onPluginMessage(callback) {
    this._init()
    if (this._initialized && window.electronAPI) {
      const handler = (event, data) => callback(data.pluginId, data.message)
      window.electronAPI.onPluginLoaded(handler)
      return () => {
        // 清理监听器
      }
    }
    return () => {}
  }

  /**
   * 监听插件加载事件
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消监听的函数
   */
  onPluginLoaded(callback) {
    this._init()
    if (this._initialized && window.electronAPI) {
      window.electronAPI.onPluginLoaded(callback)
      return () => {
        // 清理监听器
      }
    }
    return () => {}
  }

  /**
   * 监听插件卸载事件
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消监听的函数
   */
  onPluginUnloaded(callback) {
    this._init()
    if (this._initialized && window.electronAPI) {
      window.electronAPI.onPluginUnloaded(callback)
      return () => {
        // 清理监听器
      }
    }
    return () => {}
  }
}

// 单例模式
const pluginBridge = new PluginBridge()

module.exports = pluginBridge
