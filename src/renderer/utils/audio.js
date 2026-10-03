// 音效管理器
import { loadSoundSettings, DEFAULT_SOUND_SETTINGS, syncSoundSettingsToMain } from './sound-settings'

const sounds = {}
const soundLoaded = {}
let masterVolume = DEFAULT_SOUND_SETTINGS.volume / 100

// 预加载音效文件路径
const soundFiles = {
  click: 'sounds/click.mp3',
  change: 'sounds/change.mp3',
  loading: 'sounds/loading.mp3',
  OK: 'sounds/OK.mp3',
  bengbeng: 'sounds/bengbeng.mp3',
  exit: 'sounds/exit.mp3',
  error: 'sounds/error.mp3',
  home: 'sounds/home.mp3',
  setting: 'sounds/setting.mp3'
}

// 初始化音效
export const initSounds = () => {
  Object.entries(soundFiles).forEach(([name, src]) => {
    const audio = new Audio()
    audio.preload = 'auto'
    audio.volume = 1

    // 监听加载完成
    audio.addEventListener('canplaythrough', () => {
      soundLoaded[name] = true
    })

    // 监听错误
    audio.addEventListener('error', (e) => {
      console.warn(`Failed to load sound [${name}]: ${src}`, e)
      soundLoaded[name] = false
    })

    // 设置 src 触发加载
    audio.src = src
    audio.load()
    sounds[name] = audio
  })
}

// 待播放队列 (音效尚未就绪时排队, 就绪后自动播放; key=音效名)
const pendingPlays = {}

// 播放音效
export const playSound = (name) => {
  const audio = sounds[name]
  if (!audio) return

  // 之前加载出错 → 重新加载 (error 状态下不重载将永远播不出声)
  if (audio.error) {
    audio.load()
  }

  // 已有可播放数据 → 立即播放
  // 注意: 以 readyState 为准, 不能只信 soundLoaded 标记 ——
  // 该标记被 error 置 false 后, canplaythrough 不会再触发,
  // 旧逻辑会死等该事件导致此音效永久无声 (时有时无 bug)
  if (audio.readyState >= 2 /* HTMLMediaElement.HAVE_CURRENT_DATA */) {
    playAudio(audio)
    return
  }

  // 未就绪 → 等就绪后播放; 同一音效去重, 快速连点不叠加监听器
  if (pendingPlays[name]) return
  pendingPlays[name] = true

  const cleanup = () => {
    audio.removeEventListener('canplay', onReady)
    audio.removeEventListener('canplaythrough', onReady)
    audio.removeEventListener('loadeddata', onReady)
    audio.removeEventListener('error', onFailed)
    delete pendingPlays[name]
  }
  const onReady = () => {
    cleanup()
    playAudio(audio)
  }
  const onFailed = () => {
    // 加载失败: 放弃本次排队, 下次 playSound 会重新触发加载
    cleanup()
  }
  audio.addEventListener('canplay', onReady)
  audio.addEventListener('canplaythrough', onReady)
  audio.addEventListener('loadeddata', onReady)
  audio.addEventListener('error', onFailed)
}

// 实际播放
const playAudio = (audio) => {
  audio.currentTime = 0
  audio.play().catch(e => {
    console.warn('Sound autoplay blocked:', e.message)
  })
}

// 停止音效
export const stopSound = (name) => {
  if (sounds[name]) {
    sounds[name].pause()
    sounds[name].currentTime = 0
  }
}

// 停止所有音效
export const stopAllSounds = () => {
  Object.values(sounds).forEach(sound => {
    sound.pause()
    sound.currentTime = 0
  })
}

// 设置音量 (0-1)
export const setVolume = (name, volume) => {
  if (sounds[name]) {
    sounds[name].volume = Math.max(0, Math.min(1, volume))
  }
}

// 设置全局音量
export const setGlobalVolume = (volume) => {
  masterVolume = volume
  Object.values(sounds).forEach(sound => {
    sound.volume = volume
  })
}

// 获取全局音量
export const getMasterVolume = () => masterVolume

// 启动时读取一次用户设置的音效音量并应用 (音效开关 + 音量)
export const applySavedVolume = () => {
  const { soundEnabled, volume } = loadSoundSettings()
  setGlobalVolume(soundEnabled ? volume / 100 : 0)
}

// 预加载所有音效
initSounds()
// 立即应用已保存的音量，避免启动后到打开设置页之前一直是满格音量
applySavedVolume()
// 把同一份设置镜像到主进程 (插件窗口直放音效读取该镜像)
syncSoundSettingsToMain(loadSoundSettings())

// 调试句柄: 便于排查音效问题 (控制台查看 window.__huntunAudio)
if (typeof window !== 'undefined') {
  window.__huntunAudio = {
    sounds,
    soundLoaded,
    getMasterVolume,
    playSound,
    setGlobalVolume,
    applySavedVolume
  }
}

export default {
  initSounds,
  playSound,
  stopSound,
  stopAllSounds,
  setVolume,
  setGlobalVolume,
  applySavedVolume
}
