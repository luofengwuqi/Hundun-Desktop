    // ========== PluginSDK: playSound (与家族子程序同构, 音量遵循母程序设置) ==========
    const _pluginAudioCache = {};
    const _pluginSoundMap = {
      click: 'sounds/click.mp3', change: 'sounds/change.mp3',
      OK: 'sounds/OK.mp3', exit: 'sounds/exit.mp3', error: 'sounds/error.mp3',
      bengbeng: 'sounds/bengbeng.mp3', loading: 'sounds/loading.mp3',
      home: 'sounds/home.mp3', setting: 'sounds/setting.mp3'
    };

    let _soundSettings = (() => {
      try {
        if (window.hundun && window.hundun.sound && window.hundun.sound.getSettings) {
          return window.hundun.sound.getSettings();
        }
      } catch (e) { /* ignore */ }
      return { soundEnabled: true, volume: 50 };
    })();
    try {
      if (window.hundun && window.hundun.sound && window.hundun.sound.onSettingsChanged) {
        window.hundun.sound.onSettingsChanged((s) => { _soundSettings = s; });
      }
    } catch (e) { /* ignore */ }

    const _resolveSoundVolume = () => {
      if (!_soundSettings || _soundSettings.soundEnabled === false) return 0;
      const v = Number(_soundSettings.volume);
      if (!Number.isFinite(v)) return 0.5;
      return Math.max(0, Math.min(100, v)) / 100;
    };

    const playSound = async (name) => {
      const volume = _resolveSoundVolume();
      if (volume <= 0) return;
      try {
        const src = _pluginSoundMap[name];
        if (!src) return;
        const path = require('path');
        // 项目根目录: plugins/music/ → 往上两级
        const root = path.resolve(__dirname || '.', '..', '..');
        const absPath = path.join(root, src).replace(/\\/g, '/');
        const fileUrl = 'file:///' + absPath;
        if (!_pluginAudioCache[name]) {
          _pluginAudioCache[name] = new Audio(fileUrl);
        }
        const audio = _pluginAudioCache[name];
        audio.currentTime = 0;
        audio.volume = volume;
        audio.play().catch(() => {
          if (window.hundun && window.hundun.host && window.hundun.host.playSound) {
            window.hundun.host.playSound(name);
          }
        });
      } catch (e) {
        if (window.hundun && window.hundun.host && window.hundun.host.playSound) {
          window.hundun.host.playSound(name);
        }
      }
    };

    // ========== returnToParent ==========
    const returnToParent = async () => {
      if (window.hundun && window.hundun.host && window.hundun.host.returnToParent) {
        await window.hundun.host.returnToParent();
      } else if (window.hundun && window.hundun.window && window.hundun.window.close) {
        await window.hundun.window.close();
      } else {
        window.close();
      }
    };

    // ========== 关闭信号监听 ==========
    // 需求: 关闭子程序或母程序时 停止播放 + 清空队列 + 退出子程序。
    // returnToParent 会先发 'plugin:transition-enter' (子程序退场过渡) —— 收到即停播;
    // 母程序关闭 → 窗口销毁 → beforeunload 兜底暂停。
    let _ipcRenderer = null;
    try { _ipcRenderer = require('electron').ipcRenderer; } catch (e) { _ipcRenderer = null; }
    if (_ipcRenderer) {
      _ipcRenderer.on('plugin:transition-enter', () => {
        if (typeof stopPlaybackForExit === 'function') stopPlaybackForExit();
      });
    }
    window.addEventListener('beforeunload', () => {
      try {
        const el = document.getElementById('audioEl');
        if (el) { el.pause(); el.removeAttribute('src'); }
      } catch (e) { /* ignore */ }
    });
