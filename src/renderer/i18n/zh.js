export default {
  // 母程序
  app: {
    title: 'HUNDUN DESKTOP',
    selectHint: '← → 选择卡带',
    exit: '退出',
    minimize: '最小化',
  },

  // 卡带信息
  cartridge: {
    running: '运行中',
    idle: '空闲',
    alreadyRunning: '已在运行',
    alreadyRunningMsg: '<strong>{name}</strong> 已在运行！<br>只允许一个实例。',
    switchTitle: '切换卡带',
    switchMsg: '当前运行: <strong>{current}</strong><br><br>切换到: <strong>{target}</strong>',
    switchBtn: '🔌 弹出并切换',
    busyOtherMsg: '<strong>{name}</strong> 正在另一个窗口中运行<br>同一子程序同一时间只能在一个窗口打开。',
    slotEmpty: '拖拽卡带到这里或按 Enter 插入',
    slotRunning: '● 运行中',
    continue: '✓ 继续',
    eject: '🔌 弹出',
    cancel: '取消',
    ok: '确定',
  },

  // 底部按钮
  bottom: {
    add: '添加应用',
    settings: '设置',
    mirror: '镜像模式',
    repo: '仓库',
    slot: '卡带插槽',
  },

  // 镜像模式 (决策45)
  mirror: {
    title: '镜像模式',
    notice: '当前程序为镜像程序 不能修改配置',
  },

  // 添加应用
  addApp: {
    title: '添加插件',
    installZip: '本地安装 (.zip)',
    community: '逛逛社区',
    successTitle: '安装成功',
    successMsg: '<strong>{name}</strong> v{version} 已安装<br>已同步到卡带货架与插件列表。<br><br>⚠️ 插件拥有本机完整权限，请仅安装信任来源的插件包。',
    failTitle: '安装失败',
    communityFailTitle: '无法打开浏览器',
    communityFailMsg: '请手动访问: https://gitee.com/luofengwuqi',
    pickCancel: '已取消选择',
    pickCancelMsg: '未选择任何文件，插件安装已取消。',
  },

  // 设置页面
  settings: {
    title: '设置',
    back: '返回',
    sound: '声音',
    theme: '主题',
    language: '语言',
    plugins: '插件',
    about: '关于',
    soundEffects: '音效',
    volume: '音量',
    testSound: '测试音效',
    light: '馄饨黄',
    dark: '馄饨黑',
    // 主题注册表 (决策55): 官方样式 + 非官方主题
    hunTunBlack: '馄饨黑',
    hunTunYellow: '馄饨黄',
    handheld: '掌机实装',
    contactSheet: '接触印样',
    officialThemes: '官方样式',
    communityThemes: '非官方主题',
    officialBadge: '官方',
    restoreOfficial: '恢复官方样式',
    version: '版本',
    stack: '技术栈',
    system: '系统',
    checkUpdate: '检查更新',
    updateCheckingTitle: '正在检查',
    updateCheckingMsg: '正在检查新版本，请稍候…',
    updateFoundTitle: '发现新版本',
    updateFoundMsg: '最新版本 <strong>v{version}</strong> 已发布，当前版本 v{current}。是否前往下载页？',
    updateGoDownload: '前往下载',
    updateLater: '以后再说',
    updateLatestTitle: '已是最新',
    updateLatestMsg: '当前版本 v{version} 已经是最新版本～',
    updateFailTitle: '检查失败',
    updateFailMsg: '检查更新失败，请检查网络连接后重试。<br><span style="opacity:.6">({reason})</span>',
    author: '关于作者',
    desc: '复古掌机风格桌面效率工具',
    inUse: '使用中',
    // 插件管理 (决策46)
    removeTitle: '删除插件',
    removeMsg: '确定移除 <strong>{name}</strong>？<br>是否保留该插件在 user-data 中的数据？',
    keepData: '保留数据',
    removeDataBtn: '删除数据',
    removeRunningMsg: '<strong>{name}</strong> 正在运行（含其他镜像窗口），无法移除。',
    removeOkTitle: '已移除',
    removeOkMsg: '<strong>{name}</strong> 已从母程序移除<br>数据处理: {data}',
    dataKept: '已保留',
    dataDeleted: '已删除',
    removeFailTitle: '移除失败',
    removedSection: '已移除',
    restore: '恢复',
    restoreFailTitle: '恢复失败',
    restoreMissingMsg: '<strong>{name}</strong> 的插件文件已不存在，请重新安装 (.zip)。',
  },

  // 插件状态
  plugin: {
    running: '● 运行中',
    idle: '○ 空闲',
  },


  // 用户数据仓库 (决策67)
  // 帮助页 (可复用): 通用按钮文案; 各教程正文在 src/renderer/help/topics.js
  help: {
    back: '返回',
    close: '关闭',
    notesTitle: '补充说明',
    esc: '按 ESC 返回',
    unknown: '没有这个帮助主题',
  },

  repo: {
    title: '仓库',
    subtitle: '把设置与选定子程序的数据存到 git 远端，换机器时拉下来即可继续',
    close: '关闭',
    gitMissing: '未检测到 git —— 请先安装 git 再使用仓库同步',
    gitReady: 'git {version}',
    notLinked: '尚未关联远程仓库',
    linkedTo: '已关联',
    lastSync: '上次同步',
    neverSynced: '从未同步',
    tokenSaved: '令牌已加密保存',
    tokenPlain: '令牌为明文保存（系统无可用密钥环）',
    noToken: '未保存令牌',
    // 未关联
    setupTitle: '第一次使用：选一种方式',
    autoTitle: '① 用 Gitee 令牌自动创建（推荐）',
    autoHint: '填一个 Gitee 私人令牌，应用会在你的账号下建一个私有仓库并接管关联。令牌只在需要时填一次。',
    autoName: '仓库名',
    autoCreate: '创建并关联',
    manualTitle: '② 我已有仓库',
    manualHint: '填 https 地址（空仓库，不要初始化 README），有私有库请一并填令牌。',
    remoteUrl: '仓库地址',
    username: '用户名（可留空）',
    token: '访问令牌（私有库必填）',
    link: '关联',
    // 已关联
    scopeTitle: '同步范围',
    scopeSettings: '应用设置（主题 / 语言 / 音效 / 插件顺序）',
    scopeInstalled: '已安装插件清单',
    scopePlugins: '子程序数据',
    scopeEmpty: '没有子程序声明可同步（manifest 里加 sync 字段后才会出现在这里）',
    scopeHint: '只有勾选的子程序才会进仓库；未勾选的文件不会上传。单个文件超过 50MB 会自动跳过。',
    syncNow: '立即同步',
    preview: '先看要传什么',
    syncing: '同步中…',
    previewing: '正在预检…',
    // 左栏四动作
    actPullTitle: '从云端拉取到本地',
    actPullDesc: '把云端的改动合到本地，不推送',
    actPushTitle: '从本地推送到云端',
    actPushDesc: '把本地改动推到云端，不拉取',
    actPullOverTitle: '从云端覆盖到本地',
    actPullOverDesc: '本地全部被云端替换。执行前自动打备份点',
    actPushOverTitle: '从本地覆盖到云端',
    actPushOverDesc: '云端历史被本地替换。执行前自动打备份点',
    confirmAgain: '再点一次确认',
    confirmHint: '这是破坏性操作：{what}',
    // 右栏
    tokenLabel: 'Gitee 访问令牌',
    tokenHelp: '怎么找到 Gitee 访问令牌？',
    tokenPh: 'private token（留空则清除）',
    tokenSave: '保存',
    tokenSavedOk: '令牌已保存',
    installedTitle: '已装的子程序',
    noPlugins: '没有找到子程序',
    notSyncable: '未声明同步',
    notLinkedHint: '还没关联仓库。填好下面任一种方式即可开始。',
    linkedOk: '已关联仓库',
    // 结果
    resultPulled: '已从云端拉取：{n} 个文件更新',
    resultPulledNothing: '云端没有新内容，本地已是最新',
    resultPushed: '已推送到云端：{n} 个文件',
    resultPushedNothing: '没有需要推送的改动',
    resultOverwriteLocal: '已用云端覆盖本地',
    resultOverwriteRemote: '已用本地覆盖云端',
    resultBackup: '备份点 {tag}（要回退：git reset --hard {tag}）',
    emptyRemote: '云端还没有内容，没有东西可拉取或覆盖',
    needPull: '云端有本地没有的提交。先「从云端拉取到本地」，或用「从本地覆盖到云端」',
    pendingCount: '{count} 个文件待提交',
    noPending: '没有待提交的改动',
    // 结果
    resultOk: '同步完成：{count} 个文件已上传',
    resultNothing: '已是最新，没有需要上传的改动',
    resultSkipped: '{count} 个文件超过 50MB，已跳过（本地文件保留）',
    resultUntracked: '{count} 个文件因取消勾选被移出仓库（本地文件保留）',
    resultPreview: '本次将上传 {count} 个文件',
    resultPreviewEmpty: '没有待上传的改动',
    // 冲突
    conflictTitle: '有冲突需要你决定',
    conflictHint: '云端和本地改了同一个文件。选一边保留，另一边会被覆盖（本地文件都还在，可用 git 历史找回）。',
    keepLocal: '保留我的',
    keepCloud: '采用云端',
    // 错误
    failed: '操作失败',
    done: '知道了',
    retry: '重试',
  },

  // 键盘提示
  keys: {
    escToExit: 'ESC 返回',
  },

  // 错误
  error: {
    launchFailed: '启动失败',
    unknownError: '未知错误',
  },
}
