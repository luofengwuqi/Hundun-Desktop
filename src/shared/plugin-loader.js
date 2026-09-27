const fs = require('fs')
const path = require('path')

// 读取 manifest 文本：兼容 UTF-8 BOM / UTF-16 / GBK（编辑器另存为的常见编码）
function readManifestText (manifestPath) {
  const buf = fs.readFileSync(manifestPath)
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.slice(2).toString('utf16le')
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.from(buf.slice(2))
    if (swapped.length % 2 === 0) swapped.swap16()
    return swapped.toString('utf16le')
  }
  let text = buf.toString('utf8')
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  if (text.indexOf('\uFFFD') !== -1) {
    try {
      const gbk = new TextDecoder('gbk').decode(buf)
      if (gbk.indexOf('\uFFFD') === -1) return gbk
    } catch (_) { /* 忽略 */ }
  }
  return text
}

class PluginLoader {
  /**
   * @param {string|string[]} pluginsDir 单个插件目录，或按优先级排序的多个目录
   *                                     （内置插件目录 + 用户安装插件目录）
   */
  constructor(pluginsDir) {
    this.pluginDirs = Array.isArray(pluginsDir) ? pluginsDir.slice() : [pluginsDir]
    // 兼容旧代码中对单目录的引用
    this.pluginsDir = this.pluginDirs[0]
    this.loadedPlugins = new Map()
  }

  // 按优先级查找插件目录
  findPluginPath(pluginId) {
    if (!pluginId) return null
    for (const dir of this.pluginDirs) {
      const pluginPath = path.join(dir, pluginId)
      if (fs.existsSync(path.join(pluginPath, 'manifest.json'))) {
        return pluginPath
      }
    }
    return null
  }

  // 扫描插件目录（支持多个目录，按 id 去重，优先级靠前者胜出）
  async scanPlugins() {
    const plugins = []
    const seenIds = new Set()

    for (const dir of this.pluginDirs) {
      let entries
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
      } catch (error) {
        // 目录不存在（如用户安装目录尚未创建）时跳过
        continue
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const pluginPath = path.join(dir, entry.name)
        const manifestPath = path.join(pluginPath, 'manifest.json')

        if (!fs.existsSync(manifestPath)) continue

        try {
          const manifest = JSON.parse(readManifestText(manifestPath))
          if (!manifest || !manifest.id) continue
          if (seenIds.has(manifest.id)) continue // 高优先级目录已提供同 id 插件

          seenIds.add(manifest.id)
          plugins.push({
            ...manifest,
            path: pluginPath,
            loaded: this.loadedPlugins.has(manifest.id)
          })
        } catch (error) {
          // 单个插件 manifest 损坏不应影响整体扫描
          console.warn('[PluginLoader] Invalid manifest skipped:', manifestPath, error.message)
        }
      }
    }

    return plugins
  }

  // 加载插件
  async loadPlugin(pluginId) {
    if (this.loadedPlugins.has(pluginId)) {
      return this.loadedPlugins.get(pluginId)
    }

    const pluginPath = this.findPluginPath(pluginId)

    if (!pluginPath) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    const manifestPath = path.join(pluginPath, 'manifest.json')
    const manifest = JSON.parse(readManifestText(manifestPath))
    
    // 验证插件
    this.validatePlugin(manifest)

    // 加载插件代码
    const pluginModule = await this.loadPluginModule(pluginPath, manifest)

    const pluginInstance = {
      id: manifest.id,
      manifest,
      path: pluginPath,
      module: pluginModule,
      loadedAt: new Date().toISOString()
    }

    this.loadedPlugins.set(pluginId, pluginInstance)
    
    // 调用插件初始化
    if (pluginModule.init) {
      await pluginModule.init()
    }

    return pluginInstance
  }

  // 卸载插件
  async unloadPlugin(pluginId) {
    const plugin = this.loadedPlugins.get(pluginId)
    
    if (!plugin) {
      return false
    }

    // 调用插件清理
    if (plugin.module.cleanup) {
      await plugin.module.cleanup()
    }

    this.loadedPlugins.delete(pluginId)
    return true
  }

  // 加载插件模块
  async loadPluginModule(pluginPath, manifest) {
    const entryFile = path.join(pluginPath, manifest.entry || 'index.js')
    
    if (!fs.existsSync(entryFile)) {
      throw new Error(`Plugin entry file not found: ${entryFile}`)
    }

    // 根据文件类型加载
    if (entryFile.endsWith('.js')) {
      return require(entryFile)
    } else if (entryFile.endsWith('.html')) {
      // HTML 插件，返回基础对象
      return {
        type: 'html',
        path: entryFile,
        init: () => {},
        cleanup: () => {}
      }
    }
    
    throw new Error(`Unsupported plugin type: ${entryFile}`)
  }

  // 验证插件
  validatePlugin(manifest) {
    const required = ['id', 'name', 'version']
    
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Plugin manifest missing required field: ${field}`)
      }
    }

    // 版本格式验证
    if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
      throw new Error(`Invalid plugin version: ${manifest.version}`)
    }

    return true
  }

  // 获取已加载插件
  getLoadedPlugin(pluginId) {
    return this.loadedPlugins.get(pluginId)
  }

  // 获取所有已加载插件
  getAllLoadedPlugins() {
    return Array.from(this.loadedPlugins.values())
  }

  // 检查插件是否已加载
  isPluginLoaded(pluginId) {
    return this.loadedPlugins.has(pluginId)
  }
}

module.exports = PluginLoader
