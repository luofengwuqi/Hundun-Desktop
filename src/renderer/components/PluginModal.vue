<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div class="modal">
      <div class="modal-icon">{{ plugin.icon }}</div>
      <div class="modal-title">{{ plugin.name }}</div>
      <div class="modal-message">
        <strong>{{ plugin.icon }} {{ plugin.name }}</strong><br><br>
        这是一个子程序的占位弹窗。<br>
        实际功能将在后续开发中实现。<br><br>
        <span class="plugin-version">
          PLUGIN v{{ plugin.version }}
        </span>
      </div>
      <button class="modal-btn" @click="handleClose">返回母程序</button>
    </div>
  </div>
</template>

<script setup>
import { playSound } from '../utils/audio'

const props = defineProps({
  plugin: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close'])

const handleClose = () => {
  playSound('exit')
  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
  animation: fadeIn 0.3s ease;
}

.modal {
  width: 400px;
  background: var(--bg-card);
  border-radius: 12px;
  border: 2px solid var(--accent-primary);
  padding: 32px;
  text-align: center;
  box-shadow: var(--shadow-glow);
  animation: modalPop 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.modal-icon {
  font-size: 48px;
  margin-bottom: 16px;
  animation: bounce 0.6s ease infinite;
}

.modal-title {
  font-family: 'Press Start 2P', cursive;
  font-size: 12px;
  color: var(--accent-primary);
  margin-bottom: 12px;
  text-transform: uppercase;
}

.modal-message {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 24px;
  line-height: 1.6;
}

.plugin-version {
  font-family: 'Press Start 2P', cursive;
  font-size: 8px;
  color: var(--text-muted);
}

.modal-btn {
  font-family: 'Press Start 2P', cursive;
  font-size: 8px;
  padding: 12px 24px;
  background: var(--accent-primary);
  color: #000;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.2s ease;
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

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
</style>
