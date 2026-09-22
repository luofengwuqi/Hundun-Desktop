    // ========== Auto-save ==========
    const saveEditorContent = async () => {
      if (!editingFile) return;
      const api = fsAPI();
      if (api) {
        const subPath = editingFile.parentPath ? `${editingFile.parentPath}/${editingFile.name}` : editingFile.name;
        await api.writeFile(subPath, editorContent);
      }
      editingFile.content = editorContent;
      await saveFiles();
    };

    const showAutoSaveIndicator = () => {
      autoSaveIndicator.style.display = '';
      // Reset animation
      autoSaveIndicator.style.animation = 'none';
      autoSaveIndicator.offsetHeight; // Trigger reflow
      autoSaveIndicator.style.animation = '';
      setTimeout(() => {
        autoSaveIndicator.style.display = 'none';
      }, 1500);
    };

    // ========== 定时自动保存 (每5秒) ==========
    let autoSaveInterval = null;

    const startAutoSaveTimer = () => {
      if (autoSaveInterval) return; // 避免重复启动
      autoSaveInterval = setInterval(async () => {
        if (editingFile && currentView === 'editor') {
          await saveEditorContent();
          showAutoSaveIndicator();
        }
      }, 5000); // 每5秒保存一次
    };

    const stopAutoSaveTimer = () => {
      if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
      }
    };

    // ========== beforeunload 事件处理 ==========
    const handleBeforeUnload = async () => {
      if (editingFile && currentView === 'editor') {
        await saveEditorContent();
      }
    };
