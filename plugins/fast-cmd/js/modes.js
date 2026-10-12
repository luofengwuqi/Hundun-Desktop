    // ========== Trash Operations ==========
    const toggleTrashMode = async () => {
      if (!isTrashMode) { await loadFilesFromDisk(); }
      playSound('click');
      isTrashMode = !isTrashMode;
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
      if (file && !file.deleted && !file.isFolder) {
        await deleteFileToTrash(file);
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
          try { await api.deleteFile(`${TRASH_DIR}/${diskName}`); }
          catch (err) { console.warn('[FastCmd] shred single failed:', diskName, err); }
        }
        await finalizeFsChange('error');
      }
    };

    const showShredConfirm = () => {
      if (getDeletedFiles().length === 0) {
        showModal('📭', FastCmdI18n.t('modal.emptyTrash'), FastCmdI18n.t('modal.noFilesToShred'), [
          { text: FastCmdI18n.t('modal.ok'), class: 'primary', action: closeModal }
        ]);
        return;
      }
      showModal('⚙️', FastCmdI18n.t('modal.shredAll'), FastCmdI18n.t('modal.shredConfirm', { count: getDeletedFiles().length }), [
        { text: FastCmdI18n.t('modal.cancel'), class: 'secondary', action: closeModal },
        { text: FastCmdI18n.t('modal.shredBtn'), class: 'danger', action: shredAll }
      ]);
    };

    const shredAll = async () => {
      const api = fsAPI();
      const deleted = getDeletedFiles();
      if (api) {
        for (const file of deleted) {
          const diskName = file.diskName || file.name;
          try { await api.deleteFile(`${TRASH_DIR}/${diskName}`); }
          catch (err) { console.warn('[FastCmd] shred failed:', diskName, err); }
        }
      }
      await finalizeFsChange('error');
      closeModal();
    };

    const openFolder = async () => {
      playSound('click');
      try {
        if (window.hundun && window.hundun.fs && window.hundun.fs.openInExplorer) {
          await window.hundun.fs.openInExplorer();
          return;
        }
      } catch (e) { console.warn('[FastCmd] preload openInExplorer failed:', e); }
      try {
        const { shell } = require('electron');
        const filePath = decodeURIComponent(window.location.pathname);
        const dirPath = filePath.replace(/^\/?([A-Z]:)/, '$1').replace(/\/(index|main)\.html$/, '');
        shell.openPath(dirPath);
      } catch (e) { console.error('[FastCmd] openFolder fallback error:', e); }
    };
