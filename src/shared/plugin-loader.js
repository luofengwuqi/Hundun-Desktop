const fs = require('fs')
const path = require('path')

class PluginLoader {
  constructor(pluginsDir) {
    this.pluginsDir = pluginsDir
    this.loadedPlugins = new Map()
  }

  // 扫描插件目录
  async scanPlugins() {
    const plugins = []
    
    try {
      const entries = fs.readdirSync(this.pluginsDir, { withFileTypes: true })
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginPath = path.join(this.pluginsDir, entry.name)
          const manifestPath = path.join(pluginPath, 'manifest.json')
          
          if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
            plugins.push({
              ...manifest,
              path: pluginPath,
              loaded: this.loadedPlugins.has(manifest.id)
            })
          }
        }
      }
    } catch (error) {
      console.error('Failed to scan plugins:', error)
    }
    
    return plugins
  }

  // 加载插件
  async loadPlugin(pluginId) {
    if (this.loadedPlugins.has(pluginId)) {
      return this.loadedPlugins.get(pluginId)
    }

    const pluginPath = path.join(this.pluginsDir, pluginId)
    const manifestPath = path.join(pluginPath, 'manifest.json')

    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    
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
