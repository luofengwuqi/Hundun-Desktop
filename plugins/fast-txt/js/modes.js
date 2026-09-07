    // ========== Trash Operations ==========
    const toggleTrashMode = async () => {
      // 进入垃圾桶前先从磁盘读取最新回收站内容, 避免外部修改后看不到
      if (!isTrashMode) {
        await loadFilesFromDisk();
      }
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
        // 统一删除入口 (文件/文件夹; 文件夹非空时会弹确认)
        if (file.isFolder) {
          await deleteFolderToTrash(file);
        } else {
          await deleteFileToTrash(file);
        }
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
          const diskName = file.diskName || file.name;
          try {
            // 从磁盘永久删除 (回收站为平铺文件/兼容的旧文件夹)
            await api.deleteFile(`${TRASH_DIR}/${diskName}`);
          } catch (err) {
            console.warn('[FastTXT] shred single failed:', diskName, err);
          }
        }
        await finalizeFsChange('error');
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
      const deleted = getDeletedFiles();
      if (api) {
        // 从磁盘永久删除回收站中所有条目
        for (const file of deleted) {
          const diskName = file.diskName || file.name;
          try {
            await api.deleteFile(`${TRASH_DIR}/${diskName}`);
          } catch (err) {
            console.warn('[FastTXT] shred failed:', diskName, err);
          }
        }
      }
      await finalizeFsChange('error');
      closeModal();
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
        const dirPath = filePath.replace(/^\/?([A-Z]:)/, '$1').replace(/\/(index|main)\.html$/, '');
        shell.openPath(dirPath);
      } catch (e) {
        console.error('[FastTXT] openFolder fallback error:', e);
      }
    };
