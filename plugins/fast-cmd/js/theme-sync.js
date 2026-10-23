    // ========== Theme (dark/light/neon/gameboy, 决策54) ==========
    let isDarkMode = true;

    const applyTheme = (themeValue) => {
      // 兼容: boolean(旧) | 'dark'|'light'|'neon'|'gameboy'(母程序主题名)
      const name = typeof themeValue === 'boolean'
        ? (themeValue ? 'dark' : 'light')
        : ['dark', 'light', 'neon', 'gameboy'].includes(themeValue) ? themeValue : 'dark';
      isDarkMode = (name === 'dark' || name === 'neon');
      document.body.classList.remove('light-mode', 'neon-mode', 'gameboy-mode');
      if (name === 'light') document.body.classList.add('light-mode');
      else if (name === 'neon') document.body.classList.add('neon-mode');
      else if (name === 'gameboy') document.body.classList.add('gameboy-mode');
      updateThemeToggle();
    };

    const toggleTheme = () => {
      // 本地拨动开关: 始终在暗/亮基底间切换 (neon/gameboy 等精确主题由母程序设置页驱动)
      applyTheme(!isDarkMode);
      localStorage.setItem('fastcmd-theme', isDarkMode ? 'dark' : 'light');
    };

    const updateThemeToggle = () => {
      const themeToggle = document.getElementById('themeToggle');
      if (themeToggle) themeToggle.classList.toggle('active', !isDarkMode);
    };

    const loadTheme = () => {
      const savedTheme = localStorage.getItem('fastcmd-theme');
      if (savedTheme) applyTheme(savedTheme); // 'dark'/'light' 都是合法主题名
    };

    // ========== Sync Save ==========
    window.addEventListener('beforeunload', () => {
      // FastCmd 无编辑器，无需同步保存
    });
