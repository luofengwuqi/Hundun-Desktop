const { app, BrowserWindow, ipcMain, protocol } = require('electron')
const path = require('path')

// 禁用硬件加速以提高兼容性
// app.disableHardwareAcceleration()

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
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 800,
    minHeight: 600,
    maxWidth: 800,
    maxHeight: 600,
    frame: false, // 无边框窗口，自定义标题栏
    transparent: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../renderer/assets/icon.png'),
    backgroundColor: '#0a0a0a'
  })

  // 开发模式加载 Vite 开发服务器，生产模式加载打包文件
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // 窗口关闭事件
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 窗口准备就绪
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })
}

// 应用准备就绪
app.whenReady().then(() => {
  createWindow()

  // macOS 点击 dock 图标时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 所有窗口关闭时退出应用 (Windows/Linux)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC 通信处理
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

// 自定义协议注册 (用于加载本地资源)
app.whenReady().then(() => {
  protocol.registerFileProtocol('local-file', (request, callback) => {
    const filePath = path.join(__dirname, '../renderer', request.url.replace('local-file://', ''))
    callback({ path: filePath })
  })
})

// 导出窗口引用供插件系统使用
module.exports = { mainWindow }
