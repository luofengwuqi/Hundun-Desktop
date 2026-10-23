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
    officialThemes: '官方样式',
    communityThemes: '非官方主题',
    officialBadge: '官方',
    restoreOfficial: '恢复官方样式',
    version: '版本',
    stack: '技术栈',
    system: '系统',
    checkUpdate: '检查更新',
    updateTitle: '开发中',
    updateMsg: '检查更新功能正在开发中，敬请期待～',
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
