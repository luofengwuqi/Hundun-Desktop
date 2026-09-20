    // ========== Init ==========
    const init = async () => {
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

      setupPinButton();
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
