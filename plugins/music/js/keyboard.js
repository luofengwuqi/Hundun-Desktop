    // ========== Keyboard (家族约定: WASD/方向键/空格/Esc) ==========
    const isTyping = () => {
      const a = document.activeElement;
      return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA');
    };

    const toggleDrawer1 = () => {
      drawer1Open = !drawer1Open;
      document.getElementById('drawer1').classList.toggle('open', drawer1Open);
      playSound('change');
    };

    const toggleDrawer2 = () => {
      drawer2Open = !drawer2Open;
      document.getElementById('drawer2').classList.toggle('open', drawer2Open);
      playSound('change');
    };

    window.addEventListener('keydown', async (e) => {
      if (isModalOpen()) return; // 弹窗自己处理 (modal.js 捕获阶段)
      if (isTyping()) {
        if (e.key === 'Escape') document.activeElement.blur();
        return;
      }

      let key = e.key;
      if (key === 'w' || key === 'W') key = 'ArrowUp';
      if (key === 's' || key === 'S') key = 'ArrowDown';
      if (key === 'a' || key === 'A') key = 'ArrowLeft';
      if (key === 'd' || key === 'D') key = 'ArrowRight';

      // Esc 链: 弹层 → 队列抽屉 → 音乐库抽屉 → 退出子程序
      if (key === 'Escape') {
        e.preventDefault();
        const pop = document.getElementById('groupPopover');
        if (pop && pop.style.display !== 'none') { closeGroupPopover(); return; }
        if (drawer2Open) { toggleDrawer2(); return; }
        if (drawer1Open) { toggleDrawer1(); return; }
        await exitPlugin();
        return;
      }

      // 空格: 播放/暂停 (抽屉未开时)
      if (key === ' ' && !drawer1Open && !drawer2Open) {
        e.preventDefault();
        playSound('click');
        await togglePlayPause();
        return;
      }

      // ---- 播放队列抽屉 ----
      if (drawer2Open) {
        if (key === 'ArrowUp' || key === 'ArrowDown') {
          e.preventDefault();
          if (queue.length === 0) return;
          if (queueSelectedIdx < 0) queueSelectedIdx = (queueIndex >= 0 ? queueIndex : 0);
          if (e.shiftKey) {
            // Shift+↑/↓: 重排序
            const to = key === 'ArrowUp' ? queueSelectedIdx - 1 : queueSelectedIdx + 1;
            if (to >= 0 && to < queue.length) {
              playSound('change');
              await moveQueueItem(queueSelectedIdx, to);
              queueSelectedIdx = to;
              renderQueue();
              const wrap = document.getElementById('queueList');
              const sel = wrap && wrap.querySelector('.q-item.selected');
              if (sel) sel.scrollIntoView({ block: 'nearest' });
            }
          } else {
            queueSelectedIdx = key === 'ArrowUp'
              ? Math.max(0, queueSelectedIdx - 1)
              : Math.min(queue.length - 1, queueSelectedIdx + 1);
            renderQueue();
            const wrap = document.getElementById('queueList');
            const sel = wrap && wrap.querySelector('.q-item.selected');
            if (sel) sel.scrollIntoView({ block: 'nearest' });
          }
          return;
        }
        if (key === 'Delete' && queueSelectedIdx >= 0 && queueSelectedIdx < queue.length) {
          e.preventDefault();
          playSound('click');
          await removeFromQueueAt(queueSelectedIdx);
          return;
        }
        if (key === 'Enter' && queueSelectedIdx >= 0 && queueSelectedIdx < queue.length) {
          e.preventDefault();
          playSound('OK');
          await playIndex(queueSelectedIdx);
          return;
        }
        return; // 队列模式下其余按键不处理
      }

      // ---- 音乐库抽屉 ----
      if (drawer1Open) {
        const list = getVisibleTracks();

        if (key === 'ArrowUp' || key === 'ArrowDown') {
          e.preventDefault();
          if (!list.length) return;
          if (libSelectedIdx < 0) libSelectedIdx = 0;
          else libSelectedIdx = key === 'ArrowUp'
            ? Math.max(0, libSelectedIdx - 1)
            : Math.min(list.length - 1, libSelectedIdx + 1);
          renderSongs();
          scrollToSelectedSong();
          return;
        }
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
          // ←/→: 切换分组
          e.preventDefault();
          const ids = ['all', ...groups.map(g => g.id)];
          let i = ids.indexOf(currentGroupId);
          if (i < 0) i = 0;
          i = key === 'ArrowLeft' ? Math.max(0, i - 1) : Math.min(ids.length - 1, i + 1);
          currentGroupId = ids[i];
          libSelectedIdx = -1;
          playSound('click');
          renderLibrary();
          return;
        }
        if (key === 'Enter' && libSelectedIdx >= 0 && list.length) {
          e.preventDefault();
          playSound('OK');
          await queuePlayTrack(list[libSelectedIdx]);
          return;
        }
        if (key === 'Delete' && libSelectedIdx >= 0 && libSelectedIdx < list.length) {
          e.preventDefault();
          await deleteTrack(list[libSelectedIdx]);
          return;
        }
        if (key === '/' || key === 'f' || key === 'F') {
          e.preventDefault();
          const input = document.getElementById('libSearch');
          if (input) input.focus();
          return;
        }
        return;
      }
    });
