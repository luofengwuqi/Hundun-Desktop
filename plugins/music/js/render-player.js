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
      const wasPlaying = app.classList.contains('is-playing');
      app.classList.toggle('is-playing', isPlaying);
      app.classList.toggle('library-empty', libraryFiles.length === 0);
      initEqBar();

      const btnPlay = document.getElementById('btnPlay');
      if (btnPlay) btnPlay.classList.toggle('is-playing', isPlaying);

      const btnMode = document.getElementById('btnMode');
      if (btnMode) {
        const shuffle = playMode === 'shuffle';
        const loop = playMode === 'loop';
        btnMode.classList.toggle('is-shuffle', shuffle);
        btnMode.classList.toggle('is-loop', loop);
        btnMode.title = shuffle ? MusicI18n.t('player.modeShuffle')
          : loop ? MusicI18n.t('player.modeLoop')
          : MusicI18n.t('player.modeSequence');
      }

      const title = document.getElementById('cassetteTitle');
      const cur = currentTrack();
      if (title) title.textContent = cur ? displayStem(cur) : '—';

      const btnPlayTitle = document.getElementById('btnPlay');
      if (btnPlayTitle) btnPlayTitle.title = MusicI18n.t('player.playPause');

      renderNowPlaying();

      // 开始播放: 拉起弹幕时钟, 并立刻飘第一条; 停播/清空后收起弹幕
      if (isPlaying && !wasPlaying) { startBulletLoop(); flyBullet(); }
      else if (isPlaying) startBulletLoop();
      else stopBullet();
    };

    // ---------- 底部通栏电平柱: 22 根, 高度与节奏随机, 播放时才跳 ----------
    const EQ_BARS = 22;
    const initEqBar = () => {
      const bar = document.getElementById('mcEqBar');
      if (!bar || bar.childElementCount) return;
      const frag = document.createDocumentFragment();
      for (let i = 0; i < EQ_BARS; i++) {
        const b = document.createElement('i');
        b.style.setProperty('--bar-h', (0.22 + Math.random() * 0.52).toFixed(2));
        b.style.setProperty('--bar-dur', (0.55 + Math.random() * 0.75).toFixed(2) + 's');
        b.style.setProperty('--bar-delay', (-Math.random() * 1.2).toFixed(2) + 's');
        frag.appendChild(b);
      }
      bar.appendChild(frag);
    };

    // ---------- 顶部弹幕: 播放中每 10s 飘过一次「下一首」 ----------
    const BULLET_INTERVAL = 10000;
    let _bulletTimer = null;

    const nextUpFile = () => {
      if (playMode !== 'sequence') return null;
      if (!queue.length || queueIndex < 0) return null;
      return queueIndex + 1 < queue.length ? queue[queueIndex + 1] : null;
    };

    const flyBullet = () => {
      const wrap = document.getElementById('mcBullet');
      const text = document.getElementById('mcBulletText');
      const nextFile = nextUpFile();
      if (!wrap || !text || !nextFile) return;
      text.textContent = MusicI18n.t('player.upNext') + ' · ' + trackTitle(nextFile);
      wrap.classList.remove('is-running');
      void wrap.offsetWidth;            // 强制重排, 让动画从头播
      wrap.classList.add('is-running');
    };

    const startBulletLoop = () => {
      if (_bulletTimer) return;
      _bulletTimer = setInterval(() => { if (isPlaying) flyBullet(); }, BULLET_INTERVAL);
    };

    const stopBullet = () => {
      const wrap = document.getElementById('mcBullet');
      const text = document.getElementById('mcBulletText');
      if (wrap) wrap.classList.remove('is-running');
      if (text) text.textContent = '';
    };

    // ---------- 右侧信息栏: 曲名 ----------
    const setText = (id, text, withTitleAttr) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = text;
      if (withTitleAttr) el.title = text;
    };

    const renderNowPlaying = () => {
      const empty = libraryFiles.length === 0;
      const cur = currentTrack();

      // 完整文件名 (去扩展名), 不拆歌手、不缩字、不截断;
      // 换行时靠 CSS 让标题向上生长, 下方的进度与走带按钮位置不动
      setText('npTitle', empty
        ? MusicI18n.t('player.emptyTitle')
        : (cur ? trackTitle(cur) : MusicI18n.t('player.noTrack')), true);
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
