// 音效设置持久化 (决策66: user-data/settings.json 的 sound 节点)
// 供 utils/audio.js (启动时应用一次) 与 Settings.vue (读写) 共用，避免 key/默认值重复定义
//
// 同时负责把设置镜像推送给主进程 (src/main/sound-settings.js):
//   主进程缓存后广播给插件窗口, 插件直放音效按同一份设置播放
//   (修复: 插件曾硬编码 0.5 音量, 无视音量滑块与静音开关)
//
// 决策66 变更: 原存储是 localStorage 的 hundundesktop-settings, 现改由 app-settings
// 统一读写 settings.json; 老键在首次读取时自动补写过去 (只补不覆盖)。

import { SETTING_KEY, getSettingMigrating, setSetting } from './app-settings'

// 默认值 (与 Settings 页面默认一致: 开启音效, 音量 50%)
export const DEFAULT_SOUND_SETTINGS = Object.freeze({
  soundEnabled: true,
  volume: 50
})

// 归一化: 缺字段/脏数据一律回默认值, 音量钳到 0~100
const normalizeSoundSettings = (data) => {
  if (!data || typeof data !== 'object') return { ...DEFAULT_SOUND_SETTINGS }
  const volume = Number(data.volume)
  return {
    soundEnabled: data.soundEnabled !== false,
    volume: Number.isFinite(volume)
      ? Math.max(0, Math.min(100, volume))
      : DEFAULT_SOUND_SETTINGS.volume
  }
}

// 读取音效设置 (无存档/解析失败时返回默认值)
export const loadSoundSettings = () => {
  try {
    return normalizeSoundSettings(getSettingMigrating(SETTING_KEY.sound, null))
  } catch (e) {
    console.warn('[sound-settings] Failed to load settings:', e)
    return { ...DEFAULT_SOUND_SETTINGS }
  }
}

// 推送当前设置到主进程 (运行期镜像, 供插件窗口读取)
// 经 preload 暴露的 electronAPI 桥接; 测试环境/无 preload 时静默跳过
export const syncSoundSettingsToMain = (settings) => {
  try {
    const payload = settings || loadSoundSettings()
    if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.syncSoundSettings === 'function') {
      window.electronAPI.syncSoundSettings({
        soundEnabled: payload.soundEnabled !== false,
        volume: payload.volume
      })
    }
  } catch (e) {
    console.warn('[sound-settings] Failed to sync settings to main:', e)
  }
}

// 保存音效设置
export const saveSoundSettings = (settings) => {
  try {
    const normalized = normalizeSoundSettings(settings)
    setSetting(SETTING_KEY.sound, normalized)
    // 同步镜像到主进程 → 广播给插件窗口
    syncSoundSettingsToMain(normalized)
  } catch (e) {
    console.warn('[sound-settings] Failed to save settings:', e)
  }
}

export default {
  DEFAULT_SOUND_SETTINGS,
  loadSoundSettings,
  saveSoundSettings,
  syncSoundSettingsToMain
}
