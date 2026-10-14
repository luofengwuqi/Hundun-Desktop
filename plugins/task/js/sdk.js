    // ========== PluginSDK: playSound / returnToParent ==========
    const _pluginAudioCache = {};
    const _pluginSoundMap = {
      click: 'sounds/click.mp3', change: 'sounds/change.mp3',
      OK: 'sounds/OK.mp3', exit: 'sounds/exit.mp3', error: 'sounds/error.mp3',
      bengbeng: 'sounds/bengbeng.mp3', loading: 'sounds/loading.mp3',
      home: 'sounds/home.mp3', setting: 'sounds/setting.mp3'
    };

    // 音量/静音设置: 取自母程序 (经主进程镜像下发, 见 plugin-preload.js 的 hundun.sound)
    // 插件直放音效必须按此设置播放, 禁止硬编码音量 (决策35)
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

    // 计算本次播放音量 (0~1); 静音或音量为 0 时返回 0
    const _resolveSoundVolume = () => {
      if (!_soundSettings || _soundSettings.soundEnabled === false) return 0;
      const v = Number(_soundSettings.volume);
      if (!Number.isFinite(v)) return 0.5;
      return Math.max(0, Math.min(100, v)) / 100;
    };

    const playSound = async (name) => {
      const volume = _resolveSoundVolume();
      if (volume <= 0) return; // 静音: 不创建也不播放
      try {
        const src = _pluginSoundMap[name];
        if (!src) return;
        const path = require('path');
        // 项目根目录: plugins/task/ → 往上两级
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
          // 文件缺失/解码失败 → 兜底走 IPC (主窗口播放, 音量同样按用户设置)
          if (window.hundun && window.hundun.host && window.hundun.host.playSound) {
            window.hundun.host.playSound(name);
          }
        });
      } catch (e) {
        // fallback: IPC
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
