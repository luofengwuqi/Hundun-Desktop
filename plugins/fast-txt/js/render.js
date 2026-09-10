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

      // 仅当现有卡片集合与目标列表【数量+顺序+id】完全一致时增量更新选中态；
      // 否则(切垃圾桶/文件夹、搜索、排序、删除恢复等导致内容变化)完整重建 DOM，
      // 避免卡片残留上一视图的 DELETED 徽标/图标/删除样式(表现为"正常文件显示为已删除")
      const cards = fileList.querySelectorAll('.ftxt-file-card');
      let sameSet = cards.length === list.length;
      if (sameSet) {
        for (let i = 0; i < list.length; i++) {
          if (cards[i].dataset.fileId !== list[i].id) {
            sameSet = false;
            break;
          }
        }
      }
      if (!sameSet) {
        rebuildFileListDOM(list);
      } else {
        // 只更新选中状态
        updateFileListSelection(list);
      }
    };

    const rebuildFileListDOM = (list) => {
      fileList.innerHTML = '';

      if (list.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'ftxt-empty';
        const emptyText = isTrashMode 
          ? FastTXTI18n.t('empty.trash') 
          : isFolderMode 
            ? FastTXTI18n.t('empty.folder', { folder: currentFolderPath }) 
            : FastTXTI18n.t('empty.root');
        const emptyHint = isTrashMode || isFolderMode ? '' : FastTXTI18n.t('empty.hint');
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
          ${file.deleted ? `<div class="file-deleted-badge">${FastTXTI18n.t('file.deleted')}</div>` : ''}
          <button class="file-rename-btn" title="${FastTXTI18n.t('file.rename')}">✎</button>
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
      const deleted = getDeletedFiles();
      if (isTrashMode) {
        fileCountEl.textContent = FastTXTI18n.t('footer.deleted', { count: deleted.length });
        trashCountEl.style.display = 'none';
      } else if (isFolderMode) {
        const inFolder = getFilesInCurrentFolder();
        fileCountEl.textContent = FastTXTI18n.t('footer.inFolder', { count: inFolder.length, folder: currentFolderPath });
        trashCountEl.style.display = 'none';
      } else {
        const rootCount = getRootFiles().length;
        fileCountEl.textContent = FastTXTI18n.t('footer.files', { count: rootCount });
        trashCountEl.style.display = 'none';
      }
    };

    const updateTrashShredderZones = () => {
      trashZone.style.display = (isTrashMode || isFolderMode) ? 'none' : '';
      shredderZone.style.display = isTrashMode ? '' : 'none';
      emptyTrashBtn.style.display = isTrashMode ? '' : 'none';
    };

    const renderLineNumbers = () => {
      const count = getLineCount();
      const lineHeight = editorFontSize * 1.8;
      const cur = lineNumbers.childElementCount;
      const lastLH = parseFloat(lineNumbers.dataset.lh || '0');

      // 行数与行高均未变化 → 零 DOM 操作 (打字路径的优化分支)
      // 但书签状态可能变化，需要更新书签显示
      if (cur === count && lastLH === lineHeight) {
        // 更新书签显示
        lineNumbers.querySelectorAll('.line-num').forEach((el, idx) => {
          const lineNum = idx + 1;
          const hasBookmark = bookmarks[lineNum];
          const existingBookmark = el.querySelector('.bookmark-dot');
          if (hasBookmark && !existingBookmark) {
            el.classList.add('has-bookmark');
            el.textContent = '';
            const dot = document.createElement('div');
            dot.className = 'bookmark-dot';
            el.appendChild(dot);
          } else if (!hasBookmark && existingBookmark) {
            el.classList.remove('has-bookmark');
            existingBookmark.remove();
            el.textContent = lineNum;
          }
        });
        return;
      }

      if (cur === count) {
        // 仅行高变化 (Ctrl+滚轮缩放) → 全量更新行高样式
        lineNumbers.dataset.lh = lineHeight;
        lineNumbers.querySelectorAll('.line-num').forEach(el => {
          el.style.lineHeight = lineHeight + 'px';
          el.style.height = lineHeight + 'px';
        });
        return;
      }

      // 行数变化 → 增量增删尾部节点，避免全量重建
      if (cur < count) {
        const frag = document.createDocumentFragment();
        for (let n = cur + 1; n <= count; n++) {
          const div = document.createElement('div');
          div.className = 'line-num';
          div.style.lineHeight = lineHeight + 'px';
          div.style.height = lineHeight + 'px';
          
          // 书签状态
          if (bookmarks[n]) {
            div.classList.add('has-bookmark');
            const dot = document.createElement('div');
            dot.className = 'bookmark-dot';
            div.appendChild(dot);
          } else {
            div.textContent = n;
          }
          
          // 点击事件
          div.addEventListener('click', () => toggleBookmark(n, div));
          frag.appendChild(div);
        }
        lineNumbers.appendChild(frag);
      } else {
        while (lineNumbers.childElementCount > count) {
          lineNumbers.lastChild.remove();
        }
      }
      lineNumbers.dataset.lh = lineHeight;
    };

    const toggleBookmark = async (lineNum, lineEl) => {
      if (bookmarks[lineNum]) {
        // 移除书签
        delete bookmarks[lineNum];
        lineEl.classList.remove('has-bookmark');
        const dot = lineEl.querySelector('.bookmark-dot');
        if (dot) dot.remove();
        lineEl.textContent = lineNum;
      } else {
        // 添加书签
        bookmarks[lineNum] = true;
        lineEl.textContent = '';
        lineEl.classList.add('has-bookmark');
        const dot = document.createElement('div');
        dot.className = 'bookmark-dot';
        lineEl.appendChild(dot);
      }
      playSound('click');
      // 持久化书签
      const filePath = editingFile ? (editingFile.parentPath ? `${editingFile.parentPath}/${editingFile.name}` : editingFile.name) : null;
      await saveBookmarksToDisk(filePath);
    };

    let _statusWordTimer = null; // 字数统计防抖定时器
    const renderEditorStatus = () => {
      statusLines.textContent = FastTXTI18n.t('status.lines', { n: getLineCount() });
      statusChars.textContent = FastTXTI18n.t('status.chars', { n: editorContent.length });
      // Word count (防抖: 大文件避免每次击键全量 split)
      if (_statusWordTimer) clearTimeout(_statusWordTimer);
      _statusWordTimer = setTimeout(() => {
        _statusWordTimer = null;
        const words = editorContent.trim() ? editorContent.trim().split(/\s+/).length : 0;
        statusWords.textContent = FastTXTI18n.t('status.words', { n: words });
      }, 200);
      statusType.textContent = editingFile && editingFile.name.endsWith('.md') ? FastTXTI18n.t('status.markdown') : FastTXTI18n.t('status.plainText');
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
        if (selectedRow === 0) {
          // 仅在文件行时 clamp 文件列表
          if (list.length === 0) {
            selectedCol = 0;
          } else if (selectedCol >= list.length) {
            selectedCol = list.length - 1;
          }
          if (selectedCol < 0) selectedCol = 0;
        }
        if (selectedRow === 1) {
          const btns = getFooterButtons();
          if (selectedCol >= btns.length) selectedCol = btns.length - 1;
          if (selectedCol < 0) selectedCol = 0;
        }
      }
    };
