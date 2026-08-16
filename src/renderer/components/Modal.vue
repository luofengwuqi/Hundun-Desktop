<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div class="modal" :class="{ 'modal-large': size === 'large' }">
      <!-- 左侧：图标和信息 -->
      <div class="modal-left">
        <div class="modal-icon">{{ icon }}</div>
        <div class="modal-info">
          <div class="modal-title">{{ title }}</div>
          <div class="modal-message" v-html="message"></div>
        </div>
      </div>
      <!-- 右侧：操作按钮 -->
      <div class="modal-right">
        <button 
          v-for="(btn, idx) in buttons" 
          :key="idx"
          class="modal-btn" 
          :class="[btn.class, { selected: selectedBtnIdx === idx }]"
          @click="handleBtnClick(idx, btn.action)"
          @mouseenter="handleBtnHover(idx)"
        >
          {{ btn.text }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  icon: {
    type: String,
    default: '🎮'
  },
  title: {
    type: String,
    default: '确认'
  },
  message: {
    type: String,
    default: ''
  },
  buttons: {
    type: Array,
    default: () => [{ text: '确定', class: 'primary', action: null }]
  },
  size: {
    type: String,
    default: 'normal',
    validator: (value) => ['normal', 'large'].includes(value)
  }
})

const emit = defineEmits(['close'])

// 选中的按钮索引
const selectedBtnIdx = ref(-1)

// 执行按钮操作
const executeBtnAction = (action) => {
  if (action && typeof action === 'function') {
    action()
  } else {
    emit('close')
  }
}

// 鼠标点击处理：第一次选中，第二次执行
const handleBtnClick = (idx, action) => {
  if (selectedBtnIdx.value === idx) {
    // 第二次点击同一按钮，执行操作
    executeBtnAction(action)
  } else {
    // 第一次点击，选中按钮
    selectedBtnIdx.value = idx
  }
}

// 鼠标悬停时选中按钮
const handleBtnHover = (idx) => {
  selectedBtnIdx.value = idx
}

// 键盘导航处理
const handleKeydown = (e) => {
  let key = e.key
  
  // WASD 映射到方向键
  if (key === 'w' || key === 'W') key = 'ArrowUp'
  if (key === 's' || key === 'S') key = 'ArrowDown'
  if (key === 'a' || key === 'A') key = 'ArrowLeft'
  if (key === 'd' || key === 'D') key = 'ArrowRight'
  
  switch (key) {
    case 'ArrowUp':
      e.preventDefault()
      if (selectedBtnIdx.value <= 0) {
        selectedBtnIdx.value = props.buttons.length - 1
      } else {
        selectedBtnIdx.value--
      }
      break
      
    case 'ArrowDown':
      e.preventDefault()
      if (selectedBtnIdx.value >= props.buttons.length - 1) {
        selectedBtnIdx.value = 0
      } else {
        selectedBtnIdx.value++
      }
      break
      
    case 'Enter':
    case ' ':
      e.preventDefault()
      if (selectedBtnIdx.value >= 0 && selectedBtnIdx.value < props.buttons.length) {
        const btn = props.buttons[selectedBtnIdx.value]
        executeBtnAction(btn.action)
      }
      break
      
    case 'Escape':
      e.preventDefault()
      emit('close')
      break
  }
}

// 组件挂载时添加键盘监听
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  // 默认选中第一个按钮
  if (props.buttons.length > 0) {
    selectedBtnIdx.value = 0
  }
})

// 组件卸载时移除键盘监听
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9998;
  animation: fadeIn 0.3s ease;
}

.modal {
  display: flex;
  align-items: stretch;
  gap: 0;
  background: var(--bg-card);
  border-radius: 16px;
  border: 3px solid var(--accent-primary);
  box-shadow: var(--shadow-glow);
  animation: modalPop 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  overflow: hidden;
  min-width: 520px;
  max-width: 700px;
}

.modal.modal-large {
  min-width: 600px;
  max-width: 800px;
  min-height: 280px;
}

.modal-left {
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 40px 48px;
  flex: 1;
  border-right: 2px solid var(--border-color);
}

.modal-icon {
  font-size: 72px;
  flex-shrink: 0;
}

.modal-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.modal-title {
  font-family: 'Press Start 2P', cursive;
  font-size: 20px;
  color: var(--accent-primary);
}

.modal-message {
  font-size: 18px;
  color: var(--text-secondary);
  line-height: 1.7;
}

.modal-right {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 32px;
  justify-content: center;
  align-items: center;
  min-width: 200px;
  background: rgba(0, 0, 0, 0.15);
}

.modal-btn {
  font-family: 'Press Start 2P', cursive;
  font-size: 18px;
  padding: 10px 18px;
  border: 3px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.15s ease;
  width: 100%;
  white-space: nowrap;
}

.modal-btn.primary {
  background: var(--accent-primary);
  color: #000;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.3);
}

.modal-btn.secondary {
  background: #555;
  color: #fff;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.3);
}

.modal-btn.danger {
  background: #ff0040;
  color: #fff;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.3);
}

/* 选中状态 */
.modal-btn.selected {
  border-color: #fff;
  box-shadow: 0 0 16px rgba(255, 255, 255, 0.5), 0 4px 0 rgba(0, 0, 0, 0.3);
  transform: scale(1.05);
}

.modal-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.3);
}

/* 选中状态优先于hover */
.modal-btn.selected:hover {
  transform: scale(1.05);
  box-shadow: 0 0 16px rgba(255, 255, 255, 0.5), 0 4px 0 rgba(0, 0, 0, 0.3);
}

.modal-btn:active {
  transform: translateY(2px) scale(0.98);
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes modalPop {
  from {
    transform: scale(0.8);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
