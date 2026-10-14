<template>
  <div class="settings-view" :class="{ 'light-mode': !isDarkMode }">
    <!-- Header -->
    <header class="settings-header">
      <div class="toggle-container">
        <span class="toggle-label">{{ t('settings.dark') }}</span>
        <div 
          class="toggle-switch" 
          :class="{ active: !isDarkMode }"
          @click="toggleTheme"
        >
          <div class="toggle-knob"></div>
        </div>
        <span class="toggle-label">{{ t('settings.light') }}</span>
      </div>
      <div class="settings-logo">
        <span class="logo-icon">⚙️</span>
        <span class="logo-text">{{ t('settings.title') }}</span>
      </div>
      <button class="settings-close-btn" @click="closeSettings" :title="t('settings.back')">✕</button>
    </header>

    <!-- Content -->
    <main class="settings-content">
      <!-- Navigation Tabs -->
      <div class="settings-nav">
        <button 
          v-for="(tab, idx) in tabs" 
          :key="tab.id"
          class="nav-tab"
          :class="{ selected: currentSide === 'left' && selectedTab === idx }"
          @click="selectTab(idx)"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </div>

      <!-- Tab Content -->
      <div class="settings-panel">
        <!-- Sound Settings -->
        <div v-if="selectedTab === 0" class="tab-content">
          <div class="setting-group">
            <div class="setting-row detail-item" :class="{ selected: currentSide === 'right' && detailIndex === 0 }">
              <span class="setting-label">{{ t('settings.soundEffects') }}</span>
              <div class="toggle-with-status">
                <span v-if="settings.soundEnabled" class="in-use-tag">{{ t('settings.inUse') }}</span>
                <div 
                  class="toggle-switch small"
                  :class="{ active: settings.soundEnabled }"
                  @click="selectDetail(0); toggleSoundEnabled()"
                >
                  <div class="toggle-knob"></div>
                </div>
              </div>
            </div>
            <div class="setting-row detail-item" :class="{ disabled: !settings.soundEnabled, selected: currentSide === 'right' && detailIndex === 1 }" @click="selectDetail(1)">
              <span class="setting-label">{{ t('settings.volume') }}</span>
              <div class="volume-control">
                <span class="volume-icon">🔊</span>
                <input 
                  type="range" 
                  class="volume-slider"
                  min="0" 
                  max="100" 
                  :value="settings.volume"
                  :disabled="!settings.soundEnabled"
                  @input="updateVolume"
                />
                <span class="volume-value">{{ settings.volume }}%</span>
              </div>
            </div>
            <button 
              class="test-sound-btn detail-item"
              :class="{ selected: currentSide === 'right' && detailIndex === 2 }"
              :disabled="!settings.soundEnabled"
              @click="selectDetail(2); testSound()"
            >
              <span class="btn-icon">▶</span>
              <span class="btn-text">{{ t('settings.testSound') }}</span>
            </button>
          </div>
        </div>

        <!-- Theme Settings -->
        <div v-if="selectedTab === 1" class="tab-content">
          <div class="setting-group">
            <div class="theme-options">
              <button 
                class="theme-option detail-item"
                :class="{ active: !isDarkMode, selected: currentSide === 'right' && detailIndex === 0 }"
                @click="selectDetail(0); setTheme('light')"
              >
                <div class="theme-preview light">
                  <div class="preview-header"></div>
                  <div class="preview-body"></div>
                </div>
                <span class="theme-name">{{ t('settings.light') }}</span>
                <span v-if="!isDarkMode" class="in-use-tag">{{ t('settings.inUse') }}</span>
              </button>
              <button 
                class="theme-option detail-item"
                :class="{ active: isDarkMode, selected: currentSide === 'right' && detailIndex === 1 }"
                @click="selectDetail(1); setTheme('dark')"
              >
                <div class="theme-preview dark">
                  <div class="preview-header"></div>
                  <div class="preview-body"></div>
                </div>
                <span class="theme-name">{{ t('settings.dark') }}</span>
                <span v-if="isDarkMode" class="in-use-tag">{{ t('settings.inUse') }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Language Settings -->
        <div v-if="selectedTab === 2" class="tab-content">
          <div class="setting-group">
            <div class="language-options">
              <button 
                v-for="(option, index) in languageOptions"
                :key="option.id"
                class="language-option detail-item"
                :class="{ active: currentLocale === option.id, selected: currentSide === 'right' && detailIndex === index }"
                @click="selectDetail(index); setLanguage(option.id)"
              >
                <span class="lang-flag">{{ option.flag }}</span>
                <div class="lang-info">
                  <span class="lang-name">{{ option.name }}</span>
                  <span class="lang-native">{{ option.id === 'zh' ? '中文' : 'English' }}</span>
                </div>
                <span v-if="currentLocale === option.id" class="in-use-tag">{{ t('settings.inUse') }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Plugin Settings -->
        <div v-if="selectedTab === 3" class="tab-content">
          <div class="setting-group">
            <div class="plugin-list">
              <div 
                v-for="(plugin, index) in plugins" 
                :key="plugin.id"
                class="plugin-item detail-item"
                :class="{
                  selected: currentSide === 'right' && detailIndex === index,
                  dragging: dragPluginId === plugin.id,
                  'drop-before': dropTargetId === plugin.id && dropBefore,
                  'drop-after': dropTargetId === plugin.id && !dropBefore
                }"
                draggable="true"
                @click="selectDetail(index)"
                @dragstart="onDragStart($event, plugin)"
                @dragover.prevent="onDragOver($event, plugin)"
                @dragleave="onDragLeave(plugin)"
                @drop.prevent="onDrop(plugin)"
                @dragend="onDragEnd"
              >
                <!-- 拖拽柄 (决策46): 左侧, 拖动排序 -->
                <span class="plugin-grip" title="⋮⋮">⣿</span>
                <span class="plugin-icon">{{ plugin.icon }}</span>
                <div class="plugin-info">
                  <span class="plugin-name">{{ plugin.name }}</span>
                  <span class="plugin-version">v{{ plugin.version }}</span>
                </div>
                <!-- 实时状态 (决策46): 存在插件窗口 = 运行中 -->
                <span v-if="occupiedIds.includes(plugin.id)" class="in-use-tag">{{ t('settings.inUse') }}</span>
                <span v-else class="plugin-status idle">{{ t('plugin.idle') }}</span>
                <!-- 移除 (决策46) -->
                <button
                  class="plugin-remove-btn"
                  :title="t('settings.removeTitle')"
                  @click.stop="requestRemove(plugin)"
                >✕</button>
              </div>
            </div>

            <!-- 已移除列表 + 恢复 (决策46) -->
            <div v-if="removedRecords.length" class="removed-section">
              <button class="removed-toggle" @click="removedOpen = !removedOpen">
                <span>{{ t('settings.removedSection') }} ({{ removedRecords.length }})</span>
                <span class="removed-arrow">{{ removedOpen ? '▾' : '▸' }}</span>
              </button>
              <div v-if="removedOpen" class="removed-list">
                <div v-for="r in removedRecords" :key="r.id" class="removed-item">
                  <span class="removed-icon">{{ r.icon }}</span>
                  <span class="removed-name">{{ r.name }}</span>
                  <button class="restore-btn" @click="restoreRemoved(r)">{{ t('settings.restore') }}</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- About -->
        <div v-if="selectedTab === 4" class="tab-content">
          <div class="setting-group about-section">
            <div class="about-logo">🎮</div>
            <div class="about-title">HUNDUN LITE</div>
            <div class="about-version">v1.0.0-alpha</div>
            <div class="about-desc">
              {{ t('settings.desc') }}
            </div>
            <div class="about-links">
              <div class="about-link">
                <span class="link-label">{{ t('settings.engine') }}</span>
                <span class="link-value">Electron + Vue3</span>
              </div>
              <div class="about-link">
                <span class="link-label">{{ t('settings.platform') }}</span>
                <span class="link-value">{{ platform }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="settings-footer">
      <span class="footer-hint">{{ t('keys.escToExit') }}</span>
    </footer>

    <!-- 弹窗 (移除确认 / 结果提示, 决策46) -->
    <Modal
      v-if="modalVisible"
      :icon="modalIcon"
      :title="modalTitle"
      :message="modalMessage"
      :buttons="modalButtons"
      @close="closeModal"
    />
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import { useThemeStore } from '../stores/theme'
import { usePluginStore } from '../stores/plugin'
import { useI18nStore } from '../stores/i18n'
import { playSound, setGlobalVolume } from '../utils/audio'
import { loadSoundSettings, saveSoundSettings } from '../utils/sound-settings'
import { localeOptions } from '../i18n/index.js'
import Modal from './Modal.vue'

const emit = defineEmits(['close'])

const themeStore = useThemeStore()
const pluginStore = usePluginStore()
const i18nStore = useI18nStore()

// State
const isDarkMode = computed(() => themeStore.isDarkMode)
const plugins = computed(() => pluginStore.plugins)
const selectedTab = ref(0)
const detailIndex = ref(-1)
const currentSide = ref('left') // 'left' 或 'right'
const previousSideIndex = ref(0) // 记住从右侧返回时要恢复的左侧栏索引
const platform = ref('Unknown')
const currentLocale = computed(() => i18nStore.locale)
const languageOptions = localeOptions

// ========== 插件页状态 (决策46) ==========
// 全局运行中 (存在插件窗口, 含镜像另一窗口与隐藏窗口)
const occupiedIds = ref([])
// 已移除名单 (含展示信息, 供恢复区)
const removedRecords = ref([])
const removedOpen = ref(false)
// 拖拽排序
const dragPluginId = ref(null)
const dropTargetId = ref(null)
const dropBefore = ref(true)
// 弹窗 (移除确认 / 结果)
const modalVisible = ref(false)
const modalIcon = ref('')
const modalTitle = ref('')
const modalMessage = ref('')
const modalButtons = ref([])
// 生命周期事件退订
let unsubPluginStarted = null
let unsubPluginClosed = null

// i18n
const t = (key, params = {}) => i18nStore.t(key, params)

// Settings
const settings = reactive({
  soundEnabled: true,
  volume: 50
})

// Tabs
const tabs = computed(() => [
  { id: 'sound', icon: '🔊', label: t('settings.sound') },
  { id: 'theme', icon: '🎨', label: t('settings.theme') },
  { id: 'language', icon: '🌐', label: t('settings.language') },
  { id: 'plugins', icon: '📦', label: t('settings.plugins') },
  { id: 'about', icon: 'ℹ️', label: t('settings.about') }
])

const detailItemCount = computed(() => {
  switch (selectedTab.value) {
    case 0: // 声音标签
      return 3 // 音效开关、音量滑块、测试按钮
    case 1: // 主题标签
      return 2 // 浅色主题、深色主题
    case 2: // 语言标签
      return 2 // 中文、英文
    case 3: // 插件标签
      return plugins.value.length // 插件数量
    case 4: // 关于标签
      return 0 // 没有可交互元素
    default:
      return 0
  }
})

// Methods
const selectTab = (idx) => {
  selectedTab.value = idx
  detailIndex.value = -1
  currentSide.value = 'left'
  playSound('click')
}

const toggleTheme = () => {
  playSound('change')
  themeStore.toggleTheme()
}

const setTheme = (theme) => {
  playSound('click')
  themeStore.setTheme(theme)
}

const setLanguage = (lang) => {
  playSound('click')
  i18nStore.setLocale(lang)
}

const toggleSoundEnabled = () => {
  settings.soundEnabled = !settings.soundEnabled
  if (settings.soundEnabled) {
    setGlobalVolume(settings.volume / 100)
  } else {
    setGlobalVolume(0)
  }
  saveSettings()
}

const updateVolume = (e) => {
  settings.volume = parseInt(e.target.value)
  if (settings.soundEnabled) {
    setGlobalVolume(settings.volume / 100)
  }
  saveSettings()
}

const testSound = () => {
  playSound('OK')
}

const closeSettings = () => {
  playSound('exit')
  emit('close')
}

const saveSettings = () => {
  saveSoundSettings(settings)
}

const loadSettings = () => {
  // 与启动时 audio.js 使用同一份设置 (utils/sound-settings.js)
  const saved = loadSoundSettings()
  settings.soundEnabled = saved.soundEnabled
  settings.volume = saved.volume
  // 根据设置应用全局音量
  setGlobalVolume(settings.soundEnabled ? settings.volume / 100 : 0)
}

const selectDetail = (index) => {
  detailIndex.value = index
  currentSide.value = 'right'
}

// ========== 决策46: 运行状态实时化 ==========
const refreshOccupied = async () => {
  try {
    if (window.electronAPI && window.electronAPI.getOccupiedPlugins) {
      const ids = await window.electronAPI.getOccupiedPlugins()
      occupiedIds.value = Array.isArray(ids) ? ids : []
    }
  } catch (e) {
    console.warn('[Settings] Failed to load occupied plugins:', e)
  }
}

// ========== 决策46: 弹窗 helpers ==========
const escapeHtml = (str) => String(str ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const showModal = (icon, title, message, buttons) => {
  modalIcon.value = icon
  modalTitle.value = title
  modalMessage.value = message
  modalButtons.value = buttons
  modalVisible.value = true
}

const closeModal = () => {
  playSound('exit')
  modalVisible.value = false
}

// 流程中切换到下一个弹窗 (避免叠加 exit 音效)
const closeModalSilent = () => {
  modalVisible.value = false
}

// ========== 决策46: 移除插件 ==========
const requestRemove = (plugin) => {
  if (!plugin) return
  // 运行中拦截 (含镜像另一窗口占用)
  if (occupiedIds.value.includes(plugin.id)) {
    playSound('error')
    showModal('⚠️', t('settings.removeTitle'),
      t('settings.removeRunningMsg', { name: escapeHtml(plugin.name) }),
      [{ text: t('cartridge.ok'), class: 'primary', action: closeModal }])
    return
  }
  playSound('click')
  showModal(
    '🗑️',
    t('settings.removeTitle'),
    t('settings.removeMsg', { name: `${plugin.icon} ${escapeHtml(plugin.name)}` }),
    [
      { text: t('settings.keepData'), class: 'primary', action: () => doRemove(plugin, false) },
      { text: t('settings.removeDataBtn'), class: 'danger', action: () => doRemove(plugin, true) },
      { text: t('cartridge.cancel'), class: 'secondary', action: closeModal }
    ]
  )
}

const doRemove = async (plugin, removeData) => {
  closeModalSilent()
  playSound('click')
  try {
    const { ipcRenderer } = require('electron')
    const r = await ipcRenderer.invoke('plugin-install:uninstall', plugin.id, { removeData })

    if (!r || !r.success) {
      playSound('error')
      showModal('❌', t('settings.removeFailTitle'),
        escapeHtml(r && r.error ? r.error : t('error.unknownError')),
        [{ text: t('cartridge.ok'), class: 'primary', action: closeModal }])
      return
    }

    // 配置汇总 (决策46): 目录已删 (安装插件) → 不进名单, 重装 zip 即回;
    // 内置/保留目录 → 进"已移除名单"挡 DEFAULT/磁盘扫描回灌, 可恢复
    pluginStore.removePluginFromConfig(plugin, { trackRemoved: !r.removedDir })
    removedRecords.value = pluginStore.getRemovedRecords()
    if (detailIndex.value >= plugins.value.length) {
      detailIndex.value = plugins.value.length - 1
    }

    playSound('OK')
    showModal('✅', t('settings.removeOkTitle'),
      t('settings.removeOkMsg', {
        name: `${plugin.icon} ${escapeHtml(plugin.name)}`,
        data: r.removedData ? t('settings.dataDeleted') : t('settings.dataKept')
      }),
      [{ text: t('cartridge.ok'), class: 'primary', action: closeModal }])
  } catch (e) {
    console.error('[Settings] Remove plugin failed:', e)
    playSound('error')
    showModal('❌', t('settings.removeFailTitle'),
      escapeHtml(e.message || t('error.unknownError')),
      [{ text: t('cartridge.ok'), class: 'primary', action: closeModal }])
  }
}

// ========== 决策46: 恢复已移除插件 ==========
const restoreRemoved = async (record) => {
  playSound('click')
  try {
    const ok = await pluginStore.restorePlugin(record.id)
    removedRecords.value = pluginStore.getRemovedRecords()
    if (ok) {
      playSound('OK')
    } else {
      playSound('error')
      showModal('❌', t('settings.restoreFailTitle'),
        t('settings.restoreMissingMsg', { name: escapeHtml(record.name) }),
        [{ text: t('cartridge.ok'), class: 'primary', action: closeModal }])
    }
  } catch (e) {
    console.error('[Settings] Restore plugin failed:', e)
    playSound('error')
    showModal('❌', t('settings.restoreFailTitle'),
      escapeHtml(e.message || t('error.unknownError')),
      [{ text: t('cartridge.ok'), class: 'primary', action: closeModal }])
  }
}

// ========== 决策46: 拖拽排序 ==========
const onDragStart = (e, plugin) => {
  dragPluginId.value = plugin.id
  e.dataTransfer.effectAllowed = 'move'
  // Firefox 需要 setData 才会启动拖拽
  try { e.dataTransfer.setData('text/plain', plugin.id) } catch (_) { /* ignore */ }
}

const onDragOver = (e, plugin) => {
  e.dataTransfer.dropEffect = 'move'
  if (dragPluginId.value === plugin.id) {
    dropTargetId.value = null
    return
  }
  const rect = e.currentTarget.getBoundingClientRect()
  dropBefore.value = e.clientY < rect.top + rect.height / 2
  dropTargetId.value = plugin.id
}

const onDrop = (plugin) => {
  const fromId = dragPluginId.value
  const before = dropBefore.value
  dragPluginId.value = null
  dropTargetId.value = null
  if (!fromId || fromId === plugin.id) return

  const list = plugins.value
  const targetIdx = list.findIndex(p => p.id === plugin.id)
  const fromIdx = list.findIndex(p => p.id === fromId)
  if (targetIdx === -1 || fromIdx === -1) return

  // 目标最终下标: 上半区插到目标前, 下半区插到目标后; 源在前则左移补偿
  let to = before ? targetIdx : targetIdx + 1
  if (fromIdx < to) to -= 1
  if (pluginStore.movePlugin(fromId, to)) {
    // 选中跟随被移动项
    if (currentSide.value === 'right') {
      detailIndex.value = pluginStore.plugins.findIndex(p => p.id === fromId)
    }
    playSound('click')
  }
}

const onDragEnd = () => {
  dragPluginId.value = null
  dropTargetId.value = null
}

// ========== 决策46: 键盘排序 (Ctrl+↑/↓) ==========
const moveCurrent = (delta) => {
  const list = plugins.value
  const from = detailIndex.value
  if (from < 0 || from >= list.length) return
  const to = from + delta
  if (to < 0 || to >= list.length) return
  if (pluginStore.movePlugin(list[from].id, to)) {
    detailIndex.value = to
    playSound('click')
  }
}

// Execute action for selected detail item (Enter key)
const executeDetailAction = () => {
  if (detailIndex.value < 0) return
  
  switch (selectedTab.value) {
    case 0: // Sound settings
      if (detailIndex.value === 0) {
        // Toggle sound effects
        toggleSoundEnabled()
      } else if (detailIndex.value === 2) {
        // Test sound
        testSound()
      }
      break
    case 1: // Theme settings
      if (detailIndex.value === 0) {
        setTheme('light')
      } else if (detailIndex.value === 1) {
        setTheme('dark')
      }
      break
    case 2: // Language settings
      if (detailIndex.value === 0) {
        setLanguage('zh')
      } else if (detailIndex.value === 1) {
        setLanguage('en')
      }
      break
    case 3: // Plugin settings
      // Plugin items are display only, no action on Enter
      break
  }
}

// Keyboard navigation
const handleKeydown = (e) => {
  // 如果焦点在输入元素中，只处理Escape键
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    if (e.key === 'Escape') {
      closeSettings()
    }
    return
  }

  // 弹窗打开时键盘交给 Modal (其自带 document 监听), 设置页不响应 (决策46)
  if (modalVisible.value) {
    return
  }
  
  if (e.key === 'Escape') {
    closeSettings()
    return
  }
  
  // 左侧栏导航
  if (currentSide.value === 'left') {
    // 上下箭头键切换标签页
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault()
      selectedTab.value = Math.max(0, selectedTab.value - 1)
      detailIndex.value = -1
      playSound('click')
    }
    
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      e.preventDefault()
      selectedTab.value = Math.min(tabs.value.length - 1, selectedTab.value + 1)
      detailIndex.value = -1
      playSound('click')
    }
    
    // 右箭头键或Enter键切换到右侧栏
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (detailItemCount.value > 0) {
        currentSide.value = 'right'
        detailIndex.value = 0
        playSound('click')
      }
    }
    
    // 左箭头键无操作（已在最左侧）
  }
  
  // 右侧栏导航
  else if (currentSide.value === 'right') {
    // Ctrl+↑/↓ 移动排序 (决策46, 仅插件页)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      if (selectedTab.value === 3) {
        moveCurrent(e.key === 'ArrowUp' ? -1 : 1)
      }
      return
    }

    // Delete/Backspace 打开移除确认 (决策46, 仅插件页)
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTab.value === 3 && detailIndex.value >= 0) {
      e.preventDefault()
      requestRemove(plugins.value[detailIndex.value])
      return
    }

    // 上下箭头键移动细节焦点
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault()
      if (detailItemCount.value > 0) {
        detailIndex.value = Math.max(0, detailIndex.value - 1)
        playSound('click')
      }
    }
    
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      e.preventDefault()
      if (detailItemCount.value > 0) {
        detailIndex.value = Math.min(detailItemCount.value - 1, detailIndex.value + 1)
        playSound('click')
      }
    }
    
    // 左箭头键：直接回到左侧栏
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      e.preventDefault()
      currentSide.value = 'left'
      detailIndex.value = -1
      playSound('click')
    }
    
    // 右箭头键：移动到下一个项目
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      e.preventDefault()
      if (detailItemCount.value > 0) {
        detailIndex.value = Math.min(detailItemCount.value - 1, detailIndex.value + 1)
        playSound('click')
      }
    }
    
    // Enter键：执行当前选中项
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      executeDetailAction()
    }
  }
}

// Lifecycle
onMounted(() => {
  loadSettings()
  document.addEventListener('keydown', handleKeydown)
  
  // Get platform info
  if (window.nodeInfo) {
    platform.value = window.nodeInfo.platform
  }

  // 决策46: 运行状态实时化 (初始拉取 + 生命周期事件增删)
  refreshOccupied()
  try {
    if (window.electronAPI) {
      if (window.electronAPI.onPluginStarted) {
        unsubPluginStarted = window.electronAPI.onPluginStarted((pluginId) => {
          if (pluginId && !occupiedIds.value.includes(pluginId)) {
            occupiedIds.value.push(pluginId)
          }
        })
      }
      if (window.electronAPI.onPluginClosed) {
        unsubPluginClosed = window.electronAPI.onPluginClosed((pluginId) => {
          occupiedIds.value = occupiedIds.value.filter(id => id !== pluginId)
        })
      }
    }
  } catch (e) {
    console.warn('[Settings] Failed to register plugin lifecycle handlers:', e)
  }

  // 已移除名单
  removedRecords.value = pluginStore.getRemovedRecords()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  const safeUnsub = (fn) => { try { if (fn) fn() } catch (e) { /* ignore */ } }
  safeUnsub(unsubPluginStarted)
  unsubPluginStarted = null
  safeUnsub(unsubPluginClosed)
  unsubPluginClosed = null
})
</script>

<style scoped>
.settings-view {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--bg-secondary);
  border-radius: 50px;
  border: 3px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 1002;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Header */
.settings-header {
  height: 50px;
  background: var(--bg-secondary);
  border-bottom: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.settings-logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-icon {
  font-size: 20px;
}

.logo-text {
  font-family: 'Press Start 2P', cursive;
  font-size: 14px;
  color: var(--accent-primary);
}

.settings-close-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--accent-primary);
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}



/* Content */
.settings-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* Navigation */
.settings-nav {
  width: 120px;
  background: var(--bg-primary);
  border-right: 2px solid var(--border-color);
  padding: 16px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.nav-tab.selected {
  background: var(--bg-card);
  color: var(--accent-primary);
  border-left: 3px solid var(--accent-primary);
}

.tab-icon {
  font-size: 16px;
}

.tab-label {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 11px;
}

/* Panel */
.settings-panel {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.tab-content {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Setting Groups */
.setting-group {
  background: var(--bg-card);
  border-radius: 12px;
  border: 2px solid var(--border-color);
  padding: 20px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
}

.setting-row:last-child {
  border-bottom: none;
}

.setting-row.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.setting-label {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 13px;
  color: var(--text-primary);
}

/* Toggle Switch (small) */
.toggle-switch.small {
  width: 40px;
  height: 20px;
}

.toggle-switch.small .toggle-knob {
  width: 14px;
  height: 14px;
}

.toggle-switch.small.active .toggle-knob {
  left: 22px;
}

/* Volume Control */
.volume-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.volume-icon {
  font-size: 16px;
}

.volume-slider {
  width: 120px;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--toggle-bg);
  border-radius: 3px;
  outline: none;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: var(--accent-primary);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 8px var(--shadow-color);
}

.volume-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: var(--accent-primary);
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: 0 0 8px var(--shadow-color);
}

.volume-value {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 11px;
  color: var(--text-secondary);
  min-width: 35px;
  text-align: right;
}

/* Test Sound Button */
.test-sound-btn {
  margin-top: 16px;
  padding: 10px 20px;
  background: var(--bg-slot);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  color: var(--accent-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
}

.test-sound-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  font-size: 12px;
}

.btn-text {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 11px;
}

/* Theme Options */
.theme-options {
  display: flex;
  gap: 16px;
}

.theme-option {
  flex: 1;
  padding: 16px;
  background: var(--bg-slot);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.theme-option.active {
  border-color: var(--accent-primary);
  box-shadow: 0 0 15px var(--shadow-color);
}

.theme-preview {
  width: 80px;
  height: 60px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid var(--border-color);
}

.theme-preview.light {
  background: #FFF8E8;
}

.theme-preview.light .preview-header {
  height: 12px;
  background: #FFF3D6;
  border-bottom: 1px solid #E8DCC8;
}

.theme-preview.light .preview-body {
  height: 48px;
  background: #FFFEFB;
}

.theme-preview.dark {
  background: #0a0a0a;
}

.theme-preview.dark .preview-header {
  height: 12px;
  background: #141414;
  border-bottom: 1px solid #333;
}

.theme-preview.dark .preview-body {
  height: 48px;
  background: #1a1a1a;
}

.theme-name {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 11px;
  color: var(--text-primary);
}

/* Language Options */
.language-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.language-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--bg-slot);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.language-option.active {
  border-color: var(--accent-primary);
  box-shadow: 0 0 15px var(--shadow-color);
}

.lang-flag {
  font-size: 24px;
}

.lang-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.lang-name {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 13px;
  color: var(--text-primary);
}

.lang-native {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 14px;
  color: var(--text-secondary);
}

.lang-check {
  font-size: 16px;
  color: var(--accent-primary);
  font-weight: bold;
}

/* Plugin List */
.plugin-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.plugin-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-slot);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.plugin-icon {
  font-size: 24px;
}

.plugin-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.plugin-name {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 13px;
  color: var(--text-primary);
}

.plugin-version {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 10px;
  color: var(--text-muted);
}

.plugin-status {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 10px;
}

.plugin-status.running {
  color: var(--accent-primary);
}

.plugin-status.idle,
.plugin-status.unloaded {
  color: var(--text-muted);
}

/* ========== 插件页: 拖拽排序 / 移除 / 已移除 (决策46) ========== */
.plugin-item {
  cursor: pointer;
}

.plugin-grip {
  font-size: 14px;
  line-height: 1;
  color: var(--text-muted);
  cursor: grab;
  user-select: none;
  padding: 2px 0;
  transition: color 0.15s ease;
}

.plugin-item:hover .plugin-grip {
  color: var(--accent-primary);
}

.plugin-item:active .plugin-grip {
  cursor: grabbing;
}

.plugin-item.dragging {
  opacity: 0.4;
}

.plugin-item.drop-before {
  border-top: 2px solid var(--accent-primary);
}

.plugin-item.drop-after {
  border-bottom: 2px solid var(--accent-primary);
}

.plugin-remove-btn {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.plugin-remove-btn:hover {
  color: #ff0040;
  border-color: #ff0040;
  box-shadow: 0 0 8px rgba(255, 0, 64, 0.4);
}

/* 已移除区 */
.removed-section {
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-color);
}

.removed-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 2px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 11px;
  transition: color 0.15s ease;
}

.removed-toggle:hover {
  color: var(--accent-secondary);
}

.removed-arrow {
  font-size: 11px;
}

.removed-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}

.removed-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--bg-slot);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  opacity: 0.75;
}

.removed-icon {
  font-size: 16px;
}

.removed-name {
  flex: 1;
  min-width: 0;
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.restore-btn {
  flex-shrink: 0;
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid var(--accent-primary);
  background: transparent;
  color: var(--accent-primary);
  cursor: pointer;
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 10px;
  transition: all 0.15s ease;
}

.restore-btn:hover {
  background: var(--accent-primary);
  color: #0a0a0a;
}

/* About Section */
.about-section {
  text-align: center;
  padding: 32px 20px;
}

.about-logo {
  font-size: 48px;
  margin-bottom: 16px;
}

.about-title {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 20px;
  color: var(--accent-primary);
  margin-bottom: 8px;
  text-shadow: 0 0 10px var(--accent-primary);
}

.about-version {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.about-desc {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: 24px;
  line-height: 1.6;
}

.about-links {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.about-link {
  display: flex;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--bg-slot);
  border-radius: 6px;
}

.link-label {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 11px;
  color: var(--text-muted);
}

.link-value {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 11px;
  color: var(--text-primary);
}

/* Footer */
.settings-footer {
  height: 36px;
  background: var(--bg-secondary);
  border-top: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

.footer-hint {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 11px;
  color: var(--text-muted);
}

/* Light mode overrides */
.light-mode .settings-view {
  background: var(--bg-secondary);
  border-color: var(--border-color);
}

.light-mode .settings-nav {
  background: var(--bg-primary);
  border-color: var(--border-color);
}

.light-mode .nav-tab.selected {
  background: var(--bg-card);
  border-left-color: var(--accent-primary);
}

.light-mode .theme-preview.light {
  border-color: #E8DCC8;
}

.light-mode .theme-preview.dark {
  border-color: #333;
}

/* Detail item base */
.detail-item {
  border: 2px solid transparent;
  border-radius: 8px;
  transition: all 0.2s ease;
}

/* Detail item selected state */
.detail-item.selected {
  background: var(--bg-card);
  border-color: var(--accent-primary);
  box-shadow: 0 0 12px var(--accent-primary), inset 0 0 8px rgba(0, 255, 136, 0.1);
  transform: translateY(-2px);
  padding-left: 12px;
  padding-right: 12px;
}

/* Remove focus outline */
button:focus,
.nav-tab:focus,
.theme-option:focus,
.language-option:focus,
.test-sound-btn:focus,
.toggle-switch:focus,
.settings-close-btn:focus {
  outline: none;
}

/* Toggle with status */
.toggle-with-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* In Use Tag */
.in-use-tag {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 9px;
  color: var(--accent-primary);
  background: var(--bg-slot);
  padding: 3px 8px;
  border-radius: 4px;
  white-space: nowrap;
}

/* Language check (deprecated, replaced by in-use-tag) */
.lang-check {
  display: none;
}
</style>
