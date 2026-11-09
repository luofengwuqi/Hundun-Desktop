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
      minimize: '最小化',
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

    // Markdown 浏览/编辑模式
    mdMode: {
      browse: '浏览',
      edit: '编辑',
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
      refresh: '刷新',
      cloud: '云端文档库',
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

    // 云端文档库 (git)
    cloud: {
      title: 'Cloud Link',
      loading: '正在读取云端状态…',
      loadingSub: 'git 状态 · 本地仓库',
      kicker: 'CLOUD LINK',
      noApi: '当前宿主不支持云端文档库接口',
      noApiHint: '请更新母程序到包含决策56 的版本后重试。',
      noGit: '未检测到 git',
      noGitHint: '云端文档库依赖系统 git。安装 git 后点「重新检测」即可，其他功能不受影响。',
      retryDetect: '重新检测',
      legendNav: '选择',
      legendEnter: '确认',
      legendEsc: '返回',
      legendTab: '切换输入',
      intro: {
        eyebrow: 'FASTTXT · CLOUD LINK',
        title: '把文本放上云',
        desc: '以 git 为底座的文档库：文档仍旧是本地文件，只是多了一份版本历史与云端副本。默认关闭，只有你手动点同步才会联网。',
        chip1: '默认关闭',
        chip2: '手动同步',
        chip3: '本地优先',
        opt1Title: '我没有仓库，新建一个',
        opt1Desc: '先去 GitHub / Gitee 建一个空仓库（别勾初始化 README），再把地址填进来',
        opt2Title: '我已有云端仓库',
        opt2Desc: '填地址后会把云端与本地合并，两边的文件都不丢',
        opt3Title: '暂不启用云端仓库功能',
        opt3Desc: '直接返回主页面，不做任何改动',
        footnote: '回收站、排序与书签属于本地视图状态，不会同步到云端。'
      },
      form: {
        back: '← 返回',
        newKicker: 'LINK SETUP · NEW REPO',
        newTitle: '新建云端仓库',
        newHint: '先在 GitHub / Gitee 新建一个空仓库（不要勾选初始化 README / .gitignore），把仓库地址填到这里。确认后会把本地文档作为第一个提交推上去。',
        existingKicker: 'LINK SETUP · EXISTING REPO',
        existingTitle: '连接已有云端仓库',
        existingHint: '会先拉取云端内容再与本地合并。同一个文件两端都改过时，会让你选择处理方式（自动合并 / 云端为准 / 本地为准 / 都保留）。',
        remote: '远程仓库地址',
        remotePh: 'https://gitee.com/your-name/notes.git',
        branch: '分支',
        username: '用户名（可空）',
        usernamePh: 'x-access-token',
        usernamePhGithub: 'x-access-token',
        usernamePhGitee: '你的 Gitee 用户名',
        usernamePhOther: 'oauth2',
        token: '访问令牌（可空）',
        tokenPh: '私有仓库需要',
        authGithub: 'GitHub 已停用账号密码：令牌填 Personal Access Token（ghp_… 或 github_pat_…，勾 repo），用户名填 x-access-token（填 oauth2 会失败）。',
        authGitee: 'Gitee 用「设置 → 私人令牌」生成的令牌，勾 projects；用户名填你的 Gitee 用户名（不要填 oauth2）。',
        authOther: '用户名 + 访问令牌；GitLab 可用 oauth2 + Personal Access Token。',
        tokenHint: '令牌只存在本机 user-data，不写进仓库、不回传界面。公开仓库可留空。',
        submit: '关联并同步',
        submitting: '正在关联…',
        badUrl: '请填写以 https:// 或 ssh 开头的仓库地址'
      },
      dash: {
        linkOn: '已连接',
        linkOff: '未启用',
        branch: '分支 {branch}',
        lastSync: '上次同步 {time}',
        never: '从未同步',
        panelStatus: 'STATUS',
        panelActions: 'ACTIONS',
        rowRemote: '远程',
        rowBranch: '分支',
        rowAhead: '待推送',
        rowBehind: '待拉取',
        rowLocal: '本地改动',
        rowMerge: '合并状态',
        rowCommit: '最近提交',
        mergeClean: '干净',
        mergePending: '待处理冲突',
        sync: '立即同步',
        syncHint: 'commit → fetch → merge → push',
        resolve: '处理冲突',
        resolveHint: '{count} 个文件待决定',
        reconfigure: '更换仓库',
        reconfigureHint: '保留本地文档与历史',
        disable: '关闭云同步',
        disableHint: '文档与 .git 历史保留',
        back: '返回文件列表',
        backHint: 'Esc',
        log: 'SYNC LOG',
        noLog: '还没有同步记录。',
        disabledNote: '云同步已关闭，文档仍保存在本地。随时可以重新开启。',
        enable: '启用云同步'
      },
      conflict: {
        kicker: 'CONFLICT',
        title: '有 {count} 个文件两端都改过',
        desc: '本地与云端对同一文件做了不同修改。选一种处理方式，处理完会生成合并提交；点「同步」即可把结果推上云端。',
        local: '本地',
        cloud: '云端',
        emptySide: '(这一端已删除该文件)',
        apply: '按此方式处理',
        applying: '正在处理…',
        backDash: '← 返回状态',
        resolved: '已处理 {count} 个文件'
      },
      strategy: {
        autoTitle: '自动合并',
        autoDesc: '交给 git。文本里会留下 <<<<<<< 标记，需要你自己再编辑。',
        cloudTitle: '以云端为准',
        cloudDesc: '丢弃本地对冲突文件的修改，以云端版本覆盖。',
        localTitle: '以本地为准',
        localDesc: '冲突文件用本地版本，云端其它不冲突的改动仍会保留。',
        bothTitle: '两端都保留',
        bothDesc: '原文件留本地，云端版本另存为「文件 (云端).txt」。'
      },
      msg: {
        setupOk: '云端文档库已关联',
        setupConflict: '已关联，但有 {count} 个文件需要处理冲突',
        syncOk: '同步完成',
        upToDate: '已是最新',
        pushed: '已推送 {n} 个提交',
        pulled: '已合并云端 {n} 个提交',
        resolveOk: '冲突已处理',
        disableOk: '云同步已关闭'
      },
      err: {
        generic: '操作失败',
        forbidden: '当前窗口无权访问云端文档库',
        disabled: '云同步尚未开启',
        noMerge: '当前没有进行中的合并',
        detail: '详情'
      }
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
      minimize: 'Minimize',
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

    // Markdown browse/edit mode
    mdMode: {
      browse: 'Browse',
      edit: 'Edit',
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
      refresh: 'Refresh',
      cloud: 'Cloud library',
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

    // Cloud library (git)
    cloud: {
      title: 'Cloud Link',
      loading: 'Reading cloud state…',
      loadingSub: 'git status · local repo',
      kicker: 'CLOUD LINK',
      noApi: 'This host does not expose the cloud library API',
      noApiHint: 'Update the host app to a build that includes decision 56 and retry.',
      noGit: 'git not found',
      noGitHint: 'The cloud library needs system git. Install git, then hit "Detect again". Everything else keeps working.',
      retryDetect: 'Detect again',
      legendNav: 'select',
      legendEnter: 'confirm',
      legendEsc: 'back',
      legendTab: 'switch field',
      intro: {
        eyebrow: 'FASTTXT · CLOUD LINK',
        title: 'Put your text on the cloud',
        desc: 'A git-backed document library: files stay local, you just gain a version history and a cloud copy. Off by default — nothing touches the network until you press sync.',
        chip1: 'Off by default',
        chip2: 'Manual sync',
        chip3: 'Local first',
        opt1Title: 'I have no repo — create one',
        opt1Desc: 'Create an empty repo on GitHub / Gitee (skip README init), then paste its URL here',
        opt2Title: 'I already have a cloud repo',
        opt2Desc: 'Cloud and local are merged after linking — no file on either side is lost',
        opt3Title: 'Not now',
        opt3Desc: 'Go straight back to the file list, nothing changes',
        footnote: 'Trash, ordering and bookmarks are local view state and never sync.'
      },
      form: {
        back: '← Back',
        newKicker: 'LINK SETUP · NEW REPO',
        newTitle: 'Create a cloud repo',
        newHint: 'Create an empty repo on GitHub / Gitee first (no README / .gitignore init), then paste its URL. Local documents are pushed as the first commit.',
        existingKicker: 'LINK SETUP · EXISTING REPO',
        existingTitle: 'Connect an existing repo',
        existingHint: 'Cloud content is fetched and merged into local. If the same file changed on both sides you pick how to resolve it (auto merge / cloud wins / local wins / keep both).',
        remote: 'Remote URL',
        remotePh: 'https://gitee.com/your-name/notes.git',
        branch: 'Branch',
        username: 'Username (optional)',
        usernamePh: 'x-access-token',
        usernamePhGithub: 'x-access-token',
        usernamePhGitee: 'your Gitee username',
        usernamePhOther: 'oauth2',
        token: 'Access token (optional)',
        tokenPh: 'needed for private repos',
        authGithub: 'GitHub no longer accepts passwords: use a Personal Access Token (ghp_… / github_pat_…, repo scope) and username x-access-token (oauth2 fails).',
        authGitee: 'Gitee: create a private token (Settings → Private tokens, projects scope); the username is your Gitee username, not oauth2.',
        authOther: 'Username + access token; GitLab accepts oauth2 + a Personal Access Token.',
        tokenHint: 'The token stays in local user-data; it is never written into the repo nor sent back to the UI. Leave empty for public repos.',
        submit: 'Link & sync',
        submitting: 'Linking…',
        badUrl: 'Enter a URL starting with https:// or ssh'
      },
      dash: {
        linkOn: 'Linked',
        linkOff: 'Disabled',
        branch: 'branch {branch}',
        lastSync: 'last sync {time}',
        never: 'never synced',
        panelStatus: 'STATUS',
        panelActions: 'ACTIONS',
        rowRemote: 'REMOTE',
        rowBranch: 'BRANCH',
        rowAhead: 'AHEAD',
        rowBehind: 'BEHIND',
        rowLocal: 'LOCAL',
        rowMerge: 'MERGE',
        rowCommit: 'COMMIT',
        mergeClean: 'clean',
        mergePending: 'conflicts pending',
        sync: 'Sync now',
        syncHint: 'commit → fetch → merge → push',
        resolve: 'Resolve conflicts',
        resolveHint: '{count} file(s) to decide',
        reconfigure: 'Change repo',
        reconfigureHint: 'keeps local files & history',
        disable: 'Disable cloud sync',
        disableHint: 'keeps files and .git history',
        back: 'Back to files',
        backHint: 'Esc',
        log: 'SYNC LOG',
        noLog: 'No sync yet.',
        disabledNote: 'Cloud sync is off. Documents stay local. You can re-enable anytime.',
        enable: 'Enable cloud sync'
      },
      conflict: {
        kicker: 'CONFLICT',
        title: '{count} file(s) changed on both sides',
        desc: 'Local and cloud edited the same file. Pick a strategy; a merge commit is created and you can push it with "Sync now".',
        local: 'LOCAL',
        cloud: 'CLOUD',
        emptySide: '(deleted on this side)',
        apply: 'Apply strategy',
        applying: 'Resolving…',
        backDash: '← Back to status',
        resolved: 'Resolved {count} file(s)'
      },
      strategy: {
        autoTitle: 'Auto merge',
        autoDesc: 'Let git do it. Conflict markers <<<<<<< stay in the text for you to edit.',
        cloudTitle: 'Cloud wins',
        cloudDesc: 'Drop local edits to conflicting files; take the cloud version.',
        localTitle: 'Local wins',
        localDesc: 'Conflicting files keep local content; other cloud changes are still merged.',
        bothTitle: 'Keep both',
        bothDesc: 'Original keeps local, cloud copy saved as "file (cloud).txt".'
      },
      msg: {
        setupOk: 'Cloud library linked',
        setupConflict: 'Linked, but {count} file(s) need a conflict decision',
        syncOk: 'Sync complete',
        upToDate: 'Already up to date',
        pushed: 'Pushed {n} commit(s)',
        pulled: 'Merged {n} cloud commit(s)',
        resolveOk: 'Conflicts resolved',
        disableOk: 'Cloud sync disabled'
      },
      err: {
        generic: 'Operation failed',
        forbidden: 'This window may not access the cloud library',
        disabled: 'Cloud sync is not enabled',
        noMerge: 'No merge in progress',
        detail: 'detail'
      }
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
      const parentLocale = localStorage.getItem('hundundesktop-locale')
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
