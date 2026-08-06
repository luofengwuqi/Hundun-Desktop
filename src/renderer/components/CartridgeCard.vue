<template>
  <div 
    class="cartridge" 
    :style="{ '--cartridge-color': plugin.color }"
    @click="handleClick"
    @mouseenter="handleHover"
  >
    <div class="cartridge-icon">{{ plugin.icon }}</div>
    <div class="cartridge-title">{{ plugin.name }}</div>
    <div class="cartridge-desc">{{ plugin.description }}</div>
    <div class="cartridge-id">#{{ plugin.id }}</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { playSound } from '../utils/audio'

const props = defineProps({
  plugin: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['insert'])

const isHovered = ref(false)

const handleClick = () => {
  playSound('click')
  emit('insert', props.plugin)
}

const handleHover = () => {
  isHovered.value = true
  // 可以添加悬停音效
}
</script>

<style scoped>
.cartridge {
  background: var(--cartridge-body);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  border: 2px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
  image-rendering: pixelated;
}

.cartridge::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--cartridge-color, var(--accent-primary));
  border-radius: 6px 6px 0 0;
}

/* Pixel Art Notch */
.cartridge::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 8px;
  background: var(--bg-slot);
  border-radius: 4px 4px 0 0;
}

.cartridge:hover {
  transform: translateY(-4px);
  border-color: var(--cartridge-color, var(--accent-primary));
  box-shadow: 0 0 20px var(--cartridge-color, var(--accent-primary));
}

.cartridge:active {
  transform: translateY(-2px) scale(0.98);
}

.cartridge-icon {
  width: 48px;
  height: 48px;
  background: var(--bg-primary);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  border: 2px solid var(--border-color);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
}

.cartridge-title {
  font-family: 'Press Start 2P', cursive;
  font-size: 7px;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  line-height: 1.4;
}

.cartridge-desc {
  font-size: 10px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.cartridge-id {
  font-family: 'Press Start 2P', cursive;
  font-size: 6px;
  color: var(--text-muted);
  margin-top: auto;
}
</style>
