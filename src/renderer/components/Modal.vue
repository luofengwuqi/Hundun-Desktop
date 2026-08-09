<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div class="modal">
      <div class="modal-icon">{{ icon }}</div>
      <div class="modal-title">{{ title }}</div>
      <div class="modal-message" v-html="message"></div>
      <div class="modal-buttons">
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
  z-index: 500;
  animation: fadeIn 0.3s ease;
}

.modal {
  width: 380px;
  background: var(--bg-card);
  border-radius: 12px;
  border: 2px solid var(--accent-primary);
  padding: 28px;
  text-align: center;
  box-shadow: var(--shadow-glow);
  animation: modalPop 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.modal-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.modal-title {
  font-family: 'Press Start 2P', cursive;
  font-size: 12px;
  color: var(--accent-primary);
  margin-bottom: 12px;
}

.modal-message {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 20px;
  line-height: 1.8;
}

.modal-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.modal-btn {
  font-family: 'Press Start 2P', cursive;
  font-size: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.2s ease;
}

.modal-btn.primary {
  background: var(--accent-primary);
  color: #000;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.3);
}

.modal-btn.secondary {
  background: #444;
  color: #fff;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.3);
}

.modal-btn.danger {
  background: #ff0040;
  color: #fff;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.3);
}

.modal-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 0 rgba(0, 0, 0, 0.3);
}

.modal-btn:active {
  transform: translateY(1px);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.3);
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
