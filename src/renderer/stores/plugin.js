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
   * 初始化插件列表（从主进程加载）
   */
  async function init() {
    if (initialized.value) return

    // 先加载默认插件列表，确保无论如何都有卡带显示
    initDefaultPlugins()

    try {
      // 尝试从主进程获取已扫描的插件
      if (window.electronAPI && window.electronAPI.scanPlugins) {
        const result = await window.electronAPI.scanPlugins()
        if (result && result.success && result.plugins) {
          // 合并插件列表：用磁盘上的插件覆盖/补充默认列表
          for (const pluginInfo of result.plugins) {
            const existing = plugins.value.find(p => p.id === pluginInfo.id)
            if (existing) {
              // 更新已有插件的信息
              existing.name = pluginInfo.name || existing.name
              existing.description = pluginInfo.description || existing.description
              existing.icon = pluginInfo.icon || existing.icon
              existing.version = pluginInfo.version || existing.version
              existing.author = pluginInfo.author || existing.author
              existing.color = pluginInfo.color || existing.color
              existing.windowSize = pluginInfo.windowSize || existing.windowSize
            } else {
              // 添加新插件
              plugins.value.push({
                id: pluginInfo.id,
                name: pluginInfo.name || pluginInfo.id,
                description: pluginInfo.description || '',
                icon: pluginInfo.icon || '📦',
                version: pluginInfo.version || '1.0.0',
                author: pluginInfo.author || 'Unknown',
                enabled: true,
                color: pluginInfo.color || '#00ff88',
                windowSize: pluginInfo.windowSize,
                state: 'unloaded',
                manifest: pluginInfo.manifest || pluginInfo
              })
            }
          }
        }
        
        // 加载本地存储的插件配置
        loadFromStorage()
      }
      
      initialized.value = true
      console.log('[PluginStore] Initialized with', plugins.value.length, 'plugins')
    } catch (error) {
      console.error('[PluginStore] Failed to initialize from main process:', error)
      // 默认插件已经在 initDefaultPlugins() 中加载了
      initialized.value = true
    }
  }

  /**
   * 初始化默认插件列表（fallback）
   */
  function initDefaultPlugins() {
    plugins.value = [
      {
        id: 'test-app',
        name: 'TEST',
        description: '测试子程序 - 验证过渡动画',
        icon: '🧪',
        version: '0.0.1',
        author: 'Hundun Lite',
        enabled: true,
        color: '#00ff88',
        windowSize: { width: 400, height: 400 },
        state: 'unloaded'
      },
      {
        id: 'timer-manager',
        name: '定时任务',
        description: '管理您的定时任务和提醒',
        icon: '⏰',
        version: '1.0.0',
        author: 'Hundun Lite',
        enabled: true,
        color: '#00ff88',
        state: 'unloaded'
      },
      {
        id: 'command-executor',
        name: '命令执行',
        description: '执行自定义bash命令',
        icon: '⚡',
        version: '1.0.0',
        author: 'Hundun Lite',
        enabled: true,
        color: '#ff0080',
        state: 'unloaded'
      },
      {
        id: 'note-taker',
        name: '极客记事',
        description: '支持Markdown的极客记事本',
        icon: '📝',
        version: '1.0.0',
        author: 'Hundun Lite',
        enabled: true,
        color: '#00d4ff',
        state: 'unloaded'
      },
      {
        id: 'clipboard-manager',
        name: '剪贴管理',
        description: '历史剪贴板内容管理',
        icon: '📋',
        version: '1.0.0',
        author: 'Hundun Lite',
        enabled: true,
        color: '#ffaa00',
        state: 'unloaded'
      },
      {
        id: 'system-monitor',
        name: '系统监控',
        description: '实时系统资源监控',
        icon: '📊',
        version: '1.0.0',
        author: 'Hundun Lite',
        enabled: true,
        color: '#ff5500',
        state: 'unloaded'
      },
      {
        id: 'quick-launcher',
        name: '快捷启动',
        description: '常用应用和网站快捷启动',
        icon: '🚀',
        version: '1.0.0',
        author: 'Hundun Lite',
        enabled: true,
        color: '#aa00ff',
        state: 'unloaded'
      },
      {
        id: 'file-manager',
        name: '文件管理',
        description: '快速访问常用文件夹',
        icon: '📁',
        version: '1.0.0',
        author: 'Hundun Lite',
        enabled: true,
        color: '#00aaff',
        state: 'unloaded'
      },
      {
        id: 'color-picker',
        name: '取色器',
        description: '屏幕取色和调色板',
        icon: '🎨',
        version: '1.0.0',
        author: 'Hundun Lite',
        enabled: true,
        color: '#ff6699',
        state: 'unloaded'
      },
      {
        id: 'calculator',
        name: '计算器',
        description: '科学计算器和单位换算',
        icon: '🔢',
        version: '1.0.0',
        author: 'Hundun Lite',
        enabled: true,
        color: '#88ff00',
        state: 'unloaded'
      },
      {
        id: 'screenshot',
        name: '截图工具',
        description: '屏幕截图和标注',
        icon: '📸',
        version: '1.0.0',
        author: 'Hundun Lite',
        enabled: true,
        color: '#ff8800',
        state: 'unloaded'
      }
    ]
    
    initialized.value = true
  }

  /**
   * 添加插件
   * @param {Object} plugin - 插件对象
   * @returns {boolean} 是否成功添加
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
   * @param {string} pluginId - 插件ID
   * @returns {boolean} 是否成功移除
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
   * @param {string} pluginId - 插件ID
   * @returns {boolean} 是否成功切换
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
   * @param {string} pluginId - 插件ID
   * @param {string} state - 新状态
   */
  function updatePluginState(pluginId, state) {
    const plugin = plugins.value.find(p => p.id === pluginId)
    if (plugin) {
      plugin.state = state
    }
  }

  /**
   * 设置当前活动插件
   * @param {Object} plugin - 插件对象
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
   * @param {Object} plugin - 插件对象
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
        // 合并保存的配置到现有插件列表
        for (const savedPlugin of savedPlugins) {
          const existing = plugins.value.find(p => p.id === savedPlugin.id)
          if (existing) {
            // 只更新用户配置，不覆盖核心属性
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
      // 只保存用户配置，不保存完整插件对象
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
   * @param {string} pluginId - 插件ID
   * @param {Object} options - 启动选项
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
   * @param {string} pluginId - 插件ID
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
