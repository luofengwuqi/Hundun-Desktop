/**
 * Hundun Lite - 数据库管理器
 * 使用 JSON 文件存储插件数据（避免 SQLite 原生模块编译问题）
 * 
 * 设计理念：
 * - 每个插件的数据存储在独立的 JSON 文件中
 * - 支持事务性操作（原子写入）
 * - 支持数据验证和版本迁移
 * - 性能优化：内存缓存 + 延迟写入
 */

const fs = require('fs')
const path = require('path')
const { app } = require('electron')

class Database {
  constructor() {
    // 数据存储目录：用户数据目录下的 huntun-lite-data
    this.dataDir = path.join(app.getPath('userData'), 'huntun-lite-data')
    this.cache = new Map() // 内存缓存
    this.dirtyKeys = new Set() // 脏数据标记（延迟写入）
    this.writeTimer = null
    
    // 确保数据目录存在
    this._ensureDataDir()
    
    // 进程退出时保存脏数据
    this._setupExitHandlers()
  }

  /**
   * 确保数据目录存在
   */
  _ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true })
    }
  }

  /**
   * 设置进程退出处理器
   */
  _setupExitHandlers() {
    const saveOnExit = () => {
      this.flush()
    }
    
    process.on('exit', saveOnExit)
    process.on('SIGINT', () => { saveOnExit(); process.exit(0) })
    process.on('SIGTERM', () => { saveOnExit(); process.exit(0) })
  }

  /**
   * 获取插件数据文件路径
   * @param {string} pluginId - 插件ID
   * @returns {string} 文件路径
   */
  _getPluginFilePath(pluginId) {
    // 安全的文件名：只允许字母、数字、连字符
    const safeName = pluginId.replace(/[^a-zA-Z0-9\-]/g, '_')
    return path.join(this.dataDir, `${safeName}.json`)
  }

  /**
   * 从磁盘加载插件数据
   * @param {string} pluginId - 插件ID
   * @returns {Object} 插件数据
   */
  _loadFromDisk(pluginId) {
    const filePath = this._getPluginFilePath(pluginId)
    
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8')
        return JSON.parse(content)
      }
    } catch (error) {
      console.error(`[Database] Failed to load data for plugin ${pluginId}:`, error)
    }
    
    return {}
  }

  /**
   * 写入磁盘
   * @param {string} pluginId - 插件ID
   * @param {Object} data - 要写入的数据
   */
  _writeToDisk(pluginId, data) {
    const filePath = this._getPluginFilePath(pluginId)
    
    try {
      // 原子写入：先写入临时文件，再重命名
      const tempPath = `${filePath}.tmp`
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8')
      fs.renameSync(tempPath, filePath)
    } catch (error) {
      console.error(`[Database] Failed to write data for plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * 获取插件的缓存数据（如果不存在则从磁盘加载）
   * @param {string} pluginId - 插件ID
   * @returns {Object} 插件数据
   */
  _getPluginCache(pluginId) {
    if (!this.cache.has(pluginId)) {
      this.cache.set(pluginId, this._loadFromDisk(pluginId))
    }
    return this.cache.get(pluginId)
  }

  /**
   * 获取插件的某个键值
   * @param {string} pluginId - 插件ID
   * @param {string} key - 键名
   * @param {*} defaultValue - 默认值
   * @returns {*} 键值
   */
  get(pluginId, key, defaultValue = null) {
    const data = this._getPluginCache(pluginId)
    return key in data ? data[key] : defaultValue
  }

  /**
   * 设置插件的某个键值
   * @param {string} pluginId - 插件ID
   * @param {string} key - 键名
   * @param {*} value - 值
   * @param {boolean} immediate - 是否立即写入磁盘
   */
  set(pluginId, key, value, immediate = false) {
    const data = this._getPluginCache(pluginId)
    data[key] = value
    this.dirtyKeys.add(pluginId)
    
    if (immediate) {
      this._writeToDisk(pluginId, data)
      this.dirtyKeys.delete(pluginId)
    } else {
      this._scheduleWrite()
    }
  }

  /**
   * 删除插件的某个键
   * @param {string} pluginId - 插件ID
   * @param {string} key - 键名
   */
  remove(pluginId, key) {
    const data = this._getPluginCache(pluginId)
    if (key in data) {
      delete data[key]
      this.dirtyKeys.add(pluginId)
      this._scheduleWrite()
    }
  }

  /**
   * 获取插件的所有数据
   * @param {string} pluginId - 插件ID
   * @returns {Object} 所有数据
   */
  getAll(pluginId) {
    return { ...this._getPluginCache(pluginId) }
  }

  /**
   * 设置插件的所有数据（覆盖）
   * @param {string} pluginId - 插件ID
   * @param {Object} data - 数据
   */
  setAll(pluginId, data) {
    this.cache.set(pluginId, { ...data })
    this.dirtyKeys.add(pluginId)
    this._scheduleWrite()
  }

  /**
   * 清空插件的所有数据
   * @param {string} pluginId - 插件ID
   */
  clear(pluginId) {
    this.cache.set(pluginId, {})
    this.dirtyKeys.add(pluginId)
    this._scheduleWrite()
  }

  /**
   * 删除插件的所有数据（包括文件）
   * @param {string} pluginId - 插件ID
   */
  deleteAll(pluginId) {
    this.cache.delete(pluginId)
    this.dirtyKeys.delete(pluginId)
    
    const filePath = this._getPluginFilePath(pluginId)
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    } catch (error) {
      console.error(`[Database] Failed to delete data for plugin ${pluginId}:`, error)
    }
  }

  /**
   * 检查插件是否有数据
   * @param {string} pluginId - 插件ID
   * @returns {boolean}
   */
  hasData(pluginId) {
    const data = this._getPluginCache(pluginId)
    return Object.keys(data).length > 0
  }

  /**
   * 获取所有有数据的插件ID列表
   * @returns {string[]}
   */
  getAllPluginIds() {
    try {
      const files = fs.readdirSync(this.dataDir)
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''))
    } catch (error) {
      return []
    }
  }

  /**
   * 延迟写入调度（100ms 批量写入）
   */
  _scheduleWrite() {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer)
    }
    
    this.writeTimer = setTimeout(() => {
      this.flush()
    }, 100)
  }

  /**
   * 立即写入所有脏数据
   */
  flush() {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer)
      this.writeTimer = null
    }
    
    for (const pluginId of this.dirtyKeys) {
      const data = this.cache.get(pluginId)
      if (data !== undefined) {
        this._writeToDisk(pluginId, data)
      }
    }
    
    this.dirtyKeys.clear()
  }

  /**
   * 数据库统计信息
   * @returns {Object}
   */
  getStats() {
    return {
      dataDir: this.dataDir,
      cachedPlugins: this.cache.size,
      dirtyPlugins: this.dirtyKeys.size,
      diskPlugins: this.getAllPluginIds().length
    }
  }
}

// 单例模式
let instance = null

function getDatabase() {
  if (!instance) {
    instance = new Database()
  }
  return instance
}

module.exports = { Database, getDatabase }
