/**
 * Hundun Lite - 插件开发 SDK
 * 
 * 提供给插件开发者使用的工具和 API
 * 插件可以在其 HTML/JS 中引入此 SDK
 */

/**
 * 插件 SDK 类
 * 提供插件开发所需的工具方法
 */
class PluginSDK {
  constructor() {
    this._pluginId = null
    this._manifest = null
    this._ready = false
    this._eventListeners = new Map()
  }

  /**
   * 初始化 SDK
   * 在插件窗口加载完成后调用
   */
  async init() {
    // 等待 window.__PLUGIN_ID__ 被注入
    await this._waitForPluginId()
    
    this._pluginId = window.__PLUGIN_ID__
    this._manifest = window.__PLUGIN_MANIFEST__
    this._ready = true
    
    console.log(`[PluginSDK] Initialized for plugin: ${this._pluginId}`)
    
    // 触发 ready 事件
    this._emit('ready', { pluginId: this._pluginId })
    
    return this
  }

  /**
   * 等待插件ID被注入
   */
  _waitForPluginId() {
    return new Promise((resolve) => {
      if (window.__PLUGIN_ID__) {
        resolve()
        return
      }
      
      const check = () => {
        if (window.__PLUGIN_ID__) {
          resolve()
        } else {
          setTimeout(check, 10)
        }
      }
      check()
    })
  }

  /**
   * 获取插件ID
   */
  get pluginId() {
    return this._pluginId
  }

  /**
   * 获取插件 manifest
   */
  get manifest() {
    return this._manifest
  }

  /**
   * 检查 SDK 是否就绪
   */
  get isReady() {
    return this._ready
  }

  // ========== 存储 API ==========

  /**
   * 存储管理器
   */
  storage = {
    /**
     * 获取存储的数据
     * @param {string} key - 键名
     * @param {*} defaultValue - 默认值
     * @returns {Promise<*>}
     */
    get: async (key, defaultValue = null) => {
      this._checkReady()
      return await window.hundun.storage.get(key, defaultValue)
    },

    /**
     * 设置存储的数据
     * @param {string} key - 键名
     * @param {*} value - 值
     * @returns {Promise<boolean>}
     */
    set: async (key, value) => {
      this._checkReady()
      return await window.hundun.storage.set(key, value)
    },

    /**
     * 删除存储的数据
     * @param {string} key - 键名
     * @returns {Promise<boolean>}
     */
    remove: async (key) => {
      this._checkReady()
      return await window.hundun.storage.remove(key)
    },

    /**
     * 获取所有存储的数据
     * @returns {Promise<Object>}
     */
    getAll: async () => {
      this._checkReady()
      return await window.hundun.storage.getAll()
    }
  }

  // ========== 消息 API ==========

  /**
   * 消息管理器
   */
  messaging = {
    /**
     * 发送消息到其他插件
     * @param {string} targetPluginId - 目标插件ID
     * @param {Object} message - 消息内容
     * @returns {Promise<boolean>}
     */
    sendTo: async (targetPluginId, message) => {
      this._checkReady()
      return await window.hundun.messaging.sendTo(targetPluginId, message)
    },

    /**
     * 广播消息给所有插件
     * @param {Object} message - 消息内容
     * @returns {Promise<boolean>}
     */
    broadcast: async (message) => {
      this._checkReady()
      return await window.hundun.messaging.broadcast(message)
    },

    /**
     * 监听消息
     * @param {Function} callback - 消息回调
     * @returns {Function} 取消监听的函数
     */
    onMessage: (callback) => {
      this._checkReady()
      return window.hundun.messaging.onMessage(callback)
    },

    /**
     * 监听广播消息
     * @param {Function} callback - 消息回调
     * @returns {Function} 取消监听的函数
     */
    onBroadcast: (callback) => {
      this._checkReady()
      return window.hundun.messaging.onBroadcast(callback)
    }
  }

  // ========== 窗口 API ==========

  /**
   * 窗口管理器
   */
  window = {
    /**
     * 最小化窗口
     */
    minimize: async () => {
      this._checkReady()
      return await window.hundun.window.minimize()
    },

    /**
     * 最大化/还原窗口
     */
    maximize: async () => {
      this._checkReady()
      return await window.hundun.window.maximize()
    },

    /**
     * 关闭窗口
     */
    close: async () => {
      this._checkReady()
      return await window.hundun.window.close()
    },

    /**
     * 设置窗口标题
     * @param {string} title - 标题
     */
    setTitle: (title) => {
      document.title = title
    },

    /**
     * 获取窗口尺寸
     */
    getSize: () => {
      return {
        width: window.innerWidth,
        height: window.innerHeight
      }
    },

    /**
     * 监听窗口大小变化
     * @param {Function} callback - 回调函数
     */
    onResize: (callback) => {
      window.addEventListener('resize', () => {
        callback(this.getSize())
      })
    }
  }

  // ========== UI API ==========

  /**
   * UI 工具
   */
  ui = {
    /**
     * 显示通知
     * @param {string} message - 通知内容
     * @param {string} type - 类型：'info' | 'success' | 'warning' | 'error'
     */
    notify: (message, type = 'info') => {
      // 创建通知元素
      const notification = document.createElement('div')
      notification.className = `hundun-notification hundun-notification-${type}`
      notification.textContent = message
      
      // 添加样式
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        color: white;
        z-index: 10000;
        animation: hundun-slide-in 0.3s ease-out;
      `
      
      // 根据类型设置背景色
      const colors = {
        info: '#00d4ff',
        success: '#00ff88',
        warning: '#ffaa00',
        error: '#ff0080'
      }
      notification.style.backgroundColor = colors[type] || colors.info
      
      // 添加到页面
      document.body.appendChild(notification)
      
      // 3秒后移除
      setTimeout(() => {
        notification.style.animation = 'hundun-slide-out 0.3s ease-out'
        setTimeout(() => notification.remove(), 300)
      }, 3000)
    },

    /**
     * 显示确认对话框
     * @param {string} message - 确认内容
     * @returns {Promise<boolean>}
     */
    confirm: (message) => {
      return new Promise((resolve) => {
        resolve(window.confirm(message))
      })
    },

    /**
     * 显示提示对话框
     * @param {string} message - 提示内容
     * @param {string} defaultValue - 默认值
     * @returns {Promise<string|null>}
     */
    prompt: (message, defaultValue = '') => {
      return new Promise((resolve) => {
        resolve(window.prompt(message, defaultValue))
      })
    }
  }

  // ========== 工具 API ==========

  /**
   * 工具方法
   */
  utils = {
    /**
     * 延迟执行
     * @param {number} ms - 毫秒数
     */
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    /**
     * 生成唯一ID
     */
    generateId: () => {
      return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    },

    /**
     * 深拷贝对象
     */
    deepClone: (obj) => {
      return JSON.parse(JSON.stringify(obj))
    },

    /**
     * 格式化日期
     */
    formatDate: (date, format = 'YYYY-MM-DD HH:mm:ss') => {
      const d = new Date(date)
      const map = {
        'YYYY': d.getFullYear(),
        'MM': String(d.getMonth() + 1).padStart(2, '0'),
        'DD': String(d.getDate()).padStart(2, '0'),
        'HH': String(d.getHours()).padStart(2, '0'),
        'mm': String(d.getMinutes()).padStart(2, '0'),
        'ss': String(d.getSeconds()).padStart(2, '0')
      }
      return format.replace(/YYYY|MM|DD|HH|mm|ss/g, match => map[match])
    }
  }

  // ========== 事件 API ==========

  /**
   * 监听事件
   * @param {string} event - 事件名
   * @param {Function} callback - 回调函数
   */
  on(event, callback) {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, [])
    }
    this._eventListeners.get(event).push(callback)
  }

  /**
   * 移除事件监听
   * @param {string} event - 事件名
   * @param {Function} callback - 回调函数
   */
  off(event, callback) {
    const listeners = this._eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  /**
   * 触发事件
   * @param {string} event - 事件名
   * @param {Object} data - 事件数据
   */
  _emit(event, data) {
    const listeners = this._eventListeners.get(event)
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(data)
        } catch (error) {
          console.error(`[PluginSDK] Event error:`, error)
        }
      }
    }
  }

  /**
   * 检查 SDK 是否就绪
   */
  _checkReady() {
    if (!this._ready) {
      throw new Error('PluginSDK not initialized. Call init() first.')
    }
  }
}

// 全局单例
let sdkInstance = null

/**
 * 获取 PluginSDK 实例
 * @returns {PluginSDK}
 */
function getPluginSDK() {
  if (!sdkInstance) {
    sdkInstance = new PluginSDK()
  }
  return sdkInstance
}

// 自动初始化（如果在插件窗口中）
if (typeof window !== 'undefined') {
  // 暴露到全局
  window.HundunSDK = getPluginSDK()
  
  // 页面加载完成后自动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.HundunSDK.init()
    })
  } else {
    window.HundunSDK.init()
  }
}

module.exports = { PluginSDK, getPluginSDK }
