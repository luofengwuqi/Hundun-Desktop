export default {
  // 母程序
  app: {
    title: 'HUNDUN DESKTOP',
    selectHint: '← → Select cartridge',
    exit: 'Exit',
  },

  // 卡带信息
  cartridge: {
    running: 'Running',
    idle: 'Idle',
    alreadyRunning: 'ALREADY RUNNING',
    alreadyRunningMsg: '<strong>{name}</strong> is already running!<br>Only one instance allowed.',
    switchTitle: 'SWITCH CARTRIDGE',
    switchMsg: 'Running: <strong>{current}</strong><br><br>Switch to: <strong>{target}</strong>',
    switchBtn: '🔌 Eject & Switch',
    busyOtherMsg: '<strong>{name}</strong> is running in another window.<br>A plugin can only be open in one window at a time.',
    slotEmpty: 'Drag a cartridge here or press Enter',
    slotRunning: '● RUNNING',
    continue: '✓ Continue',
    eject: '🔌 Eject',
    cancel: 'Cancel',
    ok: 'OK',
  },

  // 底部按钮
  bottom: {
    add: 'ADD',
    settings: 'SETTINGS',
    mirror: 'MIRROR',
    slot: 'SLOT',
  },

  // 镜像模式 (决策45)
  mirror: {
    title: 'MIRROR MODE',
    notice: 'This is a mirror window: settings cannot be changed',
  },

  // 添加应用
  addApp: {
    title: 'ADD PLUGIN',
    installZip: 'INSTALL (.ZIP)',
    community: 'COMMUNITY',
    successTitle: 'INSTALL SUCCESS',
    successMsg: '<strong>{name}</strong> v{version} installed<br>Synced to the shelf and plugin list.',
    failTitle: 'INSTALL FAILED',
    communityFailTitle: 'BROWSER NOT OPENED',
    communityFailMsg: 'Please visit manually: https://gitee.com/luofengwuqi',
    pickCancel: 'Selection cancelled',
    pickCancelMsg: 'No file selected, installation cancelled.',
  },

  // 设置页面
  settings: {
    title: 'SETTINGS',
    back: 'Back',
    sound: 'SOUND',
    theme: 'THEME',
    language: 'LANGUAGE',
    plugins: 'PLUGINS',
    about: 'ABOUT',
    soundEffects: 'Sound Effects',
    volume: 'Volume',
    testSound: 'TEST SOUND',
    light: 'LIGHT',
    dark: 'DARK',
    version: 'Version',
    engine: 'Engine',
    platform: 'Platform',
    desc: 'Retro pocket console style desktop efficiency tool',
    inUse: 'IN USE',
    // Plugin management (decision 46)
    removeTitle: 'REMOVE PLUGIN',
    removeMsg: 'Remove <strong>{name}</strong>?<br>Keep this plugin\'s data in user-data?',
    keepData: 'KEEP DATA',
    removeDataBtn: 'DELETE DATA',
    removeRunningMsg: '<strong>{name}</strong> is running (including another mirror window) and cannot be removed.',
    removeOkTitle: 'REMOVED',
    removeOkMsg: '<strong>{name}</strong> removed from the console<br>Data: {data}',
    dataKept: 'kept',
    dataDeleted: 'deleted',
    removeFailTitle: 'REMOVE FAILED',
    removedSection: 'REMOVED',
    restore: 'RESTORE',
    restoreFailTitle: 'RESTORE FAILED',
    restoreMissingMsg: 'Plugin files of <strong>{name}</strong> no longer exist. Please reinstall (.zip).',
  },

  // 插件状态
  plugin: {
    running: '● RUNNING',
    idle: '○ IDLE',
  },

  // 键盘提示
  keys: {
    escToExit: 'ESC to exit',
  },

  // 错误
  error: {
    launchFailed: 'LAUNCH FAILED',
    unknownError: 'Unknown error',
  },
}
