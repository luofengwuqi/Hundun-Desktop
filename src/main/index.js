const { app, BrowserWindow, ipcMain, protocol } = require('electron')
const path = require('path')
const { PluginManager } = require('./plugin-manager')

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
    // 当运行第二个实例时，将聚焦到主窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

let mainWindow

function createWindow () {
  // 创建浏览器窗口（比 console 大一圈，透明背景露出桌面）
  mainWindow = new BrowserWindow({
    width: 820,
    height: 580,
    minWidth: 820,
    minHeight: 580,
    maxWidth: 820,
    maxHeight: 580,
    frame: false,
    transparent: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js'),
      autoplayPolicy: 'no-user-gesture-required'
    },
    icon: path.join(__dirname, '../renderer/assets/icon.png'),
    show: false // 先隐藏，等加载完成后再显示
  })

  // 开发模式加载 Vite 开发服务器，生产模式加载打包文件
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
    // 注意：透明窗口下不要自动打开 DevTools，会导致透明失效
    // 需要调试时按 F12 或 Ctrl+Shift+I 手动打开
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // 窗口关闭事件
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 窗口准备就绪后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // 页面加载完成后再显示（防止白屏闪烁）
  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show()
    }
  })
}

// ========== 插件管理器实例 ==========
let pluginManager = null

// 应用准备就绪
app.whenReady().then(() => {
  createWindow()
  
  // 初始化插件管理器（使用主窗口引用）
  pluginManager = new PluginManager(mainWindow)
  
  // 注册插件管理器 IPC 处理器
  registerPluginManagerIPC()
  
  console.log('[Main] Plugin manager initialized')

  // macOS 点击 dock 图标时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
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

// 窗口控制
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize()
})

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close()
})

// 窗口拖动（自定义标题栏用）
ipcMain.on('window-start-drag', (event, mousePosition) => {
  if (mainWindow) {
    const winBounds = mainWindow.getBounds()
    const currentPos = mainWindow.getPosition()
    
    const moveWindow = (e) => {
      // 计算新位置
      const x = currentPos[0] + (e.screenX - mousePosition.x)
      const y = currentPos[1] + (e.screenY - mousePosition.y)
      mainWindow.setPosition(x, y)
    }
    
    const stopMove = () => {
      document.removeEventListener('mousemove', moveWindow)
      document.removeEventListener('mouseup', stopMove)
    }
    
    // 这里通过 webContents 发送事件
  }
})

// 自定义协议注册 (用于加载本地资源)
app.whenReady().then(() => {
  protocol.registerFileProtocol('local-file', (request, callback) => {
    const filePath = path.join(__dirname, '../renderer', request.url.replace('local-file://', ''))
    callback({ path: filePath })
  })
})

// 窗口尺寸调整（子程序切换用）- 带过渡动画
let resizeAnimToken = 0 // 防重入：新动画启动时使旧动画立即失效
ipcMain.on('window-resize', (event, { width, height }) => {
  if (!mainWindow) return
  const token = ++resizeAnimToken // 旧动画的 token 不再匹配，会被取消

  const targetW = width + 20
  const targetH = height + 20

  // 先解除尺寸限制
  mainWindow.setResizable(true)
  mainWindow.setMinimumSize(100, 100)
  mainWindow.setMaximumSize(9999, 9999)

  // 获取当前窗口大小和位置
  const [currentW, currentH] = mainWindow.getSize()
  const [currentX, currentY] = mainWindow.getPosition()
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
    // 新动画已启动，或窗口已销毁 → 取消本次动画
    if (token !== resizeAnimToken || !mainWindow) return

    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = easeInOut(progress)

    const newW = Math.round(currentW + (targetW - currentW) * eased)
    const newH = Math.round(currentH + (targetH - currentH) * eased)
    // 以窗口中心为基准计算新位置，使中心点保持不变
    const newX = Math.round(centerX - newW / 2)
    const newY = Math.round(centerY - newH / 2)

    mainWindow.setBounds({ x: newX, y: newY, width: newW, height: newH })

    if (progress < 1) {
      setTimeout(animate, frameInterval)
    } else {
      // 动画结束，锁定尺寸（中心点已保持不变，无需再居中）
      mainWindow.setMinimumSize(targetW, targetH)
      mainWindow.setMaximumSize(targetW, targetH)
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
      await pluginManager.startPlugin(pluginId, options)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('plugin-manager:launch', async (event, pluginId, options) => {
    try {
      const result = await pluginManager.launchPluginWithTransition(pluginId, options)
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

  ipcMain.handle('plugin-manager:getActive', async () => {
    return pluginManager.getActivePluginId()
  })

  ipcMain.handle('plugin-manager:returnToParent', async (event) => {
    const pluginId = pluginManager.getActivePluginId()
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

  // 插件窗口控制
  ipcMain.handle('plugin:close', async (event, pluginId) => {
    try {
      await pluginManager.closePlugin(pluginId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('plugin:minimize', async (event, pluginId) => {
    try {
      pluginManager.minimizePlugin(pluginId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('plugin:maximize', async (event, pluginId) => {
    try {
      pluginManager.maximizePlugin(pluginId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })
}

// ========== 主题系统 IPC ==========
// 追踪主题请求来源
let themeRequestSender = null

// 子程序请求当前主题
ipcMain.on('theme:get-request', (event) => {
  // 记录是哪个窗口请求的
  themeRequestSender = event.sender
  // 转发给母程序获取主题状态
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('theme:get-request')
  }
})

// 母程序回复主题状态
ipcMain.on('theme:get-response', (event, theme) => {
  // 如果是母程序回复的，转发给请求的子程序
  if (event.sender === mainWindow?.webContents && themeRequestSender) {
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

// 导出窗口引用供插件系统使用
module.exports = { mainWindow }
