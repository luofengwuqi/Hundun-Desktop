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
