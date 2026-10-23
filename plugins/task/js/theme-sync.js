    // ========== Theme (决策55: 子程序只继承官方基底 dark/light, 其余主题插件自管) ==========
    let isDarkMode = true;

    const applyTheme = (themeValue) => {
      // 兼容: boolean(旧) | 'dark'/'light'(母程序官方基底)
      const name = themeValue === 'light' || themeValue === false ? 'light' : 'dark';
      isDarkMode = (name === 'dark');
      document.body.classList.toggle('light-mode', !isDarkMode);
      updateThemeToggle();
    };

    const toggleTheme = () => {
      // 本地拨动开关: 在暗/亮基底间切换 (子程序主题独立于母程序, 决策55)
      applyTheme(!isDarkMode);
      localStorage.setItem('task-theme', isDarkMode ? 'dark' : 'light');
    };

    const updateThemeToggle = () => {
      if (themeToggle) themeToggle.classList.toggle('active', !isDarkMode);
    };

    const loadTheme = () => {
      const savedTheme = localStorage.getItem('task-theme');
      if (savedTheme) applyTheme(savedTheme); // 'dark'/'light' 都是合法主题名
    };
