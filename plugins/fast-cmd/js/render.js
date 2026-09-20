    // ========== UI Render ==========
    const updateUI = () => {
      if (currentView === 'main') {
        viewMain.style.display = '';
        if (isFolderMode) {
          folderBreadcrumb.style.display = '';
          breadcrumbPath.textContent = `📁 ${currentFolderPath}`;
        } else {
          folderBreadcrumb.style.display = 'none';
        }
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
        const emptyText = isTrashMode
          ? FastCmdI18n.t('empty.trash')
          : isFolderMode
            ? FastCmdI18n.t('empty.folder', { folder: currentFolderPath })
            : FastCmdI18n.t('empty.root');
        const emptyHint = isTrashMode || isFolderMode ? '' : FastCmdI18n.t('empty.hint');
        emptyDiv.innerHTML = `
          <div class="empty-icon">📁</div>
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

        let icon = '📄';
        if (file.isFolder) icon = '📁';
        else if (file.name.endsWith('.bat') || file.name.endsWith('.cmd')) icon = '⚙️';
        else if (file.name.endsWith('.ps1')) icon = '🔧';

        const ext = file.isFolder ? '' : file.name.substring(file.name.lastIndexOf('.')).toUpperCase();
        card.innerHTML = `
          <div class="file-icon">${icon}</div>
          <div class="file-info">
            <div class="file-name">${escapeHtml(file.name)}</div>
          </div>
          ${!file.isFolder && ext ? `<span class="file-ext-badge">${ext}</span>` : ''}
          ${file.deleted ? `<div class="file-deleted-badge">${FastCmdI18n.t('file.deleted')}</div>` : ''}
          <button class="file-rename-btn" title="${FastCmdI18n.t('file.rename')}">✎</button>
        `;

        card.addEventListener('dragstart', (e) => handleFileDragStart(e, file));
        card.addEventListener('dragend', handleFileDragEnd);
        card.addEventListener('click', () => handleFileClick(file));
        card.addEventListener('dblclick', (e) => {
          e.preventDefault();
          if (!isTrashMode && !file.isFolder) startRename(file);
        });
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
        const isActive = (btn.id === 'trash' && isTrashMode) || (btn.id === 'folder' && isFolderMode);
        const wasActive = el.classList.contains('active');
        if (isActive !== wasActive) el.classList.toggle('active', isActive);
      });
    };

    const updateFooterInfo = () => {
      const deleted = getDeletedFiles();
      if (isTrashMode) {
        fileCountEl.textContent = FastCmdI18n.t('footer.deleted', { count: deleted.length });
        trashCountEl.style.display = 'none';
      } else if (isFolderMode) {
        const inFolder = getFilesInCurrentFolder();
        fileCountEl.textContent = FastCmdI18n.t('footer.inFolder', { count: inFolder.length, folder: currentFolderPath });
        trashCountEl.style.display = 'none';
      } else {
        const rootCount = getRootFiles().length;
        fileCountEl.textContent = FastCmdI18n.t('footer.files', { count: rootCount });
        trashCountEl.style.display = 'none';
      }
    };

    const updateTrashShredderZones = () => {
      trashZone.style.display = (isTrashMode || isFolderMode) ? 'none' : '';
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
