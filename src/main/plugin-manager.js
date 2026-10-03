/**
 * Hundun Lite - 插件管理器 v2.0
 * 
 * 核心职责：
 * 1. 扫描和注册插件 (自动发现 plugins/ 目录)
 * 2. 管理插件生命周期（加载、启动、暂停、恢复、卸载）
 * 3. 创建和管理插件 BrowserWindow 沙箱
 * 4. 插件间通信路由
 * 5. 权限控制
 * 6. 过渡动画协调（跨窗口切换）
 */

const { BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { getDatabase } = require('./database')
const { resolvePluginsDirs } = require('./paths')
const PluginLoader = require(fs.existsSync(path.join(__dirname, 'plugin-loader.js'))
  ? './plugin-loader'
  : '../shared/plugin-loader')

// 插件状态枚举
const PluginState = {
  UNLOADED: 'unloaded',     // 未加载
  LOADED: 'loaded',         // 已加载（manifest 已解析）
  RUNNING: 'running',       // 运行中（BrowserWindow 已创建）
  SUSPENDED: 'suspended',   // 已暂停（窗口隐藏）
  ERROR: 'error'            // 错误状态
}

class PluginManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow // 主窗口引用
    this.plugins = new Map()     // pluginId -> PluginInstance
    this.windows = new Map()     // pluginId -> BrowserWindow
    this.database = getDatabase()
    // 扫描内置插件目录 + 用户安装插件目录（本地安装的 .zip 插件落盘于后者）
    this.pluginDirs = resolvePluginsDirs()
    this.loader = new PluginLoader(this.pluginDirs)
    
    // 事件监听器
    this.listeners = new Map()
    
    // 过渡动画窗口
    this.transitionWindow = null
    
    // 当前运行的插件ID
    this.activePluginId = null
    
    // 追踪每个插件窗口的置顶状态（show() 会重置 always-on-top，需要独立追踪）
    this.pluginPinStates = new Map() // pluginId -> boolean
    
    // 追踪主窗口的置顶状态（launchPluginWithTransition 隐藏主窗口前保存，returnToParent 恢复）
    this._mainWindowPinned = false

    // ========== 母程序/子程序可见性互斥 (2026-10-03) ==========
    // 任何路径把主窗口 show() 出来时, 只要有插件窗口可见, 立即重新隐藏 ——
    // 防止 did-finish-load / ready-to-show / 页面重载(HMR) / focus 等路径
    // 在子程序运行期间把母程序带出来 (母子同时运行)
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.on('show', () => {
        if (this.hasVisiblePluginWindow()) {
          console.log('[PluginManager] Main window show() blocked: plugin window visible, re-hiding')
          this.mainWindow.hide()
        }
      })
    }
    
    // 插件窗口默认配置
    this.defaultWindowConfig = {
      width: 400,
      height: 400,
      minWidth: 300,
      minHeight: 300,
      show: false, // 先隐藏，加载完成后显示
      frame: false, // 无边框
      transparent: false,
      resizable: true,
      webPreferences: {
        nodeIntegration: true, // 插件可以使用 Node.js
        contextIsolation: false,
        sandbox: false, // 不使用沙箱（需要 Node.js 能力）
        preload: path.join(__dirname, 'plugin-preload.js')
      }
    }
    
    // 注册 IPC 处理器
    this._registerIPC()
  }

  /**
   * 注册 IPC 处理器
   */
  _registerIPC() {
    // 插件 -> 主进程：获取插件数据
    ipcMain.handle('plugin:getData', (event, pluginId, key, defaultValue) => {
      return this.database.get(pluginId, key, defaultValue)
    })

    // 插件 -> 主进程：设置插件数据
    ipcMain.handle('plugin:setData', (event, pluginId, key, value) => {
      this.database.set(pluginId, key, value)
      return true
    })

    // 插件 -> 主进程：删除插件数据
    ipcMain.handle('plugin:removeData', (event, pluginId, key) => {
      this.database.remove(pluginId, key)
      return true
    })

    // 插件 -> 主进程：获取所有插件数据
    ipcMain.handle('plugin:getAllData', (event, pluginId) => {
      return this.database.getAll(pluginId)
    })

    // 插件 -> 主进程：发送消息到其他插件
    ipcMain.handle('plugin:sendMessage', (event, targetPluginId, message) => {
      return this.sendMessageToPlugin(targetPluginId, message)
    })

    // 插件 -> 主进程：广播消息给所有插件
    ipcMain.handle('plugin:broadcast', (event, message) => {
      return this.broadcastMessage(message)
    })

    // 插件 -> 主进程：获取插件信息
    ipcMain.handle('plugin:getInfo', (event, pluginId) => {
      const plugin = this.plugins.get(pluginId)
      if (!plugin) return null
      return {
        id: plugin.id,
        manifest: plugin.manifest,
        state: plugin.state
      }
    })

    // 插件 -> 主进程：获取所有已安装插件
    ipcMain.handle('plugin:getInstalled', (event) => {
      return this.getInstalledPlugins()
    })

    // 插件 -> 主进程：请求权限
    ipcMain.handle('plugin:requestPermission', (event, pluginId, permission) => {
      return this.checkPermission(pluginId, permission)
    })

    // 主程序 -> 插件：执行命令
    ipcMain.on('plugin:execute', (event, pluginId, command, ...args) => {
      this.executePluginCommand(pluginId, command, ...args)
    })

    // 插件 -> 主进程：返回母程序 (带过渡动画)
    ipcMain.handle('plugin:returnToParent', async (event) => {
      const pluginId = this._getWindowPluginId(event.sender)
      if (pluginId) {
        await this.returnToParent(pluginId)
        return true
      }
      return false
    })

    // 插件 -> 主进程：播放音效
    ipcMain.handle('plugin:playSound', (event, soundName) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('play-sound', soundName)
      }
    })

    // 插件 -> 主进程：获取当前主题
    ipcMain.handle('plugin:getTheme', (event) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        // 从母程序获取主题状态
        return new Promise((resolve) => {
          ipcMain.once('theme:get-response', (event, theme) => {
            resolve(theme)
          })
          this.mainWindow.webContents.send('theme:get-request')
        })
      }
      return 'dark'
    })
  }

  /**
   * 获取窗口对应的插件ID
   */
  _getWindowPluginId(webContents) {
    for (const [pluginId, win] of this.windows) {
      if (win.webContents === webContents) {
        return pluginId
      }
    }
    return null
  }

  /**
   * 扫描所有可用插件
   * @returns {Array} 插件列表
   */
  async scanPlugins() {
    return await this.loader.scanPlugins()
  }

  /**
   * 获取已安装插件列表（包含状态信息）
   * @returns {Array}
   */
  getInstalledPlugins() {
    const result = []
    for (const [pluginId, plugin] of this.plugins) {
      result.push({
        id: pluginId,
        manifest: plugin.manifest,
        state: plugin.state,
        path: plugin.path
      })
    }
    return result
  }

  /**
   * 获取所有已扫描的插件 (包括未加载的)
   * @returns {Array}
   */
  async getAllScannedPlugins() {
    const scanned = await this.loader.scanPlugins()
    return scanned.map(p => {
      const loaded = this.plugins.get(p.id)
      return {
        id: p.id,
        name: p.name,
        description: p.description || '',
        icon: p.icon || '📦',
        version: p.version || '1.0.0',
        author: p.author || 'Unknown',
        color: p.color || '#00ff88',
        windowSize: p.windowSize || { width: 400, height: 400 },
        entry: p.entry || 'index.html',
        path: p.path,
        state: loaded ? loaded.state : 'unloaded',
        loaded: !!loaded
      }
    })
  }

  /**
   * 加载插件（解析 manifest，但不启动窗口）
   * @param {string} pluginId - 插件ID
   * @returns {Object} 插件实例
   */
  async loadPlugin(pluginId) {
    // 检查是否已加载
    if (this.plugins.has(pluginId)) {
      const existing = this.plugins.get(pluginId)
      if (existing.state !== PluginState.ERROR) {
        return existing
      }
    }

    try {
      // 使用 PluginLoader 加载
      const pluginInstance = await this.loader.loadPlugin(pluginId)
      
      // 创建内部插件实例
      const plugin = {
        id: pluginId,
        manifest: pluginInstance.manifest,
        path: pluginInstance.path,
        module: pluginInstance.module,
        state: PluginState.LOADED,
        loadedAt: new Date().toISOString(),
        data: {} // 插件运行时数据
      }
      
      this.plugins.set(pluginId, plugin)
      
      // 触发事件
      this._emit('plugin-loaded', { pluginId, manifest: plugin.manifest })
      
      console.log(`[PluginManager] Plugin loaded: ${pluginId}`)
      return plugin
    } catch (error) {
      console.error(`[PluginManager] Failed to load plugin ${pluginId}:`, error)
      
      // 记录错误状态
      this.plugins.set(pluginId, {
        id: pluginId,
        manifest: null,
        path: null,
        module: null,
        state: PluginState.ERROR,
        error: error.message
      })
      
      throw error
    }
  }

  /**
   * 启动插件（创建 BrowserWindow）
   * @param {string} pluginId - 插件ID
   * @param {Object} options - 启动选项
   * @returns {BrowserWindow} 插件窗口
   */
  async startPlugin(pluginId, options = {}) {
    // 确保插件已加载
    let plugin = this.plugins.get(pluginId)
    if (!plugin || plugin.state === PluginState.UNLOADED) {
      plugin = await this.loadPlugin(pluginId)
    }
    
    // 如果已经在运行，返回现有窗口
    if (plugin.state === PluginState.RUNNING && this.windows.has(pluginId)) {
      const existingWindow = this.windows.get(pluginId)
      // 互斥: 先藏母程序, 再显示插件窗口 (避免瞬间双窗口同时可见)
      this._hideMainForPlugin()
      existingWindow.show()
      // 重新应用置顶状态（show() 会重置 always-on-top）
      if (this.pluginPinStates.get(pluginId)) {
        existingWindow.setAlwaysOnTop(true, 'screen-saver')
      }
      existingWindow.focus()
      return existingWindow
    }

    // 如果已暂停，恢复
    if (plugin.state === PluginState.SUSPENDED && this.windows.has(pluginId)) {
      this.resumePlugin(pluginId)
      return this.windows.get(pluginId)
    }

    try {
      // 获取插件窗口配置
      const windowConfig = {
        ...this.defaultWindowConfig,
        width: plugin.manifest.windowSize?.width || this.defaultWindowConfig.width,
        height: plugin.manifest.windowSize?.height || this.defaultWindowConfig.height
      }

      console.log(`[PluginManager] Creating window for ${pluginId}:`, {
        width: windowConfig.width,
        height: windowConfig.height,
        pluginPath: plugin.path,
        entry: plugin.manifest.entry
      })

      // 创建插件窗口
      const pluginWindow = new BrowserWindow(windowConfig)
      
      // 设置窗口标题
      pluginWindow.setTitle(plugin.manifest.name || pluginId)
      
      // 存储插件ID到窗口
      pluginWindow.pluginId = pluginId
      
      // 加载插件入口文件
      const entryFile = path.join(plugin.path, plugin.manifest.entry || 'index.html')
      
      console.log(`[PluginManager] Loading entry file: ${entryFile}, exists: ${fs.existsSync(entryFile)}`)
      
      if (fs.existsSync(entryFile)) {
        // 使用 file:// 协议加载本地文件
        pluginWindow.loadFile(entryFile)
      } else {
        // 如果入口文件不存在，加载错误页面
        console.error(`[PluginManager] Entry file not found: ${entryFile}`)
        pluginWindow.loadURL('data:text/html,<html><body style="background:#1a1b26;color:#c0caf5;font-family:monospace;padding:40px;"><h1>❌ 插件入口文件不存在</h1><p>路径: ' + entryFile + '</p></body></html>')
      }

      // 窗口加载完成后显示
      pluginWindow.once('ready-to-show', () => {
        console.log(`[PluginManager] Plugin window ready-to-show: ${pluginId}`)
        // 不立即显示，等过渡动画就绪
      })

      // 窗口关闭事件
      pluginWindow.on('closed', () => {
        this.windows.delete(pluginId)
        if (plugin) {
          plugin.state = PluginState.UNLOADED
        }
        if (this.activePluginId === pluginId) {
          this.activePluginId = null
        }
        this._emit('plugin-closed', { pluginId })
        console.log(`[PluginManager] Plugin window closed: ${pluginId}`)
        // 互斥的另一半: 插件窗口消失后恢复母程序 (否则整个应用无可见窗口)
        this._recoverMainWindowIfIdle()
      })

      // 窗口错误处理
      pluginWindow.webContents.on('crashed', (event, code) => {
        console.error(`[PluginManager] Plugin window crashed: ${pluginId}, code: ${code}`)
        plugin.state = PluginState.ERROR
        this._emit('plugin-error', { pluginId, error: `Window crashed with code ${code}` })
      })

      // 注入插件预加载脚本
      pluginWindow.webContents.on('did-finish-load', () => {
        console.log(`[PluginManager] Plugin page loaded: ${pluginId}`)
        // 注入插件 ID 到窗口
        pluginWindow.webContents.executeJavaScript(`
          window.__PLUGIN_ID__ = '${pluginId}';
          window.__PLUGIN_MANIFEST__ = ${JSON.stringify(plugin.manifest)};
          console.log('[Plugin] Injected plugin ID:', '${pluginId}');
        `)
      })

      // 存储窗口引用
      this.windows.set(pluginId, pluginWindow)
      
      // 更新插件状态
      plugin.state = PluginState.RUNNING
      plugin.startedAt = new Date().toISOString()
      this.activePluginId = pluginId
      
      // 触发事件
      this._emit('plugin-started', { pluginId, manifest: plugin.manifest })
      
      console.log(`[PluginManager] Plugin started: ${pluginId}`)
      return pluginWindow
    } catch (error) {
      console.error(`[PluginManager] Failed to start plugin ${pluginId}:`, error)
      plugin.state = PluginState.ERROR
      plugin.error = error.message
      this._emit('plugin-error', { pluginId, error: error.message })
      throw error
    }
  }

  /**
   * 启动插件并执行过渡动画
   * @param {string} pluginId - 插件ID
   * @param {Object} options - 启动选项
   */
  async launchPluginWithTransition(pluginId, options = {}) {
    console.log(`[PluginManager] launchPluginWithTransition called for: ${pluginId}`)
    
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      console.log(`[PluginManager] Plugin not loaded, loading: ${pluginId}`)
      try {
        await this.loadPlugin(pluginId)
      } catch (e) {
        console.error(`[PluginManager] Failed to load plugin ${pluginId}:`, e)
        // 提供更友好的错误信息
        const friendlyMsg = e.message.includes('not found')
          ? `插件 "${pluginId}" 不存在。请检查 plugins/${pluginId}/ 目录是否包含 manifest.json`
          : `加载插件 "${pluginId}" 失败: ${e.message}`
        return { success: false, error: friendlyMsg }
      }
    }
    
    const loadedPlugin = this.plugins.get(pluginId)
    const manifest = loadedPlugin?.manifest
    const childSize = manifest?.windowSize || { width: 400, height: 400 }
    
    // 启动插件窗口
    let pluginWindow
    try {
      pluginWindow = await this.startPlugin(pluginId, options)
    } catch (e) {
      console.error(`[PluginManager] Failed to start plugin ${pluginId}:`, e)
      return { success: false, error: e.message }
    }
    
    // 获取母程序位置，对齐插件窗口
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      const [mainX, mainY] = this.mainWindow.getPosition()
      const [mainW, mainH] = this.mainWindow.getSize()
      
      const pluginW = childSize.width + 20
      const pluginH = childSize.height + 20
      const pluginX = mainX + (mainW - pluginW) / 2
      const pluginY = mainY + (mainH - pluginH) / 2
      
      pluginWindow.setBounds({
        x: Math.round(pluginX),
        y: Math.round(pluginY),
        width: pluginW,
        height: pluginH
      })
    }
    
    // 互斥: 先隐藏其他可见插件 (同一时间只允许一个子程序可见), 再隐藏母程序, 最后显示新插件
    this._hideAllPluginWindows(pluginId)
    console.log(`[PluginManager] Hiding main window, pin state saved: ${this._mainWindowPinned}`)
    this._hideMainForPlugin()
    console.log(`[PluginManager] Showing plugin window: ${pluginId}`)
    pluginWindow.show()
    pluginWindow.focus()
    
    this.activePluginId = pluginId
    console.log(`[PluginManager] ✅ Plugin window shown successfully: ${pluginId}`)
    
    return { success: true }
  }

  /**
   * 返回母程序（带过渡动画）
   * @param {string} pluginId - 插件ID
   */
  async returnToParent(pluginId) {
    const pluginWindow = this.windows.get(pluginId)
    if (!pluginWindow || pluginWindow.isDestroyed()) {
      // 直接显示母程序 (互斥: 先隐藏所有可见插件窗口)
      this._hideAllPluginWindows()
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.show()
        // 重新应用置顶状态（show() 会重置 always-on-top）
        if (this._mainWindowPinned) {
          this.mainWindow.setAlwaysOnTop(true, 'screen-saver')
        }
      }
      return
    }
    
    // 通知插件开始退出过渡
    pluginWindow.webContents.send('plugin:transition-enter')
    
    // 等待插件蒙版覆盖 (900ms)
    await this._sleep(900)
    
    // 隐藏插件，显示母程序
    // 互斥: 隐藏**所有**插件窗口 (历史 Bug: 只隐藏活动插件, 其他插件窗口仍可见 → 母子同屏)
    this._hideAllPluginWindows()
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.show()
      // 重新应用置顶状态（show() 会重置 always-on-top）
      if (this._mainWindowPinned) {
        this.mainWindow.setAlwaysOnTop(true, 'screen-saver')
      }
      this.mainWindow.focus()
      
      // 通知母程序播放退出动画
      this.mainWindow.webContents.send('transition:exit')
    }
    
    // 等待母程序蒙版退出 (900ms)
    await this._sleep(900)
    
    // 通知母程序过渡完成
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('transition:done')
    }
  }

  /**
   * 暂停插件（隐藏窗口）
   * @param {string} pluginId - 插件ID
   */
  suspendPlugin(pluginId) {
    const plugin = this.plugins.get(pluginId)
    const pluginWindow = this.windows.get(pluginId)
    
    if (plugin && plugin.state === PluginState.RUNNING && pluginWindow && !pluginWindow.isDestroyed()) {
      pluginWindow.hide()
      plugin.state = PluginState.SUSPENDED
      this._emit('plugin-suspended', { pluginId })
      console.log(`[PluginManager] Plugin suspended: ${pluginId}`)
      // 互斥: 隐藏后若无任何可见插件窗口, 恢复母程序 (保证始终有窗口在运行)
      this._recoverMainWindowIfIdle()
    }
  }

  /**
   * 恢复插件（显示窗口）
   * @param {string} pluginId - 插件ID
   */
  resumePlugin(pluginId) {
    const plugin = this.plugins.get(pluginId)
    const pluginWindow = this.windows.get(pluginId)
    
    if (plugin && plugin.state === PluginState.SUSPENDED && pluginWindow && !pluginWindow.isDestroyed()) {
      // 互斥: 先藏母程序再显示插件
      this._hideMainForPlugin()
      pluginWindow.show()
      // 重新应用置顶状态（show() 会重置 always-on-top）
      if (this.pluginPinStates.get(pluginId)) {
        pluginWindow.setAlwaysOnTop(true, 'screen-saver')
      }
      pluginWindow.focus()
      plugin.state = PluginState.RUNNING
      this._emit('plugin-resumed', { pluginId })
      console.log(`[PluginManager] Plugin resumed: ${pluginId}`)
    }
  }

  /**
   * 关闭插件
   * @param {string} pluginId - 插件ID
   */
  async closePlugin(pluginId) {
    const pluginWindow = this.windows.get(pluginId)
    const plugin = this.plugins.get(pluginId)
    
    if (pluginWindow) {
      // 调用插件清理函数
      if (plugin && plugin.module && plugin.module.cleanup) {
        try {
          await plugin.module.cleanup()
        } catch (error) {
          console.error(`[PluginManager] Plugin cleanup error: ${pluginId}`, error)
        }
      }
      
      // 关闭窗口
      pluginWindow.close()
      
      // 更新状态
      if (plugin) {
        plugin.state = PluginState.UNLOADED
      }
      
      if (this.activePluginId === pluginId) {
        this.activePluginId = null
      }
      
      // 清理追踪的置顶状态
      this.pluginPinStates.delete(pluginId)
      
      this._emit('plugin-closed', { pluginId })
      console.log(`[PluginManager] Plugin closed: ${pluginId}`)
    }
  }

  /**
   * 卸载插件（完全移除）
   * @param {string} pluginId - 插件ID
   */
  async unloadPlugin(pluginId) {
    // 先关闭
    await this.closePlugin(pluginId)
    
    // 调用 loader 卸载
    await this.loader.unloadPlugin(pluginId)
    
    // 从内存中移除
    this.plugins.delete(pluginId)
    
    this._emit('plugin-unloaded', { pluginId })
    console.log(`[PluginManager] Plugin unloaded: ${pluginId}`)
  }

  /**
   * 最小化插件窗口
   * @param {string} pluginId - 插件ID
   */
  minimizePlugin(pluginId) {
    const pluginWindow = this.windows.get(pluginId)
    if (pluginWindow) {
      pluginWindow.minimize()
    }
  }

  /**
   * 最大化/还原插件窗口
   * @param {string} pluginId - 插件ID
   */
  maximizePlugin(pluginId) {
    const pluginWindow = this.windows.get(pluginId)
    if (pluginWindow) {
      if (pluginWindow.isMaximized()) {
        pluginWindow.unmaximize()
      } else {
        pluginWindow.maximize()
      }
    }
  }

  /**
   * 设置插件窗口置顶
   * @param {string} pluginId - 插件ID
   * @param {boolean} flag - 是否置顶
   */
  setAlwaysOnTop(pluginId, flag) {
    const pluginWindow = this.windows.get(pluginId)
    if (pluginWindow && !pluginWindow.isDestroyed()) {
      pluginWindow.setAlwaysOnTop(flag, 'screen-saver')
      // 追踪置顶状态（show() 会重置 always-on-top，需要独立记录）
      this.pluginPinStates.set(pluginId, flag)
      return true
    }
    return false
  }

  /**
   * 发送消息到插件
   * @param {string} pluginId - 目标插件ID
   * @param {Object} message - 消息内容
   */
  sendMessageToPlugin(pluginId, message) {
    const pluginWindow = this.windows.get(pluginId)
    if (pluginWindow && !pluginWindow.isDestroyed()) {
      pluginWindow.webContents.send('plugin:message', message)
      return true
    }
    return false
  }

  /**
   * 广播消息给所有运行中的插件
   * @param {Object} message - 消息内容
   */
  broadcastMessage(message) {
    for (const [pluginId, pluginWindow] of this.windows) {
      if (pluginWindow && !pluginWindow.isDestroyed()) {
        pluginWindow.webContents.send('plugin:broadcast', message)
      }
    }
    return true
  }

  /**
   * 执行插件命令
   * @param {string} pluginId - 插件ID
   * @param {string} command - 命令名
   * @param {...any} args - 参数
   */
  executePluginCommand(pluginId, command, ...args) {
    const pluginWindow = this.windows.get(pluginId)
    if (pluginWindow && !pluginWindow.isDestroyed()) {
      pluginWindow.webContents.send('plugin:execute', command, ...args)
    }
  }

  /**
   * 检查插件权限
   * @param {string} pluginId - 插件ID
   * @param {string} permission - 权限名
   * @returns {boolean}
   */
  checkPermission(pluginId, permission) {
    const plugin = this.plugins.get(pluginId)
    if (!plugin || !plugin.manifest) {
      return false
    }
    
    const permissions = plugin.manifest.permissions || []
    
    if (permissions.includes('*')) {
      return true
    }
    
    return permissions.includes(permission)
  }

  /**
   * 获取插件窗口
   * @param {string} pluginId - 插件ID
   * @returns {BrowserWindow|null}
   */
  getPluginWindow(pluginId) {
    return this.windows.get(pluginId) || null
  }

  /**
   * 检查插件是否正在运行
   * @param {string} pluginId - 插件ID
   * @returns {boolean}
   */
  isPluginRunning(pluginId) {
    const plugin = this.plugins.get(pluginId)
    return plugin && plugin.state === PluginState.RUNNING
  }

  /**
   * 获取所有运行中的插件ID
   * @returns {string[]}
   */
  getRunningPlugins() {
    const running = []
    for (const [pluginId, plugin] of this.plugins) {
      if (plugin.state === PluginState.RUNNING) {
        running.push(pluginId)
      }
    }
    return running
  }

  /**
   * 获取当前活动插件ID
   * @returns {string|null}
   */
  getActivePluginId() {
    return this.activePluginId
  }

  /**
   * 获取当前可见的插件窗口列表
   * @returns {BrowserWindow[]}
   */
  getVisiblePluginWindows() {
    const visible = []
    for (const win of this.windows.values()) {
      if (win && !win.isDestroyed() && win.isVisible()) visible.push(win)
    }
    return visible
  }

  /**
   * 是否存在可见的插件窗口 (互斥不变式的判定依据)
   * @returns {boolean}
   */
  hasVisiblePluginWindow() {
    return this.getVisiblePluginWindows().length > 0
  }

  /**
   * 显示插件窗口前隐藏母程序 (互斥: 先藏母, 再显子, 避免任何重叠窗口)
   * 同时保存母程序置顶状态供 returnToParent 恢复
   */
  _hideMainForPlugin() {
    if (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.isVisible()) {
      this._mainWindowPinned = this.mainWindow.isAlwaysOnTop()
      this.mainWindow.hide()
    }
  }

  /**
   * 隐藏所有插件窗口 (返回母程序 / 启动新插件时保证只留一个可见窗口)
   * @param {string} [exceptPluginId] - 保留显示的插件
   */
  _hideAllPluginWindows(exceptPluginId = null) {
    for (const [pluginId, win] of this.windows) {
      if (pluginId === exceptPluginId) continue
      if (win && !win.isDestroyed() && win.isVisible()) win.hide()
    }
  }

  /**
   * 插件窗口消失后的母程序恢复 (互斥的另一半: 保证始终有一个窗口在运行)
   */
  _recoverMainWindowIfIdle() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    if (this.hasVisiblePluginWindow()) return
    if (this.mainWindow.isVisible()) return
    console.log('[PluginManager] Plugin gone, restoring main window')
    this.mainWindow.show()
    // show() 会重置 always-on-top, 按保存的置顶状态恢复
    if (this._mainWindowPinned) {
      this.mainWindow.setAlwaysOnTop(true, 'screen-saver')
    }
  }

  /**
   * 辅助方法: 睡眠
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 事件监听
   * @param {string} event - 事件名
   * @param {Function} callback - 回调函数
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(callback)
  }

  /**
   * 移除事件监听
   * @param {string} event - 事件名
   * @param {Function} callback - 回调函数
   */
  off(event, callback) {
    const listeners = this.listeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  /**
   * 触发事件
   * @param {string} event - 事件名
   * @param {Object} data - 事件数据
   */
  _emit(event, data) {
    const listeners = this.listeners.get(event)
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(data)
        } catch (error) {
          console.error(`[PluginManager] Event listener error: ${event}`, error)
        }
      }
    }
  }

  /**
   * 清理所有插件（应用退出时调用）
   */
  async cleanup() {
    console.log('[PluginManager] Cleaning up all plugins...')
    
    for (const [pluginId, plugin] of this.plugins) {
      if (plugin.state === PluginState.RUNNING) {
        await this.closePlugin(pluginId)
      }
    }
    
    this.plugins.clear()
    this.windows.clear()
    
    // 保存数据库
    this.database.flush()
    
    console.log('[PluginManager] Cleanup complete')
  }
}

module.exports = { PluginManager, PluginState }
