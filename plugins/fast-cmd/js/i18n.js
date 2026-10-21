/**
 * FastCmd i18n - 轻量级多语言模块
 */
const FastCmdI18n = (() => {
  const zh = {
    theme: { dark: '深色', light: '浅色' },
    header: { back: '返回', minimize: '最小化' },
    search: { placeholder: '搜索脚本...' },
    empty: {
      trash: '回收站为空',
      root: '还没有脚本',
      hint: '拖拽 {exts} 文件到这里',
    },
    unsupported: {
      title: '当前系统不受支持',
      msg: 'FastCmd 仅支持 Windows 与 Linux (当前: {platform})',
    },
    file: {
      deleted: '已删除',
      rename: '重命名 (M)',
    },
    footer: {
      deleted: '{count} 个已删除',
      files: '{count} 个脚本',
    },
    modal: {
      ok: '确定',
      cancel: '取消',
      rename: '✎ 重命名',
      delete: '🗑 删除',
      renameFailed: '重命名失败',
      renameExists: '文件名 "{name}" 已存在',
      emptyTrash: '回收站为空',
      noFilesToShred: '没有文件可以粉碎',
      shredAll: '粉碎所有？',
      shredConfirm: '永久删除 {count} 个文件？',
      shredBtn: '⚙️ 粉碎全部',
      trashFailed: '移动到回收站失败',
      trashCannotMove: '无法将 "{name}" 移动到回收站',
      restoreFailed: '恢复失败',
      restoreCannot: '无法将 "{name}" 恢复到根目录',
    },
    create: {
      title: '新建',
      batFile: '.bat 文件',
      ps1File: '.ps1 文件',
      shFile: '.sh 文件',
      cancel: '取消',
    },
    buttons: {
      create: '新建',
      backToFiles: '返回脚本列表',
      showDeleted: '查看已删除',
      openInExplorer: '在文件管理器中打开',
      shredAll: '粉碎全部',
      refresh: '刷新',
    },
    shredder: { label: '碎纸机' },
    toast: {
      scriptRunning: '脚本已启动: {name}',
      scriptError: '启动失败: {name}',
      scriptExitCode: '脚本异常退出 (退出码 {code}): {name}',
      scriptSuccess: '✅ 运行成功: {name}',
    },
    defaults: {
      bat: '@echo off\nchcp 65001 >nul\necho Hello from FastCmd!\npause',
      ps1: '# Hello from FastCmd!\nWrite-Host "Hello from FastCmd!"',
      sh: '#!/bin/sh\necho "Hello from FastCmd!"\nprintf "Press Enter to continue..."\nread _r',
    },
  };

  const en = {
    theme: { dark: 'Dark', light: 'Light' },
    header: { back: 'Back', minimize: 'Minimize' },
    search: { placeholder: 'Search scripts...' },
    empty: {
      trash: 'Trash is empty',
      root: 'No scripts yet',
      hint: 'Drag {exts} files here',
    },
    unsupported: {
      title: 'Unsupported OS',
      msg: 'FastCmd supports Windows and Linux only (current: {platform})',
    },
    file: {
      deleted: 'DELETED',
      rename: 'Rename (M)',
    },
    footer: {
      deleted: '{count} deleted',
      files: '{count} scripts',
    },
    modal: {
      ok: 'OK',
      cancel: 'Cancel',
      rename: '✎ Rename',
      delete: '🗑 Delete',
      renameFailed: 'RENAME FAILED',
      renameExists: 'A file named "{name}" already exists',
      emptyTrash: 'EMPTY TRASH',
      noFilesToShred: 'No files to shred',
      shredAll: 'SHRED ALL?',
      shredConfirm: 'Permanently delete {count} file(s)?',
      shredBtn: '⚙️ Shred All',
      trashFailed: 'TRASH FAILED',
      trashCannotMove: 'Cannot move "{name}" to trash',
      restoreFailed: 'RESTORE FAILED',
      restoreCannot: 'Cannot restore "{name}" to the root folder',
    },
    create: {
      title: 'CREATE NEW',
      batFile: '.bat File',
      ps1File: '.ps1 File',
      shFile: '.sh File',
      cancel: 'Cancel',
    },
    buttons: {
      create: 'Create new',
      backToFiles: 'Back to scripts',
      showDeleted: 'Show deleted',
      openInExplorer: 'Open in Explorer',
      shredAll: 'Shred all',
      refresh: 'Refresh',
    },
    shredder: { label: 'SHREDDER' },
    toast: {
      scriptRunning: 'Script started: {name}',
      scriptError: 'Failed to start: {name}',
      scriptExitCode: 'Script exited abnormally (code {code}): {name}',
      scriptSuccess: '✅ Script succeeded: {name}',
    },
    defaults: {
      bat: '@echo off\nchcp 65001 >nul\necho Hello from FastCmd!\npause',
      ps1: '# Hello from FastCmd!\nWrite-Host "Hello from FastCmd!"',
      sh: '#!/bin/sh\necho "Hello from FastCmd!"\nprintf "Press Enter to continue..."\nread _r',
    },
  };

  const locales = { zh, en };
  let currentLocale = 'zh';

  function init() {
    const saved = localStorage.getItem('fastcmd-locale');
    if (saved && locales[saved]) { currentLocale = saved; return; }
    try {
      const parentLocale = localStorage.getItem('hundundesktop-locale');
      if (parentLocale && locales[parentLocale]) { currentLocale = parentLocale; return; }
    } catch (e) {}
    const lang = navigator.language || navigator.userLanguage || '';
    currentLocale = lang.startsWith('en') ? 'en' : 'zh';
  }

  function getLocale() { return currentLocale; }
  function setLocale(locale) {
    if (locales[locale]) { currentLocale = locale; localStorage.setItem('fastcmd-locale', locale); }
  }

  function t(key, params = {}) {
    const keys = key.split('.');
    let value = locales[currentLocale];
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) { value = value[k]; }
      else {
        value = locales['zh'];
        for (const fk of keys) {
          if (value && typeof value === 'object' && fk in value) { value = value[fk]; }
          else { return key; }
        }
        break;
      }
    }
    if (typeof value !== 'string') return key;
    return value.replace(/\{(\w+)\}/g, (match, name) => {
      return params[name] !== undefined ? params[name] : match;
    });
  }

  return { init, getLocale, setLocale, t, locales: Object.keys(locales) };
})();

FastCmdI18n.init();
