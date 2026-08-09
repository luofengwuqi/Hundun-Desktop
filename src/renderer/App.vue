<template>
  <div class="console" :class="{ 'light-mode': !isDarkMode }">
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
        <span v-else class="cartridge-info-empty">← → 选择卡带</span>
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
        <!-- 左侧按钮组 -->
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
        
        <!-- 右侧卡带插槽 -->
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
          <span v-else class="slot-empty">拖入卡带启动</span>
        </div>
      </div>
    </main>

    <!-- 弹窗 -->
    <Modal
      v-if="modalVisible"
      :icon="modalIcon"
      :title="modalTitle"
      :message="modalMessage"
      :buttons="modalButtons"
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

const themeStore = useThemeStore()
const pluginStore = usePluginStore()

// ========== 状态 ==========
const isDarkMode = computed(() => themeStore.isDarkMode)

// 原始插件列表（完整）
const allPlugins = computed(() => pluginStore.plugins)

// 卡带货架（不在插槽中的）
const shelfPlugins = ref([])

// 插槽中的插件
const slotPlugin = ref(null)

// 选中状态
const selectedIndex = ref(-1)
const selectedRow = ref(0) // 0=卡带行, 1=按钮+插槽行
const selectedCol = ref(0) // 按钮行中的列: 0=+, 1=设置, 2=插槽

// 拖拽状态
const dragPlugin = ref(null)
const isDragOver = ref(false)

// 底部行按钮名称
const bottomRowNames = ['添加应用', '设置', '卡带插槽']

// 弹窗状态
const modalVisible = ref(false)
const modalIcon = ref('')
const modalTitle = ref('')
const modalMessage = ref('')
const modalButtons = ref([])

// DOM 引用
const shelfRef = ref(null)
const slotRef = ref(null)

// ========== 初始化 ==========
const initShelfPlugins = () => {
  shelfPlugins.value = [...allPlugins.value]
}

// ========== 主题切换 ==========
const toggleTheme = () => {
  playSound('change')
  themeStore.toggleTheme()
}

// ========== 卡带点击 ==========
const handleCartridgeClick = (idx) => {
  playSound('click')
  if (selectedRow.value === 0 && selectedIndex.value === idx) {
    // 双击插入
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
  
  // 检查是否已在运行
  if (slotPlugin.value && slotPlugin.value.id === plugin.id) {
    showModal(
      '⚠️',
      '重复启动',
      `<strong>${plugin.icon} ${plugin.name}</strong> 已在运行中！<br>每个应用只能启动一个实例。`,
      [{ text: '确定', class: 'primary', action: closeModal }]
    )
    return
  }
  
  // 插槽已有卡带，需要切换
  if (slotPlugin.value) {
    const currentPlugin = slotPlugin.value
    const newPlugin = plugin
    
    showModal(
      '🔌',
      '切换卡带',
      `当前运行: <strong>${currentPlugin.icon} ${currentPlugin.name}</strong><br><br>要切换为: <strong>${newPlugin.icon} ${newPlugin.name}</strong>`,
      [
        { text: '取消', class: 'secondary', action: closeModal },
        { text: '🔌 拔出并切换', class: 'danger', action: () => {
          // 拔出当前卡带
          shelfPlugins.value.push(currentPlugin)
          sortShelfPlugins()
          
          // 从列表移除新卡带
          shelfPlugins.value = shelfPlugins.value.filter(p => p.id !== newPlugin.id)
          
          // 插入新卡带
          slotPlugin.value = newPlugin
          
          // 重置选中
          selectedIndex.value = 0
          selectedRow.value = 0
          
          updateRowSelection()
          closeModal()
          playSound('bengbeng')
          
          // 自动启动
          setTimeout(() => launchApp(newPlugin), 300)
        }}
      ]
    )
    return
  }
  
  // 插槽为空，直接插入
  shelfPlugins.value = shelfPlugins.value.filter(p => p.id !== plugin.id)
  slotPlugin.value = plugin
  
  selectedIndex.value = 0
  selectedRow.value = 0
  
  updateRowSelection()
  playSound('bengbeng')
  
  setTimeout(() => launchApp(plugin), 300)
}

// ========== 拔出当前卡带 ==========
const ejectCurrentPlugin = () => {
  if (!slotPlugin.value) return
  
  const plugin = slotPlugin.value
  slotPlugin.value = null
  
  shelfPlugins.value.push(plugin)
  sortShelfPlugins()
  
  selectedIndex.value = 0
  selectedRow.value = 0
  
  updateRowSelection()
  closeModal()
  playSound('exit')
}

// ========== 排序卡带 ==========
const sortShelfPlugins = () => {
  shelfPlugins.value.sort((a, b) => {
    const aIdx = allPlugins.value.findIndex(p => p.id === a.id)
    const bIdx = allPlugins.value.findIndex(p => p.id === b.id)
    return aIdx - bIdx
  })
}

// ========== 启动应用 ==========
const launchApp = (plugin) => {
  playSound('OK')
  showModal(
    plugin.icon,
    plugin.name,
    `
      <strong>${plugin.icon} ${plugin.name}</strong><br><br>
      应用已启动！<br>
      这是一个子程序的占位弹窗。<br>
      实际功能将在后续开发中实现。
    `,
    [{ text: '返回', class: 'primary', action: closeModal }]
  )
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
        '卡带插槽',
        '将卡带拖入此处或按 Enter 键插入',
        [{ text: '确定', class: 'primary', action: closeModal }]
      )
    } else {
      showModal(
        slotPlugin.value.icon,
        '运行中的应用',
        `
          <strong>${slotPlugin.value.icon} ${slotPlugin.value.name}</strong><br><br>
          <span style="color: var(--accent-primary);">● 运行中</span><br><br>
          是否要拔出此卡带？
        `,
        [
          { text: '取消', class: 'secondary', action: closeModal },
          { text: '🔌 拔出卡带', class: 'danger', action: ejectCurrentPlugin }
        ]
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
    '添加应用',
    '从应用商店获取更多卡带应用<br>（功能开发中...）',
    [{ text: '确定', class: 'primary', action: closeModal }]
  )
}

const handleSettings = () => {
  showModal(
    '⚙️',
    '母程序设置',
    '配置Hundun Lite母程序<br>（功能开发中...）',
    [{ text: '确定', class: 'primary', action: closeModal }]
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
  
  // 检查是否已在运行
  if (slotPlugin.value && slotPlugin.value.id === plugin.id) {
    showModal(
      '⚠️',
      '重复启动',
      `<strong>${plugin.icon} ${plugin.name}</strong> 已在运行中！<br>每个应用只能启动一个实例。`,
      [{ text: '确定', class: 'primary', action: closeModal }]
    )
    dragPlugin.value = null
    return
  }
  
  // 插槽已有卡带，先弹出
  if (slotPlugin.value) {
    shelfPlugins.value.push(slotPlugin.value)
    sortShelfPlugins()
  }
  
  // 从我的应用中移除
  shelfPlugins.value = shelfPlugins.value.filter(p => p.id !== plugin.id)
  
  // 添加到插槽
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

const handleModalClose = () => {
  closeModal()
}

// ========== 键盘导航 ==========
const handleKeydown = (e) => {
  // 弹窗打开时只处理 Escape
  if (modalVisible.value) {
    if (e.key === 'Escape') closeModal()
    return
  }
  
  // 映射 WASD + 空格 到方向键和回车
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
          case 0:
            handleAddApp()
            break
          case 1:
            handleSettings()
            break
          case 2:
            handleSlotClick()
            break
        }
      }
      break
      
    case 'Escape':
      closeModal()
      break
  }
}

// ========== 生命周期 ==========
onMounted(() => {
  initShelfPlugins()
  document.addEventListener('keydown', handleKeydown)
  
  // 默认选中第一个卡带
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
