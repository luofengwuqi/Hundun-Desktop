/**
 * HundunDesktop - 插件管理器 v2.0
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
const { checkPlatformSupport } = require('./platform-support')
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
    this.mainWindow = mainWindow // 主会话母窗口引用 (镜像升格后随 setPrimarySession 更新)
    this.plugins = new Map()     // pluginId -> PluginInstance
    this.windows = new Map()     // pluginId -> BrowserWindow
    // ========== 会话 (2026-10-14 决策45: 镜像模式) ==========
    // 一个会话 = 一个母窗口 + 它启动的子程序窗口; 互斥不变式按会话判定
    // (会话内母子互斥, 跨会话可同屏并行)
    this.sessions = new Map()    // 母窗口(BrowserWindow) -> { label, main, activePluginId, pinnedMain }
    this.primarySession = null   // 主会话 (原进程 A; A 关闭后镜像 B 升格接管)
    this.pluginOwner = new Map() // pluginId -> 归属会话 (镜像互斥: 同一插件同时只属于一个会话)
    this.database = getDatabase()
    // 扫描内置插件目录 + 用户安装插件目录（本地安装的 .zip 插件落盘于后者）
    this.pluginDirs = resolvePluginsDirs()
    this.loader = new PluginLoader(this.pluginDirs)
    
    // 事件监听器
    this.listeners = new Map()
    
    // 过渡动画窗口
    this.transitionWindow = null
    
    // 追踪每个插件窗口的置顶状态（show() 会重置 always-on-top，需要独立追踪）
    this.pluginPinStates = new Map() // pluginId -> boolean

    // 追踪被最小化的插件 (决策52)
    // Electron 的 isVisible() 状态更新有延迟 (minimize() 之后仍可能短暂返回 true),
    // 因此用独立标记做会话可见性判定, 保证「最小化 → 母程序顶上」不被时序打断
    this.pluginMinimized = new Map() // pluginId -> true

    // 默认会话 = 主会话 (兼容 test-window-lifecycle 等直接 new PluginManager(mainWin) 的用法)
    if (mainWindow && !mainWindow.isDestroyed()) {
      this.setPrimarySession(this.addSession(mainWindow, 'main'))
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

  // ========== 会话管理 (决策45: 镜像模式) ==========

  /**
   * 注册一个母窗口会话 (创建母窗口/镜像窗口时调用, 幂等)
   * @param {BrowserWindow} mainWin - 母窗口
   * @param {string} label - 'main' | 'mirror'
   * @returns {Object|null} 会话对象
   */
  addSession(mainWin, label = 'main') {
    if (!mainWin || mainWin.isDestroyed()) return null
    const existing = this.sessions.get(mainWin)
    if (existing) return existing

    const session = { label, main: mainWin, activePluginId: null, pinnedMain: false }
    this.sessions.set(mainWin, session)

    // ========== 会话内母子可见性互斥 (2026-10-03, 2026-10-14 会话化) ==========
    // 任何路径把该会话母窗口 show() 出来时, 只要该会话有可见插件窗口, 立即重新隐藏 ——
    // 跨会话不受影响 (镜像窗口/其子程序可与本会话同屏并行)
    mainWin.on('show', () => {
      if (this.hasVisiblePluginWindow(session)) {
        console.log(`[PluginManager] Main window show() blocked (${label}): session plugin visible, re-hiding`)
        mainWin.hide()
      }
    })

    console.log(`[PluginManager] Session added: ${label}`)
    return session
  }

  /**
   * 设定主会话 (原进程 A; A 关闭后镜像 B 升格时调用)
   */
  setPrimarySession(session) {
    this.primarySession = session || null
    this.mainWindow = session ? session.main : null
  }

  /**
   * 会话注销: 关闭该会话名下全部插件窗口并移除注册
   * (母窗口关闭时调用 — 镜像 B 关闭时其子程序一并关闭)
   * @returns {Object|null} 被注销的会话
   */
  removeSession(mainWin) {
    const session = this.sessions.get(mainWin)
    if (!session) return null

    for (const [pluginId, owner] of [...this.pluginOwner]) {
      if (owner !== session) continue
      this.pluginOwner.delete(pluginId)
      const win = this.windows.get(pluginId)
      this.windows.delete(pluginId)
      const plugin = this.plugins.get(pluginId)
      if (plugin) plugin.state = PluginState.UNLOADED
      if (win && !win.isDestroyed()) win.close()
      this._emit('plugin-closed', { pluginId })
    }

    session.activePluginId = null
    this.sessions.delete(mainWin)
    if (this.primarySession === session) this.primarySession = null
    this._broadcastPluginState()
    console.log(`[PluginManager] Session removed: ${session.label}`)
    return session
  }

  /**
   * 由 IPC 发送方反查会话: 母窗口 → 该会话; 插件窗口 → 归属会话; 兜底主会话
   */
  sessionForSender(webContents) {
    for (const [win, session] of this.sessions) {
      if (!win.isDestroyed() && win.webContents === webContents) return session
    }
    const pluginId = this._getWindowPluginId(webContents)
    if (pluginId) {
      const owner = this.pluginOwner.get(pluginId)
      if (owner) return owner
    }
    return this.primarySession
  }

  /**
   * 获取某插件的归属会话
   */
  getPluginOwner(pluginId) {
    return this.pluginOwner.get(pluginId) || null
  }

  /**
   * 当前被占用的插件 (存在未销毁的插件窗口 = 某会话持有)
   * @returns {string[]}
   */
  getOccupiedPlugins() {
    const occupied = []
    for (const [pluginId, win] of this.windows) {
      if (win && !win.isDestroyed()) occupied.push(pluginId)
    }
    return occupied
  }

  /**
   * 相对某会话而言"在别处运行"的插件列表 (镜像窗口用于徽章与冲突拦截)
   */
  getForeignPlugins(session = null) {
    const target = session || this.primarySession
    return this.getOccupiedPlugins().filter(id => this.pluginOwner.get(id) !== target)
  }

  /**
   * 向每个母窗口推送"别处运行的插件"列表 (会话视角不同, 内容不同)
   */
  _broadcastPluginState() {
    const occupied = this.getOccupiedPlugins()
    for (const session of this.sessions.values()) {
      if (!session.main || session.main.isDestroyed()) continue
      const foreign = occupied.filter(id => this.pluginOwner.get(id) !== session)
      session.main.webContents.send('plugin-state-changed', foreign)
    }
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

    // 插件 -> 主进程：关闭窗口 (返回母程序, 带过渡动画)
    ipcMain.handle('plugin:close', async (event, pluginId) => {
      try {
        await this.closePlugin(pluginId)
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    // 插件 -> 主进程：最小化窗口 (决策52)
    // 最小化后该会话将没有可见窗口 → 由 minimizePlugin 负责恢复母程序
    ipcMain.handle('plugin:minimize', async (event, pluginId) => {
      try {
        const ok = this.minimizePlugin(pluginId)
        return { success: !!ok }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    // 插件 -> 主进程：最大化/还原窗口
    ipcMain.handle('plugin:maximize', async (event, pluginId) => {
      try {
        this.maximizePlugin(pluginId)
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
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

    // 插件 -> 主进程：播放音效 (转发给归属会话的母窗口)
    ipcMain.handle('plugin:playSound', (event, soundName) => {
      const session = this.sessionForSender(event.sender) || this.primarySession
      if (session && session.main && !session.main.isDestroyed()) {
        session.main.webContents.send('play-sound', soundName)
      }
    })

    // 插件 -> 主进程：获取当前主题 (向归属会话的母程序查询)
    ipcMain.handle('plugin:getTheme', (event) => {
      const session = this.sessionForSender(event.sender) || this.primarySession
      if (session && session.main && !session.main.isDestroyed()) {
        // 从母程序获取主题状态
        return new Promise((resolve) => {
          ipcMain.once('theme:get-response', (event, theme) => {
            resolve(theme)
          })
          session.main.webContents.send('theme:get-request')
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
   * @param {Object|null} session - 目标会话 (缺省 = 主会话; 由 IPC 发送方反查)
   * @returns {BrowserWindow} 插件窗口
   */
  async startPlugin(pluginId, options = {}, session = null) {
    const targetSession = session || this.primarySession

    // ========== 镜像互斥归属校验 (决策45) ==========
    // 该插件已被其他会话持有 (存在插件窗口) → 拒绝启动, 错误回到渲染进程弹提示
    const owner = this.pluginOwner.get(pluginId)
    if (owner && owner !== targetSession && this.windows.has(pluginId)) {
      const msg = `插件 "${pluginId}" 正在另一个窗口中运行`
      console.warn(`[PluginManager] ${msg} (owner=${owner.label}, request=${targetSession ? targetSession.label : 'none'})`)
      this._emit('plugin-error', { pluginId, error: msg })
      throw new Error(msg)
    }

    // 确保插件已加载
    let plugin = this.plugins.get(pluginId)
    if (!plugin || plugin.state === PluginState.UNLOADED) {
      plugin = await this.loadPlugin(pluginId)
    }

    // 决策42: 打开前主动检查系统状态 — manifest.platforms 不含当前系统则拒绝创建窗口
    // (错误经 launchPluginWithTransition/startPlugin 的 catch 回到渲染进程, 母程序弹提示)
    const platformError = checkPlatformSupport(plugin.manifest, process.platform)
    if (platformError) {
      console.warn(`[PluginManager] ${platformError}`)
      this._emit('plugin-error', { pluginId, error: platformError })
      throw new Error(platformError)
    }

      // 如果已经在运行，返回现有窗口
      if (plugin.state === PluginState.RUNNING && this.windows.has(pluginId)) {
        const existingWindow = this.windows.get(pluginId)
        // 互斥(会话内): 先藏本会话母程序, 再显示插件窗口 (避免瞬间双窗口同时可见)
        this._hideMainForPlugin(targetSession)
        // 窗口此前被最小化 → 先恢复 (show() 不会解除最小化, 否则会话将没有可见窗口)
        if (existingWindow.isMinimized()) {
          existingWindow.restore()
        }
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

      // 子程序从最小化恢复 (任务栏/程序坞点击) → 再次隐藏本会话母程序, 维持会话内互斥
      // (最小化时母程序已恢复可见, 见 minimizePlugin)
      const onPluginWindowVisible = () => {
        this.pluginMinimized.delete(pluginId)
        const ownerSession = this.pluginOwner.get(pluginId)
        if (ownerSession) {
          this._hideMainForPlugin(ownerSession)
        }
      }
      pluginWindow.on('restore', onPluginWindowVisible)
      pluginWindow.on('show', onPluginWindowVisible)
      // focus 兜底: 个别窗口管理器从最小化恢复时只发 focus (事件时序不保证)
      pluginWindow.on('focus', onPluginWindowVisible)

      // 窗口关闭事件
      pluginWindow.on('closed', () => {
        // 先捕获归属会话 (removeSession 注销时会提前清掉 owner, 此时不再恢复已销毁的母窗口)
        const ownerSession = this.pluginOwner.get(pluginId)
        this.windows.delete(pluginId)
        this.pluginMinimized.delete(pluginId)
        if (plugin) {
          plugin.state = PluginState.UNLOADED
        }
        if (ownerSession) {
          if (ownerSession.activePluginId === pluginId) {
            ownerSession.activePluginId = null
          }
          this.pluginOwner.delete(pluginId)
        }
        this._emit('plugin-closed', { pluginId })
        console.log(`[PluginManager] Plugin window closed: ${pluginId}`)
        // 互斥的另一半: 插件窗口消失后恢复本会话母程序 (否则该会话无可见窗口)
        this._recoverMainWindowIfIdle(ownerSession)
        this._broadcastPluginState()
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

      // 存储窗口引用与归属会话
      this.windows.set(pluginId, pluginWindow)
      this.pluginOwner.set(pluginId, targetSession)
      
      // 更新插件状态
      plugin.state = PluginState.RUNNING
      plugin.startedAt = new Date().toISOString()
      if (targetSession) targetSession.activePluginId = pluginId
      
      // 触发事件
      this._emit('plugin-started', { pluginId, manifest: plugin.manifest })
      this._broadcastPluginState()
      
      console.log(`[PluginManager] Plugin started: ${pluginId} (session=${targetSession ? targetSession.label : 'none'})`)
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
   * @param {Object|null} session - 目标会话 (缺省 = 主会话; 由 IPC 发送方反查)
   */
  async launchPluginWithTransition(pluginId, options = {}, session = null) {
    console.log(`[PluginManager] launchPluginWithTransition called for: ${pluginId}`)
    const targetSession = session || this.primarySession

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
    
    // 启动插件窗口 (含镜像互斥归属校验, 决策45)
    let pluginWindow
    try {
      pluginWindow = await this.startPlugin(pluginId, options, targetSession)
    } catch (e) {
      console.error(`[PluginManager] Failed to start plugin ${pluginId}:`, e)
      return { success: false, error: e.message }
    }
    
    // 获取本会话母程序位置，对齐插件窗口
    if (targetSession && targetSession.main && !targetSession.main.isDestroyed()) {
      const [mainX, mainY] = targetSession.main.getPosition()
      const [mainW, mainH] = targetSession.main.getSize()
      
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
    
    // 互斥(会话内): 先隐藏本会话其他可见插件, 再隐藏本会话母程序, 最后显示新插件
    // 跨会话不受影响 — 镜像会话的窗口保持原状 (并行)
    this._hideAllPluginWindows(targetSession, pluginId)
    console.log(`[PluginManager] Hiding main window (${targetSession ? targetSession.label : 'none'})`)
    this._hideMainForPlugin(targetSession)
    console.log(`[PluginManager] Showing plugin window: ${pluginId}`)
    pluginWindow.show()
    pluginWindow.focus()
    
    if (targetSession) targetSession.activePluginId = pluginId
    console.log(`[PluginManager] ✅ Plugin window shown successfully: ${pluginId}`)
    
    return { success: true }
  }

  /**
   * 返回母程序（带过渡动画, 只作用于归属会话）
   * @param {string} pluginId - 插件ID
   */
  async returnToParent(pluginId) {
    const session = this.pluginOwner.get(pluginId) || this.primarySession
    const sessionMain = session && session.main && !session.main.isDestroyed() ? session.main : null
    const pluginWindow = this.windows.get(pluginId)
    if (!pluginWindow || pluginWindow.isDestroyed()) {
      // 直接显示本会话母程序 (互斥: 先隐藏本会话所有可见插件窗口)
      this._hideAllPluginWindows(session)
      if (sessionMain) {
        sessionMain.show()
        // 重新应用置顶状态（show() 会重置 always-on-top）
        if (session.pinnedMain) {
          sessionMain.setAlwaysOnTop(true, 'screen-saver')
        }
      }
      return
    }
    
    // 通知插件开始退出过渡
    pluginWindow.webContents.send('plugin:transition-enter')
    
    // 等待插件蒙版覆盖 (900ms)
    await this._sleep(900)
    
    // 隐藏插件，显示本会话母程序
    // 互斥(会话内): 隐藏**本会话所有**插件窗口 (历史 Bug: 只隐藏活动插件, 其他插件窗口仍可见 → 母子同屏)
    // 跨会话不受影响 — 镜像会话的窗口原样保留
    this._hideAllPluginWindows(session)
    if (sessionMain) {
      sessionMain.show()
      // 重新应用置顶状态（show() 会重置 always-on-top）
      if (session.pinnedMain) {
        sessionMain.setAlwaysOnTop(true, 'screen-saver')
      }
      sessionMain.focus()
      
      // 通知本会话母程序播放退出动画
      sessionMain.webContents.send('transition:exit')
    }
    
    // 等待母程序蒙版退出 (900ms)
    await this._sleep(900)
    
    // 通知本会话母程序过渡完成
    if (sessionMain) {
      sessionMain.webContents.send('transition:done')
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
      // 互斥(会话内): 隐藏后本会话无任何可见插件窗口, 恢复本会话母程序 (保证该会话始终有窗口在运行)
      this._recoverMainWindowIfIdle(this.pluginOwner.get(pluginId))
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
      // 互斥(会话内): 先藏本会话母程序再显示插件
      this._hideMainForPlugin(this.pluginOwner.get(pluginId))
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
    const ownerSession = this.pluginOwner.get(pluginId) || null
    
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
      
      if (ownerSession && ownerSession.activePluginId === pluginId) {
        ownerSession.activePluginId = null
      }
      
      // 清理追踪的置顶状态
      this.pluginPinStates.delete(pluginId)
      
      this._emit('plugin-closed', { pluginId })
      console.log(`[PluginManager] Plugin closed: ${pluginId}`)
      this._broadcastPluginState()
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
   * 会话内互斥不变式 (决策38/45): 最小化后 isVisible() 返回 false,
   * 该会话将没有任何可见窗口 → 立即恢复母程序, 保证「不会两个都没了」;
   * 子程序随后从任务栏恢复时, 母程序会被再次隐藏 (见 startPlugin 的 restore/show 监听)
   * @param {string} pluginId - 插件ID
   * @returns {boolean} 是否成功最小化
   */
  minimizePlugin(pluginId) {
    const pluginWindow = this.windows.get(pluginId)
    if (!pluginWindow || pluginWindow.isDestroyed()) return false
    // 先打标记: Electron 的 isVisible() 在 minimize() 之后有状态延迟,
    // 不打标记会导致母程序恢复逻辑误判「子程序仍可见」而被跳过
    this.pluginMinimized.set(pluginId, true)
    pluginWindow.minimize()
    const owner = this.pluginOwner.get(pluginId)
    if (owner) {
      // 恢复动作延到下一拍再执行:
      // ① 让 minimize() 的状态先落地 (isVisible 有延迟);
      // ② 若这期间窗口已被 restore (标记被清), 说明又可见了 → 不能再把母程序拉起来
      //    (防重复点击最小化 + 延迟处理导致的「母子双可见」竞态)
      setImmediate(() => {
        if (pluginWindow.isDestroyed()) return
        if (!this.pluginMinimized.get(pluginId)) return
        this._recoverMainWindowIfIdle(owner, 'plugin minimized')
      })
    }
    return true
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
   * 获取当前活动插件ID (缺省主会话)
   * @param {Object|null} session - 会话 (缺省 = 主会话)
   * @returns {string|null}
   */
  getActivePluginId(session = null) {
    const s = session || this.primarySession
    return s ? s.activePluginId : null
  }

  /**
   * 获取当前可见的插件窗口列表
   * @param {Object|null} session - 限定会话 (缺省 = 全部会话)
   * @returns {BrowserWindow[]}
   */
  getVisiblePluginWindows(session = null) {
    const visible = []
    for (const [pluginId, win] of this.windows) {
      if (this.pluginMinimized.get(pluginId)) continue // 已最小化: 视为不可见 (决策52)
      if (!win || win.isDestroyed() || !win.isVisible()) continue
      if (session && this.pluginOwner.get(pluginId) !== session) continue
      visible.push(win)
    }
    return visible
  }

  /**
   * 是否存在可见的插件窗口 (会话内互斥不变式的判定依据)
   * @param {Object|null} session - 限定会话 (缺省 = 全部会话)
   * @returns {boolean}
   */
  hasVisiblePluginWindow(session = null) {
    return this.getVisiblePluginWindows(session).length > 0
  }

  /**
   * 显示插件窗口前隐藏本会话母程序 (互斥: 先藏母, 再显子, 避免任何重叠窗口)
   * 同时保存该会话母窗口置顶状态供 returnToParent/_recover 恢复
   * @param {Object|null} session - 会话 (缺省 = 主会话)
   */
  _hideMainForPlugin(session = null) {
    const s = session || this.primarySession
    if (!s || !s.main || s.main.isDestroyed()) return
    if (s.main.isVisible()) {
      s.pinnedMain = s.main.isAlwaysOnTop()
      s.main.hide()
    }
  }

  /**
   * 隐藏某会话的所有插件窗口 (返回母程序 / 启动新插件时保证该会话只留一个可见窗口)
   * @param {Object|null} session - 会话 (缺省 = 全部会话, 兼容旧语义)
   * @param {string} [exceptPluginId] - 保留显示的插件
   */
  _hideAllPluginWindows(session = null, exceptPluginId = null) {
    for (const [pluginId, win] of this.windows) {
      if (pluginId === exceptPluginId) continue
      if (session && this.pluginOwner.get(pluginId) !== session) continue
      if (win && !win.isDestroyed() && win.isVisible()) win.hide()
    }
  }

  /**
   * 插件窗口消失后的本会话母程序恢复 (互斥的另一半: 保证该会话始终有一个窗口在运行)
   * @param {Object|null} session - 会话; 为空(会话已注销)则跳过
   * @param {string} [reason] - 恢复原因 (仅日志)
   */
  _recoverMainWindowIfIdle(session = null, reason = 'plugin gone') {
    if (!session || !session.main || session.main.isDestroyed()) return
    if (this.hasVisiblePluginWindow(session)) return
    if (session.main.isVisible()) return
    console.log(`[PluginManager] Restoring main window (${session.label}): ${reason}`)
    session.main.show()
    // show() 会重置 always-on-top, 按保存的置顶状态恢复
    if (session.pinnedMain) {
      session.main.setAlwaysOnTop(true, 'screen-saver')
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
