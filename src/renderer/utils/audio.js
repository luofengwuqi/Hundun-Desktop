// 音效管理器
const sounds = {}

// 预加载音效
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
  Object.entries(soundFiles).forEach(([name, path]) => {
    const audio = new Audio(path)
    audio.preload = 'auto'
    sounds[name] = audio
  })
}

// 播放音效
export const playSound = (name) => {
  if (sounds[name]) {
    sounds[name].currentTime = 0
    sounds[name].play().catch(e => {
      console.warn(`Failed to play sound ${name}:`, e)
    })
  }
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
  Object.values(sounds).forEach(sound => {
    sound.volume = Math.max(0, Math.min(1, volume))
  })
}

export default {
  initSounds,
  playSound,
  stopSound,
  stopAllSounds,
  setVolume,
  setGlobalVolume
}
