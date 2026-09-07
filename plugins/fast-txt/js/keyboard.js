    // ========== Editor Keydown ==========
    const handleEditorKeydown = (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = editorTextarea.selectionStart;
        const end = editorTextarea.selectionEnd;
        editorContent = editorContent.substring(0, start) + '  ' + editorContent.substring(end);
        editorTextarea.value = editorContent;
        editorTextarea.selectionStart = editorTextarea.selectionEnd = start + 2;
        renderEditorStatus();
        renderLineNumbers();
      }
      // Prevent Backspace from triggering browser back when at start
      if (e.key === 'Backspace' && editorTextarea.selectionStart === 0 && editorTextarea.selectionEnd === 0) {
        e.preventDefault();
      }
    };

    // ========== Global Keyboard ==========
    const handleKeydown = (e) => {
      let key = e.key;

      // Modal open - use original key, WASD works as arrows via mapping below
      if (modalVisible) {
        e.preventDefault();
        e.stopImmediatePropagation();
        // Map WASD to arrows for modal navigation
        if (key === 'w' || key === 'W') key = 'ArrowUp';
        if (key === 's' || key === 'S') key = 'ArrowDown';
        if (key === 'a' || key === 'A') key = 'ArrowLeft';
        if (key === 'd' || key === 'D') key = 'ArrowRight';
        if (key === 'Escape') {
          closeModal();
          playSound('click');
        } else if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
          playSound('click');
          if (key === 'ArrowUp') {
            modalSelectedBtnIdx = modalButtonDefs.length - 1;
          } else if (key === 'ArrowDown') {
            modalSelectedBtnIdx = 0;
          } else if (key === 'ArrowLeft') {
            modalSelectedBtnIdx = Math.max(0, modalSelectedBtnIdx - 1);
          } else if (key === 'ArrowRight') {
            modalSelectedBtnIdx = Math.min(modalButtonDefs.length - 1, modalSelectedBtnIdx + 1);
          }
          renderModal();
        } else if (key === 'Enter' || key === ' ') {
          playSound('click');
          const btn = modalButtonDefs[modalSelectedBtnIdx];
          if (btn && btn.action) btn.action();
        }
        return;
      }

      // Create menu open
      if (showCreateMenuVisible) {
        e.preventDefault();
        e.stopImmediatePropagation();
        // Map WASD to arrows for create menu navigation
        if (key === 'w' || key === 'W') key = 'ArrowUp';
        if (key === 's' || key === 'S') key = 'ArrowDown';
        if (key === 'a' || key === 'A') key = 'ArrowLeft';
        if (key === 'd' || key === 'D') key = 'ArrowRight';
        const totalOpts = 3;
        if (key === 'Escape') {
          closeCreateMenu();
          playSound('click');
        } else if (key === 'ArrowUp' || key === 'ArrowDown') {
          playSound('click');
          if (key === 'ArrowUp') {
            createMenuSelectedIdx = (createMenuSelectedIdx + totalOpts - 1) % totalOpts;
          } else {
            createMenuSelectedIdx = (createMenuSelectedIdx + 1) % totalOpts;
          }
          renderCreateMenu();
        } else if (key === 'Enter' || key === ' ') {
          playSound('click');
          if (createMenuSelectedIdx === 0) createFile('txt');
          else if (createMenuSelectedIdx === 1) createFile('md');
          else if (createMenuSelectedIdx === 2) createFolder();
          else closeCreateMenu();
        }
        return;
      }

      // Rename mode - only F2 to re-trigger, Escape handled by input itself
      if (isRenaming) {
        return;
      }

      // Find/Replace bar open - let it handle its own keys
      if (findBarVisible) {
        return;
      }

      // Editor mode - only handle global shortcuts (Ctrl+S, Ctrl+F, etc.)
      if (currentView === 'editor') {
        // Ctrl/Cmd shortcuts
        if (e.ctrlKey || e.metaKey) {
          if (key === 's' || key === 'S') {
            e.preventDefault();
            e.stopImmediatePropagation();
            saveEditorContent();
            showAutoSaveIndicator();
            return;
          }
          if (key === 'f' || key === 'F') {
            e.preventDefault();
            e.stopImmediatePropagation();
            openFindBar(false);
            return;
          }
          if (key === 'h' || key === 'H') {
            e.preventDefault();
            e.stopImmediatePropagation();
            openFindBar(true);
            return;
          }
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
          closeEditor();
        }
        return;
      }

      // Main view - WASD mapped to arrows for gamepad-style navigation
      let mappedKey = key;
      if (mappedKey === 'w' || mappedKey === 'W') mappedKey = 'ArrowUp';
      if (mappedKey === 's' || mappedKey === 'S') mappedKey = 'ArrowDown';
      if (mappedKey === 'a' || mappedKey === 'A') mappedKey = 'ArrowLeft';
      if (mappedKey === 'd' || mappedKey === 'D') mappedKey = 'ArrowRight';

      if (e.key === 'Escape') {
        if (isSearchFocused) {
          // 搜索框聚焦时 Escape → 清空搜索并取消聚焦
          isSearchFocused = false;
          searchInput.value = '';
          searchQuery = '';
          searchInput.blur();
          updateUI();
        } else if (isFolderMode) {
          // 文件夹模式 → 返回上一级（根目录）
          e.stopImmediatePropagation();
          exitFolderMode();
        } else if (isTrashMode) {
          // 回收站模式 → 返回文件列表
          e.stopImmediatePropagation();
          isTrashMode = false;
          playSound('exit');
          updateUI();
        } else {
          // 根目录 → 关闭子程序
          returnToParent();
        }
        return;
      }

      if (mappedKey === ' ') mappedKey = 'Enter';

      switch (mappedKey) {
        case 'ArrowUp':
          e.preventDefault();
          if (isSearchFocused) {
            // 搜索框已聚焦，不再上移
            break;
          } else if (selectedRow === 0) {
            // 文件网格中
            const list = getDisplayFiles();
            const total = list.length;
            if (total > 0 && isInFirstRow(selectedCol)) {
              // 在网格第一行 → 聚焦搜索框
              isSearchFocused = true;
              searchInput.focus();
              playSound('click');
              updateUI();
              break;
            }
            // 不在第一行 → 向上移动一行
            if (selectedCol >= GRID_COLS) {
              selectedCol -= GRID_COLS;
            }
          } else if (selectedRow === 1) {
            // 底部按钮行 → 回到最后一个文件
            selectedRow = 0;
            const btns = getFooterButtons();
            const lastFileCol = getDisplayFiles().length - 1;
            // 尝试对齐到按钮所在的列
            selectedCol = Math.min(selectedCol, lastFileCol);
          }
          playSound('click');
          updateUI();
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (isSearchFocused) {
            // 搜索框聚焦 → 选中第一个文件
            isSearchFocused = false;
            searchInput.blur();
            selectedRow = 0;
            selectedCol = 0;
            playSound('click');
            updateUI();
            break;
          } else if (selectedRow === 0) {
            // 文件网格中
            const list = getDisplayFiles();
            const total = list.length;
            if (total === 0) break;
            if (isInLastRow(selectedCol, total)) {
              // 在网格最后一行 → 跳到底部按钮
              selectedRow = 1;
              const btns = getFooterButtons();
              selectedCol = Math.min(selectedCol, btns.length - 1);
            } else {
              // 向下移动一行，但不超过总数
              const next = selectedCol + GRID_COLS;
              selectedCol = Math.min(next, total - 1);
            }
          }
          playSound('click');
          updateUI();
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (!isSearchFocused) {
            if (selectedRow === 0 && selectedCol > 0) {
              selectedCol--;
            } else if (selectedRow === 1 && selectedCol > 0) {
              selectedCol--;
            }
          }
          playSound('click');
          updateUI();
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (!isSearchFocused) {
            if (selectedRow === 0) {
              const maxFileCol = getDisplayFiles().length - 1;
              if (selectedCol < maxFileCol) selectedCol++;
            } else {
              const maxBtnCol = getFooterButtons().length - 1;
              if (selectedCol < maxBtnCol) selectedCol++;
            }
          }
          playSound('click');
          updateUI();
          break;

        case 'M':
        case 'm':
          e.preventDefault();
          if (selectedRow === 0 && !isTrashMode) {
            const file = getDisplayFiles()[selectedCol];
            if (file && !file.isFolder) startRename(file);
          }
          break;

        case 'Enter':
          e.preventDefault();
          if (isSearchFocused) {
            // 搜索框中按 Enter → 打开当前选中的文件（如果有的话）
            isSearchFocused = false;
            searchInput.blur();
            const list = getDisplayFiles();
            if (list.length > 0) {
              selectedRow = 0;
              openFile(list[selectedCol] || list[0]);
            }
          } else if (selectedRow === 0) {
            const file = getDisplayFiles()[selectedCol];
            if (file) openFile(file);
          } else {
            const btn = getFooterButtons()[selectedCol];
            if (btn) btn.action();
          }
          break;

        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          if (!isSearchFocused && selectedRow === 0 && !isTrashMode) {
            const file = getDisplayFiles()[selectedCol];
            if (file && !file.deleted) {
              const api = fsAPI();
              if (api) {
                const srcPath = file.parentPath ? `${file.parentPath}/${file.name}` : file.name;
                api.mkdir(TRASH_DIR).then(() => {
                  api.rename(srcPath, `${TRASH_DIR}/${file.name}`);
                });
              }
              file.deleted = true;
              saveFiles();
              playSound('exit');
              const maxIdx = getDisplayFiles().length - 1;
              if (selectedCol > maxIdx) selectedCol = maxIdx;
              updateUI();
            }
          }
          break;
      }
    };
