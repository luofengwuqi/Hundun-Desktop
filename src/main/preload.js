const { ipcRenderer } = require('electron')

// 注意: 本窗口 contextIsolation: false, 不能使用 contextBridge ——
// contextBridge.exposeInMainWorld 在该模式下会抛
// "contextBridge API can only be used when contextIsolation is enabled",
// 导致整个 preload 加载失败 (window.electronAPI 一直是 undefined,
// play-sound 监听、插件扫描等全部失效)。
// 与 plugin-preload.js 保持一致, 直接挂载到 window 上。

// ========== 应用设置快照 (决策66) ==========
// 一次 sendSync 拿整份 user-data/settings.json, 之后 get() 全走内存。
// 注: 主进程 handler 在 index.js 顶层注册, 早于任何窗口创建, 不会拿不到。
let settingsSnapshot = {}
try {
  const initial = ipcRenderer.sendSync('settings:get-sync')
  if (initial && typeof initial === 'object') settingsSnapshot = initial
} catch (error) {
  console.warn('[Preload] 读取应用设置失败 (按空设置继续):', error.message)
}

const clonePlain = (value) => {
  try {
    return JSON.parse(JSON.stringify(value === undefined ? {} : value))
  } catch (_) {
    return {}
  }
}

/** 点路径读 ('sound.volume' / 'plugins.order') */
const readSettingsPath = (dotted) => {
  if (!dotted) return undefined
  let cur = settingsSnapshot
  for (const part of String(dotted).split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = cur[part]
  }
  return cur
}

/** 点路径写 (不可变, 返回新对象) */
const setSettingsPath = (obj, dotted, value) => {
  const parts = String(dotted || '').split('.')
  const root = clonePlain(obj && typeof obj === 'object' ? obj : {})
  let cur = root
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    if (!cur[key] || typeof cur[key] !== 'object' || Array.isArray(cur[key])) cur[key] = {}
    cur = cur[key]
  }
  cur[parts[parts.length - 1]] = value
  return root
}

window.electronAPI = {
  // ========== 窗口控制 ==========
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  windowPin: (pinned) => ipcRenderer.send('window-pin', pinned),
  windowResize: (width, height) => ipcRenderer.send('window-resize', { width, height }),
  
  // ========== 应用信息 ==========
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  getPlatform: () => process.platform,
  // 检查更新 (决策62): 主进程访问 GitHub Releases latest API, 渲染层拿结果弹窗
  checkForUpdate: () => ipcRenderer.invoke('update:check'),

  // ========== 应用设置 (决策66) ==========
  // 数据源: <userData>/settings.json (主进程原子写)
  //   get() 同步 —— preload 阶段用一次 sendSync 拿整份快照, 之后全在内存,
  //   这样主题/语言 store 在模块初始化时就能同步取值, 首帧不闪
  //   set() 异步 —— 主进程校验键白名单 + 原子写 + 广播 settings:changed 给所有窗口
  settings: {
    get: (dotted, fallback = null) => {
      const value = readSettingsPath(dotted)
      return value === undefined ? fallback : value
    },
    has: (dotted) => readSettingsPath(dotted) !== undefined,
    all: () => clonePlain(settingsSnapshot),
    set: (dotted, value) => {
      // 乐观更新本地快照: 同一窗口连续读立刻看到新值 (写失败由主进程日志提示)
      settingsSnapshot = setSettingsPath(settingsSnapshot, dotted, value)
      return ipcRenderer.invoke('settings:set', dotted, value)
    },
    setMany: (patch) => {
      for (const [dotted, value] of Object.entries(patch || {})) {
        settingsSnapshot = setSettingsPath(settingsSnapshot, dotted, value)
      }
      return ipcRenderer.invoke('settings:set-many', patch)
    },
    remove: (dotted) => ipcRenderer.invoke('settings:remove', dotted),
    filePath: () => ipcRenderer.invoke('settings:file-path'),
    // 其他窗口改了设置 → 刷新本地快照并回调 (本窗口自己写入也会收到)
    onChanged: (callback) => {
      const handler = (event, snapshot) => {
        settingsSnapshot = snapshot && typeof snapshot === 'object' ? snapshot : {}
        callback(settingsSnapshot)
      }
      ipcRenderer.on('settings:changed', handler)
      return () => ipcRenderer.removeListener('settings:changed', handler)
    }
  },
  
  // ========== 插件系统 API ==========
  
  // 插件生命周期
  loadPlugin: (pluginId) => ipcRenderer.invoke('plugin-manager:load', pluginId),
  startPlugin: (pluginId, options) => ipcRenderer.invoke('plugin-manager:start', pluginId, options),
  stopPlugin: (pluginId) => ipcRenderer.invoke('plugin-manager:stop', pluginId),
  suspendPlugin: (pluginId) => ipcRenderer.invoke('plugin-manager:suspend', pluginId),
  resumePlugin: (pluginId) => ipcRenderer.invoke('plugin-manager:resume', pluginId),
  unloadPlugin: (pluginId) => ipcRenderer.invoke('plugin-manager:unload', pluginId),
  
  // 插件查询
  scanPlugins: () => ipcRenderer.invoke('plugin-manager:scan'),
  scanAllPlugins: () => ipcRenderer.invoke('plugin-manager:scanAll'),
  getInstalledPlugins: () => ipcRenderer.invoke('plugin-manager:getInstalled'),
  isPluginRunning: (pluginId) => ipcRenderer.invoke('plugin-manager:isRunning', pluginId),
  getRunningPlugins: () => ipcRenderer.invoke('plugin-manager:getRunning'),
  getActivePlugin: () => ipcRenderer.invoke('plugin-manager:getActive'),
  // 相对本窗口会话"在别处运行"的插件 (镜像徽章/冲突拦截, 决策45)
  getForeignPlugins: () => ipcRenderer.invoke('plugin-manager:getForeign'),
  // 全局运行中 (存在插件窗口) 的插件 — 设置页实时状态 (决策46)
  getOccupiedPlugins: () => ipcRenderer.invoke('plugin-manager:getOccupied'),
  // 排序/移除/恢复/安装等配置变更 (其他窗口发起时收到, 决策46)
  onPluginsConfigChanged: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('plugins:config-changed', handler)
    return () => ipcRenderer.removeListener('plugins:config-changed', handler)
  },
  // 本窗口配置已变更 → 主进程广播给其他母窗口 (决策46)
  notifyPluginsChanged: () => ipcRenderer.invoke('plugins:notify-changed'),

  // ========== 镜像模式 (决策45) ==========
  // 打开镜像窗口; 已存在则聚焦 → { success, status: 'created'|'exists' }
  mirrorOpen: () => ipcRenderer.invoke('mirror:open'),
  getMirrorState: () => ipcRenderer.invoke('mirror:state'),
  onMirrorStateChanged: (callback) => {
    const handler = (event, state) => callback(state)
    ipcRenderer.on('mirror:state-changed', handler)
    return () => ipcRenderer.removeListener('mirror:state-changed', handler)
  },
  // 本窗口角色变更 (镜像 B 在 A 关闭后升格为主窗口 → 恢复完整权限)
  onWindowRoleChanged: (callback) => {
    const handler = (event, role) => callback(role)
    ipcRenderer.on('window-role-changed', handler)
    return () => ipcRenderer.removeListener('window-role-changed', handler)
  },
  // "在别处运行的插件"列表变化推送
  onPluginStateChanged: (callback) => {
    const handler = (event, foreignIds) => callback(foreignIds)
    ipcRenderer.on('plugin-state-changed', handler)
    return () => ipcRenderer.removeListener('plugin-state-changed', handler)
  },
  
  // 插件启动（带过渡动画）
  launchPlugin: (pluginId, options) => ipcRenderer.invoke('plugin-manager:launch', pluginId, options),
  returnToParent: () => ipcRenderer.invoke('plugin-manager:returnToParent'),
  
  // 本地插件安装 (.zip)
  pickPluginZip: () => ipcRenderer.invoke('plugin-install:pick'),
  installPluginFromZip: (zipPath) => ipcRenderer.invoke('plugin-install:install', zipPath),
  
  // 打开外部链接 (系统默认浏览器)
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  
  // 主题系统
  requestTheme: () => ipcRenderer.send('theme:get-request'),
  onThemeResponse: (callback) => {
    const handler = (event, theme) => callback(theme)
    ipcRenderer.on('theme:get-response', handler)
    return () => ipcRenderer.removeListener('theme:get-response', handler)
  },
  onThemeChanged: (callback) => {
    const handler = (event, theme) => callback(theme)
    ipcRenderer.on('theme-changed', handler)
    return () => ipcRenderer.removeListener('theme-changed', handler)
  },
  
  // 插件数据存储
  getPluginData: (pluginId, key, defaultValue) => ipcRenderer.invoke('plugin:getData', pluginId, key, defaultValue),
  setPluginData: (pluginId, key, value) => ipcRenderer.invoke('plugin:setData', pluginId, key, value),
  removePluginData: (pluginId, key) => ipcRenderer.invoke('plugin:removeData', pluginId, key),
  getAllPluginData: (pluginId) => ipcRenderer.invoke('plugin:getAllData', pluginId),
  
  // 插件通信
  sendToPlugin: (targetPluginId, message) => ipcRenderer.invoke('plugin:sendMessage', targetPluginId, message),
  broadcastToPlugins: (message) => ipcRenderer.invoke('plugin:broadcast', message),
  
  // 插件窗口控制
  closePlugin: (pluginId) => ipcRenderer.invoke('plugin:close', pluginId),
  minimizePlugin: (pluginId) => ipcRenderer.invoke('plugin:minimize', pluginId),
  maximizePlugin: (pluginId) => ipcRenderer.invoke('plugin:maximize', pluginId),
  
  // 插件权限
  checkPluginPermission: (pluginId, permission) => ipcRenderer.invoke('plugin:requestPermission', pluginId, permission),
  
  // ========== 事件监听 ==========
  
  // 插件生命周期事件
  onPluginLoaded: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('plugin-loaded', handler)
    return () => ipcRenderer.removeListener('plugin-loaded', handler)
  },
  
  onPluginStarted: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('plugin-started', handler)
    return () => ipcRenderer.removeListener('plugin-started', handler)
  },
  
  onPluginClosed: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('plugin-closed', handler)
    return () => ipcRenderer.removeListener('plugin-closed', handler)
  },
  
  onPluginUnloaded: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('plugin-unloaded', handler)
    return () => ipcRenderer.removeListener('plugin-unloaded', handler)
  },
  
  onPluginError: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('plugin-error', handler)
    return () => ipcRenderer.removeListener('plugin-error', handler)
  },
  
  // 插件消息事件
  onPluginMessage: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('plugin:message', handler)
    return () => ipcRenderer.removeListener('plugin:message', handler)
  },
  
  onPluginBroadcast: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('plugin:broadcast', handler)
    return () => ipcRenderer.removeListener('plugin:broadcast', handler)
  },
  
  // 移除所有监听器
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // 插件音效 (经主进程转发到本窗口) → 交给母程序 audio.js 播放
  // 注意: 播放/音量统一由 utils/audio.js 决定 (用户音量/静音设置),
  //       本 preload 不再自行创建 Audio (2026-10-03 移除重复播放器)
  onPlaySound: (callback) => {
    const handler = (event, soundName) => callback(soundName)
    ipcRenderer.on('play-sound', handler)
    return () => ipcRenderer.removeListener('play-sound', handler)
  },

  // 推送音效设置到主进程 (运行期镜像, 供插件窗口直放音效读取)
  syncSoundSettings: (settings) => ipcRenderer.send('sound:sync', settings)
}

// 暴露 Node.js 环境信息
// windowRole: 窗口角色 ('main' 完整权限 | 'mirror' 镜像受限), 由创建时
// additionalArguments --hundun-window=<label> 注入; 升格后经 window-role-changed 事件更新
const windowRoleArg = (process.argv || []).find(a => typeof a === 'string' && a.startsWith('--hundun-window='))
window.nodeInfo = {
  platform: process.platform,
  arch: process.arch,
  windowRole: windowRoleArg ? windowRoleArg.split('=')[1] : 'main',
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
    chrome: process.versions.chrome
  }
}
