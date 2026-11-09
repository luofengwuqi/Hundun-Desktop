    // ========== Events: 按钮与交互绑定 ==========
    let _pinned = false;

    const setupPinButton = () => {
      const btn = document.getElementById('pinBtn');
      if (!btn) return;
      btn.addEventListener('click', async () => {
        _pinned = !_pinned;
        btn.classList.toggle('pinned', _pinned);
        playSound('click');
        if (window.hundun && window.hundun.window && window.hundun.window.setAlwaysOnTop) {
          await window.hundun.window.setAlwaysOnTop(_pinned);
        }
      });
    };

    const setupMinButton = () => {
      const btn = document.getElementById('minBtn');
      if (!btn) return;
      btn.addEventListener('click', async () => {
        playSound('click');
        if (window.hundun && window.hundun.window && window.hundun.window.minimize) {
          await window.hundun.window.minimize();
        }
      });
    };

    // 关闭 = 退出子程序: 停止播放 + 清空队列 + 返回母程序 (需求)
    const exitPlugin = async () => {
      stopPlaybackForExit(true);
      playSound('exit');
      await returnToParent();
    };

    const setupCloseButton = () => {
      const btn = document.getElementById('closeBtn');
      if (btn) btn.addEventListener('click', exitPlugin);
    };

    // ---------- 进度条 (点按 + 拖动) ----------
    const setupSeek = () => {
      const seek = document.getElementById('seek');
      if (!seek) return;
      let seeking = false;

      const ratioOf = (e) => {
        const rect = seek.getBoundingClientRect();
        if (rect.width <= 0) return 0;
        return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      };
      const preview = (ratio) => {
        const fill = document.getElementById('seekFill');
        const knob = document.getElementById('seekKnob');
        if (fill) fill.style.width = (ratio * 100).toFixed(2) + '%';
        if (knob) knob.style.left = (ratio * 100).toFixed(2) + '%';
      };

      seek.addEventListener('pointerdown', (e) => {
        if (!currentTrack()) return;
        seeking = true;
        try { seek.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        preview(ratioOf(e));
      });
      seek.addEventListener('pointermove', (e) => {
        if (seeking) preview(ratioOf(e));
      });
      seek.addEventListener('pointerup', (e) => {
        if (!seeking) return;
        seeking = false;
        playSound('click');
        seekToRatio(ratioOf(e));
      });
      seek.addEventListener('pointercancel', () => { seeking = false; });
    };

    // ---------- 播放内核事件 ----------
    const attachAudioListeners = () => {
      const el = audioEl();
      if (!el) return;
      el.addEventListener('play', () => { isPlaying = true; updatePlayingUi(); });
      el.addEventListener('pause', () => { isPlaying = false; updatePlayingUi(); });
      el.addEventListener('ended', () => { isPlaying = false; updatePlayingUi(); nextTrack(true); });
      el.addEventListener('timeupdate', updateSeekUi);
      el.addEventListener('loadedmetadata', updateSeekUi);
      el.addEventListener('error', () => {
        if (!el.src || !currentTrack()) return;
        showToast(MusicI18n.t('toast.importError', { name: displayStem(currentTrack()) }), 'error');
        // 解码失败自动跳下一首 (队列还有歌时)
        if (queue.length > 1) nextTrack(true);
      });
    };

    const bindEvents = () => {
      // 走带控制
      document.getElementById('btnPlay').addEventListener('click', async () => {
        playSound('click');
        await togglePlayPause();
      });
      document.getElementById('btnPrev').addEventListener('click', () => { playSound('click'); prevTrack(); });
      document.getElementById('btnNext').addEventListener('click', () => { playSound('click'); nextTrack(false); });
      document.getElementById('btnMode').addEventListener('click', () => {
        playSound('change');
        setPlayMode(playMode === 'sequence' ? 'shuffle' : 'sequence');
      });

      // 抽屉把手
      document.getElementById('drawer1Handle').addEventListener('click', toggleDrawer1);
      document.getElementById('drawer2Handle').addEventListener('click', toggleDrawer2);
      document.getElementById('d2Close').addEventListener('click', toggleDrawer2);

      // 音乐库: 分组 / 搜索
      document.getElementById('addGroupBtn').addEventListener('click', async () => {
        playSound('click');
        const name = await showModal({ icon: '+', title: MusicI18n.t('groups.newTitle'), prompt: true });
        if (name) await createGroup(name);
      });
      document.getElementById('libSearch').addEventListener('input', (e) => {
        searchQuery = e.target.value || '';
        libSelectedIdx = -1;
        renderSongs();
        const info = document.getElementById('libInfo');
        if (info) info.textContent = MusicI18n.t('library.count', { count: getVisibleTracks().length });
      });

      // 底部栏: 导入 / 文件管理器 / 刷新
      document.getElementById('importBtn').addEventListener('click', () => {
        playSound('click');
        showImportMenu();
      });
      document.getElementById('folderBtn').addEventListener('click', async () => {
        playSound('click');
        if (window.hundun && window.hundun.fs && window.hundun.fs.openInExplorer) {
          await window.hundun.fs.openInExplorer();
        }
      });
      document.getElementById('refreshBtn').addEventListener('click', async () => {
        playSound('click');
        await refreshLibrary(false);
      });

      setupSeek();
      attachAudioListeners();
    };
