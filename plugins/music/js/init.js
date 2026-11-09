    // ========== Init ==========
    const init = async () => {
      // 窗口按钮先绑定 (不依赖异步初始化, 保证存储失败时仍可退回母程序)
      setupPinButton();
      setupMinButton();
      setupCloseButton();

      applyI18nHtml();
      loadTheme();
      const themeToggle = document.getElementById('themeToggle');
      if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

      // 拖入导入 + 交互绑定
      setupDragImport();
      bindEvents();

      // 数据加载: 设置(播放模式) → 分组 → 磁盘扫描 (磁盘为曲目事实来源)
      await loadSettings();
      await loadGroups();
      await refreshLibrary(true);

      renderAll();
      updateSeekUi();

      // 母程序主题跟随 (用户未手动设定过时)
      if (window.hundun && window.hundun.host) {
        if (!localStorage.getItem('music-theme')) {
          window.hundun.host.getTheme().then(applyTheme).catch(() => {});
        }
        window.hundun.host.onThemeChange((theme) => {
          if (!localStorage.getItem('music-theme')) applyTheme(theme);
        });
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
