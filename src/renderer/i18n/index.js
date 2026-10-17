import zh from './zh.js'
import en from './en.js'

// 支持的语言
export const locales = {
  zh,
  en,
}

// 语言显示名称
export const localeNames = {
  zh: '中文',
  en: 'English',
}

// 语言选项 (用于设置页面)
export const localeOptions = [
  { id: 'zh', name: '中文', flag: '🇨🇳' },
  { id: 'en', name: 'English', flag: '🇺🇸' },
]

// 默认语言
const DEFAULT_LOCALE = 'zh'

// 当前语言
let currentLocale = DEFAULT_LOCALE

// 获取保存的语言
export function getSavedLocale() {
  try {
    const saved = localStorage.getItem('hundundesktop-locale')
    if (saved && locales[saved]) {
      return saved
    }
  } catch (e) {
    // ignore
  }
  return null
}

// 检测浏览器语言
function detectBrowserLocale() {
  const lang = navigator.language || navigator.userLanguage || ''
  if (lang.startsWith('zh')) return 'zh'
  if (lang.startsWith('en')) return 'en'
  return DEFAULT_LOCALE
}

// 初始化语言
export function initLocale() {
  const saved = getSavedLocale()
  if (saved) {
    currentLocale = saved
  } else {
    currentLocale = detectBrowserLocale()
  }
  return currentLocale
}

// 获取当前语言
export function getLocale() {
  return currentLocale
}

// 设置语言
export function setLocale(locale) {
  if (locales[locale]) {
    currentLocale = locale
    try {
      localStorage.setItem('hundundesktop-locale', locale)
    } catch (e) {
      // ignore
    }
  }
}

// 翻译函数
// 支持嵌套键: t('settings.sound') => locales[locale].settings.sound
// 支持参数替换: t('cartridge.alreadyRunningMsg', { name: 'FastTXT' })
export function t(key, params = {}) {
  const keys = key.split('.')
  let value = locales[currentLocale]
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k]
    } else {
      // 找不到翻译，尝试回退到默认语言
      value = locales[DEFAULT_LOCALE]
      for (const fk of keys) {
        if (value && typeof value === 'object' && fk in value) {
          value = value[fk]
        } else {
          return key // 完全找不到，返回原始key
        }
      }
      break
    }
  }
  
  if (typeof value !== 'string') {
    return key
  }
  
  // 参数替换: {paramName} -> params.paramName
  return value.replace(/\{(\w+)\}/g, (match, name) => {
    return params[name] !== undefined ? params[name] : match
  })
}

export default {
  locales,
  localeNames,
  localeOptions,
  initLocale,
  getLocale,
  setLocale,
  t,
}
