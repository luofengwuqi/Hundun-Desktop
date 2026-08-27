<template>
  <!-- 单一 .console 容器，始终存在 -->
  <div class="console" :class="{ 'light-mode': !isDarkMode, 'child-mode': currentView === 'child' }">

    <!-- ===== 母程序视图 ===== -->
    <div class="parent-view" v-if="currentView === 'parent'">
      <!-- 装饰螺丝 -->
      <div class="deco-screw screw-tl"></div>
      <div class="deco-screw screw-tr"></div>
      <div class="deco-screw screw-bl"></div>
      <div class="deco-screw screw-br"></div>

      <!-- 头部 -->
      <header class="header">
        <div class="toggle-container">
          <span class="toggle-label">深色</span>
          <div 
            class="toggle-switch" 
            :class="{ active: !isDarkMode }"
            @click="toggleTheme"
          >
            <div class="toggle-knob"></div>
          </div>
          <span class="toggle-label">浅色</span>
          <div class="status-dot"></div>
        </div>
        <!-- 右上角退出按钮 -->
        <button class="header-close-btn" @click="quitApp" title="Exit">
          ✕
        </button>
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
          <span v-else class="cartridge-info-empty">← → Select cartridge</span>
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
            <span v-else class="slot-empty">Drag to start</span>
          </div>
        </div>
      </main>

      <!-- 底部 -->
      <footer class="footer">
        <span class="footer-info">HUNDUN LITE</span>
      </footer>
    </div>

    <!-- ===== 子程序视图 ===== -->
    <!-- KeepAlive 必须常驻挂载才能保留缓存；v-show 控制容器显隐，v-if 控制组件缓存 -->
    <div class="child-view" v-show="currentView === 'child'">
      <KeepAlive>
        <component
          v-if="currentView === 'child'"
          :is="currentChildComponent"
          @return-to-parent="returnToParent"
        />
      </KeepAlive>
    </div>

    <!-- ===== 加载蒙版 (在 .console 内部，绝对定位覆盖全部内容) ===== -->
    <LoadingMask :phase="maskPhase" :childMode="currentView === 'child'" />

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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useThemeStore } from './stores/theme'
import { usePluginStore } from './stores/plugin'
import { playSound } from './utils/audio'
import Modal from './components/Modal.vue'
import LoadingMask from './components/LoadingMask.vue'
import TestApp from './components/TestApp.vue'
import CalculatorApp from './components/CalculatorApp.vue'
import FastTXTApp from './components/FastTXTApp.vue'

const themeStore = useThemeStore()
const pluginStore = usePluginStore()

// ========== 过渡状态 ==========
const currentView = ref('parent') // 'parent' | 'child'
const maskPhase = ref('hidden')   // 'hidden' | 'entering' | 'visible' | 'exiting'
const currentAppPlugin = ref(null)
const PARENT_SIZE = { width: 800, height: 540 }
const isTransitioning = ref(false) // 防止动画重入

// 根据当前子程序插件 id 分发对应的子程序组件
const currentChildComponent = computed(() => {
  const id = currentAppPlugin.value?.id
  if (id === 'calculator') return CalculatorApp
  if (id === 'fast-txt') return FastTXTApp
  return TestApp
})

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

// DOM 引用
const shelfRef = ref(null)
const slotRef = ref(null)

// ========== 工具函数 ==========
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// ========== 初始化 ==========
const initShelfPlugins = () => {
  shelfPlugins.value = [...allPlugins.value]
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
      'ALREADY RUNNING',
      `<strong>${plugin.icon} ${plugin.name}</strong> is already running!<br>Only one instance allowed.`,
      [{ text: 'OK', class: 'primary', action: closeModal }]
    )
    return
  }
  
  if (slotPlugin.value) {
    const currentPlugin = slotPlugin.value
    const newPlugin = plugin
    
    showModal(
      '🔌',
      'SWITCH CARTRIDGE',
      `Running: <strong>${currentPlugin.icon} ${currentPlugin.name}</strong><br><br>Switch to: <strong>${newPlugin.icon} ${newPlugin.name}</strong>`,
      [
        { text: 'Cancel', class: 'secondary', action: closeModal },
        { text: '🔌 Eject & Switch', class: 'danger', action: () => {
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

// ========== 启动子程序（过渡动画） ==========
const launchApp = async (plugin) => {
  // 防止动画重入
  if (isTransitioning.value) return
  isTransitioning.value = true
  
  try {
    playSound('OK')

    const childSize = plugin.windowSize || { width: 400, height: 400 }

    // Phase 1: 蒙版从上滑入，覆盖母程序
    maskPhase.value = 'entering'
    await sleep(900)

    // Phase 2: 蒙版完全覆盖，切换视图 + 调整窗口大小
    maskPhase.value = 'visible'
    currentView.value = 'child'
    currentAppPlugin.value = plugin

    // 窗口调整大小（蒙版覆盖期间执行）
    try {
      const { ipcRenderer } = require('electron')
      ipcRenderer.send('window-resize', { width: childSize.width, height: childSize.height })
    } catch (e) {
      console.error('Failed to resize window:', e)
    }
    await sleep(1200)

    // Phase 3: 蒙版从下滑出，露出子程序
    maskPhase.value = 'exiting'
    await sleep(900)

    maskPhase.value = 'hidden'
  } finally {
    isTransitioning.value = false
  }
}

// ========== 返回母程序（过渡动画） ==========
const returnToParent = async () => {
  // 防止动画重入
  if (isTransitioning.value) return
  isTransitioning.value = true
  
  try {
    playSound('exit')

    // Phase 1: 蒙版从上滑入，覆盖子程序
    maskPhase.value = 'entering'
    await sleep(900)

    // Phase 2: 蒙版完全覆盖，切换视图 + 恢复窗口大小
    maskPhase.value = 'visible'
    currentView.value = 'parent'
    currentAppPlugin.value = null

    // 恢复窗口大小（蒙版覆盖期间执行）
    try {
      const { ipcRenderer } = require('electron')
      ipcRenderer.send('window-resize', { width: PARENT_SIZE.width, height: PARENT_SIZE.height })
    } catch (e) {
      console.error('Failed to resize window:', e)
    }
    await sleep(1200)

    // Phase 3: 蒙版从下滑出
    maskPhase.value = 'exiting'
    await sleep(900)

    maskPhase.value = 'hidden'

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
  
  if (currentView.value === 'child') {
    await returnToParent()
  } else {
    playSound('exit')
  }
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
        'CARTRIDGE SLOT',
        'Drag a cartridge here or press Enter to insert',
        [{ text: 'OK', class: 'primary', action: closeModal }]
      )
    } else {
      showModal(
        slotPlugin.value.icon,
        slotPlugin.value.name,
        '<span style="color: var(--accent-primary);">● RUNNING</span>',
        [
          { text: '✓ Continue', class: 'primary', action: continueToChild },
          { text: '🔌 Eject', class: 'danger', action: ejectCurrentPlugin },
          { text: 'Cancel', class: 'secondary', action: closeModal }
        ],
        'large'
      )
    }
  } else {
    selectedRow.value = 1
    selectedCol.value = 2
  }
}

const handleAddApp = () => {
  showModal(
    '➕',
    'ADD APP',
    'Get more cartridge apps from the store<br>(Coming soon...)',
    [{ text: 'OK', class: 'primary', action: closeModal }]
  )
}

const handleSettings = () => {
  showModal(
    '⚙️',
    'SETTINGS',
    'Configure Hundun Lite<br>(Coming soon...)',
    [{ text: 'OK', class: 'primary', action: closeModal }]
  )
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
      'ALREADY RUNNING',
      `<strong>${plugin.icon} ${plugin.name}</strong> is already running!<br>Only one instance allowed.`,
      [{ text: 'OK', class: 'primary', action: closeModal }]
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

// ========== 继续使用（切换到子程序视图） ==========
const continueToChild = async () => {
  closeModal()
  
  // 防止动画重入
  if (isTransitioning.value) return
  
  // 如果当前在母程序视图且有运行中的子程序，切换到子程序
  if (currentView.value === 'parent' && slotPlugin.value) {
    isTransitioning.value = true
    
    try {
      playSound('OK')
      
      const plugin = slotPlugin.value
      const childSize = plugin.windowSize || { width: 400, height: 400 }

      // Phase 1: 蒙版从上滑入，覆盖母程序
      maskPhase.value = 'entering'
      await sleep(900)

      // Phase 2: 蒙版完全覆盖，切换视图 + 调整窗口大小
      maskPhase.value = 'visible'
      currentView.value = 'child'
      currentAppPlugin.value = plugin

      // 窗口调整大小（蒙版覆盖期间执行）
      try {
        const { ipcRenderer } = require('electron')
        ipcRenderer.send('window-resize', { width: childSize.width, height: childSize.height })
      } catch (e) {
        console.error('Failed to resize window:', e)
      }
      await sleep(1200)

      // Phase 3: 蒙版从下滑出，露出子程序
      maskPhase.value = 'exiting'
      await sleep(900)

      maskPhase.value = 'hidden'
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
  if (modalVisible.value) {
    if (e.key === 'Escape') closeModal()
    return
  }

  // 子程序模式下：所有按键交给子程序组件自行处理（含Esc）
  if (currentView.value === 'child') {
    return
  }
  
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
      if (currentView.value === 'child') {
        // 子程序中按Esc：返回母程序
        returnToParent()
      } else {
        // 母程序中按Esc：关闭子程序并退出
        if (slotPlugin.value) {
          // 先拔出卡带
          slotPlugin.value = null
        }
        quitApp()
      }
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
  
  // 然后复制到卡带货架
  initShelfPlugins()
  
  document.addEventListener('keydown', handleKeydown)
  
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
