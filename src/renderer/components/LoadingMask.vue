<template>
  <div 
    class="loading-mask"
    :class="[maskClass, { 'mask-child-mode': childMode }]"
  >
    <div class="loading-text">
      <span class="loading-dot">.</span>
      <span class="loading-dot">.</span>
      <span class="loading-dot">.</span>
      <span class="loading-label">LOADING</span>
      <span class="loading-dot">.</span>
      <span class="loading-dot">.</span>
      <span class="loading-dot">.</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  phase: {
    type: String,
    default: 'hidden',
    validator: (v) => ['hidden', 'entering', 'visible', 'exiting'].includes(v)
  },
  childMode: {
    type: Boolean,
    default: false
  }
})

const maskClass = computed(() => ({
  'mask-entering': props.phase === 'entering',
  'mask-visible': props.phase === 'visible',
  'mask-exiting': props.phase === 'exiting',
  'mask-hidden': props.phase === 'hidden'
}))
</script>

<style scoped>
/*
  蒙版在 .console 内部，绝对定位。
  .console 有 border: 3px solid，所以蒙版的 border-radius = 50px - 3px = 47px
  蒙版尺寸始终和 .console 内容区一致（父元素 resize 时蒙版自动跟随）
*/
.loading-mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--bg-secondary, #141414);
  border-radius: 47px;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: all;
  overflow: hidden;
}

/* CRT scanline overlay on mask */
.loading-mask::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.03) 0px,
    rgba(0, 0, 0, 0.03) 1px,
    transparent 1px,
    transparent 2px
  );
  pointer-events: none;
}

/* Phase: entering - slide down from top */
.mask-entering {
  animation: maskSlideDown 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

/* Phase: visible - fully covering */
.mask-visible {
  transform: translateY(0);
}

/* Phase: exiting - slide up from bottom */
.mask-exiting {
  animation: maskSlideUp 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

/* Phase: hidden */
.mask-hidden {
  display: none;
}

/* 子程序模式 - 无圆角 */
.mask-child-mode {
  border-radius: 0;
}

/* Loading text - 自适应蒙版大小 */
.loading-text {
  display: flex;
  align-items: center;
  gap: 0.3vw;
  font-family: 'Press Start 2P', monospace;
  color: var(--accent-primary, #00ff88);
  text-shadow: 0 0 20px var(--accent-primary, #00ff88);
  user-select: none;
  /* 文字自适应：用 clamp 让字号随容器缩放 */
  font-size: clamp(10px, 2.5vw, 20px);
}

.loading-label {
  letter-spacing: 0.5vw;
  margin: 0 clamp(4px, 1vw, 12px);
}

.loading-dot {
  font-weight: bold;
  animation: dotPulse 1.2s ease-in-out infinite;
  font-size: clamp(12px, 3vw, 24px);
}

.loading-dot:nth-child(1) { animation-delay: 0s; }
.loading-dot:nth-child(2) { animation-delay: 0.15s; }
.loading-dot:nth-child(3) { animation-delay: 0.3s; }
.loading-dot:nth-child(5) { animation-delay: 0.45s; }
.loading-dot:nth-child(6) { animation-delay: 0.6s; }
.loading-dot:nth-child(7) { animation-delay: 0.75s; }

@keyframes maskSlideDown {
  0% {
    transform: translateY(-100%);
  }
  100% {
    transform: translateY(0);
  }
}

@keyframes maskSlideUp {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(100%);
  }
}

@keyframes dotPulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

/* Light mode */
.light-mode .loading-mask {
  background: var(--bg-secondary, #FFF3D6);
}

.light-mode .loading-text {
  color: var(--accent-primary, #C3272B);
  text-shadow: 0 0 20px var(--accent-primary, #C3272B);
}
</style>
