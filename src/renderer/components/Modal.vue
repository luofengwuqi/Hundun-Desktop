<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div class="modal">
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
          :class="btn.class"
          @click="handleBtnClick(btn.action)"
        >
          {{ btn.text }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
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
  }
})

const emit = defineEmits(['close'])

const handleClose = () => {
  emit('close')
}

const handleBtnClick = (action) => {
  if (action && typeof action === 'function') {
    action()
  } else {
    emit('close')
  }
}
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

.modal-left {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 32px 36px;
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
  gap: 12px;
  min-width: 0;
}

.modal-title {
  font-family: 'Press Start 2P', cursive;
  font-size: 16px;
  color: var(--accent-primary);
}

.modal-message {
  font-size: 15px;
  color: var(--text-secondary);
  line-height: 1.7;
}

.modal-right {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px;
  justify-content: center;
  align-items: center;
  min-width: 160px;
  background: rgba(0, 0, 0, 0.15);
}

.modal-btn {
  font-family: 'Press Start 2P', cursive;
  font-size: 10px;
  padding: 14px 24px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.2s ease;
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

.modal-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.3);
}

.modal-btn:active {
  transform: translateY(2px);
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
