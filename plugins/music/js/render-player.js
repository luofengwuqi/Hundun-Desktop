    // ========== Render: 播放页 ==========
    const appRoot = () => document.getElementById('app');

    const fmtTime = (s) => {
      if (!isFinite(s) || s < 0) return '00:00';
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
    };

    const escapeHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // 总渲染入口
    const renderAll = () => {
      updatePlayingUi();
      renderLibrary();
      renderQueue();
    };

    const updatePlayingUi = () => {
      const app = appRoot();
      if (!app) return;
      app.classList.toggle('is-playing', isPlaying);
      app.classList.toggle('library-empty', libraryFiles.length === 0);

      const btnPlay = document.getElementById('btnPlay');
      if (btnPlay) btnPlay.classList.toggle('is-playing', isPlaying);

      const btnMode = document.getElementById('btnMode');
      if (btnMode) {
        const shuffle = playMode === 'shuffle';
        btnMode.classList.toggle('is-shuffle', shuffle);
        btnMode.title = shuffle ? MusicI18n.t('player.modeShuffle') : MusicI18n.t('player.modeSequence');
      }

      const title = document.getElementById('cassetteTitle');
      const cur = currentTrack();
      if (title) title.textContent = cur ? displayStem(cur) : '—';

      const btnPlayTitle = document.getElementById('btnPlay');
      if (btnPlayTitle) btnPlayTitle.title = MusicI18n.t('player.playPause');
    };

    const updateSeekUi = () => {
      const el = audioEl();
      const cur = document.getElementById('npCur');
      const dur = document.getElementById('npDur');
      const fill = document.getElementById('seekFill');
      const knob = document.getElementById('seekKnob');
      if (!el || !cur || !dur) return;
      cur.textContent = fmtTime(el.currentTime);
      dur.textContent = fmtTime(el.duration);
      const r = isFinite(el.duration) && el.duration > 0 ? el.currentTime / el.duration : 0;
      if (fill) fill.style.width = (r * 100).toFixed(2) + '%';
      if (knob) knob.style.left = (r * 100).toFixed(2) + '%';
    };
