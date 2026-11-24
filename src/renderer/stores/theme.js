import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import {
  SETTING_KEY,
  getSettingMigrating,
  setSetting,
  onSettingsChanged
} from '../utils/app-settings'

// ========== 主题注册表 (决策55) ==========
// 官方样式: 馄饨黑 (原深色) / 馄饨黄 (原浅色), 视觉不变, 仅确立官方身份
// 非官方主题: 由用户/社区开发, 可自由破坏布局规则 (须保留按键功能)
// 主题只影响母程序; 子程序启动时仅继承官方基底 (base: dark/light), 之后自行管理
export const THEME_REGISTRY = [
  { id: 'hun-tun-black', official: true, base: 'dark', labelKey: 'settings.hunTunBlack' },
  { id: 'hun-tun-yellow', official: true, base: 'light', labelKey: 'settings.hunTunYellow' },
  { id: 'handheld', official: false, base: 'dark', labelKey: 'settings.handheld', preview: 'handheld' },
  // 决策61: 接触印样 —— 灯箱 + 35mm 胶片整条, 卡带横向重排为底片画幅 (布局级破坏)
  { id: 'contact-sheet', official: false, base: 'dark', labelKey: 'settings.contactSheet', preview: 'contact' }
]

export const ALL_THEMES = THEME_REGISTRY.map(t => t.id)
export const OFFICIAL_THEMES = THEME_REGISTRY.filter(t => t.official).map(t => t.id)

// 旧主题名迁移 (dark/light 时代与决策54 试验品一并归位; 上一版产出不保留)
const LEGACY_THEME_MAP = {
  dark: 'hun-tun-black',
  light: 'hun-tun-yellow',
  neon: 'hun-tun-black',
  gameboy: 'hun-tun-black'
}

// 主题 → body class (官方黑 = :root 默认变量块, 无 class)
const themeBodyClass = (name) => {
  if (name === 'hun-tun-yellow') return 'light-mode'
  if (name === 'handheld') return 'handheld-mode'
  if (name === 'contact-sheet') return 'contact-mode'
  return null
}

// 主题切换时需要清掉的旧 body class (新增非官方主题时同步追加)
const THEME_BODY_CLASSES = ['light-mode', 'handheld-mode', 'contact-mode']

export const useThemeStore = defineStore('theme', () => {
  // 状态 (isDarkMode = 基底语义: 拨动开关/子程序继承均基于官方黑黄)
  const isDarkMode = ref(true)
  const theme = ref('hun-tun-black')

  const themeMeta = () => THEME_REGISTRY.find(t => t.id === theme.value) || THEME_REGISTRY[0]
  const isOfficial = () => themeMeta().official

  const applyBodyClass = (name) => {
    document.body.classList.remove(...THEME_BODY_CLASSES)
    const cls = themeBodyClass(name)
    if (cls) document.body.classList.add(cls)
  }

  // 从设置加载主题 (决策66: 数据源 = user-data/settings.json, 老键首次读取时自动补写)
  // 非法值/旧值迁移, 兜底馄饨黑
  const loadTheme = () => {
    let saved = getSettingMigrating(SETTING_KEY.theme, null)
    if (typeof saved !== 'string') return
    if (LEGACY_THEME_MAP[saved]) {
      const migrated = LEGACY_THEME_MAP[saved]
      // 老主题名(dark/light/neon/gameboy) → 官方主题, 顺手把规范化后的值写回配置
      saved = migrated
      setSetting(SETTING_KEY.theme, migrated)
    }
    if (ALL_THEMES.includes(saved)) {
      theme.value = saved
      isDarkMode.value = themeMeta().base === 'dark'
      applyBodyClass(saved)
    }
  }

  // 二值拨动开关: 永远在官方馄饨黑/馄饨黄之间切换
  // (非官方主题下拨动开关 = 回到对应基底的官方样式)
  const toggleTheme = () => {
    setTheme(isDarkMode.value ? 'hun-tun-yellow' : 'hun-tun-black')
  }

  // 设置主题
  const setTheme = (newTheme) => {
    if (!ALL_THEMES.includes(newTheme)) newTheme = 'hun-tun-black'
    theme.value = newTheme
    isDarkMode.value = themeMeta().base === 'dark'
    setSetting(SETTING_KEY.theme, newTheme)
    applyBodyClass(newTheme)
  }

  // 其他母窗口(镜像)改了主题 → 本窗口跟着换 (决策66: 设置已不再依赖 localStorage 同源共享)
  onSettingsChanged((snapshot) => {
    const incoming = snapshot && snapshot.theme
    if (typeof incoming !== 'string' || incoming === theme.value) return
    if (!ALL_THEMES.includes(incoming)) return
    theme.value = incoming
    isDarkMode.value = themeMeta().base === 'dark'
    applyBodyClass(incoming)
  })

  // 兼容旧路径: 直接改 isDarkMode 的调用方 (现无, 保留防御)
  watch(isDarkMode, (newValue) => {
    if ((themeMeta().base === 'dark') !== newValue) {
      setTheme(newValue ? 'hun-tun-black' : 'hun-tun-yellow')
    }
  })

  // 初始化
  applyBodyClass(theme.value)
  loadTheme()

  return {
    isDarkMode,
    theme,
    isOfficial,
    toggleTheme,
    setTheme,
    loadTheme
  }
})
