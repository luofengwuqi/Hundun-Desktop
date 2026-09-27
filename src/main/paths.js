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
 * 解析应用根目录（可写）
 *   - 开发态: 项目根目录
 *   - 打包态: exe 所在目录
 * 与 src/main/index.js 中的 appRoot 逻辑保持一致。
 * @returns {string}
 */
function resolveAppRoot () {
  return app.isPackaged
    ? path.dirname(process.execPath)
    : path.join(__dirname, '..', '..')
}

/**
 * 解析所有需要扫描的插件目录（内置 + 用户安装）
 *
 * 顺序即优先级：内置插件在前（只读，随程序分发），用户安装目录在后（可写）。
 * 开发态下两者指向同一个目录，自动去重。
 * @returns {string[]} 绝对路径数组
 */
function resolvePluginsDirs () {
  const builtinDirs = app.isPackaged
    ? [
        path.join(app.getAppPath(), 'plugins'),       // app.asar/plugins (只读)
        path.join(process.resourcesPath, 'plugins')   // resources/plugins (备用)
      ]
    : [
        path.join(__dirname, '..', '..', 'plugins')   // 项目根/plugins
      ]

  const installDir = resolveInstallPluginsDir()

  const dirs = []
  for (const dir of [...builtinDirs, installDir]) {
    if (!dirs.includes(dir)) dirs.push(dir)
  }
  return dirs
}

/**
 * 用户安装插件的落盘目录（可写）
 * 开发态: 项目根/plugins；打包态: exe 目录/plugins
 * 目录不存在时自动创建（写入失败由调用方处理）。
 * @returns {string}
 */
function resolveInstallPluginsDir () {
  const dir = path.join(resolveAppRoot(), 'plugins')
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  } catch (error) {
    // 目录创建失败（如安装在只读位置）时仍返回路径，由安装流程给出友好错误
    console.warn('[Paths] Failed to create install plugins dir:', dir, error.message)
  }
  return dir
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
  resolveAppRoot,
  resolvePluginsDir,
  resolvePluginsDirs,
  resolveInstallPluginsDir,
  resolvePluginDir,
  resolvePluginDataDir,
  MAIN_PRELOAD,
  PLUGIN_PRELOAD
}
