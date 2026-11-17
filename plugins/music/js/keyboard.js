    // ========== Keyboard (家族约定: WASD/方向键/空格/Esc) ==========
    // 焦点模型 (状态在 app-state.js):
    //   主页面  第一行 [上一首][播放/暂停][下一首][播放模式][队列] ←→ 移动
    //           第二行 [音乐库]                                ↓/↑ 进出
    //   音乐库  左列 分组 [新建分组][全部音乐][分组...]  右列 歌曲栏 [搜索][歌曲...]
    //           底部 [导入][打开文件夹][刷新]            ←→ 换列, ↑↓ 换行, ↓ 到底进底部栏
    //   队列    沿用旧逻辑 (↑↓ 选, Shift+↑↓ 排序, Delete 移除, Enter 播放)
    const KBD_FOCUS = 'kbd-focus';

    // 焦点环只在用键盘时出现: 纯鼠标操作时列表重绘/切歌都不该冒出焦点框
    let kbdActive = true;

    const isTyping = () => {
      const a = document.activeElement;
      return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA');
    };

    // ---------- 焦点环 ----------
    const clearKbdRing = () => {
      document.querySelectorAll('.' + KBD_FOCUS).forEach((el) => el.classList.remove(KBD_FOCUS));
    };

    // 分组列索引 ↔ 分组 id: 0 是「新建分组」按钮, 1 起才是分组 (1 = 全部音乐)
    const groupIds = () => ['all', ...groups.map((g) => g.id)];
    const currentGroupIdx = () => {
      const i = groupIds().indexOf(currentGroupId);
      return i < 0 ? 1 : i + 1;
    };

    const renderKeyboardFocus = () => {
      clearKbdRing();
      if (!kbdActive) return;
      if (isModalOpen()) return;

      // 队列抽屉: 用列表行的 .selected 表达, 不加环
      if (drawer2Open) return;

      if (!drawer1Open) {
        if (uiFocus === 'library') {
          const handle = document.getElementById('drawer1Handle');
          if (handle) handle.classList.add(KBD_FOCUS);
          return;
        }
        const row = ['btnPrev', 'btnPlay', 'btnNext', 'btnMode', 'drawer2Handle']
          .map((id) => document.getElementById(id));
        const el = row[transportIdx];
        if (el) el.classList.add(KBD_FOCUS);
        return;
      }

      // 音乐库
      if (libZone === 'groups') {
        if (groupIdx <= 0) {
          const add = document.getElementById('addGroupBtn');
          if (add) add.classList.add(KBD_FOCUS);
          return;
        }
        const items = document.querySelectorAll('#groupList .group-item');
        const el = items[groupIdx - 1];
        if (el) el.classList.add(KBD_FOCUS);
        return;
      }

      if (libZone === 'footer') {
        const btns = ['importBtn', 'folderBtn', 'refreshBtn'].map((id) => document.getElementById(id));
        const el = btns[footerIdx];
        if (el) el.classList.add(KBD_FOCUS);
        return;
      }

      // 歌曲列: 选中行由 .song-card.selected 表达; 空列表时把环落在搜索框上
      // (搜索框自身有 :focus-within 高亮, 输入期间不再叠一层环)
      if (libSelectedIdx < 0 && libZone !== 'search') {
        const search = document.querySelector('.d1-search');
        if (search) search.classList.add(KBD_FOCUS);
      }
    };

    // 鼠标点过就把键盘环收掉, 并把状态对齐到点到的控件 (避免下一次方向键从旧位置跳)
    const TRANSPORT_IDS = ['btnPrev', 'btnPlay', 'btnNext', 'btnMode', 'drawer2Handle'];
    document.addEventListener('pointerdown', (e) => {
      const hit = e.target && e.target.closest
        ? e.target.closest('#btnPrev,#btnPlay,#btnNext,#btnMode,#drawer2Handle,#drawer1Handle')
        : null;
      if (hit) {
        const i = TRANSPORT_IDS.indexOf(hit.id);
        if (i >= 0) { uiFocus = 'transport'; transportIdx = i; }
        else if (hit.id === 'drawer1Handle') uiFocus = 'library';
      }
      kbdActive = false;   // 鼠标接管: 焦点环收起来
      clearKbdRing();
    }, true);

    // ---------- 抽屉开关 ----------
    const toggleDrawer1 = () => {
      drawer1Open = !drawer1Open;
      document.getElementById('drawer1').classList.toggle('open', drawer1Open);
      playSound('change');
      if (drawer1Open) {
        enterLibraryFocus();
      } else {
        uiFocus = 'library';
        renderKeyboardFocus();
      }
    };

    const toggleDrawer2 = () => {
      drawer2Open = !drawer2Open;
      document.getElementById('drawer2').classList.toggle('open', drawer2Open);
      playSound('change');
      if (drawer2Open) {
        enterQueueFocus();
      } else {
        uiFocus = 'transport';
        transportIdx = 4;
        renderKeyboardFocus();
      }
    };

    // 进库: 默认选中当前分组第一首
    const enterLibraryFocus = () => {
      libZone = 'songs';
      libSelectedIdx = getVisibleTracks().length ? 0 : -1;
      groupIdx = currentGroupIdx();
      footerIdx = 0;
      renderSongs();
      scrollToSelectedSong();
      renderKeyboardFocus();
    };

    // 进队列: 默认停在当前播放项
    const enterQueueFocus = () => {
      if (!queue.length) queueSelectedIdx = -1;
      else queueSelectedIdx = (queueIndex >= 0 && queueIndex < queue.length) ? queueIndex : 0;
      renderQueue();
    };

    // 搜索框: 真焦点 + 光标移到末尾
    const focusSearchInput = () => {
      const input = document.getElementById('libSearch');
      if (!input) return;
      libZone = 'search';
      input.focus();
      const len = input.value.length;
      try { input.setSelectionRange(len, len); } catch (_) { /* ignore */ }
      renderKeyboardFocus();
    };

    // 主页面 Enter: 执行当前选中项
    const activateMainFocus = async () => {
      if (uiFocus === 'library') {
        playSound('OK');
        if (!drawer1Open) toggleDrawer1();
        return;
      }
      playSound('click');
      switch (transportIdx) {
        case 0: await prevTrack(); break;
        case 1: await togglePlayPause(); break;
        case 2: await nextTrack(false); break;
        case 3: await cyclePlayMode(); break;
        case 4: if (!drawer2Open) toggleDrawer2(); break;
        default: break;
      }
    };

    window.addEventListener('keydown', async (e) => {
      if (isModalOpen()) return; // 弹窗自己处理 (modal.js 捕获阶段)

      kbdActive = true;   // 键盘接管: 后续渲染都带焦点环

      // 搜索框输入中: Esc / Enter 结束输入 → 回到当前分组第一首
      if (isTyping()) {
        if (e.key === 'Escape' || e.key === 'Enter') {
          e.preventDefault();
          document.activeElement.blur();
          if (drawer1Open) {
            libZone = 'songs';
            libSelectedIdx = getVisibleTracks().length ? 0 : -1;
            playSound('click');
            renderSongs();
            scrollToSelectedSong();
            renderKeyboardFocus();
          }
        }
        return;
      }

      let key = e.key;
      if (key === 'w' || key === 'W') key = 'ArrowUp';
      if (key === 's' || key === 'S') key = 'ArrowDown';
      if (key === 'a' || key === 'A') key = 'ArrowLeft';
      if (key === 'd' || key === 'D') key = 'ArrowRight';
      if (key === ' ') key = 'Enter';           // 空格 = 确认

      // Esc 链: 分组弹层 → 队列抽屉 → 音乐库抽屉 → 退出子程序
      if (key === 'Escape') {
        e.preventDefault();
        const pop = document.getElementById('groupPopover');
        if (pop && pop.style.display !== 'none') { closeGroupPopover(); return; }
        if (drawer2Open) { toggleDrawer2(); return; }
        if (drawer1Open) { toggleDrawer1(); return; }
        await exitPlugin();
        return;
      }

      // ---- 播放队列抽屉 (沿用旧逻辑) ----
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

        // 任意时刻 "/" 或 "f" 直接进搜索
        if (key === '/' || key === 'f' || key === 'F') {
          e.preventDefault();
          focusSearchInput();
          return;
        }

        // 歌曲列
        if (libZone === 'songs') {
          if (key === 'ArrowUp' || key === 'ArrowDown') {
            e.preventDefault();
            if (!list.length) {
              if (key === 'ArrowDown') { libZone = 'footer'; footerIdx = 0; }
              else focusSearchInput();
              playSound('click');
              renderKeyboardFocus();
              return;
            }
            if (key === 'ArrowUp') {
              if (libSelectedIdx <= 0) { playSound('click'); focusSearchInput(); return; }
              libSelectedIdx -= 1;
            } else {
              if (libSelectedIdx >= list.length - 1) {
                libZone = 'footer';
                footerIdx = 0;
                playSound('change');
                renderKeyboardFocus();
                return;
              }
              libSelectedIdx += 1;
            }
            playSound('click');
            renderSongs();
            scrollToSelectedSong();
            renderKeyboardFocus();
            return;
          }
          if (key === 'ArrowLeft') {
            e.preventDefault();
            libZone = 'groups';
            groupIdx = currentGroupIdx();
            playSound('click');
            renderKeyboardFocus();
            return;
          }
          if (key === 'Enter' && libSelectedIdx >= 0 && libSelectedIdx < list.length) {
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
          return;
        }

        // 分组列
        if (libZone === 'groups') {
          const ids = groupIds();
          if (key === 'ArrowUp' || key === 'ArrowDown') {
            e.preventDefault();
            const next = key === 'ArrowUp' ? groupIdx - 1 : groupIdx + 1;
            if (next > ids.length) {         // 到底 → 底部按钮群
              libZone = 'footer';
              footerIdx = 0;
              playSound('change');
              renderKeyboardFocus();
              return;
            }
            groupIdx = Math.max(0, next);
            playSound('click');
            if (groupIdx >= 1) {
              // 切换分组: 歌曲列回到该组第一首
              currentGroupId = ids[groupIdx - 1];
              libSelectedIdx = getVisibleTracks().length ? 0 : -1;
              renderLibrary();
              scrollToSelectedSong();
            } else {
              renderKeyboardFocus();
            }
            return;
          }
          if (key === 'ArrowRight') {
            e.preventDefault();
            libZone = 'songs';
            libSelectedIdx = list.length ? 0 : -1;
            playSound('click');
            renderSongs();
            scrollToSelectedSong();
            renderKeyboardFocus();
            return;
          }
          if (key === 'Enter') {
            e.preventDefault();
            if (groupIdx <= 0) {
              playSound('OK');
              const name = await showModal({ icon: '+', title: MusicI18n.t('groups.newTitle'), prompt: true });
              if (name) { await createGroup(name); groupIdx = currentGroupIdx(); renderKeyboardFocus(); }
            } else {
              playSound('OK');
              currentGroupId = ids[groupIdx - 1];
              libSelectedIdx = getVisibleTracks().length ? 0 : -1;
              renderLibrary();
              scrollToSelectedSong();
            }
            return;
          }
          return;
        }

        // 底部按钮群
        if (libZone === 'footer') {
          if (key === 'ArrowLeft' || key === 'ArrowRight') {
            e.preventDefault();
            footerIdx = key === 'ArrowLeft'
              ? Math.max(0, footerIdx - 1)
              : Math.min(2, footerIdx + 1);
            playSound('click');
            renderKeyboardFocus();
            return;
          }
          if (key === 'ArrowUp') {
            e.preventDefault();
            libZone = 'songs';
            if (libSelectedIdx < 0) libSelectedIdx = list.length ? 0 : -1;
            playSound('click');
            renderSongs();
            scrollToSelectedSong();
            renderKeyboardFocus();
            return;
          }
          if (key === 'Enter') {
            e.preventDefault();
            playSound('OK');
            if (footerIdx === 0) showImportMenu();
            else if (footerIdx === 1) {
              if (window.hundun && window.hundun.fs && window.hundun.fs.openInExplorer) {
                await window.hundun.fs.openInExplorer();
              }
            } else {
              await refreshLibrary(false);
            }
            return;
          }
          return;
        }

        return;
      }

      // ---- 主页面 ----
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        e.preventDefault();
        if (uiFocus === 'library') return;   // 第二行只有音乐库一项
        transportIdx = key === 'ArrowLeft'
          ? Math.max(0, transportIdx - 1)
          : Math.min(4, transportIdx + 1);
        playSound('click');
        renderKeyboardFocus();
        return;
      }
      if (key === 'ArrowDown') {
        e.preventDefault();
        if (uiFocus !== 'library') {
          uiFocus = 'library';
          playSound('change');
          renderKeyboardFocus();
        }
        return;
      }
      if (key === 'ArrowUp') {
        e.preventDefault();
        if (uiFocus === 'library') {
          uiFocus = 'transport';
          playSound('change');
          renderKeyboardFocus();
        }
        return;
      }
      if (key === 'Enter') {
        e.preventDefault();
        await activateMainFocus();
        return;
      }
    });
