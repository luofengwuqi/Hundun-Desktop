import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  SETTING_KEY,
  getSettingMigrating,
  setSetting
} from '../utils/app-settings'

// ========== 插件配置 (决策46 / 决策66 迁到 settings.json) ==========
// plugins.order:        [{id, enabled, customSettings}, ...] — 数组顺序即显示顺序
// plugins.removed:      [{id, name, icon, version, removedAt}, ...] — 已移除名单
//   (挡 DEFAULT_PLUGINS/磁盘扫描把已移除插件回灌; 文件已删的安装插件不进名单, 见决策46)
// plugins.orderVersion: 数字 — 默认排序基线版本 (决策64)
//   低于当前版本时按 DEFAULT_ORDER 重排一次, 之后用户拖拽自由, 不再打回
// 存储位置: <userData>/settings.json (决策66 之前是 localStorage 的
//   hundundesktop-plugins / -removed / -plugin-order-version, 老值首次读取时自动补写)

// 默认排序基线 (决策64): FastTXT → Music → TASK → FastCmd → CALC
// 只列需要固定位置的 id; 未列出的插件(用户安装)保持原有相对顺序排在尾部
const DEFAULT_ORDER = ['fast-txt', 'music', 'task', 'fast-cmd', 'calculator']
const DEFAULT_ORDER_VERSION = 2

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
  // 数组顺序 = 默认显示顺序，需与 DEFAULT_ORDER 保持一致 (决策64)
  const DEFAULT_PLUGINS = [
    {
      id: 'fast-txt',
      name: 'FastTXT',
      description: 'Text file manager & editor',
      icon: '📄',
      version: '1.0.0',
      author: 'HundunDesktop',
      enabled: true,
      color: '#00d4ff',
      windowSize: { width: 800, height: 540 },
      state: 'unloaded'
    },
    {
      id: 'task',
      name: 'TASK',
      description: 'Task list with deadlines & reminders',
      icon: '📋',
      version: '1.0.0',
      author: 'HundunDesktop',
      enabled: true,
      color: '#ff0080',
      windowSize: { width: 400, height: 520 },
      state: 'unloaded'
    },
    {
      id: 'fast-cmd',
      name: 'FastCmd',
      description: 'Script manager & executor',
      icon: '⚡',
      version: '1.0.0',
      author: 'HundunDesktop',
      enabled: true,
      color: '#ff9900',
      windowSize: { width: 800, height: 540 },
      state: 'unloaded'
    },
    {
      id: 'calculator',
      name: 'CALC',
      description: 'Retro pocket calculator',
      icon: '🔢',
      version: '1.0.0',
      author: 'HundunDesktop',
      enabled: true,
      color: '#88ff00',
      windowSize: { width: 400, height: 540 },
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
        iconSvg: pluginInfo.iconSvg || '',
        version: pluginInfo.version || '1.0.0',
        author: pluginInfo.author || 'Unknown',
        enabled: true,
        color: pluginInfo.color || '#00ff88',
        iconColor: pluginInfo.iconColor || '',
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
      // 已移除名单过滤 (决策46): 内置/已移除插件不再回灌
      // 默认排序基线 (决策64): 磁盘 readdir 顺序不可靠, 统一按 DEFAULT_ORDER 排
      return applyDefaultOrder(filterRemoved(merged))
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

    // 第一步：立即加载默认插件，确保 UI 有内容 (先按已移除名单过滤, 决策46)
    plugins.value = filterRemoved(JSON.parse(JSON.stringify(DEFAULT_PLUGINS)))
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

    // 第四步：默认排序基线 (决策64) — 老配置的旧顺序在此升级一次
    if (migrateDefaultOrder()) {
      notifyChanged()
      console.log('[PluginStore] Applied default order baseline:', DEFAULT_ORDER.join(' > '))
    }
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
   * 从设置加载插件配置 (决策66: settings.json 的 plugins.order)
   * (决策46: 同时回填字段 + 按保存顺序重排)
   */
  function loadFromStorage() {
    try {
      const savedPlugins = getSettingMigrating(SETTING_KEY.pluginOrder, null)
      if (Array.isArray(savedPlugins) && savedPlugins.length > 0) {
        // 1) 字段回填
        for (const savedPlugin of savedPlugins) {
          const existing = plugins.value.find(p => p.id === savedPlugin.id)
          if (existing) {
            existing.enabled = savedPlugin.enabled !== false
            if (savedPlugin.customSettings) {
              existing.customSettings = savedPlugin.customSettings
            }
          }
        }
        // 2) 顺序回填 (决策46): 按保存顺序重排; 保存后新出现的插件追加在尾部
        const savedOrder = savedPlugins.map(p => p && p.id).filter(Boolean)
        const ordered = []
        for (const id of savedOrder) {
          const p = plugins.value.find(x => x.id === id)
          if (p) ordered.push(p)
        }
        const seen = new Set(savedOrder)
        for (const p of plugins.value) {
          if (!seen.has(p.id)) ordered.push(p)
        }
        plugins.value = ordered
      }
    } catch (error) {
      console.error('[PluginStore] Failed to load from storage:', error)
    }
  }

  /**
   * 保存插件配置 (数组顺序 = 显示顺序, 决策46; 落到 settings.json, 决策66)
   */
  function saveToStorage() {
    try {
      const toSave = plugins.value.map(p => ({
        id: p.id,
        enabled: p.enabled,
        customSettings: p.customSettings
      }))
      setSetting(SETTING_KEY.pluginOrder, toSave)
    } catch (error) {
      console.error('[PluginStore] Failed to save to storage:', error)
    }
  }

  // ========== 默认排序基线 (决策64) ==========

  /**
   * 按 DEFAULT_ORDER 稳定排序：已列出的插件按基线位置，未列出的（用户安装插件）保持原相对顺序排尾部
   * @param {Array} list
   * @returns {Array} 新数组，不改动入参
   */
  function applyDefaultOrder(list) {
    const rank = (id) => {
      const i = DEFAULT_ORDER.indexOf(id)
      return i === -1 ? DEFAULT_ORDER.length : i
    }
    return list
      .map((plugin, index) => ({ plugin, index }))
      .sort((a, b) => (rank(a.plugin.id) - rank(b.plugin.id)) || (a.index - b.index))
      .map(item => item.plugin)
  }

  /**
   * 排序基线一次性迁移：本地记录的版本低于 DEFAULT_ORDER_VERSION 时，
   * 把当前列表重排成基线顺序并持久化；之后用户的拖拽排序不再被覆盖
   * @returns {boolean} 是否执行了重排
   */
  function migrateDefaultOrder() {
    try {
      const saved = Number(getSettingMigrating(SETTING_KEY.pluginOrderVersion, 0)) || 0
      if (saved >= DEFAULT_ORDER_VERSION) return false
      plugins.value = applyDefaultOrder(plugins.value)
      saveToStorage()
      setSetting(SETTING_KEY.pluginOrderVersion, DEFAULT_ORDER_VERSION)
      return true
    } catch (error) {
      console.error('[PluginStore] Failed to migrate default order:', error)
      return false
    }
  }

  // ========== 已移除名单 (决策46) ==========

  function getRemovedRecords() {
    try {
      const list = getSettingMigrating(SETTING_KEY.pluginRemoved, [])
      return Array.isArray(list) ? list.filter(r => r && typeof r.id === 'string') : []
    } catch (error) {
      console.error('[PluginStore] Failed to read removed list:', error)
      return []
    }
  }

  function saveRemovedRecords(records) {
    try {
      setSetting(SETTING_KEY.pluginRemoved, records)
    } catch (error) {
      console.error('[PluginStore] Failed to save removed list:', error)
    }
  }

  function filterRemoved(list) {
    const removedIds = new Set(getRemovedRecords().map(r => r.id))
    return list.filter(p => !removedIds.has(p.id))
  }

  function clearRemovedId(id) {
    const list = getRemovedRecords()
    const next = list.filter(r => r.id !== id)
    if (next.length !== list.length) {
      saveRemovedRecords(next)
    }
  }

  /**
   * 通知其他母窗口刷新配置 (排序/移除/恢复/安装后调用, 决策46)
   * 决策66 起配置在 settings.json, 已写入主进程; 但各窗口内存 store 仍需 reload
   */
  async function notifyChanged() {
    try {
      if (window.electronAPI && window.electronAPI.notifyPluginsChanged) {
        await window.electronAPI.notifyPluginsChanged()
      }
    } catch (error) {
      console.warn('[PluginStore] notifyChanged failed:', error)
    }
  }

  /**
   * 移动插件到指定位置并持久化 (拖拽/Ctrl+↑↓, 决策46)
   * @param {string} id - 插件 id
   * @param {number} toIndex - 目标最终下标 (自动钳制)
   */
  function movePlugin(id, toIndex) {
    const from = plugins.value.findIndex(p => p.id === id)
    if (from === -1) return false
    const to = Math.max(0, Math.min(plugins.value.length - 1, Math.round(toIndex)))
    if (from === to) return false
    const [item] = plugins.value.splice(from, 1)
    plugins.value.splice(to, 0, item)
    saveToStorage()
    notifyChanged()
    return true
  }

  /**
   * 从配置中移除插件 (设置页删除, 决策46)
   * @param {Object} plugin - 插件对象 (取展示信息进已移除名单)
   * @param {{ trackRemoved?: boolean }} options
   *   trackRemoved=true (默认): 加入已移除名单 (内置插件 → 挡回灌, 可恢复)
   *   trackRemoved=false: 不进名单 (安装插件目录已删, 磁盘上已不存在, 重装 zip 即回)
   */
  function removePluginFromConfig(plugin, { trackRemoved = true } = {}) {
    const idx = plugins.value.findIndex(p => p.id === plugin.id)
    if (idx === -1) return false
    plugins.value.splice(idx, 1)
    if (trackRemoved) {
      const records = getRemovedRecords().filter(r => r.id !== plugin.id)
      records.push({
        id: plugin.id,
        name: plugin.name || plugin.id,
        icon: plugin.icon || '📦',
        iconSvg: plugin.iconSvg || '',
        iconColor: plugin.iconColor || '',
        version: plugin.version || '',
        removedAt: new Date().toISOString()
      })
      saveRemovedRecords(records)
    }
    saveToStorage()
    notifyChanged()
    return true
  }

  /**
   * 恢复已移除插件: 清名单 → 重新扫描合并 (决策46)
   * @returns {Promise<boolean>} 恢复后插件是否出现在列表 (磁盘文件已被删则 false)
   */
  async function restorePlugin(id) {
    clearRemovedId(id)
    const ok = await refreshFromDisk()
    if (!ok) return false
    notifyChanged()
    return plugins.value.some(p => p.id === id)
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
    closePlugin,
    // 决策46: 设置·插件页
    movePlugin,
    removePluginFromConfig,
    restorePlugin,
    getRemovedRecords,
    clearRemovedId,
    notifyChanged
  }
})
