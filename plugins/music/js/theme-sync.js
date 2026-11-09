    // ========== Theme (决策55: 子程序只继承官方基底 dark/light) ==========
    let isDarkMode = true;

    const applyTheme = (themeValue) => {
      const name = themeValue === 'light' || themeValue === false ? 'light' : 'dark';
      isDarkMode = (name === 'dark');
      document.body.classList.toggle('light-mode', !isDarkMode);
      updateThemeToggle();
    };

    const toggleTheme = () => {
      applyTheme(!isDarkMode);
      localStorage.setItem('music-theme', isDarkMode ? 'dark' : 'light');
    };

    const updateThemeToggle = () => {
      const themeToggle = document.getElementById('themeToggle');
      if (themeToggle) themeToggle.classList.toggle('active', !isDarkMode);
    };

    const loadTheme = () => {
      const savedTheme = localStorage.getItem('music-theme');
      if (savedTheme) applyTheme(savedTheme);
    };
