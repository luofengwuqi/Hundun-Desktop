    // ========== PluginSDK: playSound ==========
    const _pluginAudioCache = {};
    const _pluginSoundMap = {
      click: 'sounds/click.mp3', change: 'sounds/change.mp3',
      OK: 'sounds/OK.mp3', exit: 'sounds/exit.mp3', error: 'sounds/error.mp3',
      bengbeng: 'sounds/bengbeng.mp3', loading: 'sounds/loading.mp3',
      home: 'sounds/home.mp3', setting: 'sounds/setting.mp3'
    };
    const playSound = async (name) => {
      try {
        const src = _pluginSoundMap[name];
        if (!src) return;
        const path = require('path');
        const root = path.resolve(__dirname || '.', '..', '..');
        const absPath = path.join(root, src).replace(/\\/g, '/');
        const fileUrl = 'file:///' + absPath;
        if (!_pluginAudioCache[name]) {
          _pluginAudioCache[name] = new Audio(fileUrl);
        }
        const audio = _pluginAudioCache[name];
        audio.currentTime = 0;
        audio.volume = 0.5;
        audio.play().catch(() => {});
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
