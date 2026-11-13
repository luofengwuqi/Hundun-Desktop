    // ========== File Drag & Reorder ==========
    const handleFileDragStart = (e, file) => {
      if (isRenaming) {
        const renamingFile = files.find(f => f.id === renamingFileId);
        if (renamingFile) cancelRename(renamingFile);
      }
      dragFileId = file.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', file.id);
      updateUI();
    };

    const handleFileDragEnd = () => {
      dragFileId = null;
      updateUI();
    };

    const handleListDragOver = (e) => {
      e.preventDefault();
      // Linux/GTK 文件管理器拖入的 effectAllowed 只有 'copy'。若这里写死 'move',
      // Chromium 判定 dropEffect 与 effectAllowed 不兼容 → 直接取消放置, drop 事件
      // 根本不派发, 外部文件拖入表现为"完全无反应"(实测 Electron 28 + XWayland)。
      // Windows 拖入常为 'all'(含 move), 所以这个 Bug 只在 Linux 暴露。
      const ea = (e.dataTransfer && e.dataTransfer.effectAllowed) || 'all';
      const canMove = ea === 'all' || ea === 'uninitialized' || String(ea).includes('move');
      e.dataTransfer.dropEffect = canMove ? 'move' : 'copy';
    };

    const handleListDrop = (e) => {
      e.preventDefault();
      const fileId = e.dataTransfer.getData('text/plain');
      if (!fileId) return;
      const file = files.find(f => f.id === fileId);
      if (!file) return;

      const cards = fileList.querySelectorAll('.fcmd-file-card');
      let newOrder = 0;
      for (let i = 0; i < cards.length; i++) {
        const rect = cards[i].getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY > midY) newOrder = i + 1;
      }

      const viewFiles = isTrashMode ? getDeletedFiles() : getActiveFiles();
      const active = viewFiles.filter(f => f.id !== fileId);
      active.splice(newOrder, 0, file);
      active.forEach((f, i) => f.order = i);
      saveFiles();
      playSound('click');
      fileList.innerHTML = '';
      updateUI();
    };
