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

      renderNowPlaying();
    };

    // ---------- 右侧信息栏: 曲名 / 演唱者 / 标签 / 磁带编号 ----------
    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    // 无演唱者信息时: 优先显示当前分组名, 兜底"本地音乐库"
    const fallbackArtist = () => {
      const g = groups.find(x => x.id === currentGroupId);
      return g ? g.name : MusicI18n.t('player.localLibrary');
    };

    const renderNowPlaying = () => {
      const empty = libraryFiles.length === 0;
      const cur = currentTrack();
      const parsed = cur ? parseTrackName(cur) : null;

      setText('npKicker', cur ? MusicI18n.t('player.nowPlaying') : MusicI18n.t('player.idle'));
      setText('npTitle', empty
        ? MusicI18n.t('player.emptyTitle')
        : (parsed ? parsed.title : MusicI18n.t('player.noTrack')));
      setText('npArtist', empty
        ? ''
        : (parsed ? (parsed.artist || fallbackArtist()) : MusicI18n.t('player.pickHint')));

      const chips = document.getElementById('npChips');
      if (chips) {
        chips.innerHTML = '';
        if (cur) {
          const mkChip = (text, accent) => {
            const s = document.createElement('span');
            s.className = 'np-chip' + (accent ? ' is-accent' : '');
            s.textContent = text;
            chips.appendChild(s);
          };
          mkChip(fileExt(cur).toUpperCase() || 'AUDIO');
          if (queue.length) mkChip((queueIndex + 1) + ' / ' + queue.length, true);
          mkChip(playMode === 'shuffle' ? MusicI18n.t('player.modeShuffle') : MusicI18n.t('player.modeSequence'));
        }
      }

      // 磁带侧面编号 (队列位置)
      setText('deckSide', queue.length && queueIndex >= 0
        ? 'NO.' + String(queueIndex + 1).padStart(2, '0')
        : 'NO.00');

      // 下一首预览 (仅顺序模式且队列里确有下一首时出现)
      const nextWrap = document.getElementById('npNext');
      const nextVal = document.getElementById('npNextVal');
      if (nextWrap && nextVal) {
        const nextFile = (cur && playMode === 'sequence' && queueIndex >= 0 && queueIndex + 1 < queue.length)
          ? queue[queueIndex + 1]
          : null;
        nextWrap.style.display = nextFile ? 'flex' : 'none';
        if (nextFile) nextVal.textContent = parseTrackName(nextFile).title;
      }
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
