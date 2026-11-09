    // ========== Player: 播放内核 + 播放队列 ==========
    const audioEl = () => document.getElementById('audioEl');

    // 绝对路径 → file:// URL (encodeURI 处理空格与中文; # ? 需先转义)
    const basePathToFileUrl = (base, file) => {
      let p = (base + '/' + file).replace(/\\/g, '/');
      if (!p.startsWith('/')) p = '/' + p;
      p = p.replace(/#/g, '%23').replace(/\?/g, '%3F');
      return 'file://' + encodeURI(p);
    };

    const playIndex = async (idx) => {
      if (idx < 0 || idx >= queue.length) return;
      queueIndex = idx;
      const file = queue[idx];
      const base = await getBasePath();
      if (!base) return;
      const el = audioEl();
      el.src = basePathToFileUrl(base, file);
      try {
        await el.play();
      } catch (e) {
        // 自动播放策略或解码失败 —— 状态由 play/error 事件兜底
      }
      isPlaying = !el.paused;
      renderAll();
    };

    // 点播: 新曲排到队尾, 不打断正在播放的内容;
    // 队列里还没有当前曲 (首次点播 / 队列已空) 时才直接开播
    const queuePlayTrack = async (file) => {
      if (!libraryFiles.includes(file)) return;
      if (queueIndex >= 0 && queue[queueIndex] === file) return;   // 点的是当前曲
      if (queue.includes(file)) {
        showToast(MusicI18n.t('player.alreadyQueued'), 'info');
        return;
      }
      queue.push(file);
      if (queueIndex < 0) { await playIndex(queue.length - 1); return; }
      renderAll();
      showToast(MusicI18n.t('player.queued'), 'ok');
    };

    const pausePlayback = () => {
      const el = audioEl();
      if (el) el.pause();
      isPlaying = false;
      updatePlayingUi();
    };

    const togglePlayPause = async () => {
      if (libraryFiles.length === 0) return;
      const el = audioEl();
      if (queue.length === 0) {
        // 无队列: 从当前可见列表整队开始
        queue = [...getVisibleTracks()];
        await playIndex(0);
        return;
      }
      if (queueIndex < 0 || queueIndex >= queue.length) { await playIndex(0); return; }
      if (el.paused) {
        try { await el.play(); } catch (e) { /* ignore */ }
      } else {
        el.pause();
      }
    };

    const randomIndex = (exclude) => {
      if (queue.length <= 1) return 0;
      let i;
      do { i = Math.floor(Math.random() * queue.length); } while (i === exclude);
      return i;
    };

    // auto=true: 歌曲自然播完; 顺序模式到队尾即停, 手动下一首回绕
    const nextTrack = async (auto = false) => {
      if (queue.length === 0) return;
      // 单曲循环: 自然播完重播本曲 (手动下一首仍前进)
      if (playMode === 'loop' && auto) { await replayCurrent(); return; }
      if (playMode === 'shuffle') { await playIndex(randomIndex(queueIndex)); return; }
      const n = queueIndex + 1;
      if (n >= queue.length) {
        if (auto) { pausePlayback(); return; }
        await playIndex(0);
        return;
      }
      await playIndex(n);
    };

    // 原地重播当前曲 (不重新加载 src, 避免解码中断)
    const replayCurrent = async () => {
      const el = audioEl();
      if (!el || queueIndex < 0 || queueIndex >= queue.length) return;
      try {
        el.currentTime = 0;
        await el.play();
      } catch (e) {
        // 极端情况 (src 失效) 退回重新加载
        await playIndex(queueIndex);
      }
    };

    const prevTrack = async () => {
      if (queue.length === 0) return;
      const p = queueIndex - 1;
      await playIndex(p < 0 ? queue.length - 1 : p);
    };

    // 播放模式: 顺序 → 随机 → 单曲循环 (循环切换)
    const PLAY_MODES = ['sequence', 'shuffle', 'loop'];

    const setPlayMode = async (mode) => {
      if (!PLAY_MODES.includes(mode)) return;
      playMode = mode;
      await saveSettings();
      updatePlayingUi();
    };

    const cyclePlayMode = async () => {
      const next = PLAY_MODES[(PLAY_MODES.indexOf(playMode) + 1) % PLAY_MODES.length];
      await setPlayMode(next);
    };

    // ---------- 队列操作 ----------
    // 批量移除 (刷新/删除歌曲时): 清理记录, 当前被移除 → 同位置接替播放
    const removeTracksFromQueue = async (files) => {
      if (!files || !files.length) return;
      const set = new Set(files);
      let removedBeforeCurrent = 0;
      let removedCurrent = false;
      const newQueue = [];
      queue.forEach((f, i) => {
        if (set.has(f)) {
          if (i < queueIndex) removedBeforeCurrent++;
          else if (i === queueIndex) removedCurrent = true;
        } else newQueue.push(f);
      });
      queue = newQueue;
      queueIndex -= removedBeforeCurrent;
      if (queueIndex < 0) queueIndex = queue.length ? 0 : -1;
      if (removedCurrent) {
        if (queue.length === 0) {
          queueIndex = -1;
          pausePlayback();
          renderAll();
        } else {
          await playIndex(Math.min(queueIndex, queue.length - 1));
        }
      } else {
        renderAll();
      }
    };

    // 单个移除 (队列 UI)
    const removeFromQueueAt = async (i) => {
      if (i < 0 || i >= queue.length) return;
      const wasCurrent = i === queueIndex;
      queue.splice(i, 1);
      if (wasCurrent) {
        if (queue.length === 0) {
          queueIndex = -1;
          pausePlayback();
        } else {
          if (queueIndex >= queue.length) queueIndex = queue.length - 1;
          await playIndex(queueIndex);
          return;
        }
      } else if (i < queueIndex) {
        queueIndex--;
      }
      if (queueSelectedIdx >= queue.length) queueSelectedIdx = queue.length - 1;
      if (queueSelectedIdx < 0) queueSelectedIdx = -1;
      renderAll();
    };

    // 重排序 (Shift+↑/↓): from → to, queueIndex 跟随当前曲目
    const moveQueueItem = async (from, to) => {
      if (from === to) return;
      if (from < 0 || from >= queue.length || to < 0 || to >= queue.length) return;
      const [item] = queue.splice(from, 1);
      queue.splice(to, 0, item);
      if (from === queueIndex) queueIndex = to;
      else if (from < queueIndex && to >= queueIndex) queueIndex--;
      else if (from > queueIndex && to <= queueIndex) queueIndex++;
      if (queueSelectedIdx === from) queueSelectedIdx = to;
      else if (from < queueSelectedIdx && to >= queueSelectedIdx) queueSelectedIdx--;
      else if (from > queueSelectedIdx && to <= queueSelectedIdx) queueSelectedIdx++;
      renderQueue();
    };

    // 拖拽结束: 按 DOM 顺序重建队列 (拖拽过程中只挪 DOM 节点, 不重渲染)
    const finalizeQueueDrag = () => {
      const wrap = document.getElementById('queueList');
      if (!wrap) return;
      const items = [...wrap.querySelectorAll('.q-item')];
      if (!items.length) return;
      const cur = currentTrack();
      queue = items.map(el => el.dataset.file).filter(Boolean);
      queueIndex = cur ? queue.indexOf(cur) : (queueIndex >= 0 ? -1 : queueIndex);
      if (queueSelectedIdx >= 0) {
        // 选中项跟随: 找回原选中文件
      }
      renderQueue();
    };

    // ---------- 退出清理 (需求: 关闭子程序/母程序 → 停止播放 + 清空队列) ----------
    const stopPlaybackForExit = (andClear = true) => {
      const el = audioEl();
      try {
        if (el) { el.pause(); el.removeAttribute('src'); el.load(); }
      } catch (e) { /* ignore */ }
      isPlaying = false;
      if (andClear) { queue = []; queueIndex = -1; queueSelectedIdx = -1; }
      try {
        updatePlayingUi();
        renderQueue();
      } catch (e) { /* 窗口销毁过程中 DOM 可能不可用 */ }
    };

    // ---------- 进度 ----------
    const seekToRatio = (ratio) => {
      const el = audioEl();
      if (!el || !isFinite(el.duration) || el.duration <= 0) return;
      ratio = Math.max(0, Math.min(1, ratio));
      el.currentTime = ratio * el.duration;
    };
