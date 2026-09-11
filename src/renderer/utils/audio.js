// 音效管理器
const sounds = {}
const soundLoaded = {}
let masterVolume = 1

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

// 播放音效
export const playSound = (name) => {
  const audio = sounds[name]
  if (!audio) return

  // 如果还没加载完，等加载完再播放
  if (!soundLoaded[name]) {
    const onReady = () => {
      audio.removeEventListener('canplaythrough', onReady)
      playAudio(audio)
    }
    audio.addEventListener('canplaythrough', onReady)
    return
  }

  playAudio(audio)
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

// 预加载所有音效
initSounds()

export default {
  initSounds,
  playSound,
  stopSound,
  stopAllSounds,
  setVolume,
  setGlobalVolume
}
