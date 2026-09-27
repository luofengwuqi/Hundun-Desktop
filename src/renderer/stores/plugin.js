import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const usePluginStore = defineStore('plugin', () => {
  // 插件列表（从磁盘加载或动态添加）
  const plugins = ref([])
  
  // 当前选中的插件
  const activePlugin = ref(null)
  
  // 插槽中的插件
  const slotPlugin = ref(null)
  
  // 是否已初始化
  const initialized = ref(false)

  // ========== 默认插件（始终保证有卡带显示） ==========
  const DEFAULT_PLUGINS = [
    {
      id: 'calculator',
      name: 'CALC',
      description: 'Retro pocket calculator',
      icon: '🔢',
      version: '1.0.0',
      author: 'Hundun Lite',
      enabled: true,
      color: '#88ff00',
      windowSize: { width: 400, height: 540 },
      state: 'unloaded'
    },
    {
      id: 'fast-txt',
      name: 'FastTXT',
      description: 'Text file manager & editor',
      icon: '📄',
      version: '1.0.0',
      author: 'Hundun Lite',
      enabled: true,
      color: '#00d4ff',
      windowSize: { width: 800, height: 540 },
      state: 'unloaded'
    },
    {
      id: 'timer-manager',
      name: 'Timer',
      description: 'Manage your timers and reminders',
      icon: '⏰',
      version: '1.0.0',
      author: 'Hundun Lite',
      enabled: true,
      color: '#ff0080',
      windowSize: { width: 400, height: 400 },
      state: 'unloaded'
    },
    {
      id: 'fast-cmd',
      name: 'FastCmd',
      description: 'Script manager & executor',
      icon: '⚡',
      version: '1.0.0',
      author: 'Hundun Lite',
      enabled: true,
      color: '#ff9900',
      windowSize: { width: 800, height: 540 },
      state: 'unloaded'
    }
  ]

  // ========== 计算属性 ==========
  
  // 已启用的插件列表
  const enabledPlugins = computed(() => {
    return plugins.value.filter(plugin => plugin.enabled !== false)
  })

  // 根据ID获取插件
  const getPluginById = computed(() => {
    return (id) => plugins.value.find(plugin => plugin.id === id)
  })

  // 运行中的插件
  const runningPlugins = computed(() => {
    return plugins.value.filter(plugin => plugin.state === 'running')
  })

  // ========== 方法 ==========

  /**
   * 扫描磁盘插件并与默认插件合并
   * @returns {Array|null} 合并后的插件列表，扫描失败返回 null
   */
  async function scanDiskPlugins() {
    try {
      if (!(window.electronAPI && window.electronAPI.scanAllPlugins)) return null

      const result = await window.electronAPI.scanAllPlugins()
      if (!result || !result.success || !Array.isArray(result.plugins)) return null

      const diskPlugins = result.plugins.map(pluginInfo => ({
        id: pluginInfo.id,
        name: pluginInfo.name || pluginInfo.id,
        description: pluginInfo.description || '',
        icon: pluginInfo.icon || '📦',
        version: pluginInfo.version || '1.0.0',
        author: pluginInfo.author || 'Unknown',
        enabled: true,
        color: pluginInfo.color || '#00ff88',
        windowSize: pluginInfo.windowSize || { width: 400, height: 400 },
        state: 'unloaded',
        manifest: pluginInfo.manifest || pluginInfo
      }))

      // 合并：磁盘插件优先，但保留默认插件（如 fast-txt 等不在磁盘的）
      const merged = [...diskPlugins]
      for (const dp of DEFAULT_PLUGINS) {
        if (!merged.find(p => p.id === dp.id)) {
          merged.push(dp)
        }
      }
      return merged
    } catch (error) {
      console.warn('[PluginStore] Failed to scan disk plugins:', error)
      return null
    }
  }

  /**
   * 初始化插件列表
   * 策略：先加载默认卡带，再尝试从磁盘扫描合并
   */
  async function init() {
    if (initialized.value) return

    // 第一步：立即加载默认插件，确保 UI 有内容
    plugins.value = JSON.parse(JSON.stringify(DEFAULT_PLUGINS))
    initialized.value = true
    console.log('[PluginStore] Loaded default plugins:', plugins.value.length)

    // 第二步：异步尝试从主进程扫描磁盘插件（不阻塞 UI）
    const merged = await scanDiskPlugins()
    if (merged) {
      plugins.value = merged
      console.log('[PluginStore] Merged with disk plugins:', plugins.value.length)
    }

    // 第三步：应用用户本地配置
    loadFromStorage()
  }

  /**
   * 重新扫描磁盘插件并同步到全局状态
   * 用于本地安装 .zip 插件后，让母程序各页面（卡带货架 / 设置页插件列表）立即生效
   * @returns {boolean} 是否刷新成功
   */
  async function refreshFromDisk() {
    const merged = await scanDiskPlugins()
    if (!merged) return false
    plugins.value = merged
    loadFromStorage() // 恢复 enabled / customSettings 等本地配置
    console.log('[PluginStore] Refreshed from disk:', plugins.value.length)
    return true
  }

  /**
   * 添加插件
   */
  function addPlugin(plugin) {
    const existingIndex = plugins.value.findIndex(p => p.id === plugin.id)
    if (existingIndex === -1) {
      plugins.value.push({
        ...plugin,
        enabled: true,
        state: 'unloaded',
        installedAt: new Date().toISOString()
      })
      saveToStorage()
      return true
    }
    return false
  }

  /**
   * 移除插件
   */
  function removePlugin(pluginId) {
    const index = plugins.value.findIndex(p => p.id === pluginId)
    if (index !== -1) {
      plugins.value.splice(index, 1)
      saveToStorage()
      return true
    }
    return false
  }

  /**
   * 切换插件启用状态
   */
  function togglePlugin(pluginId) {
    const plugin = plugins.value.find(p => p.id === pluginId)
    if (plugin) {
      plugin.enabled = !plugin.enabled
      saveToStorage()
      return true
    }
    return false
  }

  /**
   * 更新插件状态
   */
  function updatePluginState(pluginId, state) {
    const plugin = plugins.value.find(p => p.id === pluginId)
    if (plugin) {
      plugin.state = state
    }
  }

  /**
   * 设置当前活动插件
   */
  function setActivePlugin(plugin) {
    activePlugin.value = plugin
  }

  /**
   * 清除活动插件
   */
  function clearActivePlugin() {
    activePlugin.value = null
  }

  /**
   * 设置插槽中的插件
   */
  function setSlotPlugin(plugin) {
    slotPlugin.value = plugin
  }

  /**
   * 清除插槽中的插件
   */
  function clearSlotPlugin() {
    slotPlugin.value = null
  }

  /**
   * 从本地存储加载插件配置
   */
  function loadFromStorage() {
    try {
      const saved = localStorage.getItem('huntun-lite-plugins')
      if (saved) {
        const savedPlugins = JSON.parse(saved)
        for (const savedPlugin of savedPlugins) {
          const existing = plugins.value.find(p => p.id === savedPlugin.id)
          if (existing) {
            existing.enabled = savedPlugin.enabled !== false
            if (savedPlugin.customSettings) {
              existing.customSettings = savedPlugin.customSettings
            }
          }
        }
      }
    } catch (error) {
      console.error('[PluginStore] Failed to load from storage:', error)
    }
  }

  /**
   * 保存插件配置到本地存储
   */
  function saveToStorage() {
    try {
      const toSave = plugins.value.map(p => ({
        id: p.id,
        enabled: p.enabled,
        customSettings: p.customSettings
      }))
      localStorage.setItem('huntun-lite-plugins', JSON.stringify(toSave))
    } catch (error) {
      console.error('[PluginStore] Failed to save to storage:', error)
    }
  }

  /**
   * 启动插件（创建 BrowserWindow）
   */
  async function launchPlugin(pluginId, options = {}) {
    try {
      if (!window.electronAPI) {
        throw new Error('electronAPI not available')
      }
      
      const result = await window.electronAPI.startPlugin(pluginId, options)
      if (result.success) {
        updatePluginState(pluginId, 'running')
        return true
      } else {
        throw new Error(result.error || 'Failed to start plugin')
      }
    } catch (error) {
      console.error(`[PluginStore] Failed to launch plugin ${pluginId}:`, error)
      updatePluginState(pluginId, 'error')
      throw error
    }
  }

  /**
   * 关闭插件
   */
  async function closePlugin(pluginId) {
    try {
      if (!window.electronAPI) {
        throw new Error('electronAPI not available')
      }
      
      const result = await window.electronAPI.stopPlugin(pluginId)
      if (result.success) {
        updatePluginState(pluginId, 'unloaded')
        if (slotPlugin.value && slotPlugin.value.id === pluginId) {
          slotPlugin.value = null
        }
        return true
      }
    } catch (error) {
      console.error(`[PluginStore] Failed to close plugin ${pluginId}:`, error)
      throw error
    }
  }

  return {
    // 状态
    plugins,
    activePlugin,
    slotPlugin,
    initialized,
    
    // 计算属性
    enabledPlugins,
    getPluginById,
    runningPlugins,
    
    // 方法
    init,
    refreshFromDisk,
    addPlugin,
    removePlugin,
    togglePlugin,
    updatePluginState,
    setActivePlugin,
    clearActivePlugin,
    setSlotPlugin,
    clearSlotPlugin,
    loadFromStorage,
    saveToStorage,
    launchPlugin,
    closePlugin
  }
})
