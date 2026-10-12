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
      e.dataTransfer.dropEffect = 'move';
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
