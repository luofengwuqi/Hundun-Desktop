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
      localStorage.setItem('fasttxt-theme', isDarkMode ? 'dark' : 'light');
    };

    const updateThemeToggle = () => {
      const themeToggle = document.getElementById('themeToggle');
      const themeToggleEditor = document.getElementById('themeToggleEditor');
      if (themeToggle) {
        themeToggle.classList.toggle('active', !isDarkMode);
      }
      if (themeToggleEditor) {
        themeToggleEditor.classList.toggle('active', !isDarkMode);
      }
    };

    const loadTheme = () => {
      const savedTheme = localStorage.getItem('fasttxt-theme');
      if (savedTheme) {
        applyTheme(savedTheme); // 'dark'/'light' 都是合法主题名
      }
    };

    // ========== Sync Save (beforeunload 用) ==========
    const saveFileSync = (filePath, content) => {
      try {
        const pluginId = window.__PLUGIN_ID__;
        if (pluginId && window.hundun && window.hundun.fs && window.hundun.fs.getBasePath) {
          // 通过主进程同步写入
          const { ipcRenderer } = require('electron');
          ipcRenderer.send('fasttxt:writeFileSync', pluginId, filePath, content);
        }
      } catch (e) {
        console.error('[FastTXT] saveFileSync error:', e);
      }
    };

    // 窗口关闭前同步保存当前编辑文件
    window.addEventListener('beforeunload', () => {
      if (editingFile && editorContent !== undefined) {
        const subPath = editingFile.parentPath
          ? `${editingFile.parentPath}/${editingFile.name}`
          : editingFile.name;
        saveFileSync(subPath, editorContent);
      }
    });
