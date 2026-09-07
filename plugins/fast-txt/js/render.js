    // ========== UI Render ==========
    const updateUI = () => {
      if (currentView === 'main') {
        viewMain.style.display = '';
        viewEditor.style.display = 'none';
        // Close find bar when leaving editor
        if (findBarVisible) {
          findBarVisible = false;
          findBar.style.display = 'none';
        }
        // 面包屑
        if (isFolderMode) {
          folderBreadcrumb.style.display = '';
          breadcrumbPath.textContent = `📁 ${currentFolderPath}`;
        } else {
          folderBreadcrumb.style.display = 'none';
        }
        // 搜索框聚焦视觉状态
        document.querySelector('.ftxt-search').classList.toggle('search-focused', isSearchFocused);
        renderFileList();
        renderFooter();
        updateFooterInfo();
        updateTrashShredderZones();
      } else if (currentView === 'editor') {
        viewMain.style.display = 'none';
        viewEditor.style.display = '';
        renderEditorStatus();
        renderLineNumbers();
      }
      clampSelection();
    };

    const renderFileList = () => {
      const list = getDisplayFiles();

      // 重命名中不重建 DOM（保留 input 元素）
      if (isRenaming) {
        updateFileListSelection(list);
        return;
      }

      // 如果文件数量变了，才重建 DOM
      const existingCards = fileList.querySelectorAll('.ftxt-file-card');
      if (existingCards.length !== list.length) {
        rebuildFileListDOM(list);
      } else {
        // 只更新选中状态和内容
        updateFileListSelection(list);
      }
    };

    const rebuildFileListDOM = (list) => {
      fileList.innerHTML = '';

      if (list.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'ftxt-empty';
        emptyDiv.innerHTML = `
          <div class="empty-icon">📁</div>
          <div class="empty-text">${isTrashMode ? 'Trash is empty' : isFolderMode ? `No files in ${currentFolderPath}` : 'No files yet'}</div>
          <div class="empty-hint">${isTrashMode || isFolderMode ? '' : 'Drag .txt or .md files here'}</div>
        `;
        fileList.appendChild(emptyDiv);
        return;
      }

      list.forEach((file, idx) => {
        const card = document.createElement('div');
        card.className = 'ftxt-file-card';
        if (selectedRow === 0 && selectedCol === idx && !isSearchFocused) card.classList.add('selected');
        if (dragFileId === file.id) card.classList.add('dragging');
        if (file.deleted) card.classList.add('is-deleted');
        card.draggable = true;
        card.dataset.fileId = file.id;

        let icon = '📄';
        if (file.isFolder) icon = '📁';
        else if (file.name.endsWith('.md')) icon = '📝';
        card.innerHTML = `
          <div class="file-icon">${icon}</div>
          <div class="file-info">
            <div class="file-name">${escapeHtml(file.name)}</div>
          </div>
          ${file.deleted ? '<div class="file-deleted-badge">DELETED</div>' : ''}
          <button class="file-rename-btn" title="Rename (M)">✎</button>
        `;

        card.addEventListener('dragstart', (e) => handleFileDragStart(e, file));
        card.addEventListener('dragend', handleFileDragEnd);
        card.addEventListener('click', () => handleFileClick(file));
        // 双击文件名 → 重命名
        card.addEventListener('dblclick', (e) => {
          e.preventDefault();
          if (!isTrashMode && !file.isFolder) {
            startRename(file);
          }
        });
        // 重命名按钮
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
      const cards = fileList.querySelectorAll('.ftxt-file-card');
      cards.forEach((card, idx) => {
        const file = list[idx];
        if (!file) return;

        // 更新选中状态（只在状态变化时改 class，避免抖动）
        const isSelected = selectedRow === 0 && selectedCol === idx && !isSearchFocused;
        const wasSelected = card.classList.contains('selected');
        if (isSelected !== wasSelected) {
          card.classList.toggle('selected', isSelected);
        }

        const isDragging = dragFileId === file.id;
        const wasDragging = card.classList.contains('dragging');
        if (isDragging !== wasDragging) {
          card.classList.toggle('dragging', isDragging);
        }

        const isDeleted = file.deleted;
        const wasDeleted = card.classList.contains('is-deleted');
        if (isDeleted !== wasDeleted) {
          card.classList.toggle('is-deleted', isDeleted);
        }

        // 更新文件名（以防万一）—— 重命名中跳过
        const nameEl = card.querySelector('.file-name');
        if (nameEl && nameEl.textContent !== file.name && !(isRenaming && renamingFileId === file.id)) {
          nameEl.textContent = file.name;
        }
      });
    };

    const renderFooter = () => {
      const btns = getFooterButtons();

      // 如果按钮数量变了，重建 DOM
      const existingBtns = footerButtons.querySelectorAll('.footer-btn');
      if (existingBtns.length !== btns.length) {
        rebuildFooterDOM(btns);
      } else {
        // 只更新选中状态
        updateFooterSelection(btns);
      }
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
        if (isFocused !== wasFocused) {
          el.classList.toggle('btn-focused', isFocused);
        }
        const isActive = (btn.id === 'trash' && isTrashMode) || (btn.id === 'folder' && isFolderMode);
        const wasActive = el.classList.contains('active');
        if (isActive !== wasActive) {
          el.classList.toggle('active', isActive);
        }
      });
    };

    const updateFooterInfo = () => {
      const active = getActiveFiles();
      const deleted = getDeletedFiles();
      if (isTrashMode) {
        fileCountEl.textContent = `${deleted.length} deleted`;
        trashCountEl.style.display = 'none';
      } else if (isFolderMode) {
        const inFolder = getFilesInCurrentFolder();
        fileCountEl.textContent = `${inFolder.length} files in ${currentFolderPath}`;
        trashCountEl.style.display = 'none';
      } else {
        fileCountEl.textContent = `${active.length} files`;
        trashCountEl.style.display = 'none';
      }
    };

    const updateTrashShredderZones = () => {
      trashZone.style.display = (isTrashMode || isFolderMode) ? 'none' : '';
      shredderZone.style.display = isTrashMode ? '' : 'none';
    };

    const renderLineNumbers = () => {
      const count = getLineCount();
      const lineHeight = editorFontSize * 1.8;
      lineNumbers.innerHTML = '';
      for (let n = 1; n <= count; n++) {
        const div = document.createElement('div');
        div.className = 'line-num';
        div.textContent = n;
        div.style.lineHeight = lineHeight + 'px';
        div.style.height = lineHeight + 'px';
        lineNumbers.appendChild(div);
      }
    };

    const renderEditorStatus = () => {
      statusLines.textContent = `Lines: ${getLineCount()}`;
      statusChars.textContent = `Chars: ${editorContent.length}`;
      // Word count
      const words = editorContent.trim() ? editorContent.trim().split(/\s+/).length : 0;
      statusWords.textContent = `Words: ${words}`;
      statusType.textContent = editingFile && editingFile.name.endsWith('.md') ? 'Markdown' : 'Plain Text';
    };

    const escapeHtml = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // ========== Selection Clamping ==========
    const clampSelection = () => {
      if (currentView === 'main') {
        const list = getDisplayFiles();
        if (isSearchFocused) {
          // 搜索框聚焦时不需要clamp文件列表
          return;
        }
        if (list.length === 0) {
          selectedCol = 0;
        } else if (selectedCol >= list.length) {
          selectedCol = list.length - 1;
        }
        if (selectedCol < 0) selectedCol = 0;
        if (selectedRow === 1) {
          const btns = getFooterButtons();
          if (selectedCol >= btns.length) selectedCol = btns.length - 1;
        }
      }
    };
