/**
 * HundunDesktop - 镜像窗口管理器 (决策45: 镜像模式)
 *
 * 职责:
 * 1. 保证全局至多一个镜像窗口 (mirror:open 重复调用 → 聚焦已存在镜像)
 * 2. 主窗口关闭时把镜像窗口升格为主窗口 (镜像槽位释放, 可再开新镜像)
 * 3. 镜像窗口关闭时连带注销其会话 (其名下子程序窗口一并关闭, 由 PluginManager.removeSession 完成)
 *
 * 依赖注入 (由 index.js 注入, 便于 scripts/test-mirror.js 用真实窗口驱动):
 * - createWindow(label): 创建并加载一个母窗口 (含 addSession 注册), 返回 BrowserWindow
 * - pluginManager: PluginManager 实例 (removeSession / sessions / setPrimarySession)
 * - onPromoted(win): 镜像升格回调 (index.js 更新 mainWindow 指针 + 通知渲染进程角色变更)
 * - onStateChanged(): 镜像开合状态变化回调 (index.js 广播 mirror:state-changed)
 */

class MirrorManager {
  constructor({ pluginManager, createWindow, onPromoted, onStateChanged }) {
    this.pluginManager = pluginManager
    this.createWindow = createWindow
    this.onPromoted = onPromoted || (() => {})
    this.onStateChanged = onStateChanged || (() => {})
    this.primary = null   // 主窗口 (原进程 A; 升格后指向原镜像 B)
    this.mirror = null    // 镜像窗口 (至多一个)
  }

  /**
   * 设定主窗口 (启动/重建主窗口时调用)
   */
  setPrimary(win) {
    this.primary = win || null
  }

  getPrimary() {
    return this.primary && !this.primary.isDestroyed() ? this.primary : null
  }

  getMirror() {
    return this.mirror && !this.mirror.isDestroyed() ? this.mirror : null
  }

  hasMirror() {
    return this.getMirror() !== null
  }

  /**
   * 打开镜像窗口
   * @returns {{success: boolean, status?: string, error?: string}}
   *   status: 'created' 新建 | 'exists' 已存在(已聚焦)
   */
  open() {
    const existing = this.getMirror()
    if (existing) {
      this._focusGroup(existing)
      return { success: true, status: 'exists' }
    }

    const primary = this.getPrimary()
    if (!primary) {
      return { success: false, error: '主窗口不存在，无法打开镜像' }
    }

    const win = this.createWindow('mirror')
    if (!win) {
      return { success: false, error: '镜像窗口创建失败' }
    }

    // 级联偏移: 不与主窗口完全重叠 (同屏并行时可分辨)
    const [ax, ay] = primary.getPosition()
    win.setPosition(ax + 48, ay + 48)

    this.mirror = win
    // 注意: 窗口 'closed' 接线由 createWindow 统一完成 (→ handleWindowClosed), 此处不重复挂载

    this.onStateChanged()
    console.log('[MirrorManager] Mirror window created')
    return { success: true, status: 'created' }
  }

  /**
   * 母窗口关闭入口 (index.js 在窗口 'closed' 时调用)
   * 1) 注销该窗口会话 (其名下子程序一并关闭)
   * 2) 主窗口关闭且镜像存在 → 镜像升格为主窗口; 镜像关闭 → 释放镜像槽
   */
  handleWindowClosed(win) {
    // 注销会话: 关闭该会话名下全部插件窗口 (关 B → 其子程序一并关闭)
    if (this.pluginManager) {
      this.pluginManager.removeSession(win)
    }

    if (win === this.primary) {
      this.primary = null
      const mirror = this.getMirror()
      if (mirror) {
        // 升格: 留下的镜像窗口成为主窗口, 镜像槽位释放 (可再开新镜像)
        this.primary = mirror
        this.mirror = null
        console.log('[MirrorManager] Mirror promoted to primary')
        this.onPromoted(mirror)
      }
    } else if (win === this.mirror) {
      this.mirror = null
      console.log('[MirrorManager] Mirror window closed')
    }

    this.onStateChanged()
  }

  /**
   * 聚焦目标窗口所在会话: 有可见子程序 → 聚焦子程序; 否则显示并聚焦母窗口
   */
  _focusGroup(win) {
    const pm = this.pluginManager
    if (!pm) {
      win.focus()
      return
    }
    const session = pm.sessions.get(win)
    const visible = pm.getVisiblePluginWindows(session)
    if (visible.length) {
      visible[visible.length - 1].focus()
      return
    }
    if (!win.isVisible()) win.show()
    win.focus()
  }
}

module.exports = { MirrorManager }
