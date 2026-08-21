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
ipcMain.on('window-resize', (event, { width, height }) => {
  if (mainWindow) {
    const targetW = width + 20
    const targetH = height + 20

    // 先解除尺寸限制
    mainWindow.setResizable(true)
    mainWindow.setMinimumSize(100, 100)
    mainWindow.setMaximumSize(9999, 9999)

    // 获取当前窗口大小
    const [currentW, currentH] = mainWindow.getSize()
    
    // 动画参数
    const steps = 20
    const stepDelay = 20 // 每步20ms，总共约400ms
    
    let step = 0
    const animate = () => {
      step++
      const progress = step / steps
      // 使用 easeInOut 缓动函数
      const eased = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2
      
      const newW = Math.round(currentW + (targetW - currentW) * eased)
      const newH = Math.round(currentH + (targetH - currentH) * eased)
      
      mainWindow.setSize(newW, newH)
      
      if (step < steps) {
        setTimeout(animate, stepDelay)
      } else {
        // 动画结束，居中并锁定尺寸
        mainWindow.center()
        mainWindow.setMinimumSize(targetW, targetH)
        mainWindow.setMaximumSize(targetW, targetH)
      }
    }
    
    animate()
  }
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

  // 插件查询
  ipcMain.handle('plugin-manager:scan', async () => {
    try {
      const plugins = await pluginManager.scanPlugins()
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
