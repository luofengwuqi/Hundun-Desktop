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

      // 加载本地主题设置
      loadTheme();

      // 绑定主题切换拨动开关
      const themeToggle = document.getElementById('themeToggle');
      const themeToggleEditor = document.getElementById('themeToggleEditor');
      if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
      }
      if (themeToggleEditor) {
        themeToggleEditor.addEventListener('click', toggleTheme);
      }

      // 设置图钉按钮
      setupPinButton();

      updateUI();

      // 启动自动保存定时器 (每5秒)
      startAutoSaveTimer();

      // 添加 beforeunload 事件监听，窗口关闭前保存文档
      window.addEventListener('beforeunload', handleBeforeUnload);

      // 同步母程序主题（如果可用，且本地无设置则使用母程序主题）
      if (window.hundun && window.hundun.host) {
        const savedTheme = localStorage.getItem('fasttxt-theme');
        if (!savedTheme) {
          window.hundun.host.getTheme().then(applyTheme);
        }
        window.hundun.host.onThemeChange((theme) => {
          // 仅在本地无设置时同步母程序主题
          if (!localStorage.getItem('fasttxt-theme')) {
            applyTheme(theme);
          }
        });
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }