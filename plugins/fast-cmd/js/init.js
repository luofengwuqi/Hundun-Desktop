    // ========== Init ==========
    const init = async () => {
      // 窗口按钮先绑定 (不依赖后续异步初始化, 避免 fs 初始化失败时按钮失效)
      setupPinButton();
      setupMinButton();

      const api = fsAPI();
      if (api) {
        await api.mkdir(TRASH_DIR);
        await createDefaultFiles();
        await loadFilesFromDisk();
      } else {
        files = [];
      }

      loadTheme();

      const themeToggle = document.getElementById('themeToggle');
      if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

      updateUI();

      if (window.hundun && window.hundun.host) {
        const savedTheme = localStorage.getItem('fastcmd-theme');
        if (!savedTheme) {
          window.hundun.host.getTheme().then(applyTheme);
        }
        window.hundun.host.onThemeChange((theme) => {
          if (!localStorage.getItem('fastcmd-theme')) applyTheme(theme);
        });
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
