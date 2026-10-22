const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { PluginManager } = require('./plugin-manager')
const { MirrorManager } = require('./mirror-manager')
const { pickZipFile, installFromZip, uninstallPlugin } = require('./plugin-installer')
const { registerSoundSettingsIPC } = require('./sound-settings')

// ========== 应用数据目录 (决策47: 安装位置自适应) ==========
// 开发态/便携模式: exe (或项目根) 旁 user-data (原行为不变);
// 回退模式 (AppImage / Program Files / /opt 等不可写安装位置): Electron 默认 userData
//   (Linux ~/.config/<name>, Windows %APPDATA%\<name>)
const { resolveUserDataDir, isPackagedPortableMode } = require('./paths')
const userDataDir = resolveUserDataDir()

// 覆盖 Electron 的默认 userData 路径
app.setPath('userData', userDataDir)

const gpuCacheDir = path.join(userDataDir, 'gpu-cache')
if (!fs.existsSync(gpuCacheDir)) {
  try {
    fs.mkdirSync(gpuCacheDir, { recursive: true })
  } catch (error) {
    console.warn('[Main] Failed to create gpu-cache dir:', error.message)
  }
}
app.commandLine.appendSwitch('disk-cache-dir', gpuCacheDir)
app.commandLine.appendSwitch('gpu-cache-dir', gpuCacheDir)

if (app.isPackaged && !isPackagedPortableMode()) {
  console.log(`[Main] Non-portable install detected, userData fallback to: ${userDataDir}`)
}

// Windows 圆角窗口
if (process.platform === 'win32') {
  // transparent: true + CSS border-radius 实现圆角窗口
}

// 单实例锁
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // 再次启动应用时的聚焦策略 (会话内互斥, 决策45):
    //   优先主会话: 有可见子程序窗口 → 聚焦子程序 (绝不能把隐藏的母程序带出来)
    //   否则 → 恢复并聚焦主会话母窗口 (兼作"子程序已关闭但母程序仍隐藏"的兜底恢复)
    if (pluginManager) {
      const session = pluginManager.primarySession ||
        (pluginManager.sessions.size ? [...pluginManager.sessions.values()][0] : null)
      if (session) {
        const visible = pluginManager.getVisiblePluginWindows(session)
        if (visible.length) {
          visible[visible.length - 1].focus()
          return
        }
        const main = session.main
        if (main && !main.isDestroyed()) {
          if (main.isMinimized()) main.restore()
          if (!main.isVisible()) main.show()
          main.focus()
        }
        return
      }
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
    }
  })
}

let mainWindow      // 主窗口 (原进程 A; A 关闭后镜像 B 升格接管)
let mirrorManager = null // 镜像窗口管理器 (whenReady 中创建)

// preload 脚本路径:
//   electron-vite 统一输出到 out/preload/preload.js (开发与打包一致);
//   旧布局 out/main/preload.js 作为回退候选 (存在才用)。
//   历史 Bug: 开发分支曾硬编码 out/main/preload.js —— 该文件不存在,
//   preload 静默加载失败, window.electronAPI 长期不可用。
function resolvePreloadPath () {
  const candidates = [
    path.join(__dirname, '../preload/preload.js'),
    path.join(__dirname, 'preload.js')
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return candidates[0]
}

function createWindow (label = 'main') {
  // 创建浏览器窗口（比 console 大一圈，透明背景露出桌面）
  // label 传给渲染进程 (preload 解析 --hundun-window → window.nodeInfo.windowRole):
  //   'main' = 主窗口(完整权限) | 'mirror' = 镜像窗口(仅允许运行子程序)
  const win = new BrowserWindow({
    width: 820,
    height: 580,
    minWidth: 820,
    minHeight: 580,
    maxWidth: 820,
    maxHeight: 580,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000', // 显式全透明背景: 避免部分平台 (Windows) 透明窗口残留灰底 (决策51)
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: resolvePreloadPath(),
      autoplayPolicy: 'no-user-gesture-required',
      additionalArguments: [`--hundun-window=${label}`]
    },
    icon: path.join(__dirname, '../renderer/icon.png'), // 决策47: vite publicDir 拷贝自 src/renderer/public/icon.png
    show: false // 先隐藏，等加载完成后再显示
  })

  // 开发模式加载 Vite 开发服务器，生产模式加载打包文件
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    win.loadURL('http://localhost:5173')
    // 注意：透明窗口下不要自动打开 DevTools，会导致透明失效
    // 需要调试时按 F12 或 Ctrl+Shift+I 手动打开
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // 注册会话 (幂等; 主窗口在 PluginManager 构造时也会注册)
  if (pluginManager) {
    pluginManager.addSession(win, label)
  }

  // 窗口关闭事件 → 会话注销 / 镜像升格 (镜像管理器统一处理)
  win.on('closed', () => {
    if (mirrorManager) {
      mirrorManager.handleWindowClosed(win)
    }
    if (win === mainWindow) mainWindow = null
  })

  // 窗口准备就绪后显示
  win.once('ready-to-show', () => {
    maybeShowMainWindow('ready-to-show', win)
  })

  // 页面加载完成后再显示（防止白屏闪烁）
  // 注意: 页面重载 (dev 下 Vite HMR 全量刷新、生产下任何 reload) 都会再次触发本事件,
  // 若此时本会话子程序窗口可见, 直接 show() 会造成"母程序和子程序同时运行"
  win.webContents.on('did-finish-load', () => {
    if (win && !win.isVisible()) {
      maybeShowMainWindow('did-finish-load', win)
    }
  })

  return win
}

// 显示母程序窗口的唯一入口: 本会话有可见子程序窗口时跳过显示 (会话内互斥不变式)
function maybeShowMainWindow (reason, win = mainWindow) {
  if (!win || win.isDestroyed()) return
  if (pluginManager) {
    const session = pluginManager.sessions.get(win)
    if (session && pluginManager.hasVisiblePluginWindow(session)) {
      console.log(`[Main] skip main window show (${reason}): session plugin window visible`)
      return
    }
  }
  win.show()
}

// ========== 插件管理器实例 ==========
let pluginManager = null

// 向所有母窗口广播镜像开合状态 (镜像按钮高亮等)
function broadcastMirrorState () {
  if (!mirrorManager) return
  const open = mirrorManager.hasMirror()
  const wins = [mirrorManager.getPrimary(), mirrorManager.getMirror()].filter(w => w && !w.isDestroyed())
  for (const w of wins) {
    w.webContents.send('mirror:state-changed', { open })
  }
}

// 向所有会话母窗口广播任意 channel (插件生命周期 / 配置变更, 决策45/46)
function broadcastToSessionMains (channel, payload) {
  if (!pluginManager) return
  for (const session of pluginManager.sessions.values()) {
    if (session.main && !session.main.isDestroyed()) {
      session.main.webContents.send(channel, payload)
    }
  }
}

// 应用准备就绪
app.whenReady().then(() => {
  mainWindow = createWindow('main')
  
  // 初始化插件管理器（使用主窗口引用；构造时注册主会话）
  pluginManager = new PluginManager(mainWindow)

  // 镜像窗口管理器 (创建/单例/升格/会话注销)
  mirrorManager = new MirrorManager({
    pluginManager,
    createWindow: (label) => createWindow(label),
    onPromoted: (win) => {
      // 留下的镜像窗口变成主窗口: 更新指针 + 会话角色 + 通知渲染进程恢复完整权限
      mainWindow = win
      const session = pluginManager.sessions.get(win)
      if (session) pluginManager.setPrimarySession(session)
      if (!win.isDestroyed()) {
        win.webContents.send('window-role-changed', 'main')
      }
      console.log('[Main] mirror promoted, primary window updated')
    },
    onStateChanged: () => broadcastMirrorState()
  })
  mirrorManager.setPrimary(mainWindow)
  
  // 注册插件管理器 IPC 处理器
  registerPluginManagerIPC()

  // 插件生命周期事件 → 转发给所有母窗口 (设置页实时状态, 决策46; 复活 preload 的 onPluginStarted/onPluginClosed)
  pluginManager.on('plugin-started', (data) => broadcastToSessionMains('plugin-started', data && data.pluginId))
  pluginManager.on('plugin-closed', (data) => broadcastToSessionMains('plugin-closed', data && data.pluginId))
  
  // 注册 FastTXT 文件系统 IPC 处理器
  registerFastTXTIPC(pluginManager)

  // 注册音效设置 IPC (主进程镜像 + 跨窗口广播, 供插件直放音效读取)
  registerSoundSettingsIPC()
  
  console.log('[Main] Plugin manager initialized')

  // macOS 点击 dock 图标时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const win = createWindow('main')
      mainWindow = win
      const session = pluginManager.addSession(win, 'main')
      if (!pluginManager.primarySession) pluginManager.setPrimarySession(session)
      if (mirrorManager) mirrorManager.setPrimary(win)
    }
  })
})

// 所有窗口关闭时退出应用 (Windows/Linux)
app.on('window-all-closed', async () => {
  // 清理插件管理器
  if (pluginManager) {
    await pluginManager.cleanup()
  }
  
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ========== IPC 通信处理 ==========

// 由 IPC 发送方反查母窗口 (镜像模式: 窗口控制必须作用于发起窗口, 而非固定 mainWindow)
function mainWinOfSender (sender) {
  try {
    const w = BrowserWindow.fromWebContents(sender)
    return w && !w.isDestroyed() ? w : null
  } catch (_) {
    return null
  }
}

// 窗口控制
ipcMain.on('window-minimize', (event) => {
  const w = mainWinOfSender(event.sender)
  if (w) w.minimize()
})

ipcMain.on('window-maximize', (event) => {
  const w = mainWinOfSender(event.sender)
  if (w) {
    if (w.isMaximized()) {
      w.unmaximize()
    } else {
      w.maximize()
    }
  }
})

ipcMain.on('window-close', (event) => {
  const w = mainWinOfSender(event.sender)
  if (w) w.close()
})

ipcMain.on('window-pin', (event, pinned) => {
  const w = mainWinOfSender(event.sender)
  if (w) {
    w.setAlwaysOnTop(pinned, 'screen-saver')
    const session = pluginManager ? pluginManager.sessions.get(w) : null
    if (session) session.pinnedMain = pinned
    event.sender.send('window-pin-response', pinned)
  }
})

ipcMain.handle('plugin:setAlwaysOnTop', async (event, pluginId, flag) => {
  return pluginManager.setAlwaysOnTop(pluginId, flag)
})

// 自定义协议注册 (用于加载本地资源) 已移除 (V9):
// 旧 local-file 协议为废弃 API 且全工程无使用，纯死代码

// 窗口尺寸调整（子程序切换用）- 带过渡动画
// 防重入 token 按窗口隔离 (V7): 旧实现是全局单 token，
// A 窗口动画进行中 B 窗口 resize 会静默取消 A 的动画且尺寸锁不再落地 (窗口停在中间态)
const resizeAnimTokens = new Map() // BrowserWindow -> 最新 token
ipcMain.on('window-resize', (event, { width, height }) => {
  const w = mainWinOfSender(event.sender)
  if (!w) return
  const session = pluginManager ? pluginManager.sessions.get(w) : null
  const token = (resizeAnimTokens.get(w) || 0) + 1
  resizeAnimTokens.set(w, token) // 旧动画的 token 不再匹配，会被取消

  const targetW = width + 20
  const targetH = height + 20

  // 先解除尺寸限制
  w.setResizable(true)
  w.setMinimumSize(100, 100)
  w.setMaximumSize(9999, 9999)

  // 获取当前窗口大小和位置
  const [currentW, currentH] = w.getSize()
  const [currentX, currentY] = w.getPosition()
  // 计算窗口中心点（缩放过程中保持不变）
  const centerX = currentX + currentW / 2
  const centerY = currentY + currentH / 2

  // 动画参数：时间戳驱动，总时长恒定、节奏均匀
  const duration = 400 // 总时长约 400ms
  const frameInterval = 16 // 60fps
  const startTime = Date.now()

  // easeInOut 缓动函数
  const easeInOut = (t) => t < 0.5
    ? 2 * t * t
    : 1 - Math.pow(-2 * t + 2, 2) / 2

  const animate = () => {
    // 本窗口新动画已启动，或窗口已销毁 → 取消本次动画
    if (w.isDestroyed()) {
      resizeAnimTokens.delete(w)
      return
    }
    if (resizeAnimTokens.get(w) !== token) return

    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = easeInOut(progress)

    const newW = Math.round(currentW + (targetW - currentW) * eased)
    const newH = Math.round(currentH + (targetH - currentH) * eased)
    // 以窗口中心为基准计算新位置，使中心点保持不变
    const newX = Math.round(centerX - newW / 2)
    const newY = Math.round(centerY - newH / 2)

    w.setBounds({ x: newX, y: newY, width: newW, height: newH })

    if (progress < 1) {
      setTimeout(animate, frameInterval)
    } else {
      // 动画结束，锁定尺寸（中心点已保持不变，无需再居中）
      resizeAnimTokens.delete(w)
      w.setMinimumSize(targetW, targetH)
      w.setMaximumSize(targetW, targetH)
      // 重新应用置顶状态（setBounds 会重置 always-on-top）
      if (session && session.pinnedMain) {
        w.setAlwaysOnTop(true, 'screen-saver')
      }
    }
  }

  animate()
})

// ========== 插件管理器 IPC 处理器 ==========
function registerPluginManagerIPC() {
  // 插件生命周期
  ipcMain.handle('plugin-manager:load', async (event, pluginId) => {
    try {
      const plugin = await pluginManager.loadPlugin(pluginId)
      return { success: true, plugin: { id: plugin.id, manifest: plugin.manifest } }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('plugin-manager:start', async (event, pluginId, options) => {
    try {
      const session = pluginManager.sessionForSender(event.sender)
      await pluginManager.startPlugin(pluginId, options, session)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('plugin-manager:launch', async (event, pluginId, options) => {
    try {
      // 会话归属: 发起 launch 的母窗口属于哪个会话, 插件就归属哪个会话 (镜像互斥, 决策45)
      const session = pluginManager.sessionForSender(event.sender)
      const result = await pluginManager.launchPluginWithTransition(pluginId, options, session)
      return result || { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('plugin-manager:stop', async (event, pluginId) => {
    try {
      await pluginManager.closePlugin(pluginId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('plugin-manager:suspend', async (event, pluginId) => {
    try {
      pluginManager.suspendPlugin(pluginId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('plugin-manager:resume', async (event, pluginId) => {
    try {
      pluginManager.resumePlugin(pluginId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('plugin-manager:unload', async (event, pluginId) => {
    try {
      await pluginManager.unloadPlugin(pluginId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('plugin-manager:scan', async () => {
    try {
      const plugins = await pluginManager.scanPlugins()
      return { success: true, plugins }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('plugin-manager:scanAll', async () => {
    try {
      const plugins = await pluginManager.getAllScannedPlugins()
      return { success: true, plugins }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('plugin-manager:getInstalled', async () => {
    try {
      const plugins = pluginManager.getInstalledPlugins()
      return { success: true, plugins }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('plugin-manager:isRunning', async (event, pluginId) => {
    return pluginManager.isPluginRunning(pluginId)
  })

  ipcMain.handle('plugin-manager:getRunning', async () => {
    return pluginManager.getRunningPlugins()
  })

  // 相对发送方会话"在别处运行"的插件 (徽章 + 冲突拦截用, 决策45)
  ipcMain.handle('plugin-manager:getForeign', async (event) => {
    return pluginManager.getForeignPlugins(pluginManager.sessionForSender(event.sender))
  })

  // 全局被占用的插件 (存在插件窗口 = 运行中, 设置页状态用, 决策46)
  ipcMain.handle('plugin-manager:getOccupied', async () => {
    return pluginManager.getOccupiedPlugins()
  })

  ipcMain.handle('plugin-manager:getActive', async (event) => {
    return pluginManager.getActivePluginId(pluginManager.sessionForSender(event.sender))
  })

  ipcMain.handle('plugin-manager:returnToParent', async (event) => {
    const session = pluginManager.sessionForSender(event.sender)
    const pluginId = session ? session.activePluginId : null
    if (pluginId) {
      try {
        await pluginManager.returnToParent(pluginId)
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    }
    return { success: false, error: 'No active plugin' }
  })

  // 插件窗口控制 IPC (plugin:close / plugin:minimize / plugin:maximize) 由 PluginManager 注册

  // ========== 镜像模式 (决策45) ==========
  // 打开镜像窗口; 已存在则聚焦 (全局至多一个镜像)
  ipcMain.handle('mirror:open', async () => {
    try {
      return mirrorManager.open()
    } catch (error) {
      console.error('[Main] mirror:open failed:', error)
      return { success: false, error: error.message }
    }
  })

  // 查询镜像开合状态 (渲染进程挂载时初始化)
  ipcMain.handle('mirror:state', async () => {
    return { open: mirrorManager ? mirrorManager.hasMirror() : false }
  })
}

// ========== FastTXT 文件系统 IPC ==========
let fasttxtPluginManager = null

function registerFastTXTIPC(pm) {
  fasttxtPluginManager = pm

  // 安全 (V3): 插件身份一律由主进程从 event.sender 反查，绝不信任渲染进程传参
  // —— 否则任意插件窗口可传别的 pluginId 读写其他插件数据
  const senderPluginId = (event) => {
    try {
      return pm && pm._getWindowPluginId(event.sender)
    } catch (_) {
      return null
    }
  }

  // 安全 (V3): 相对路径解析后必须仍落在 base 内（防绝对路径 / `..` 穿越逃出插件数据目录）
  const safeJoin = (base, rel) => {
    const target = path.resolve(base, String(rel == null ? '' : rel))
    if (target !== base && !target.startsWith(base + path.sep)) {
      throw new Error('非法路径 (越界): ' + rel)
    }
    return target
  }

  // 获取插件数据目录
  ipcMain.handle('fasttxt:getBasePath', (event, pluginId) => {
    const pid = senderPluginId(event)
    if (!pid) return null
    return getFastTXTBasePath(pid)
  })

  // 列出目录
  ipcMain.handle('fasttxt:readDir', (event, pluginId, dirPath) => {
    const pid = senderPluginId(event)
    if (!pid) return []
    const target = safeJoin(getFastTXTBasePath(pid), dirPath || '')
    try {
      if (!fs.existsSync(target)) return []
      const entries = fs.readdirSync(target, { withFileTypes: true })
      return entries
        .filter(e => !e.name.startsWith('.'))
        .map(e => {
          const fullPath = path.join(target, e.name)
          let stat = null
          try { stat = fs.statSync(fullPath) } catch (_) {}
          return {
            name: e.name,
            isDirectory: e.isDirectory(),
            mtime: stat ? stat.mtime.getTime() : Date.now(),
            size: stat ? stat.size : 0
          }
        })
        .sort((a, b) => {
          // 目录优先，然后按名称
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
          return a.name.localeCompare(b.name)
        })
    } catch (err) {
      console.error('[FastTXT] readDir error:', err)
      return []
    }
  })

  // 读取文件
  ipcMain.handle('fasttxt:readFile', (event, pluginId, filePath) => {
    const pid = senderPluginId(event)
    if (!pid) return null
    const target = safeJoin(getFastTXTBasePath(pid), filePath)
    try {
      if (!fs.existsSync(target)) return null
      return fs.readFileSync(target, 'utf-8')
    } catch (err) {
      console.error('[FastTXT] readFile error:', err)
      return null
    }
  })

  // 写入文件
  ipcMain.handle('fasttxt:writeFile', (event, pluginId, filePath, content) => {
    const pid = senderPluginId(event)
    if (!pid) return false
    const target = safeJoin(getFastTXTBasePath(pid), filePath)
    try {
      const dir = path.dirname(target)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      // 原子写入
      const tmp = target + '.tmp'
      fs.writeFileSync(tmp, content, 'utf-8')
      fs.renameSync(tmp, target)
      return true
    } catch (err) {
      console.error('[FastTXT] writeFile error:', err)
      return false
    }
  })

  // 删除文件
  ipcMain.handle('fasttxt:deleteFile', (event, pluginId, filePath) => {
    const pid = senderPluginId(event)
    if (!pid) return false
    const target = safeJoin(getFastTXTBasePath(pid), filePath)
    try {
      if (!fs.existsSync(target)) return true
      const stat = fs.statSync(target)
      if (stat.isDirectory()) {
        fs.rmSync(target, { recursive: true, force: true })
      } else {
        fs.unlinkSync(target)
      }
      return true
    } catch (err) {
      console.error('[FastTXT] deleteFile error:', err)
      return false
    }
  })

  // 创建目录
  ipcMain.handle('fasttxt:mkdir', (event, pluginId, dirPath) => {
    const pid = senderPluginId(event)
    if (!pid) return false
    const target = safeJoin(getFastTXTBasePath(pid), dirPath)
    try {
      fs.mkdirSync(target, { recursive: true })
      return true
    } catch (err) {
      console.error('[FastTXT] mkdir error:', err)
      return false
    }
  })

  // 重命名
  ipcMain.handle('fasttxt:rename', (event, pluginId, oldPath, newPath) => {
    const pid = senderPluginId(event)
    if (!pid) return false
    const basePath = getFastTXTBasePath(pid)
    const oldTarget = safeJoin(basePath, oldPath)
    const newTarget = safeJoin(basePath, newPath)
    try {
      const dir = path.dirname(newTarget)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.renameSync(oldTarget, newTarget)
      return true
    } catch (err) {
      console.error('[FastTXT] rename error:', err)
      return false
    }
  })

  // 检查是否存在
  ipcMain.handle('fasttxt:exists', (event, pluginId, filePath) => {
    const pid = senderPluginId(event)
    if (!pid) return false
    try {
      return fs.existsSync(safeJoin(getFastTXTBasePath(pid), filePath))
    } catch (err) {
      return false
    }
  })

  // 获取文件信息
  ipcMain.handle('fasttxt:stat', (event, pluginId, filePath) => {
    const pid = senderPluginId(event)
    if (!pid) return null
    try {
      const target = safeJoin(getFastTXTBasePath(pid), filePath)
      if (!fs.existsSync(target)) return null
      const stat = fs.statSync(target)
      return {
        size: stat.size,
        mtime: stat.mtime.getTime(),
        isDirectory: stat.isDirectory()
      }
    } catch (err) {
      return null
    }
  })

  // 用系统文件管理器打开目录
  ipcMain.handle('fasttxt:openInExplorer', (event, pluginId) => {
    const pid = senderPluginId(event)
    if (!pid) return false
    shell.openPath(getFastTXTBasePath(pid))
    return true
  })

  // 同步写入文件（beforeunload 时使用，确保窗口关闭前数据落盘）
  ipcMain.on('fasttxt:writeFileSync', (event, pluginId, filePath, content) => {
    const pid = senderPluginId(event)
    if (!pid) return
    const target = safeJoin(getFastTXTBasePath(pid), filePath)
    try {
      const dir = path.dirname(target)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(target, content, 'utf-8')
    } catch (err) {
      console.error('[FastTXT] writeFileSync error:', err)
    }
  })
}

// 辅助：获取 FastTXT 数据目录（存储在 userData 下，不写 asar）
function getFastTXTBasePath(pluginId) {
  const dataPath = path.join(app.getPath('userData'), 'plugins', pluginId || 'fast-txt', 'file')
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true })
  }
  return dataPath
}

// ========== 插件本地安装 IPC ==========
// ADD 按钮 → 本地安装(.zip): 打开文件资源管理器选择插件包
ipcMain.handle('plugin-install:pick', async (event) => {
  try {
    const parent = mainWinOfSender(event.sender) || mainWindow
    return await pickZipFile(parent)
  } catch (error) {
    console.error('[PluginInstaller] pick failed:', error)
    return null
  }
})

// 校验并安装选中的插件包，成功后渲染进程重新扫描同步
ipcMain.handle('plugin-install:install', async (event, zipPath) => {
  try {
    return await installFromZip(zipPath)
  } catch (error) {
    console.error('[PluginInstaller] install failed:', error)
    return { success: false, error: error.message || String(error) }
  }
})

// 卸载插件 (设置页删除, 决策46): 安装的删目录+记录, 内置只隐藏; 可选删 userdata
ipcMain.handle('plugin-install:uninstall', async (event, pluginId, options) => {
  try {
    return uninstallPlugin(pluginId, options || {})
  } catch (error) {
    console.error('[PluginInstaller] uninstall failed:', error)
    return { success: false, error: error.message || String(error) }
  }
})

// 插件配置变更 (排序/移除/恢复/安装) → 广播给**其他**母窗口各自刷新
// (localStorage 同源共享, 但各窗口内存中的 store 需要 reload, 决策46)
ipcMain.handle('plugins:notify-changed', async (event) => {
  const senderWin = (() => {
    try { const w = BrowserWindow.fromWebContents(event.sender); return w && !w.isDestroyed() ? w : null } catch (_) { return null }
  })()
  if (!pluginManager) return { success: false }
  for (const session of pluginManager.sessions.values()) {
    const main = session.main
    if (!main || main.isDestroyed() || main === senderWin) continue
    main.webContents.send('plugins:config-changed')
  }
  return { success: true }
})

// 打开外部链接 (逛逛社区 → 系统默认浏览器)
ipcMain.handle('app:openExternal', async (event, url) => {
  try {
    const target = String(url || '')
    if (!/^https?:\/\//i.test(target)) return false
    await shell.openExternal(target)
    return true
  } catch (error) {
    console.error('[Main] openExternal failed:', error)
    return false
  }
})

// ========== 主题系统 IPC ==========
// 追踪主题请求来源
let themeRequestSender = null

// 子程序请求当前主题 → 转发给**归属会话**的母程序 (镜像模式: A/B 各自应答自己的插件)
ipcMain.on('theme:get-request', (event) => {
  // 记录是哪个窗口请求的
  themeRequestSender = event.sender
  if (!pluginManager) return
  const session = pluginManager.sessionForSender(event.sender)
  if (session && session.main && !session.main.isDestroyed()) {
    session.main.webContents.send('theme:get-request')
  }
})

// 母程序回复主题状态 → 任一母窗口的回复都受理, 转发给请求的子程序
ipcMain.on('theme:get-response', (event, theme) => {
  const fromMain = pluginManager
    ? [...pluginManager.sessions.keys()].some(win => !win.isDestroyed() && win.webContents === event.sender)
    : event.sender === mainWindow?.webContents
  if (fromMain && themeRequestSender) {
    themeRequestSender.send('theme:get-response', theme)
    themeRequestSender = null
  }
})

// 获取应用版本
ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})

// 获取应用信息
ipcMain.handle('get-app-info', () => {
  return {
    version: app.getVersion(),
    name: app.getName(),
    isPackaged: app.isPackaged,
    platform: process.platform,
    arch: process.arch
  }
})
