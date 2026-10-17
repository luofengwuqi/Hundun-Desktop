import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  // 状态
  const isDarkMode = ref(true)
  const theme = ref('dark')

  // 从本地存储加载主题
  const loadTheme = () => {
    const savedTheme = localStorage.getItem('hundundesktop-theme')
    if (savedTheme) {
      isDarkMode.value = savedTheme === 'dark'
      theme.value = savedTheme
    }
  }

  // 切换主题
  const toggleTheme = () => {
    isDarkMode.value = !isDarkMode.value
    theme.value = isDarkMode.value ? 'dark' : 'light'
    localStorage.setItem('hundundesktop-theme', theme.value)
  }

  // 设置主题
  const setTheme = (newTheme) => {
    isDarkMode.value = newTheme === 'dark'
    theme.value = newTheme
    localStorage.setItem('hundundesktop-theme', theme.value)
  }

  // 监听主题变化
  watch(isDarkMode, (newValue) => {
    document.body.classList.toggle('light-mode', !newValue)
  }, { immediate: true })

  // 初始化
  loadTheme()

  return {
    isDarkMode,
    theme,
    toggleTheme,
    setTheme,
    loadTheme
  }
})
