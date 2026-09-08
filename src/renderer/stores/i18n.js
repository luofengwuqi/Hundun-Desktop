import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { 
  initLocale, 
  getLocale, 
  setLocale as setI18nLocale, 
  t as translate,
  localeOptions,
  localeNames 
} from '../i18n/index.js'

export const useI18nStore = defineStore('i18n', () => {
  // 当前语言
  const locale = ref(initLocale())
  
  // 语言选项
  const options = localeOptions
  
  // 语言名称映射
  const names = localeNames
  
  // 计算属性: 当前语言显示名称
  const currentLocaleName = computed(() => names[locale.value] || locale.value)
  
  // 翻译函数 (响应式)
  const t = (key, params = {}) => {
    return translate(key, params)
  }
  
  // 设置语言
  const setLocale = (newLocale) => {
    setI18nLocale(newLocale)
    locale.value = newLocale
  }
  
  // 切换语言 (在中文和英文之间切换)
  const toggleLocale = () => {
    const newLocale = locale.value === 'zh' ? 'en' : 'zh'
    setLocale(newLocale)
  }
  
  return {
    locale,
    options,
    names,
    currentLocaleName,
    t,
    setLocale,
    toggleLocale,
  }
})
