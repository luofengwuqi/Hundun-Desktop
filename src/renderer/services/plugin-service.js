/**
 * Hundun Lite - 渲染进程插件服务
 * 
 * 提供给 Vue 组件使用的插件系统接口
 * 封装了与主进程 PluginManager 的通信
 */

import { ref, computed, readonly } from 'vue'

// 插件状态枚举
export const PluginState = {
  UNLOADED: 'unloaded',
  LOADED: 'loaded',
  RUNNING: 'running',
  SUSPENDED: 'suspended',
  ERROR: 'error'
}

// 插件服务类
class PluginService {
  constructor() {
    this._plugins = ref([])
    this._runningPlugins = ref([])
    this._initialized = ref(false)
    this._listeners = new Map()
  }

  /**
   * 计算属性：所有插件列表
   */
  get plugins() {
    return readonly(this._plugins)
  }

  /**
   * 计算属性：运行中的插件列表
   */
  get runningPlugins() {
    return readonly(this._runningPlugins)
  }

  /**
   * 计算属性：是否已初始化
   */
  get initialized() {
    return readonly(this._initialized)
  }

  /**
   * 初始化插件服务
   */
  async init() {
    if (this._initialized.value) return

    try {
      // 扫描所有可用插件
      await this.scanPlugins()
      
      // 设置事件监听
      this._setupEventListeners()
      
      this._initialized.value = true
      console.log('[PluginService] Initialized')
    } catch (error) {
      console.error('[PluginService] Failed to initialize:', error)
    }
  }

  /**
   * 扫描所有可用插件
   */
  async scanPlugins() {
    try {
      const result = await window.electronAPI.scanPlugins()
      if (result.success) {
        this._plugins.value = result.plugins || []
      }
    } catch (error) {
      console.error('[PluginService] Failed to scan plugins:', error)
    }
  }

  /**
   * 刷新运行中的插件列表
   */
  async refreshRunningPlugins() {
    try {
      const result = await window.electronAPI.getRunningPlugins()
      if (result.success !== false) {
        this._runningPlugins.value = result || []
      }
    } catch (error) {
      console.error('[PluginService] Failed to get running plugins:', error)
    }
  }

  /**
   * 设置事件监听
   */
  _setupEventListeners() {
    // 插件加载事件
    window.electronAPI.onPluginLoaded((data) => {
      console.log('[PluginService] Plugin loaded:', data.pluginId)
      this.scanPlugins() // 刷新插件列表
      this._emit('loaded', data)
    })

    // 插件启动事件
    window.electronAPI.onPluginStarted((data) => {
      console.log('[PluginService] Plugin started:', data.pluginId)
      this.refreshRunningPlugins()
      this._emit('started', data)
    })

    // 插件关闭事件
    window.electronAPI.onPluginClosed((data) => {
      console.log('[PluginService] Plugin closed:', data.pluginId)
      this.refreshRunningPlugins()
      this._emit('closed', data)
    })

    // 插件卸载事件
    window.electronAPI.onPluginUnloaded((data) => {
      console.log('[PluginService] Plugin unloaded:', data.pluginId)
      this.scanPlugins()
      this.refreshRunningPlugins()
      this._emit('unloaded', data)
    })

    // 插件错误事件
    window.electronAPI.onPluginError((data) => {
      console.error('[PluginService] Plugin error:', data)
      this._emit('error', data)
    })

    // 插件消息事件
    window.electronAPI.onPluginMessage((data) => {
      this._emit('message', data)
    })

    // 初始刷新运行中的插件
    this.refreshRunningPlugins()
  }

  /**
   * 加载插件
   * @param {string} pluginId - 插件ID
   * @returns {Object} 插件信息
   */
  async loadPlugin(pluginId) {
    try {
      const result = await window.electronAPI.loadPlugin(pluginId)
      return result
    } catch (error) {
      console.error(`[PluginService] Failed to load plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * 启动插件
   * @param {string} pluginId - 插件ID
   * @param {Object} options - 启动选项
   */
  async startPlugin(pluginId, options = {}) {
    try {
      const result = await window.electronAPI.startPlugin(pluginId, options)
      if (result.success) {
        await this.refreshRunningPlugins()
      }
      return result
    } catch (error) {
      console.error(`[PluginService] Failed to start plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * 停止插件
   * @param {string} pluginId - 插件ID
   */
  async stopPlugin(pluginId) {
    try {
      const result = await window.electronAPI.stopPlugin(pluginId)
      if (result.success) {
        await this.refreshRunningPlugins()
      }
      return result
    } catch (error) {
      console.error(`[PluginService] Failed to stop plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * 暂停插件
   * @param {string} pluginId - 插件ID
   */
  async suspendPlugin(pluginId) {
    try {
      return await window.electronAPI.suspendPlugin(pluginId)
    } catch (error) {
      console.error(`[PluginService] Failed to suspend plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * 恢复插件
   * @param {string} pluginId - 插件ID
   */
  async resumePlugin(pluginId) {
    try {
      return await window.electronAPI.resumePlugin(pluginId)
    } catch (error) {
      console.error(`[PluginService] Failed to resume plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * 卸载插件
   * @param {string} pluginId - 插件ID
   */
  async unloadPlugin(pluginId) {
    try {
      return await window.electronAPI.unloadPlugin(pluginId)
    } catch (error) {
      console.error(`[PluginService] Failed to unload plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * 获取插件数据
   * @param {string} pluginId - 插件ID
   * @param {string} key - 键名
   * @param {*} defaultValue - 默认值
   * @returns {Promise<*>}
   */
  async getData(pluginId, key, defaultValue = null) {
    try {
      return await window.electronAPI.getPluginData(pluginId, key, defaultValue)
    } catch (error) {
      console.error(`[PluginService] Failed to get data:`, error)
      return defaultValue
    }
  }

  /**
   * 设置插件数据
   * @param {string} pluginId - 插件ID
   * @param {string} key - 键名
   * @param {*} value - 值
   * @returns {Promise<boolean>}
   */
  async setData(pluginId, key, value) {
    try {
      return await window.electronAPI.setPluginData(pluginId, key, value)
    } catch (error) {
      console.error(`[PluginService] Failed to set data:`, error)
      return false
    }
  }

  /**
   * 发送消息到插件
   * @param {string} pluginId - 目标插件ID
   * @param {Object} message - 消息内容
   * @returns {Promise<boolean>}
   */
  async sendMessage(pluginId, message) {
    try {
      return await window.electronAPI.sendToPlugin(pluginId, message)
    } catch (error) {
      console.error(`[PluginService] Failed to send message:`, error)
      return false
    }
  }

  /**
   * 广播消息给所有插件
   * @param {Object} message - 消息内容
   * @returns {Promise<boolean>}
   */
  async broadcast(message) {
    try {
      return await window.electronAPI.broadcastToPlugins(message)
    } catch (error) {
      console.error(`[PluginService] Failed to broadcast:`, error)
      return false
    }
  }

  /**
   * 检查插件是否正在运行
   * @param {string} pluginId - 插件ID
   * @returns {boolean}
   */
  isRunning(pluginId) {
    return this._runningPlugins.value.includes(pluginId)
  }

  /**
   * 获取插件信息
   * @param {string} pluginId - 插件ID
   * @returns {Object|null}
   */
  getPlugin(pluginId) {
    return this._plugins.value.find(p => p.id === pluginId) || null
  }

  /**
   * 事件监听
   * @param {string} event - 事件名
   * @param {Function} callback - 回调函数
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, [])
    }
    this._listeners.get(event).push(callback)
  }

  /**
   * 移除事件监听
   * @param {string} event - 事件名
   * @param {Function} callback - 回调函数
   */
  off(event, callback) {
    const listeners = this._listeners.get(event)
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
    const listeners = this._listeners.get(event)
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(data)
        } catch (error) {
          console.error(`[PluginService] Event listener error:`, error)
        }
      }
    }
  }
}

// 单例模式
let instance = null

export function usePluginService() {
  if (!instance) {
    instance = new PluginService()
  }
  return instance
}

export default usePluginService
