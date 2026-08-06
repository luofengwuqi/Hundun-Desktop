<template>
  <div class="console" :class="{ 'light-mode': !isDarkMode }">
    <!-- 装饰螺丝 -->
    <div class="deco-screw screw-tl"></div>
    <div class="deco-screw screw-tr"></div>
    <div class="deco-screw screw-bl"></div>
    <div class="deco-screw screw-br"></div>

    <!-- 头部 -->
    <header class="header">
      <div class="logo">
        <div class="logo-icon">HT</div>
        <span class="logo-text">馄饨LITE</span>
      </div>

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
      <div class="section-title">卡带插槽</div>
      
      <!-- 卡带插槽 -->
      <div class="cartridge-slot" ref="slotRef">
        <span class="slot-label">将卡带拖入此处或点击下方卡带</span>
        <div class="cartridge-insert-area" ref="insertAreaRef"></div>
      </div>

      <div class="section-title">我的应用</div>

      <!-- 卡带网格 -->
      <div class="cartridge-grid">
        <CartridgeCard
          v-for="plugin in plugins"
          :key="plugin.id"
          :plugin="plugin"
          @insert="handleCartridgeInsert"
        />
      </div>
    </main>

    <!-- 底部 -->
    <footer class="footer">
      <div class="footer-info">
        <span class="footer-stat">版本 {{ version }}</span>
        <span class="footer-stat">已安装 {{ plugins.length }} 个卡带</span>
      </div>
      <div class="footer-info">
        <span class="footer-stat">按 ESC 返回</span>
      </div>
    </footer>

    <!-- 子程序弹窗 -->
    <PluginModal
      v-if="showModal"
      :plugin="currentPlugin"
      @close="closeModal"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useThemeStore } from './stores/theme'
import { usePluginStore } from './stores/plugin'
import CartridgeCard from './components/CartridgeCard.vue'
import PluginModal from './components/PluginModal.vue'
import { playSound } from './utils/audio'

const themeStore = useThemeStore()
const pluginStore = usePluginStore()

const isDarkMode = computed(() => themeStore.isDarkMode)
const plugins = computed(() => pluginStore.plugins)
const showModal = ref(false)
const currentPlugin = ref(null)
const version = ref('1.0.0')

const slotRef = ref(null)
const insertAreaRef = ref(null)

// 切换主题
const toggleTheme = () => {
  playSound('change')
  themeStore.toggleTheme()
}

// 处理卡带插入
const handleCartridgeInsert = (plugin) => {
  playSound('click')
  currentPlugin.value = plugin
  showModal.value = true
  playSound('OK')
}

// 关闭弹窗
const closeModal = () => {
  playSound('exit')
  showModal.value = false
  currentPlugin.value = null
}

// 键盘事件处理
const handleKeydown = (e) => {
  if (e.key === 'Escape' && showModal.value) {
    closeModal()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  // 播放加载音效
  playSound('loading')
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style>
/* 样式已移至 main.css */
</style>
