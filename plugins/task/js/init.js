    // ========== Init ==========
    const init = async () => {
      // __PLUGIN_ID__ 注入竞态兜底: plugin-manager 在 did-finish-load 才注入,
      // 可能晚于 DOMContentLoaded; 从入口路径解析同值, 避免 storage 写到 null.json
      if (!window.__PLUGIN_ID__) {
        const m = (location.pathname || '').match(/\/plugins\/([^/\\]+)/);
        if (m) window.__PLUGIN_ID__ = m[1];
      }

      try {
        await TaskStore.load();
      } catch (e) {
        console.error('[Task] load failed:', e);
      }

      loadTheme();
      themeToggle.addEventListener('click', toggleTheme);
      setupPinButton();
      setHeaderTitle();
      updateUI();
      startReminderLoop();

      // 主题跟随母程序 (仅当插件内未手动切换过)
      if (window.hundun && window.hundun.host) {
        const savedTheme = localStorage.getItem('task-theme');
        if (!savedTheme) {
          window.hundun.host.getTheme().then(applyTheme).catch(() => {});
        }
        window.hundun.host.onThemeChange((theme) => {
          if (!localStorage.getItem('task-theme')) applyTheme(theme);
        });
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
