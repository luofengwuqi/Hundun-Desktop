    /**
     * FastCmd 平台感知模块 — 系统状态检查 (决策42)
     *
     * - 打开前主进程已按 manifest.platforms 拦截; 本模块负责插件内的二次平台感知:
     *   决定"支持哪些脚本后缀 / 新建菜单有哪些项 / 不支持系统时显示什么"
     * - 不支持的脚本文件一律不显示 (列表、拖拽导入、新建全部经此过滤)
     *   Windows = .bat .cmd .ps1; Linux = .sh; 其余系统 (如 macOS) = 不支持
     * - 测试可用环境变量 FASTCMD_PLATFORM 覆盖 (如在 Linux 上回归 Windows 链路)
     */
    const FastCmdPlatform = (() => {
      const OS_NAMES = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };

      // 各平台支持的脚本后缀
      const SUPPORTED_EXTENSIONS = {
        win32: ['.bat', '.cmd', '.ps1'],
        linux: ['.sh'],
      };

      // 可新建的脚本类型 (图标 / 后缀 / i18n 键)
      const CREATE_TYPES = {
        bat: { ext: '.bat', icon: '⚙️', labelKey: 'create.batFile', defaultsKey: 'defaults.bat' },
        ps1: { ext: '.ps1', icon: '🔧', labelKey: 'create.ps1File', defaultsKey: 'defaults.ps1' },
        sh: { ext: '.sh', icon: '🖥️', labelKey: 'create.shFile', defaultsKey: 'defaults.sh' },
      };
      const PLATFORM_CREATE_TYPES = { win32: ['bat', 'ps1'], linux: ['sh'] };

      const detectPlatform = () => {
        try {
          if (typeof process !== 'undefined' && process && process.env && process.env.FASTCMD_PLATFORM) {
            return process.env.FASTCMD_PLATFORM;
          }
          if (typeof process !== 'undefined' && process && process.platform) return process.platform;
        } catch (_) { /* 无 Node 环境 */ }
        return 'win32';
      };

      const platform = detectPlatform();
      const isSupported = Object.prototype.hasOwnProperty.call(SUPPORTED_EXTENSIONS, platform);
      const extensions = isSupported ? SUPPORTED_EXTENSIONS[platform].slice() : [];
      const createTypes = isSupported ? PLATFORM_CREATE_TYPES[platform].slice() : [];

      const extOf = (name) => {
        const s = String(name || '');
        const i = s.lastIndexOf('.');
        return i > 0 ? s.slice(i).toLowerCase() : '';
      };

      const isSupportedScript = (name) => extensions.includes(extOf(name));

      const iconFor = (name) => {
        const ext = extOf(name);
        if (ext === '.bat' || ext === '.cmd') return '⚙️';
        if (ext === '.ps1') return '🔧';
        if (ext === '.sh') return '🖥️';
        return '📄';
      };

      return {
        platform,
        isSupported,
        extensions,
        createTypes,
        CREATE_TYPES,
        extOf,
        isSupportedScript,
        iconFor,
        osName: OS_NAMES[platform] || platform,
      };
    })();
