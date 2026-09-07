    // ========== Theme ==========
    const applyTheme = (isDark) => {
      document.body.classList.toggle('light-mode', !isDark);
    };

    // ========== Sync Save (beforeunload 用) ==========
    const saveFileSync = (filePath, content) => {
      try {
        const pluginId = window.__PLUGIN_ID__;
        if (pluginId && window.hundun && window.hundun.fs && window.hundun.fs.getBasePath) {
          // 通过主进程同步写入
          const { ipcRenderer } = require('electron');
          ipcRenderer.send('fasttxt:writeFileSync', pluginId, filePath, content);
        }
      } catch (e) {
        console.error('[FastTXT] saveFileSync error:', e);
      }
    };

    // 窗口关闭前同步保存当前编辑文件
    window.addEventListener('beforeunload', () => {
      if (editingFile && editorContent !== undefined) {
        const subPath = editingFile.parentPath
          ? `${editingFile.parentPath}/${editingFile.name}`
          : editingFile.name;
        saveFileSync(subPath, editorContent);
      }
    });
