    // ========== Render: 音乐库 (抽屉1) + 分组弹层 ==========
    const groupListEl = () => document.getElementById('groupList');
    const songListEl = () => document.getElementById('songList');

    const renderLibrary = () => {
      renderGroups();
      renderSongs();
      const info = document.getElementById('libInfo');
      if (info) info.textContent = MusicI18n.t('library.count', { count: getVisibleTracks().length });
    };

    const renderGroups = () => {
      const wrap = groupListEl();
      if (!wrap) return;
      wrap.innerHTML = '';

      const mk = (id, name, count, isAll) => {
        const item = document.createElement('div');
        item.className = 'group-item' + (id === currentGroupId ? ' selected' : '') + (isAll ? ' is-all' : '');
        item.dataset.groupId = id;
        item.innerHTML =
          '<span class="group-name"></span>' +
          '<span class="group-count">' + count + '</span>' +
          (isAll ? '' : '<button class="group-del" title="✕">✕</button>');
        item.querySelector('.group-name').textContent = name;
        item.addEventListener('click', (e) => {
          if (e.target.closest('.group-del')) return; // ✕ 单独处理
          currentGroupId = id;
          libSelectedIdx = -1;
          playSound('click');
          renderLibrary();
        });
        if (!isAll) {
          const del = item.querySelector('.group-del');
          del.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteGroup(id);
          });
        }
        wrap.appendChild(item);
      };

      // 全部音乐 (虚拟分组, 永远第一且不可移除)
      mk('all', MusicI18n.t('library.groupAll'), libraryFiles.length, true);
      for (const g of groups) {
        mk(g.id, g.name, g.tracks.filter(f => libraryFiles.includes(f)).length, false);
      }
    };

    const renderSongs = () => {
      const wrap = songListEl();
      if (!wrap) return;
      wrap.innerHTML = '';
      const list = getVisibleTracks();
      const playingFile = currentTrack();

      if (!list.length) {
        const empty = document.createElement('div');
        empty.className = 'd1-empty';
        const filtered = libraryFiles.length > 0 && (searchQuery.trim() || currentGroupId !== 'all');
        const icon = filtered ? '🔍' : '🎵';
        const text = filtered ? MusicI18n.t('library.emptyFiltered') : MusicI18n.t('library.empty');
        const hint = filtered ? '' : MusicI18n.t('library.emptyHint');
        empty.innerHTML =
          '<div class="d1-empty-icon">' + icon + '</div>' +
          '<div class="d1-empty-text"></div>' +
          '<div class="d1-empty-hint"></div>';
        empty.querySelector('.d1-empty-text').textContent = text;
        empty.querySelector('.d1-empty-hint').textContent = hint;
        wrap.appendChild(empty);
        return;
      }

      list.forEach((file, idx) => {
        const card = document.createElement('div');
        card.className = 'song-card' +
          (idx === libSelectedIdx ? ' selected' : '') +
          (file === playingFile ? ' playing' : '');
        card.dataset.file = file;
        card.innerHTML =
          '<span class="song-note">♪</span>' +
          '<span class="song-name"></span>' +
          '<span class="song-ext"></span>' +
          '<div class="song-actions">' +
          '  <button class="song-btn sb-play" title="' + escapeHtml(MusicI18n.t('library.play')) + '">' +
          '    <svg class="btn-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="7,4 7,20 19,12"/></svg>' +
          '  </button>' +
          '  <button class="song-btn sb-group" title="' + escapeHtml(MusicI18n.t('library.addGroup')) + '">＋</button>' +
          '  <button class="song-btn sb-del" title="' + escapeHtml(MusicI18n.t('library.del')) + '">🗑</button>' +
          '</div>';
        card.querySelector('.song-name').textContent = displayStem(file);
        const extEl = card.querySelector('.song-ext');
        const ext = fileExt(file);
        if (ext) extEl.textContent = ext; else extEl.style.display = 'none';

        card.addEventListener('click', () => {
          libSelectedIdx = idx;
          renderSongs();
        });
        card.addEventListener('dblclick', () => { queuePlayTrack(file); });
        card.querySelector('.sb-play').addEventListener('click', async (e) => {
          e.stopPropagation();
          playSound('OK');
          await queuePlayTrack(file);
        });
        card.querySelector('.sb-group').addEventListener('click', (e) => {
          e.stopPropagation();
          playSound('click');
          openGroupPopover(file, e.currentTarget);
        });
        card.querySelector('.sb-del').addEventListener('click', async (e) => {
          e.stopPropagation();
          await deleteTrack(file);
        });
        wrap.appendChild(card);
      });
    };

    const scrollToSelectedSong = () => {
      const wrap = songListEl();
      const sel = wrap && wrap.querySelector('.song-card.selected');
      if (sel) sel.scrollIntoView({ block: 'nearest' });
    };

    // ---------- 通用弹层 (分组管理 / 导入菜单) ----------
    const popoverEl = () => document.getElementById('groupPopover');

    const closeGroupPopover = () => {
      const pop = popoverEl();
      if (pop) { pop.style.display = 'none'; pop.innerHTML = ''; }
    };

    const placePopover = (pop, anchorBtn) => {
      pop.style.display = '';
      const w = 172;
      const h = pop.offsetHeight || 60;
      const rect = anchorBtn.getBoundingClientRect();
      let x = Math.min(rect.left, window.innerWidth - w - 8);
      let y = rect.bottom + 4;
      if (y + h > window.innerHeight - 8) y = Math.max(48, rect.top - h - 4);
      pop.style.left = Math.max(4, x) + 'px';
      pop.style.top = y + 'px';
    };

    // 菜单型弹层: rows = [{label, action}]
    const showMenuPopover = (anchorBtn, rows) => {
      const pop = popoverEl();
      if (!pop) return;
      pop.innerHTML = '';
      rows.forEach(r => {
        const row = document.createElement('div');
        row.className = 'gp-row';
        row.textContent = r.label;
        row.addEventListener('click', () => { closeGroupPopover(); r.action(); });
        pop.appendChild(row);
      });
      placePopover(pop, anchorBtn);
    };

    // 分组弹层: 勾选式切换 + 新建分组
    const openGroupPopover = (file, anchorBtn) => {
      const pop = popoverEl();
      if (!pop) return;
      pop.innerHTML = '';

      if (groups.length === 0) {
        const tip = document.createElement('div');
        tip.className = 'gp-row';
        tip.style.cursor = 'default';
        tip.textContent = MusicI18n.t('library.newGroup') + ' ↓';
        pop.appendChild(tip);
      }
      groups.forEach(g => {
        const row = document.createElement('div');
        row.className = 'gp-row';
        const inGroup = g.tracks.includes(file);
        row.innerHTML = '<span class="gp-check">' + (inGroup ? '✔' : '') + '</span><span class="gp-name"></span>';
        row.querySelector('.gp-name').textContent = g.name;
        row.addEventListener('click', async () => {
          const added = await toggleTrackInGroup(g.id, file);
          playSound(added ? 'OK' : 'click');
          openGroupPopover(file, anchorBtn); // 重开刷新勾选
        });
        pop.appendChild(row);
      });

      const newBtn = document.createElement('button');
      newBtn.className = 'gp-new';
      newBtn.textContent = '+ ' + MusicI18n.t('library.newGroup');
      newBtn.addEventListener('click', async () => {
        closeGroupPopover();
        const name = await showModal({
          icon: '+',
          title: MusicI18n.t('groups.newTitle'),
          prompt: true
        });
        if (name) await createGroup(name, { trackFiles: [file] });
      });
      pop.appendChild(newBtn);

      placePopover(pop, anchorBtn);
    };

    // 点击弹层外关闭
    document.addEventListener('click', (e) => {
      const pop = popoverEl();
      if (!pop || pop.style.display === 'none') return;
      if (pop.contains(e.target)) return;
      if (e.target.closest('.sb-group') || e.target.closest('#importBtn')) return; // 锚点自己会重开
      closeGroupPopover();
    });
