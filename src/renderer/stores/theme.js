import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

// 全部主题: dark (默认) / light / neon (赛博霓虹, 决策54) / gameboy (经典绿, 决策54)
export const ALL_THEMES = ['dark', 'light', 'neon', 'gameboy']

// 深色基底的主题 (isDarkMode 兼容语义: 开关拨到暗侧)
const DARK_BASE_THEMES = ['dark', 'neon']

export const useThemeStore = defineStore('theme', () => {
  // 状态
  const isDarkMode = ref(true)
  const theme = ref('dark')

  // 主题 → body class (dark 无 class = :root 默认变量块)
  const themeBodyClass = (name) => {
    if (name === 'light') return 'light-mode'
    if (name === 'neon') return 'neon-mode'
    if (name === 'gameboy') return 'gameboy-mode'
    return null // dark
  }

  const applyBodyClass = (name) => {
    document.body.classList.remove('light-mode', 'neon-mode', 'gameboy-mode')
    const cls = themeBodyClass(name)
    if (cls) document.body.classList.add(cls)
  }

  // 从本地存储加载主题 (非法值回退 dark)
  const loadTheme = () => {
    const savedTheme = localStorage.getItem('hundundesktop-theme')
    if (savedTheme && ALL_THEMES.includes(savedTheme)) {
      isDarkMode.value = DARK_BASE_THEMES.includes(savedTheme)
      theme.value = savedTheme
      applyBodyClass(savedTheme)
    }
  }

  // 切换主题 (二值拨动开关: 在暗/亮基底间切换, 精确主题用设置页四卡)
  const toggleTheme = () => {
    setTheme(isDarkMode.value ? 'light' : 'dark')
  }

  // 设置主题
  const setTheme = (newTheme) => {
    if (!ALL_THEMES.includes(newTheme)) newTheme = 'dark'
    isDarkMode.value = DARK_BASE_THEMES.includes(newTheme)
    theme.value = newTheme
    localStorage.setItem('hundundesktop-theme', newTheme)
    applyBodyClass(newTheme)
    broadcastThemeChange(newTheme)
  }

  // 广播主题变更到已打开的子程序窗口 (修复: theme-changed 事件原先无发送方,
  // 运行中切主题不会同步到已打开的插件窗口)
  const broadcastThemeChange = (name) => {
    try {
      const { ipcRenderer } = require('electron')
      ipcRenderer.send('theme:changed', name)
    } catch (e) {
      /* 非 Electron 环境忽略 */
    }
  }

  // 兼容旧路径: 直接改 isDarkMode 的调用方 (现无, 保留防御)
  watch(isDarkMode, (newValue) => {
    if (DARK_BASE_THEMES.includes(theme.value) !== newValue) {
      setTheme(newValue ? 'dark' : 'light')
    }
  })

  // 初始化
  applyBodyClass(theme.value)
  loadTheme()

  return {
    isDarkMode,
    theme,
    toggleTheme,
    setTheme,
    loadTheme
  }
})
