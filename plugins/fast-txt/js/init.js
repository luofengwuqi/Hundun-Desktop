    // ========== Init ==========
    const init = async () => {
      const api = fsAPI();
      if (api) {
        // 确保回收站目录存在
        await api.mkdir(TRASH_DIR);
        // 创建默认文件（如果目录为空）
        await createDefaultFiles();
        // 从磁盘加载文件列表
        await loadFilesFromDisk();
      } else {
        // 无 fs API 时的 fallback（不应发生）
        files = [];
      }
      updateUI();

      if (window.hundun && window.hundun.host) {
        window.hundun.host.getTheme().then(applyTheme);
        window.hundun.host.onThemeChange(applyTheme);
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }