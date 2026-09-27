export default {
  // 母程序
  app: {
    title: 'HUNDUN LITE',
    selectHint: '← → 选择卡带',
    exit: '退出',
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
    slot: '卡带插槽',
  },

  // 添加应用
  addApp: {
    title: '添加插件',
    msg: '选择右侧操作：<br>安装本地 .zip 插件包，或逛逛插件社区。',
    installZip: '本地安装 (.zip)',
    community: '逛逛社区',
    successTitle: '安装成功',
    successMsg: '<strong>{name}</strong> v{version} 已安装<br>已同步到卡带货架与插件列表。',
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
    light: '浅色',
    dark: '深色',
    version: '版本',
    engine: '引擎',
    platform: '平台',
    desc: '复古掌机风格桌面效率工具',
    inUse: '使用中',
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
