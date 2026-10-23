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
