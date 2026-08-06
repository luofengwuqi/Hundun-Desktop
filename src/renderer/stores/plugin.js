import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const usePluginStore = defineStore('plugin', () => {
  // 状态
  const plugins = ref([
    {
      id: 'timer-manager',
      name: '定时任务',
      description: '管理您的定时任务和提醒',
      icon: '⏰',
      version: '1.0.0',
      author: '馄饨Lite',
      enabled: true,
      color: '#00ff88'
    },
    {
      id: 'command-executor',
      name: '命令执行',
      description: '执行自定义bash命令',
      icon: '⚡',
      version: '1.0.0',
      author: '馄饨Lite',
      enabled: true,
      color: '#ff0080'
    },
    {
      id: 'note-taker',
      name: '极客记事',
      description: '支持Markdown的极客记事本',
      icon: '📝',
      version: '1.0.0',
      author: '馄饨Lite',
      enabled: true,
      color: '#00d4ff'
    },
    {
      id: 'clipboard-manager',
      name: '剪贴管理',
      description: '历史剪贴板内容管理',
      icon: '📋',
      version: '1.0.0',
      author: '馄饨Lite',
      enabled: true,
      color: '#ffaa00'
    },
    {
      id: 'system-monitor',
      name: '系统监控',
      description: '实时系统资源监控',
      icon: '📊',
      version: '1.0.0',
      author: '馄饨Lite',
      enabled: true,
      color: '#ff5500'
    },
    {
      id: 'quick-launcher',
      name: '快捷启动',
      description: '常用应用和网站快捷启动',
      icon: '🚀',
      version: '1.0.0',
      author: '馄饨Lite',
      enabled: true,
      color: '#aa00ff'
    }
  ])

  const activePlugin = ref(null)

  // 计算属性
  const enabledPlugins = computed(() => {
    return plugins.value.filter(plugin => plugin.enabled)
  })

  const getPluginById = computed(() => {
    return (id) => plugins.value.find(plugin => plugin.id === id)
  })

  // 方法
  const addPlugin = (plugin) => {
    const existingIndex = plugins.value.findIndex(p => p.id === plugin.id)
    if (existingIndex === -1) {
      plugins.value.push({
        ...plugin,
        enabled: true,
        installedAt: new Date().toISOString()
      })
      return true
    }
    return false
  }

  const removePlugin = (pluginId) => {
    const index = plugins.value.findIndex(p => p.id === pluginId)
    if (index !== -1) {
      plugins.value.splice(index, 1)
      return true
    }
    return false
  }

  const togglePlugin = (pluginId) => {
    const plugin = plugins.value.find(p => p.id === pluginId)
    if (plugin) {
      plugin.enabled = !plugin.enabled
      return true
    }
    return false
  }

  const setActivePlugin = (plugin) => {
    activePlugin.value = plugin
  }

  const clearActivePlugin = () => {
    activePlugin.value = null
  }

  // 加载插件列表 (从本地存储)
  const loadPlugins = () => {
    const savedPlugins = localStorage.getItem('huntun-lite-plugins')
    if (savedPlugins) {
      try {
        plugins.value = JSON.parse(savedPlugins)
      } catch (e) {
        console.error('Failed to load plugins:', e)
      }
    }
  }

  // 保存插件列表
  const savePlugins = () => {
    localStorage.setItem('huntun-lite-plugins', JSON.stringify(plugins.value))
  }

  return {
    plugins,
    activePlugin,
    enabledPlugins,
    getPluginById,
    addPlugin,
    removePlugin,
    togglePlugin,
    setActivePlugin,
    clearActivePlugin,
    loadPlugins,
    savePlugins
  }
})
