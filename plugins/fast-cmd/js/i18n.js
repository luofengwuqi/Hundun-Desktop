/**
 * FastCmd i18n - 轻量级多语言模块
 */
const FastCmdI18n = (() => {
  const zh = {
    theme: { dark: '深色', light: '浅色' },
    header: { back: '返回' },
    search: { placeholder: '搜索脚本...' },
    breadcrumb: { back: '← 返回' },
    empty: {
      trash: '回收站为空',
      folder: '文件夹 {folder} 中没有脚本',
      root: '还没有脚本',
      hint: '拖拽 .bat .ps1 .cmd 文件到这里',
    },
    file: {
      deleted: '已删除',
      rename: '重命名 (M)',
      run: '运行 (Enter)',
      edit: '编辑',
    },
    footer: {
      deleted: '{count} 个已删除',
      inFolder: '{count} 个脚本在 {folder}',
      files: '{count} 个脚本',
    },
    modal: {
      ok: '确定',
      cancel: '取消',
      run: '▶ 运行',
      edit: '✏ 编辑',
      rename: '✎ 重命名',
      delete: '🗑 删除',
      runConfirm: '确认运行此脚本？',
      editConfirm: '用系统编辑器打开？',
      renameFailed: '重命名失败',
      renameExists: '文件名 "{name}" 已存在',
      emptyTrash: '回收站为空',
      noFilesToShred: '没有文件可以粉碎',
      shredAll: '粉碎所有？',
      shredConfirm: '永久删除 {count} 个文件？',
      shredBtn: '⚙️ 粉碎全部',
      trashFailed: '移动到回收站失败',
      trashCannotMove: '无法将 "{name}" 移动到回收站',
      deleteFolder: '删除文件夹？',
      deleteFolderConfirm: '"{name}" 包含 {count} 个文件。将它们全部移入回收站并删除此文件夹？',
      deleteFolderBtn: '🗑️ 移入回收站',
      deleteFailed: '删除失败',
      deleteCannotFolder: '无法删除文件夹 "{name}"',
      deleteIncomplete: '删除未完成',
      deleteIncompleteMsg: '已移动 {moved}/{total} 个文件到回收站。',
      deleteIncompleteRemain: '剩余 {n} 个文件；文件夹保留。',
      restoreFailed: '恢复失败',
      restoreCannot: '无法将 "{name}" 恢复到根目录',
    },
    create: {
      title: '新建',
      batFile: '.bat 文件',
      ps1File: '.ps1 文件',
      folder: '文件夹',
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
      editorOpen: '已打开编辑器: {name}',
    },
    defaults: {
      bat: '@echo off\nchcp 65001 >nul\necho Hello from FastCmd!\npause',
      ps1: '# Hello from FastCmd!\nWrite-Host "Hello from FastCmd!"',
    },
  };

  const en = {
    theme: { dark: 'Dark', light: 'Light' },
    header: { back: 'Back' },
    search: { placeholder: 'Search scripts...' },
    breadcrumb: { back: '← Back' },
    empty: {
      trash: 'Trash is empty',
      folder: 'No scripts in {folder}',
      root: 'No scripts yet',
      hint: 'Drag .bat .ps1 .cmd files here',
    },
    file: {
      deleted: 'DELETED',
      rename: 'Rename (M)',
      run: 'Run (Enter)',
      edit: 'Edit',
    },
    footer: {
      deleted: '{count} deleted',
      inFolder: '{count} scripts in {folder}',
      files: '{count} scripts',
    },
    modal: {
      ok: 'OK',
      cancel: 'Cancel',
      run: '▶ Run',
      edit: '✏ Edit',
      rename: '✎ Rename',
      delete: '🗑 Delete',
      runConfirm: 'Run this script?',
      editConfirm: 'Open in system editor?',
      renameFailed: 'RENAME FAILED',
      renameExists: 'A file named "{name}" already exists',
      emptyTrash: 'EMPTY TRASH',
      noFilesToShred: 'No files to shred',
      shredAll: 'SHRED ALL?',
      shredConfirm: 'Permanently delete {count} file(s)?',
      shredBtn: '⚙️ Shred All',
      trashFailed: 'TRASH FAILED',
      trashCannotMove: 'Cannot move "{name}" to trash',
      deleteFolder: 'DELETE FOLDER?',
      deleteFolderConfirm: '"{name}" contains {count} file(s). Move them ALL to trash and delete this folder?',
      deleteFolderBtn: '🗑️ Move to Trash',
      deleteFailed: 'DELETE FAILED',
      deleteCannotFolder: 'Cannot delete folder "{name}"',
      deleteIncomplete: 'DELETE INCOMPLETE',
      deleteIncompleteMsg: 'Moved {moved}/{total} file(s) to trash.',
      deleteIncompleteRemain: '{n} file(s) left; folder kept.',
      restoreFailed: 'RESTORE FAILED',
      restoreCannot: 'Cannot restore "{name}" to the root folder',
    },
    create: {
      title: 'CREATE NEW',
      batFile: '.bat File',
      ps1File: '.ps1 File',
      folder: 'Folder',
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
      editorOpen: 'Editor opened: {name}',
    },
    defaults: {
      bat: '@echo off\nchcp 65001 >nul\necho Hello from FastCmd!\npause',
      ps1: '# Hello from FastCmd!\nWrite-Host "Hello from FastCmd!"',
    },
  };

  const locales = { zh, en };
  let currentLocale = 'zh';

  function init() {
    const saved = localStorage.getItem('fastcmd-locale');
    if (saved && locales[saved]) { currentLocale = saved; return; }
    try {
      const parentLocale = localStorage.getItem('huntun-lite-locale');
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
