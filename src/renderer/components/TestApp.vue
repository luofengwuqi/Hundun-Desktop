<template>
  <div class="test-app">
    <!-- 装饰螺丝 (仅底部) -->
    <div class="deco-screw screw-bl"></div>
    <div class="deco-screw screw-br"></div>

    <!-- 头部 -->
    <header class="test-header">
      <div class="test-title-row">
        <span class="test-icon">🧪</span>
        <span class="test-title">TEST</span>
      </div>
      <!-- 右上角返回按钮 -->
      <button class="test-close-btn" @click="$emit('returnToParent')" title="返回母程序">
        ✕
      </button>
    </header>

    <!-- 内容 -->
    <main class="test-content">
      <div class="test-grid">
        <div class="test-cell" v-for="i in 9" :key="i" :style="{ animationDelay: `${i * 0.08}s` }">
          <div class="cell-inner"></div>
        </div>
      </div>
      <div class="test-status">
        <span class="status-dot"></span>
        <span class="status-text">ALL SYSTEMS GO</span>
      </div>
    </main>

    <!-- 底部 -->
    <footer class="test-footer">
      <span class="test-version">v0.0.1</span>
    </footer>
  </div>
</template>

<script setup>
defineEmits(['returnToParent'])
</script>

<style scoped>
.test-app {
  width: 100%;
  height: 100%;
  background: var(--bg-secondary);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* CRT Scanline */
.test-app::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, var(--scanline-opacity, 0.03)) 0px,
    rgba(0, 0, 0, var(--scanline-opacity, 0.03)) 1px,
    transparent 1px,
    transparent 2px
  );
  pointer-events: none;
  z-index: 100;
}

/* 装饰螺丝 */
.deco-screw {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--border-color);
  border-radius: 50%;
  z-index: 101;
}
.deco-screw::before {
  content: '+';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 6px;
  color: #000;
}
.screw-tl { top: 12px; left: 12px; }
.screw-tr { top: 12px; right: 12px; }
.screw-bl { bottom: 15px; left: 20px; }
.screw-br { bottom: 15px; right: 20px; }

/* Header */
.test-header {
  height: 44px;
  background: var(--bg-secondary);
  border-bottom: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  -webkit-app-region: drag;
  flex-shrink: 0;
  position: relative;
}

.test-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.test-icon {
  font-size: 16px;
}

.test-title {
  font-family: 'Press Start 2P', monospace;
  font-size: 12px;
  color: var(--accent-primary);
  letter-spacing: 3px;
  text-shadow: 0 0 10px var(--accent-primary);
}

/* 右上角返回按钮 */
.test-close-btn {
  position: absolute;
  top: 8px;
  right: 12px;
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
  -webkit-app-region: no-drag;
  z-index: 102;
}

.test-close-btn:hover {
  border-color: var(--accent-secondary, #ff0080);
  color: var(--accent-secondary, #ff0080);
  box-shadow: 0 0 12px rgba(255, 0, 128, 0.4);
  transform: scale(1.1);
}

/* Content */
.test-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 16px;
}

.test-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  width: 180px;
}

.test-cell {
  aspect-ratio: 1;
  animation: cellFadeIn 0.4s ease-out both;
}

.cell-inner {
  width: 100%;
  height: 100%;
  background: var(--bg-card);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.test-cell:hover .cell-inner {
  border-color: var(--accent-primary);
  box-shadow: 0 0 12px var(--shadow-color);
  transform: scale(1.08);
}

.test-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 6px;
  height: 6px;
  background: var(--accent-primary);
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-text {
  font-family: 'Press Start 2P', monospace;
  font-size: 7px;
  color: var(--text-muted);
  letter-spacing: 2px;
}

/* Footer */
.test-footer {
  height: 32px;
  background: var(--bg-secondary);
  border-top: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.test-version {
  font-family: 'Press Start 2P', monospace;
  font-size: 7px;
  color: var(--text-muted);
}

@keyframes cellFadeIn {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

/* Light mode */
.light-mode .test-app {
  background: var(--bg-secondary);
}

.light-mode .cell-inner {
  background: var(--bg-card);
  border-color: var(--border-color);
}

.light-mode .cell-inner:hover {
  border-color: var(--accent-primary);
  box-shadow: 0 0 12px var(--shadow-color);
}

.light-mode .test-close-btn {
  background: var(--bg-slot, #FFE8B8);
}
</style>
