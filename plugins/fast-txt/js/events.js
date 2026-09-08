    // ========== Event Listeners ==========
    // Drag & drop global
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', handleGlobalDrop);

    // Search
    searchInput.addEventListener('focus', () => {
      isSearchFocused = true;
      updateUI();
    });
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      selectedCol = 0;
      updateUI();
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        searchInput.value = '';
        searchQuery = '';
        searchInput.blur();
        isSearchFocused = false;
        updateUI();
      } else if (e.key === 'ArrowDown') {
        // 从搜索框按下 → 选中第一个文件
        e.preventDefault();
        e.stopPropagation();
        searchInput.blur();
        isSearchFocused = false;
        selectedRow = 0;
        selectedCol = 0;
        playSound('click');
        updateUI();
      } else if (e.key === 'Backspace' && searchInput.value === '') {
        // Prevent browser back navigation when search is empty
        e.preventDefault();
        e.stopPropagation();
      } else {
        e.stopPropagation();
      }
    });

    // 搜索框失去焦点时清除高亮
    searchInput.addEventListener('blur', () => {
      // 延迟清除，避免点击搜索框时闪烁
      setTimeout(() => {
        if (document.activeElement !== searchInput) {
          isSearchFocused = false;
          updateUI();
        }
      }, 150);
    });

    // File list drag
    fileList.addEventListener('dragover', handleListDragOver);
    fileList.addEventListener('drop', handleListDrop);

    // Breadcrumb back
    breadcrumbBack.addEventListener('click', () => exitFolderMode());

    // Trash zone
    trashZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      isTrashDragOver = true;
      trashZone.classList.add('drag-over');
    });
    trashZone.addEventListener('dragleave', () => {
      isTrashDragOver = false;
      trashZone.classList.remove('drag-over');
    });
    trashZone.addEventListener('drop', handleTrashDrop);

    // Shredder zone
    shredderZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      isShredderDragOver = true;
      shredderZone.classList.add('drag-over');
    });
    shredderZone.addEventListener('dragleave', () => {
      isShredderDragOver = false;
      shredderZone.classList.remove('drag-over');
    });
    shredderZone.addEventListener('drop', handleShredderDrop);

    // Close buttons
    closeBtn.addEventListener('click', returnToParent);
    editorCloseBtn.addEventListener('click', closeEditor);

    // Editor textarea
    let _lastEditorContent = '';
    editorTextarea.addEventListener('input', (e) => {
      const newContent = e.target.value;
      // 内容变化时保存撤销状态
      if (newContent !== _lastEditorContent) {
        pushUndoState();
        _lastEditorContent = newContent;
      }
      editorContent = newContent;
      renderEditorStatus();
      renderLineNumbers();
      // Update find matches if find bar is open
      if (findBarVisible && findInput.value) {
        performFind();
      }
    });
    editorTextarea.addEventListener('keydown', handleEditorKeydown);

    // ========== Ctrl+Scroll Font Zoom ==========
    let editorFontSize = 18; // 当前编辑器字号
    const EDITOR_FONT_SIZE_MIN = 8;
    const EDITOR_FONT_SIZE_MAX = 32;

    const syncLineNumbersLineHeight = () => {
      // 行号行高始终与textarea一致
      const lineHeight = editorFontSize * 1.8;
      document.querySelectorAll('.line-num').forEach(el => {
        el.style.lineHeight = lineHeight + 'px';
        el.style.height = lineHeight + 'px';
      });
    };

    editorTextarea.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();

      const delta = e.deltaY > 0 ? -1 : 1;
      const newSize = Math.min(EDITOR_FONT_SIZE_MAX, Math.max(EDITOR_FONT_SIZE_MIN, editorFontSize + delta));
      if (newSize === editorFontSize) return;

      editorFontSize = newSize;
      const lineHeight = editorFontSize * 1.8;
      editorTextarea.style.fontSize = editorFontSize + 'px';
      editorTextarea.style.lineHeight = lineHeight + 'px';

      // 重新渲染行号以匹配新行高
      renderLineNumbers();
    }, { passive: false });

    // 行号跟随textarea滚动同步
    editorTextarea.addEventListener('scroll', () => {
      lineNumbers.scrollTop = editorTextarea.scrollTop;
    });

    // 阻止行号区域被鼠标滚轮单独滚动，将滚轮事件转发给textarea
    lineNumbers.addEventListener('wheel', (e) => {
      e.preventDefault();
      editorTextarea.scrollTop += e.deltaY;
    }, { passive: false });

    // Modal overlay click to close
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
    createMenuOverlay.addEventListener('click', (e) => {
      if (e.target === createMenuOverlay) closeCreateMenu();
    });

    // Create menu options
    createOptions.querySelectorAll('.create-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        if (idx === 0) createFile('txt');
        else if (idx === 1) createFile('md');
        else if (idx === 2) createFolder();
      });
    });
    createMenuCancel.addEventListener('click', closeCreateMenu);

    // Find bar
    findInput.addEventListener('input', () => performFind());
    findInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) findPrev();
        else findNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeFindBar();
      }
    });
    findPrevBtn.addEventListener('click', findPrev);
    findNextBtn.addEventListener('click', findNext);
    findCloseBtn.addEventListener('click', closeFindBar);
    replaceOneBtn.addEventListener('click', replaceOne);
    replaceAllBtn.addEventListener('click', replaceAll);
    replaceInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        closeFindBar();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        replaceOne();
      }
    });

    // Global keyboard
    document.addEventListener('keydown', handleKeydown);
