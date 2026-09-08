/**
 * FastTXT i18n - 轻量级多语言模块
 * 支持嵌套键、参数替换、自动语言检测
 */

const FastTXTI18n = (() => {
  // ========== 翻译文件 ==========
  const zh = {
    // 主题
    theme: {
      dark: '深色',
      light: '浅色',
    },

    // 头部
    header: {
      back: '返回',
      saveBack: '保存并返回',
    },

    // 搜索
    search: {
      placeholder: '搜索文件...',
    },

    // 面包屑
    breadcrumb: {
      back: '← 返回',
    },

    // 空状态
    empty: {
      trash: '回收站为空',
      folder: '文件夹 {folder} 中没有文件',
      root: '还没有文件',
      hint: '拖拽 .txt 或 .md 文件到这里',
    },

    // 文件卡片
    file: {
      deleted: '已删除',
      rename: '重命名 (M)',
    },

    // 页脚信息
    footer: {
      deleted: '{count} 个已删除',
      inFolder: '{count} 个文件在 {folder}',
      files: '{count} 个文件',
    },

    // 编辑器
    editor: {
      untitled: '未命名',
      placeholder: '开始输入...',
      find: '查找...',
      findPrev: '上一个 (Shift+Enter)',
      findNext: '下一个 (Enter)',
      findClose: '关闭 (Esc)',
      replace: '替换...',
      replaceOne: '替换一个',
      replaceAll: '全部替换',
    },

    // 状态栏
    status: {
      lines: '行数: {n}',
      chars: '字符: {n}',
      words: '字数: {n}',
      plainText: '纯文本',
      markdown: 'Markdown',
      saved: '✓ 已保存',
      shortcuts: 'Ctrl+S 保存 | Ctrl+F 查找 | Ctrl+H 替换',
    },

    // 创建菜单
    create: {
      title: '新建',
      txtFile: '.txt 文件',
      mdFile: '.md 文件',
      folder: '文件夹',
      cancel: '取消',
    },

    // 弹窗
    modal: {
      ok: '确定',
      cancel: '取消',
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

    // 页脚按钮
    buttons: {
      create: '新建',
      backToFiles: '返回文件列表',
      showDeleted: '查看已删除',
      openInExplorer: '在文件管理器中打开',
      shredAll: '粉碎全部',
    },

    // 碎纸机区域
    shredder: {
      label: '碎纸机',
    },

    // 默认文件内容
    defaults: {
      readme: '欢迎使用 FastTXT！\n\n一个复古风格的文本文件管理器。\n\n功能：\n- 拖拽导入\n- 文件编辑\n- 回收站与粉碎',
      notes: '# 笔记\n\n## 待办\n- [ ] 试试拖拽文件\n- [ ] 创建新文件\n- [ ] 测试碎纸机',
      draft: '这是一个草稿文件。\n\n你可以自由编辑这段文字。',
    },
  }

  const en = {
    // Theme
    theme: {
      dark: 'Dark',
      light: 'Light',
    },

    // Header
    header: {
      back: 'Back',
      saveBack: 'Save & Back',
    },

    // Search
    search: {
      placeholder: 'Search files...',
    },

    // Breadcrumb
    breadcrumb: {
      back: '← Back',
    },

    // Empty state
    empty: {
      trash: 'Trash is empty',
      folder: 'No files in {folder}',
      root: 'No files yet',
      hint: 'Drag .txt or .md files here',
    },

    // File card
    file: {
      deleted: 'DELETED',
      rename: 'Rename (M)',
    },

    // Footer info
    footer: {
      deleted: '{count} deleted',
      inFolder: '{count} files in {folder}',
      files: '{count} files',
    },

    // Editor
    editor: {
      untitled: 'Untitled',
      placeholder: 'Start typing...',
      find: 'Find...',
      findPrev: 'Previous (Shift+Enter)',
      findNext: 'Next (Enter)',
      findClose: 'Close (Esc)',
      replace: 'Replace...',
      replaceOne: 'Replace One',
      replaceAll: 'Replace All',
    },

    // Status bar
    status: {
      lines: 'Lines: {n}',
      chars: 'Chars: {n}',
      words: 'Words: {n}',
      plainText: 'Plain Text',
      markdown: 'Markdown',
      saved: '✓ Saved',
      shortcuts: 'Ctrl+S Save | Ctrl+F Find | Ctrl+H Replace',
    },

    // Create menu
    create: {
      title: 'CREATE NEW',
      txtFile: '.txt File',
      mdFile: '.md File',
      folder: 'Folder',
      cancel: 'Cancel',
    },

    // Modal
    modal: {
      ok: 'OK',
      cancel: 'Cancel',
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

    // Footer buttons
    buttons: {
      create: 'Create new',
      backToFiles: 'Back to files',
      showDeleted: 'Show deleted',
      openInExplorer: 'Open in Explorer',
      shredAll: 'Shred all',
    },

    // Shredder zone
    shredder: {
      label: 'SHREDDER',
    },

    // Default file content
    defaults: {
      readme: 'Welcome to FastTXT!\n\nA retro text file manager.\n\nFeatures:\n- Drag & drop import\n- File editing\n- Trash & shred',
      notes: '# Notes\n\n## TODO\n- [ ] Try dragging files\n- [ ] Create new files\n- [ ] Test the shredder',
      draft: 'This is a draft file.\n\nYou can edit this text freely.',
    },
  }

  // ========== 翻译数据 ==========
  const locales = { zh, en }

  // ========== 当前语言 ==========
  let currentLocale = 'zh'

  // ========== 初始化 ==========
  function init() {
    // 1. 优先从 localStorage 读取
    const saved = localStorage.getItem('fasttxt-locale')
    if (saved && locales[saved]) {
      currentLocale = saved
      return
    }

    // 2. 尝试从母程序同步
    try {
      const parentLocale = localStorage.getItem('huntun-lite-locale')
      if (parentLocale && locales[parentLocale]) {
        currentLocale = parentLocale
        return
      }
    } catch (e) {
      // ignore
    }

    // 3. 检测浏览器语言
    const lang = navigator.language || navigator.userLanguage || ''
    if (lang.startsWith('en')) {
      currentLocale = 'en'
    } else {
      currentLocale = 'zh'
    }
  }

  // ========== 获取当前语言 ==========
  function getLocale() {
    return currentLocale
  }

  // ========== 设置语言 ==========
  function setLocale(locale) {
    if (locales[locale]) {
      currentLocale = locale
      localStorage.setItem('fasttxt-locale', locale)
    }
  }

  // ========== 翻译函数 ==========
  // t('modal.ok') => locales[locale].modal.ok
  // t('empty.folder', { folder: 'MyFolder' }) => "文件夹 MyFolder 中没有文件"
  function t(key, params = {}) {
    const keys = key.split('.')
    let value = locales[currentLocale]

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        // 回退到默认语言 (zh)
        value = locales['zh']
        for (const fk of keys) {
          if (value && typeof value === 'object' && fk in value) {
            value = value[fk]
          } else {
            return key
          }
        }
        break
      }
    }

    if (typeof value !== 'string') {
      return key
    }

    // 参数替换: {paramName} -> params.paramName
    return value.replace(/\{(\w+)\}/g, (match, name) => {
      return params[name] !== undefined ? params[name] : match
    })
  }

  // ========== 暴露 API ==========
  return {
    init,
    getLocale,
    setLocale,
    t,
    locales: Object.keys(locales),
  }
})()

// 自动初始化
FastTXTI18n.init()
