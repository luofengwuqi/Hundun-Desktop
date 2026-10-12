    // ========== Global Keyboard ==========
    const handleKeydown = (e) => {
      let key = e.key;

      // Modal open
      if (modalVisible) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (key === 'w' || key === 'W') key = 'ArrowUp';
        if (key === 's' || key === 'S') key = 'ArrowDown';
        if (key === 'a' || key === 'A') key = 'ArrowLeft';
        if (key === 'd' || key === 'D') key = 'ArrowRight';
        if (key === 'Escape') { closeModal(); playSound('click'); }
        else if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
          playSound('click');
          if (key === 'ArrowUp') modalSelectedBtnIdx = modalButtonDefs.length - 1;
          else if (key === 'ArrowDown') modalSelectedBtnIdx = 0;
          else if (key === 'ArrowLeft') modalSelectedBtnIdx = Math.max(0, modalSelectedBtnIdx - 1);
          else if (key === 'ArrowRight') modalSelectedBtnIdx = Math.min(modalButtonDefs.length - 1, modalSelectedBtnIdx + 1);
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
        if (key === 'w' || key === 'W') key = 'ArrowUp';
        if (key === 's' || key === 'S') key = 'ArrowDown';
        if (key === 'a' || key === 'A') key = 'ArrowLeft';
        if (key === 'd' || key === 'D') key = 'ArrowRight';
        const totalOpts = 2;
        if (key === 'Escape') { closeCreateMenu(); playSound('click'); }
        else if (key === 'ArrowUp' || key === 'ArrowDown') {
          playSound('click');
          createMenuSelectedIdx = key === 'ArrowUp'
            ? (createMenuSelectedIdx + totalOpts - 1) % totalOpts
            : (createMenuSelectedIdx + 1) % totalOpts;
          renderCreateMenu();
        } else if (key === 'Enter' || key === ' ') {
          playSound('click');
          if (createMenuSelectedIdx === 0) createFile('bat');
          else if (createMenuSelectedIdx === 1) createFile('ps1');
          else closeCreateMenu();
        }
        return;
      }

      // Rename mode
      if (isRenaming) return;

      // Main view WASD
      let mappedKey = key;
      if (mappedKey === 'w' || mappedKey === 'W') mappedKey = 'ArrowUp';
      if (mappedKey === 's' || mappedKey === 'S') mappedKey = 'ArrowDown';
      if (mappedKey === 'a' || mappedKey === 'A') mappedKey = 'ArrowLeft';
      if (mappedKey === 'd' || mappedKey === 'D') mappedKey = 'ArrowRight';

      if (e.key === 'Escape') {
        if (isSearchFocused) {
          isSearchFocused = false;
          searchInput.value = '';
          searchQuery = '';
          searchInput.blur();
          updateUI();
        } else if (isTrashMode) {
          e.stopImmediatePropagation();
          isTrashMode = false;
          playSound('exit');
          updateUI();
        } else {
          returnToParent();
        }
        return;
      }

      if (mappedKey === ' ') mappedKey = 'Enter';

      switch (mappedKey) {
        case 'ArrowUp':
          e.preventDefault();
          if (isSearchFocused) break;
          else if (selectedRow === 0) {
            const list = getDisplayFiles();
            const total = list.length;
            if (total > 0 && isInFirstRow(selectedCol)) {
              isSearchFocused = true;
              searchInput.focus();
              playSound('click');
              updateUI();
              break;
            }
            if (selectedCol >= GRID_COLS) selectedCol -= GRID_COLS;
          } else if (selectedRow === 1) {
            selectedRow = 0;
            const lastFileCol = getDisplayFiles().length - 1;
            selectedCol = Math.min(selectedCol, lastFileCol);
          }
          playSound('click');
          updateUI();
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (isSearchFocused) {
            isSearchFocused = false;
            searchInput.blur();
            selectedRow = 0;
            selectedCol = 0;
            playSound('click');
            updateUI();
            break;
          } else if (selectedRow === 0) {
            const list = getDisplayFiles();
            const total = list.length;
            if (total === 0) { selectedRow = 1; selectedCol = 0; }
            else if (isInLastRow(selectedCol, total)) {
              selectedRow = 1;
              const btns = getFooterButtons();
              selectedCol = Math.min(selectedCol, btns.length - 1);
            } else {
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
            if (selectedRow === 0 && selectedCol > 0) selectedCol--;
            else if (selectedRow === 1 && selectedCol > 0) selectedCol--;
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
            if (file) startRename(file);
          }
          break;

        case 'Enter':
          e.preventDefault();
          if (isSearchFocused) {
            isSearchFocused = false;
            searchInput.blur();
            const list = getDisplayFiles();
            if (list.length > 0) {
              selectedRow = 0;
              const file = list[selectedCol] || list[0];
              if (file.deleted) restoreFile(file);
              else if (isScriptFile(file.name)) runScript(file);
            }
          } else if (selectedRow === 0) {
            const file = getDisplayFiles()[selectedCol];
            if (file) {
              if (file.deleted) restoreFile(file);
              else if (isScriptFile(file.name)) runScript(file);
            }
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
            if (file && !file.deleted) deleteFileToTrash(file);
          }
          break;
      }
    };
