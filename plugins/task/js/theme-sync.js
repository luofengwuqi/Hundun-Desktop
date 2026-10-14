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
      localStorage.setItem('task-theme', isDarkMode ? 'dark' : 'light');
      updateThemeToggle();
    };

    const updateThemeToggle = () => {
      if (themeToggle) themeToggle.classList.toggle('active', !isDarkMode);
    };

    const loadTheme = () => {
      const savedTheme = localStorage.getItem('task-theme');
      if (savedTheme) applyTheme(savedTheme === 'dark');
    };
