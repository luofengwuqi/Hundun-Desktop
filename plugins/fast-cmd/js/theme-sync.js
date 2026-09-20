    // ========== Theme ==========
    let isDarkMode = true;

    const applyTheme = (isDark) => {
      isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'dark';
      document.body.classList.toggle('light-mode', !isDarkMode);
      updateThemeToggle();
    };

    const toggleTheme = () => {
      isDarkMode = !isDarkMode;
      document.body.classList.toggle('light-mode', !isDarkMode);
      localStorage.setItem('fastcmd-theme', isDarkMode ? 'dark' : 'light');
      updateThemeToggle();
    };

    const updateThemeToggle = () => {
      const themeToggle = document.getElementById('themeToggle');
      if (themeToggle) themeToggle.classList.toggle('active', !isDarkMode);
    };

    const loadTheme = () => {
      const savedTheme = localStorage.getItem('fastcmd-theme');
      if (savedTheme) applyTheme(savedTheme === 'dark');
    };

    // ========== Sync Save ==========
    window.addEventListener('beforeunload', () => {
      // FastCmd 无编辑器，无需同步保存
    });
