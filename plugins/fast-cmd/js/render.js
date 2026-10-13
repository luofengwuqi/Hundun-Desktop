    // ========== UI Render ==========
    const updateUI = () => {
      if (currentView === 'main') {
        viewMain.style.display = '';
        document.querySelector('.fcmd-search').classList.toggle('search-focused', isSearchFocused);
        renderFileList();
        renderFooter();
        updateFooterInfo();
        updateTrashShredderZones();
      }
      clampSelection();
    };

    const renderFileList = () => {
      const list = getDisplayFiles();
      if (isRenaming) { updateFileListSelection(list); return; }
      // 空列表一律重建: 保证空态 (还没有脚本/回收站为空/系统不支持) 始终渲染且随模式切换更新
      if (list.length === 0) { rebuildFileListDOM(list); return; }

      const cards = fileList.querySelectorAll('.fcmd-file-card');
      let sameSet = cards.length === list.length;
      if (sameSet) {
        for (let i = 0; i < list.length; i++) {
          if (cards[i].dataset.fileId !== list[i].id) { sameSet = false; break; }
        }
      }
      if (!sameSet) { rebuildFileListDOM(list); }
      else { updateFileListSelection(list); }
    };

    const rebuildFileListDOM = (list) => {
      fileList.innerHTML = '';
      if (list.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'fcmd-empty';
        // 空列表时区分: 系统不支持 / 回收站为空 / 还没有脚本 (决策42)
        let emptyIcon = '📁';
        let emptyText;
        let emptyHint = '';
        if (!FastCmdPlatform.isSupported) {
          emptyIcon = '⚠️';
          emptyText = FastCmdI18n.t('unsupported.title');
          emptyHint = FastCmdI18n.t('unsupported.msg', { platform: FastCmdPlatform.osName });
        } else if (isTrashMode) {
          emptyText = FastCmdI18n.t('empty.trash');
        } else {
          emptyText = FastCmdI18n.t('empty.root');
          emptyHint = FastCmdI18n.t('empty.hint', { exts: FastCmdPlatform.extensions.join(' ') });
        }
        emptyDiv.innerHTML = `
          <div class="empty-icon">${emptyIcon}</div>
          <div class="empty-text">${emptyText}</div>
          <div class="empty-hint">${emptyHint}</div>
        `;
        fileList.appendChild(emptyDiv);
        return;
      }

      list.forEach((file, idx) => {
        const card = document.createElement('div');
        card.className = 'fcmd-file-card';
        if (selectedRow === 0 && selectedCol === idx && !isSearchFocused) card.classList.add('selected');
        if (dragFileId === file.id) card.classList.add('dragging');
        if (file.deleted) card.classList.add('is-deleted');
        card.draggable = true;
        card.dataset.fileId = file.id;

        const icon = FastCmdPlatform.iconFor(file.name);

        const dotIdx = file.name.lastIndexOf('.');
        const ext = dotIdx > 0 ? file.name.substring(dotIdx).toUpperCase() : '';
        card.innerHTML = `
          <div class="file-icon">${icon}</div>
          <div class="file-info">
            <div class="file-name">${escapeHtml(file.name)}</div>
          </div>
          ${ext ? `<span class="file-ext-badge">${ext}</span>` : ''}
          ${file.deleted ? `<div class="file-deleted-badge">${FastCmdI18n.t('file.deleted')}</div>` : ''}
          <button class="file-rename-btn" title="${FastCmdI18n.t('file.rename')}">✎</button>
        `;

        card.addEventListener('dragstart', (e) => handleFileDragStart(e, file));
        card.addEventListener('dragend', handleFileDragEnd);
        card.addEventListener('click', () => handleFileClick(file));
        const renameBtn = card.querySelector('.file-rename-btn');
        if (renameBtn) {
          renameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isTrashMode) startRename(file);
          });
        }
        fileList.appendChild(card);
      });
    };

    const updateFileListSelection = (list) => {
      const cards = fileList.querySelectorAll('.fcmd-file-card');
      cards.forEach((card, idx) => {
        const file = list[idx];
        if (!file) return;
        const isSelected = selectedRow === 0 && selectedCol === idx && !isSearchFocused;
        const wasSelected = card.classList.contains('selected');
        if (isSelected !== wasSelected) card.classList.toggle('selected', isSelected);
        const isDragging = dragFileId === file.id;
        const wasDragging = card.classList.contains('dragging');
        if (isDragging !== wasDragging) card.classList.toggle('dragging', isDragging);
        const isDeleted = file.deleted;
        const wasDeleted = card.classList.contains('is-deleted');
        if (isDeleted !== wasDeleted) card.classList.toggle('is-deleted', isDeleted);
        const nameEl = card.querySelector('.file-name');
        if (nameEl && nameEl.textContent !== file.name && !(isRenaming && renamingFileId === file.id)) {
          nameEl.textContent = file.name;
        }
      });
    };

    const renderFooter = () => {
      const btns = getFooterButtons();
      const existingBtns = footerButtons.querySelectorAll('.footer-btn');
      if (existingBtns.length !== btns.length) { rebuildFooterDOM(btns); }
      else { updateFooterSelection(btns); }
    };

    const rebuildFooterDOM = (btns) => {
      footerButtons.innerHTML = '';
      btns.forEach((btn, idx) => {
        const el = document.createElement('button');
        el.className = 'footer-btn ' + btn.id + '-btn';
        if (btn.id === 'trash' && isTrashMode) el.classList.add('active');
        if (selectedRow === 1 && selectedCol === idx) el.classList.add('btn-focused');
        el.title = btn.title;
        el.innerHTML = `<span class="btn-icon">${btn.icon}</span>`;
        el.addEventListener('click', () => {
          isSearchFocused = false;
          selectedRow = 1;
          selectedCol = idx;
          btn.action();
          updateUI();
        });
        footerButtons.appendChild(el);
      });
    };

    const updateFooterSelection = (btns) => {
      const elements = footerButtons.querySelectorAll('.footer-btn');
      elements.forEach((el, idx) => {
        const btn = btns[idx];
        if (!btn) return;
        const isFocused = selectedRow === 1 && selectedCol === idx;
        const wasFocused = el.classList.contains('btn-focused');
        if (isFocused !== wasFocused) el.classList.toggle('btn-focused', isFocused);
        const isActive = (btn.id === 'trash' && isTrashMode);
        const wasActive = el.classList.contains('active');
        if (isActive !== wasActive) el.classList.toggle('active', isActive);
      });
    };

    const updateFooterInfo = () => {
      const deleted = getDeletedFiles();
      if (isTrashMode) {
        fileCountEl.textContent = FastCmdI18n.t('footer.deleted', { count: deleted.length });
        trashCountEl.style.display = 'none';
      } else {
        fileCountEl.textContent = FastCmdI18n.t('footer.files', { count: getActiveFiles().length });
        trashCountEl.style.display = 'none';
      }
    };

    const updateTrashShredderZones = () => {
      // 不支持的系统: 无脚本可管理, 隐藏投放区
      trashZone.style.display = (isTrashMode || !FastCmdPlatform.isSupported) ? 'none' : '';
      shredderZone.style.display = isTrashMode ? '' : 'none';
      emptyTrashBtn.style.display = isTrashMode ? '' : 'none';
    };

    const escapeHtml = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // ========== Selection Clamping ==========
    const clampSelection = () => {
      if (currentView === 'main') {
        const list = getDisplayFiles();
        if (isSearchFocused) return;
        if (selectedRow === 0) {
          if (list.length === 0) selectedCol = 0;
          else if (selectedCol >= list.length) selectedCol = list.length - 1;
          if (selectedCol < 0) selectedCol = 0;
        }
        if (selectedRow === 1) {
          const btns = getFooterButtons();
          if (selectedCol >= btns.length) selectedCol = btns.length - 1;
          if (selectedCol < 0) selectedCol = 0;
        }
      }
    };
