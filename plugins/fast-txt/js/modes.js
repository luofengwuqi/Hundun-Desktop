    // ========== Trash Operations ==========
    const toggleTrashMode = () => {
      playSound('click');
      isTrashMode = !isTrashMode;
      isFolderMode = false;
      currentFolderPath = '';
      selectedRow = 0;
      selectedCol = 0;
      isSearchFocused = false;
      searchQuery = '';
      searchInput.value = '';
      searchInput.blur();
      updateUI();
    };

    // ========== Folder Operations ==========
    const enterFolder = (folderFile) => {
      playSound('click');
      isFolderMode = true;
      isTrashMode = false;
      currentFolderPath = folderFile.name;
      selectedRow = 0;
      selectedCol = 0;
      isSearchFocused = false;
      searchQuery = '';
      searchInput.value = '';
      searchInput.blur();
      updateUI();
    };

    const enterFolderFromSelection = () => {
      const list = getDisplayFiles();
      const file = list[selectedCol];
      if (file && file.isFolder) {
        enterFolder(file);
      }
    };

    const exitFolderMode = () => {
      playSound('click');
      isFolderMode = false;
      currentFolderPath = '';
      selectedRow = 0;
      selectedCol = 0;
      isSearchFocused = false;
      searchQuery = '';
      searchInput.value = '';
      searchInput.blur();
      updateUI();
    };

    const handleTrashDrop = async (e) => {
      e.preventDefault();
      isTrashDragOver = false;
      trashZone.classList.remove('drag-over');
      const fileId = e.dataTransfer.getData('text/plain');
      if (!fileId) return;

      const file = files.find(f => f.id === fileId);
      if (file && !file.deleted) {
        const api = fsAPI();
        if (api) {
          // 确保 .trash 目录存在
          await api.mkdir(TRASH_DIR);
          // 移动文件到回收站
          const srcPath = file.parentPath ? `${file.parentPath}/${file.name}` : file.name;
          const trashPath = `${TRASH_DIR}/${file.name}`;
          await api.rename(srcPath, trashPath);
        }
        file.deleted = true;
        saveFiles();
        playSound('exit');
        updateUI();
      }
    };

    const handleShredderDrop = async (e) => {
      e.preventDefault();
      isShredderDragOver = false;
      shredderZone.classList.remove('drag-over');
      const fileId = e.dataTransfer.getData('text/plain');
      if (!fileId) return;

      const file = files.find(f => f.id === fileId);
      if (file && file.deleted) {
        const api = fsAPI();
        if (api) {
          // 从磁盘永久删除
          await api.deleteFile(`${TRASH_DIR}/${file.name}`);
        }
        const idx = files.findIndex(f => f.id === fileId);
        if (idx !== -1) {
          files.splice(idx, 1);
          saveFiles();
          playSound('error');
          updateUI();
        }
      }
    };

    // ========== Shredder Operation ==========
    const showShredConfirm = () => {
      if (getDeletedFiles().length === 0) {
        showModal('📭', 'EMPTY TRASH', 'No files to shred', [
          { text: 'OK', class: 'primary', action: closeModal }
        ]);
        return;
      }

      showModal('⚙️', 'SHRED ALL?', `Permanently delete ${getDeletedFiles().length} file(s)?`, [
        { text: 'Cancel', class: 'secondary', action: closeModal },
        { text: '⚙️ Shred All', class: 'danger', action: shredAll }
      ]);
    };

    const shredAll = async () => {
      const api = fsAPI();
      if (api) {
        // 从磁盘永久删除回收站中所有文件
        const deleted = getDeletedFiles();
        for (const file of deleted) {
          await api.deleteFile(`${TRASH_DIR}/${file.name}`);
        }
      }
      files = files.filter(f => !f.deleted);
      saveFiles();
      closeModal();
      playSound('error');
      updateUI();
    };

    const openFolder = async () => {
      playSound('click');
      try {
        // 优先用 preload 提供的 API（通过主进程 shell.openPath）
        if (window.hundun && window.hundun.fs && window.hundun.fs.openInExplorer) {
          await window.hundun.fs.openInExplorer();
          return;
        }
      } catch (e) {
        console.warn('[FastTXT] preload openInExplorer failed, trying fallback:', e);
      }
      // fallback: 直接用 Electron shell（需要 nodeIntegration: true）
      try {
        const { shell } = require('electron');
        const filePath = decodeURIComponent(window.location.pathname);
        const dirPath = filePath.replace(/^\/?([A-Z]:)/, '$1').replace(/\/index\.html$/, '');
        shell.openPath(dirPath);
      } catch (e) {
        console.error('[FastTXT] openFolder fallback error:', e);
      }
    };
