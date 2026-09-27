<template>
  <!-- 单一 .console 容器，始终存在 -->
  <div class="console" :class="{ 'light-mode': !isDarkMode }">

    <!-- ===== 母程序视图 ===== -->
    <div class="parent-view">
      <!-- 装饰螺丝 -->
      <div class="deco-screw screw-tl"></div>
      <div class="deco-screw screw-tr"></div>
      <div class="deco-screw screw-bl"></div>
      <div class="deco-screw screw-br"></div>

      <!-- 头部 -->
      <header class="header">
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
          <div class="status-dot"></div>
        </div>
        <!-- 右上角按钮组 -->
        <div class="header-buttons">
          <button class="header-pin-btn" @click="togglePin" :class="{ pinned: isPinned }" :title="isPinned ? '取消置顶' : '窗口置顶'">
            📌
          </button>
          <button class="header-close-btn" @click="quitApp" :title="t('app.exit')">
            ✕
          </button>
        </div>
      </header>

      <!-- 主内容 -->
      <main class="content">
        <!-- 卡带信息栏 -->
        <div class="cartridge-info">
          <span v-if="selectedRow === 0 && selectedIndex >= 0 && shelfPlugins[selectedIndex]" class="cartridge-info-name">
            {{ shelfPlugins[selectedIndex].name }}
          </span>
          <span v-else-if="selectedRow === 1" class="cartridge-info-name">
            {{ bottomRowNames[selectedCol] }}
          </span>
          <span v-else class="cartridge-info-empty">{{ t('app.selectHint') }}</span>
        </div>

        <!-- 卡带货架 (水平滚动) -->
        <div class="cartridge-shelf" ref="shelfRef" @wheel="handleWheel">
          <div class="cartridge-row">
            <div 
              v-for="(plugin, idx) in shelfPlugins" 
              :key="plugin.id"
              class="cartridge"
              :class="{ 
                selected: selectedRow === 0 && idx === selectedIndex,
                dragging: dragPlugin && dragPlugin.id === plugin.id
              }"
              :style="{ '--cartridge-color': plugin.color }"
              :draggable="selectedRow === 0 && idx === selectedIndex"
              @dragstart="handleDragStart($event, plugin)"
              @dragend="handleDragEnd"
              @click="handleCartridgeClick(idx)"
            >
              <div class="cartridge-icon">{{ plugin.icon }}</div>
              <div class="cartridge-title">{{ plugin.name }}</div>
              <div class="cartridge-id">#{{ String(idx + 1).padStart(3, '0') }}</div>
            </div>
          </div>
        </div>

        <!-- 底部行：按钮 + 插槽 -->
        <div class="slot-row">
          <div class="slot-buttons">
            <button 
              class="slot-btn" 
              :class="{ selected: selectedRow === 1 && selectedCol === 0 }"
              @click="handleBtnAddClick"
            >
              <span class="slot-btn-icon">+</span>
            </button>
            <button 
              class="slot-btn" 
              :class="{ selected: selectedRow === 1 && selectedCol === 1 }"
              @click="handleBtnSettingsClick"
            >
              <span class="slot-btn-icon">⚙</span>
            </button>
          </div>
          
          <div 
            class="cartridge-slot" 
            ref="slotRef"
            :class="{ 
              selected: selectedRow === 1 && selectedCol === 2,
              'drag-over': isDragOver
            }"
            @dragover.prevent="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
            @click="handleSlotClick"
          >
            <div v-if="slotPlugin" class="slot-cartridge" :style="{ '--cartridge-color': slotPlugin.color }">
              <div class="slot-cartridge-icon">{{ slotPlugin.icon }}</div>
              <div class="slot-cartridge-name">{{ slotPlugin.name }}</div>
            </div>
            <span v-else class="slot-empty">{{ t('cartridge.slotEmpty') }}</span>
          </div>
        </div>
      </main>

      <!-- 底部 -->
      <footer class="footer">
        <span class="footer-info">HUNDUN LITE</span>
      </footer>
    </div>

    <!-- ===== 加载蒙版 (在 .console 内部，绝对定位覆盖全部内容) ===== -->
    <LoadingMask :phase="maskPhase" :childMode="false" />

    <!-- 弹窗 -->
    <Modal
      v-if="modalVisible"
      :icon="modalIcon"
      :title="modalTitle"
      :message="modalMessage"
      :buttons="modalButtons"
      :size="modalSize"
      @close="handleModalClose"
    />

    <!-- 设置页面 -->
    <Settings 
      v-if="settingsVisible"
      @close="closeSettings"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useThemeStore } from './stores/theme'
import { usePluginStore } from './stores/plugin'
import { useI18nStore } from './stores/i18n'
import { playSound } from './utils/audio'
import Modal from './components/Modal.vue'
import LoadingMask from './components/LoadingMask.vue'
import Settings from './components/Settings.vue'

const themeStore = useThemeStore()
const pluginStore = usePluginStore()
const i18nStore = useI18nStore()

// i18n
const t = (key, params = {}) => i18nStore.t(key, params)

// ========== 过渡状态 ==========
// 子程序现在是独立 BrowserWindow，不再需要 Vue 组件切换
// 过渡动画由主进程协调，母程序只负责卡带UI和按钮事件
const maskPhase = ref('hidden')
const isTransitioning = ref(false)

// ========== 母程序状态 ==========
const isDarkMode = computed(() => themeStore.isDarkMode)
const allPlugins = computed(() => pluginStore.plugins)
const shelfPlugins = ref([])
const slotPlugin = ref(null)
const selectedIndex = ref(-1)
const selectedRow = ref(0)
const selectedCol = ref(0)
const dragPlugin = ref(null)
const isDragOver = ref(false)
const bottomRowNames = ['ADD', 'SETTINGS', 'SLOT']

// 弹窗状态
const modalVisible = ref(false)
const modalIcon = ref('')
const modalTitle = ref('')
const modalMessage = ref('')
const modalButtons = ref([])
const modalSize = ref('normal')

// 设置页面状态
const settingsVisible = ref(false)

// DOM 引用
const shelfRef = ref(null)
const slotRef = ref(null)

// ========== 工具函数 ==========
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// HTML 转义（插件名/错误信息会经 v-html 渲染，防止外部内容注入）
const escapeHtml = (str) => String(str ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

// ========== 初始化 / 同步卡带货架 ==========
// 依据插件 store 重建货架（排除插槽中正在使用的卡带），
// 用于初始化以及本地安装新插件后的同步刷新
const syncShelfWithStore = () => {
  const slotId = slotPlugin.value ? slotPlugin.value.id : null
  shelfPlugins.value = allPlugins.value.filter(p => p.id !== slotId)

  const len = shelfPlugins.value.length
  if (len === 0) {
    selectedIndex.value = -1
  } else if (selectedIndex.value >= len) {
    selectedIndex.value = len - 1
  } else if (selectedIndex.value < 0) {
    selectedIndex.value = 0
  }
  updateRowSelection()
}

// ========== 主题切换 ==========
const toggleTheme = () => {
  playSound('change')
  themeStore.toggleTheme()
}

// ========== 退出程序 ==========
const quitApp = () => {
  playSound('exit')
  setTimeout(() => {
    try {
      const { ipcRenderer } = require('electron')
      ipcRenderer.send('window-close')
    } catch (e) {
      if (window.electronAPI && window.electronAPI.windowClose) {
        window.electronAPI.windowClose()
      }
    }
  }, 1000)
}

// ========== 窗口置顶 ==========
const isPinned = ref(false)
const togglePin = () => {
  isPinned.value = !isPinned.value
  playSound('click')
  try {
    const { ipcRenderer } = require('electron')
    ipcRenderer.send('window-pin', isPinned.value)
  } catch (e) {
    if (window.electronAPI && window.electronAPI.windowPin) {
      window.electronAPI.windowPin(isPinned.value)
    }
  }
}

// ========== 卡带点击 ==========
const handleCartridgeClick = (idx) => {
  playSound('click')
  if (selectedRow.value === 0 && selectedIndex.value === idx) {
    insertSelectedToSlot()
  } else {
    selectedRow.value = 0
    selectedIndex.value = idx
    updateRowSelection()
  }
}

// ========== 更新行选择状态 ==========
const updateRowSelection = () => {
  if (shelfRef.value) {
    const cartridges = shelfRef.value.querySelectorAll('.cartridge')
    if (selectedRow.value === 0 && selectedIndex.value >= 0 && cartridges[selectedIndex.value]) {
      cartridges[selectedIndex.value].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }
}

// ========== 插入卡带到插槽 ==========
const insertSelectedToSlot = () => {
  if (selectedIndex.value < 0 || selectedIndex.value >= shelfPlugins.value.length) return
  
  const plugin = shelfPlugins.value[selectedIndex.value]
  
  if (slotPlugin.value && slotPlugin.value.id === plugin.id) {
    showModal(
      '⚠️',
      t('cartridge.alreadyRunning'),
      t('cartridge.alreadyRunningMsg', { name: `${plugin.icon} ${plugin.name}` }),
      [{ text: t('cartridge.ok'), class: 'primary', action: closeModal }]
    )
    return
  }
  
  if (slotPlugin.value) {
    const currentPlugin = slotPlugin.value
    const newPlugin = plugin
    
    showModal(
      '🔌',
      t('cartridge.switchTitle'),
      t('cartridge.switchMsg', { 
        current: `${currentPlugin.icon} ${currentPlugin.name}`, 
        target: `${newPlugin.icon} ${newPlugin.name}` 
      }),
      [
        { text: t('cartridge.cancel'), class: 'secondary', action: closeModal },
        { text: t('cartridge.switchBtn'), class: 'danger', action: () => {
          shelfPlugins.value.push(currentPlugin)
          sortShelfPlugins()
          shelfPlugins.value = shelfPlugins.value.filter(p => p.id !== newPlugin.id)
          slotPlugin.value = newPlugin
          selectedIndex.value = 0
          selectedRow.value = 0
          updateRowSelection()
          closeModal()
          playSound('bengbeng')
          setTimeout(() => launchApp(newPlugin), 300)
        }}
      ]
    )
    return
  }
  
  shelfPlugins.value = shelfPlugins.value.filter(p => p.id !== plugin.id)
  slotPlugin.value = plugin
  selectedIndex.value = 0
  selectedRow.value = 0
  updateRowSelection()
  playSound('bengbeng')
  setTimeout(() => launchApp(plugin), 300)
}

// ========== 排序卡带 ==========
const sortShelfPlugins = () => {
  shelfPlugins.value.sort((a, b) => {
    const aIdx = allPlugins.value.findIndex(p => p.id === a.id)
    const bIdx = allPlugins.value.findIndex(p => p.id === b.id)
    return aIdx - bIdx
  })
}

// ========== 启动子程序（BrowserWindow + 过渡动画） ==========
const launchApp = async (plugin) => {
  // 防止动画重入
  if (isTransitioning.value) return
  isTransitioning.value = true
  
  try {
    playSound('OK')

    // 通过主进程启动子程序 BrowserWindow
    // 主进程会协调过渡动画（遮罩覆盖母程序 → 显示子程序窗口 → 遮罩退出）
    try {
      const { ipcRenderer } = require('electron')
      const result = await ipcRenderer.invoke('plugin-manager:launch', plugin.id, {
        pluginId: plugin.id
      })
      if (!result || !result.success) {
        console.error('Plugin launch failed:', result?.error)
        showModal('❌', t('error.launchFailed'), result?.error || t('error.unknownError'), [
          { text: t('cartridge.ok'), class: 'primary', action: closeModal }
        ])
      }
    } catch (e) {
      console.error('Failed to launch plugin window:', e)
      showModal('❌', t('error.launchFailed'), e.message, [
        { text: t('cartridge.ok'), class: 'primary', action: closeModal }
      ])
    }
  } finally {
    isTransitioning.value = false
  }
}

// ========== 返回母程序（过渡动画） ==========
// 注意：现在子程序是独立 BrowserWindow，返回母程序由子程序窗口触发
// 母程序通过 IPC 接收 'plugin:returnToParent' 事件来处理动画
const returnToParent = async () => {
  // 防止动画重入
  if (isTransitioning.value) return
  isTransitioning.value = true
  
  try {
    playSound('exit')

    // 通知主进程关闭子程序窗口（主进程会协调过渡动画）
    try {
      const { ipcRenderer } = require('electron')
      await ipcRenderer.invoke('plugin-manager:returnToParent')
    } catch (e) {
      console.error('Failed to return to parent:', e)
    }

    // 恢复选中状态
    selectedIndex.value = 0
    selectedRow.value = 0
    updateRowSelection()
  } finally {
    isTransitioning.value = false
  }
}

// ========== 拔出当前卡带 ==========
const ejectCurrentPlugin = async () => {
  if (!slotPlugin.value) return
  
  const plugin = slotPlugin.value
  slotPlugin.value = null
  shelfPlugins.value.push(plugin)
  sortShelfPlugins()
  selectedIndex.value = 0
  selectedRow.value = 0
  updateRowSelection()
  closeModal()
  
  // 插件现在是独立 BrowserWindow，只需要播放音效
  playSound('exit')
}

// ========== 底部按钮点击 ==========
const handleBtnAddClick = () => {
  playSound('click')
  if (selectedRow.value === 1 && selectedCol.value === 0) {
    handleAddApp()
  } else {
    selectedRow.value = 1
    selectedCol.value = 0
  }
}

const handleBtnSettingsClick = () => {
  playSound('click')
  if (selectedRow.value === 1 && selectedCol.value === 1) {
    handleSettings()
  } else {
    selectedRow.value = 1
    selectedCol.value = 1
  }
}

const handleSlotClick = () => {
  playSound('click')
  if (selectedRow.value === 1 && selectedCol.value === 2) {
    if (!slotPlugin.value) {
      showModal(
        '🎮',
        t('bottom.slot'),
        t('cartridge.slotEmpty'),
        [{ text: t('cartridge.ok'), class: 'primary', action: closeModal }]
      )
    } else {
      showModal(
        slotPlugin.value.icon,
        slotPlugin.value.name,
        `<span style="color: var(--accent-primary);">${t('cartridge.slotRunning')}</span>`,
        [
          { text: t('cartridge.continue'), class: 'primary', action: continueToChild },
          { text: t('cartridge.eject'), class: 'danger', action: ejectCurrentPlugin },
          { text: t('cartridge.cancel'), class: 'secondary', action: closeModal }
        ],
        'large'
      )
    }
  } else {
    selectedRow.value = 1
    selectedCol.value = 2
  }
}

// ========== 添加插件 (ADD 按钮) ==========
// 弹窗样式与"弹出并切换卡带"一致：左右两侧布局，
// 左侧标题区不可被选中，右侧按钮支持上下键/鼠标选中后执行
const COMMUNITY_URL = 'https://gitee.com/luofengwuqi' // 饺饨lab官网未完成，先跳转仓库

const handleAddApp = () => {
  showModal(
    '📦',
    t('addApp.title'),
    t('addApp.msg'),
    [
      { text: t('addApp.installZip'), class: 'primary', action: handleInstallZip },
      { text: t('addApp.community'), class: 'secondary', action: handleCommunity }
    ],
    'large'
  )
}

// 静默关闭弹窗（用于流程中切换到下一个弹窗，避免叠加 exit 音效）
const closeModalSilent = () => {
  modalVisible.value = false
}

const showResultModal = (icon, title, message) => {
  showModal(icon, title, message, [
    { text: t('cartridge.ok'), class: 'primary', action: closeModal }
  ])
}

// 本地安装 (.zip)：文件资源管理器选包 → 主进程审核插件架构 → 同步母程序各页面
const handleInstallZip = async () => {
  try {
    playSound('click')

    const { ipcRenderer } = require('electron')
    const zipPath = await ipcRenderer.invoke('plugin-install:pick')

    // 用户取消选择：保持 ADD 菜单打开，可继续操作
    if (!zipPath) return

    closeModalSilent()

    const result = await ipcRenderer.invoke('plugin-install:install', zipPath)

    if (result && result.success) {
      // 同步：重新扫描磁盘插件 → 卡带货架 / 设置页插件列表 / 信息栏
      await pluginStore.refreshFromDisk()
      syncShelfWithStore()
      playSound('OK')

      const p = result.plugin || {}
      showResultModal(
        '✅',
        t('addApp.successTitle'),
        t('addApp.successMsg', {
          name: escapeHtml(p.name || p.id || ''),
          version: escapeHtml(p.version || '')
        })
      )
    } else {
      playSound('error')
      showResultModal(
        '❌',
        t('addApp.failTitle'),
        escapeHtml(result && result.error ? result.error : t('error.unknownError'))
      )
    }
  } catch (error) {
    console.error('[App] Local plugin install failed:', error)
    closeModalSilent()
    playSound('error')
    showResultModal('❌', t('addApp.failTitle'), escapeHtml(error.message || t('error.unknownError')))
  }
}

// 逛逛社区：调用系统默认浏览器打开
const handleCommunity = async () => {
  try {
    const { ipcRenderer } = require('electron')
    const opened = await ipcRenderer.invoke('app:openExternal', COMMUNITY_URL)

    if (opened) {
      playSound('OK')
      closeModal()
    } else {
      closeModalSilent()
      playSound('error')
      showResultModal('🌐', t('addApp.communityFailTitle'), t('addApp.communityFailMsg'))
    }
  } catch (error) {
    console.error('[App] Open community failed:', error)
    closeModalSilent()
    playSound('error')
    showResultModal('🌐', t('addApp.communityFailTitle'), t('addApp.communityFailMsg'))
  }
}

const handleSettings = () => {
  settingsVisible.value = true
  playSound('setting')
}

const closeSettings = () => {
  settingsVisible.value = false
}

// ========== 拖拽系统 ==========
const handleDragStart = (e, plugin) => {
  dragPlugin.value = plugin
  e.dataTransfer.effectAllowed = 'move'
  playSound('click')
}

const handleDragEnd = () => {
  dragPlugin.value = null
}

const handleDragOver = (e) => {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  isDragOver.value = true
}

const handleDragLeave = () => {
  isDragOver.value = false
}

const handleDrop = () => {
  isDragOver.value = false
  if (!dragPlugin.value) return
  
  const plugin = dragPlugin.value
  
  if (slotPlugin.value && slotPlugin.value.id === plugin.id) {
    showModal(
      '⚠️',
      t('cartridge.alreadyRunning'),
      t('cartridge.alreadyRunningMsg', { name: `${plugin.icon} ${plugin.name}` }),
      [{ text: t('cartridge.ok'), class: 'primary', action: closeModal }]
    )
    dragPlugin.value = null
    return
  }
  
  if (slotPlugin.value) {
    shelfPlugins.value.push(slotPlugin.value)
    sortShelfPlugins()
  }
  
  shelfPlugins.value = shelfPlugins.value.filter(p => p.id !== plugin.id)
  slotPlugin.value = plugin
  selectedIndex.value = 0
  selectedRow.value = 0
  updateRowSelection()
  playSound('bengbeng')
  setTimeout(() => launchApp(plugin), 300)
  dragPlugin.value = null
}

// ========== 鼠标滚轮水平滚动 ==========
const handleWheel = (e) => {
  e.preventDefault()
  if (shelfRef.value) {
    shelfRef.value.scrollLeft += e.deltaY * 2
  }
}

// ========== 弹窗系统 ==========
const showModal = (icon, title, message, buttons, size = 'normal') => {
  modalIcon.value = icon
  modalTitle.value = title
  modalMessage.value = message
  modalButtons.value = buttons
  modalSize.value = size
  modalVisible.value = true
}

const closeModal = () => {
  playSound('exit')
  modalVisible.value = false
}

// ========== 继续使用（启动插件 BrowserWindow） ==========
const continueToChild = async () => {
  closeModal()
  
  // 防止动画重入
  if (isTransitioning.value) return
  
  // 如果有运行中的插件，启动其 BrowserWindow
  if (slotPlugin.value) {
    isTransitioning.value = true
    
    try {
      playSound('OK')
      
      const plugin = slotPlugin.value

      // 通过主进程启动插件 BrowserWindow
      try {
        const { ipcRenderer } = require('electron')
        await ipcRenderer.invoke('plugin-manager:launch', plugin.id, {
          pluginId: plugin.id,
          pluginPath: plugin.pluginPath || `plugins/${plugin.id}`
        })
      } catch (e) {
        console.error('Failed to launch plugin window:', e)
      }
    } finally {
      isTransitioning.value = false
    }
  }
}

const handleModalClose = () => {
  closeModal()
}

// ========== 键盘导航 ==========
const handleKeydown = (e) => {
  // 设置页面打开时，不处理其他键盘事件
  if (settingsVisible.value) {
    return
  }
  
  if (modalVisible.value) {
    if (e.key === 'Escape') closeModal()
    return
  }

  // 注意：子程序现在是独立 BrowserWindow，母程序始终处理键盘导航
  
  let key = e.key
  if (key === 'a' || key === 'A') key = 'ArrowLeft'
  if (key === 'd' || key === 'D') key = 'ArrowRight'
  if (key === 'w' || key === 'W') key = 'ArrowUp'
  if (key === 's' || key === 'S') key = 'ArrowDown'
  if (key === ' ') key = 'Enter'
  
  switch (key) {
    case 'ArrowUp':
      e.preventDefault()
      selectedRow.value = 0
      selectedCol.value = 0
      updateRowSelection()
      playSound('click')
      break
      
    case 'ArrowDown':
      e.preventDefault()
      selectedRow.value = 1
      updateRowSelection()
      playSound('click')
      break
      
    case 'ArrowRight':
      e.preventDefault()
      if (selectedRow.value === 0) {
        if (shelfPlugins.value.length > 0) {
          selectedIndex.value = (selectedIndex.value + 1) % shelfPlugins.value.length
          updateRowSelection()
        }
      } else {
        selectedCol.value = Math.min(selectedCol.value + 1, 2)
      }
      playSound('click')
      break
      
    case 'ArrowLeft':
      e.preventDefault()
      if (selectedRow.value === 0) {
        if (shelfPlugins.value.length > 0) {
          selectedIndex.value = selectedIndex.value <= 0 ? shelfPlugins.value.length - 1 : selectedIndex.value - 1
          updateRowSelection()
        }
      } else {
        selectedCol.value = Math.max(selectedCol.value - 1, 0)
      }
      playSound('click')
      break
      
    case 'Enter':
      e.preventDefault()
      if (selectedRow.value === 0) {
        if (selectedIndex.value >= 0 && selectedIndex.value < shelfPlugins.value.length) {
          insertSelectedToSlot()
        }
      } else {
        switch (selectedCol.value) {
          case 0: handleAddApp(); break
          case 1: handleSettings(); break
          case 2: handleSlotClick(); break
        }
      }
      break
      
    case 'Escape':
      // 母程序中按Esc：关闭子程序并退出
      if (slotPlugin.value) {
        // 先拔出卡带
        slotPlugin.value = null
      }
      quitApp()
      break
  }
}

// ========== 生命周期 ==========
onMounted(async () => {
  // 确保过渡状态被重置（防止上次异常退出残留）
  isTransitioning.value = false
  maskPhase.value = 'hidden'
  
  // 先初始化插件 store（确保默认插件已加载）
  await pluginStore.init()
  
  // 然后同步到卡带货架
  syncShelfWithStore()
  
  document.addEventListener('keydown', handleKeydown)
  
  // 监听主题请求（插件窗口请求当前主题状态）
  try {
    const { ipcRenderer } = require('electron')
    ipcRenderer.on('theme:get-request', () => {
      const theme = themeStore.isDarkMode ? 'dark' : 'light'
      ipcRenderer.send('theme:get-response', theme)
    })
  } catch (e) {
    console.warn('[App] Failed to register theme handler:', e)
  }
  
  if (shelfPlugins.value.length > 0) {
    selectedIndex.value = 0
    selectedRow.value = 0
    updateRowSelection()
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style>
/* 样式已移至 main.css */
</style>
