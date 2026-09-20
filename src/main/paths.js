/**
 * Hundun Lite - 主进程路径解析
 *
 * 开发态与打包态的项目根目录不同：
 *   - 开发态: __dirname === <root>/out/main  → 根目录 = __dirname/../..
 *   - 打包态: __dirname === <app>/out/main   → 但 plugins/ 通过 electron-builder
 *             extraResources 放在 process.resourcesPath 下，不在 app.asar 内，
 *             所以必须单独解析（asar 是只读的，插件数据目录需要可写）。
 *
 * 不要在这些路径上硬编码 __dirname 相对层级。
 */

const path = require('path')
const fs = require('fs')
const { app } = require('electron')

/**
 * 解析 plugins/ 目录
 * 开发态: 项目根目录下；打包态: resources/plugins
 * @returns {string} plugins 目录绝对路径
 */
function resolvePluginsDir () {
  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, 'plugins'),
        path.join(app.getAppPath(), 'plugins')
      ]
    : [
        path.join(__dirname, '..', '..', 'plugins')
      ]

  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir
  }

  // 都不存在时返回首个候选，让上层报"插件不存在"而不是崩溃
  return candidates[0]
}

/**
 * 单个插件目录
 * @param {string} pluginId
 * @returns {string}
 */
function resolvePluginDir (pluginId) {
  return path.join(resolvePluginsDir(), pluginId || 'fast-txt')
}

/**
 * 插件数据目录（插件目录下的 file/，需要可写）
 * 注：仍位于插件目录内，打包态指向 resources/plugins/<id>/file/。
 *     迁移到 userData 属于后续阶段，此处仅保证两种模式都能正确解析。
 * @param {string} pluginId
 * @returns {string}
 */
function resolvePluginDataDir (pluginId) {
  const dir = path.join(resolvePluginDir(pluginId), 'file')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

/** 主窗口 preload（与主进程同目录，见 electron.vite.config.js 的 preload.outDir） */
const MAIN_PRELOAD = path.join(__dirname, 'preload.js')

/** 插件窗口 preload（同上） */
const PLUGIN_PRELOAD = path.join(__dirname, 'plugin-preload.js')

module.exports = {
  resolvePluginsDir,
  resolvePluginDir,
  resolvePluginDataDir,
  MAIN_PRELOAD,
  PLUGIN_PRELOAD
}
