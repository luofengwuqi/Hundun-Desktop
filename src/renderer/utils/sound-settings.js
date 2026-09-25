// 音效设置持久化 (localStorage)
// 供 utils/audio.js (启动时应用一次) 与 Settings.vue (读写) 共用，避免 key/默认值重复定义

const STORAGE_KEY = 'huntun-lite-settings'

// 默认值 (与 Settings 页面默认一致: 开启音效, 音量 50%)
export const DEFAULT_SOUND_SETTINGS = Object.freeze({
  soundEnabled: true,
  volume: 50
})

// 读取音效设置 (无存档/解析失败时返回默认值)
export const loadSoundSettings = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return { ...DEFAULT_SOUND_SETTINGS }

    const data = JSON.parse(saved)
    const volume = Number(data.volume)
    return {
      soundEnabled: data.soundEnabled !== false,
      volume: Number.isFinite(volume)
        ? Math.max(0, Math.min(100, volume))
        : DEFAULT_SOUND_SETTINGS.volume
    }
  } catch (e) {
    console.warn('[sound-settings] Failed to load settings:', e)
    return { ...DEFAULT_SOUND_SETTINGS }
  }
}

// 保存音效设置
export const saveSoundSettings = (settings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      soundEnabled: settings.soundEnabled !== false,
      volume: settings.volume
    }))
  } catch (e) {
    console.warn('[sound-settings] Failed to save settings:', e)
  }
}

export default {
  DEFAULT_SOUND_SETTINGS,
  loadSoundSettings,
  saveSoundSettings
}
