/**
 * HundunDesktop - 主进程路径解析
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
 * 解析应用根目录
 *   - 开发态: 项目根目录
 *   - 打包态: exe 所在目录
 * 注: userData 目录请用 resolveUserDataDir (决策47, 含不可写回退), 本函数仅供便携模式参考。
 * @returns {string}
 */
function resolveAppRoot () {
  return app.isPackaged
    ? path.dirname(process.execPath)
    : path.join(__dirname, '..', '..')
}

// ========== 可写根决策 (决策47 原始 / 决策63 修订) ==========
// 决策63 修订原因: Windows per-user 安装 (默认 %LOCALAPPDATA%\Programs) 目录**可写**,
//   原逻辑因此判为便携模式 → 数据落 <安装目录>/user-data; 而 NSIS 卸载器执行
//   `RMDir /r $INSTDIR`, 覆盖安装 (升级) 也会先跑旧卸载器 → 数据随安装目录一起被删。
// 现策略:
//   - 开发态: 恒便携 (项目根/user-data), 行为不变
//   - Windows 打包态: **一律** 用 Electron 默认 userData (%APPDATA%\hundundesktop), 与安装位置无关
//   - 便携需求改为**显式开关**: 启动参数 `--portable` 或环境变量 HUNDUN_PORTABLE=1
//     (显式便携 = 用户自担"卸载会清空数据"的风险)
//   - Linux AppImage: execPath 是只读临时挂载 → 回退
//   - deb (/opt 归 root 不可写) → 试写探测失败 → 回退
const PORTABLE_ENV = 'HUNDUN_PORTABLE'

/** 是否显式要求便携模式 (--portable / HUNDUN_PORTABLE=1) */
function isPortableRequested (argv = process.argv, env = process.env) {
  if (String((env && env[PORTABLE_ENV]) || '') === '1') return true
  return (argv || []).some(a => a === '--portable' || a === '--portable-mode')
}

/**
 * 纯函数: 是否使用便携模式 (抽出来便于单测)
 * @param {{isPackaged?:boolean, platform?:string, isAppImage?:boolean,
 *          portableRequested?:boolean, installDirWritable?:boolean}} opts
 * @returns {boolean}
 */
function shouldUsePortableMode (opts) {
  const o = opts || {}
  if (!o.isPackaged) return true            // 开发态: 项目根/user-data (行为不变)
  if (o.portableRequested) return true      // 显式便携开关 (用户自担风险)
  if (o.platform === 'win32') return false  // 决策63: Windows 一律回落 %APPDATA%
  if (o.isAppImage) return false            // AppImage: execPath 只读挂载
  return !!o.installDirWritable             // deb 等: 安装目录不可写则回退
}

let _portableMode = null
function isPackagedPortableMode () {
  if (_portableMode !== null) return _portableMode
  _portableMode = shouldUsePortableMode({
    isPackaged: app.isPackaged,
    platform: process.platform,
    isAppImage: !!process.env.APPIMAGE,
    portableRequested: isPortableRequested(),
    installDirWritable: app.isPackaged ? canWriteDir(path.dirname(process.execPath)) : true
  })
  return _portableMode
}

/** 试写探测: mkdir + 写探针文件 + 删除 */
function canWriteDir (dir) {
  const probe = path.join(dir, `.write-probe-${process.pid}`)
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(probe, '1')
    fs.unlinkSync(probe)
    return true
  } catch (_) {
    return false
  }
}

/**
 * 解析应用可写根 (便携模式 = exe/项目目录; 回退模式 = Electron 默认 userData)
 * @returns {string}
 */
function resolveWritableRoot () {
  if (!app.isPackaged) return path.join(__dirname, '..', '..')
  return path.dirname(process.execPath)
}

/**
 * 解析 userData 目录 (决策47)
 *   - 开发态/便携模式: <可写根>/user-data (现行为)
 *   - 回退模式: Electron 默认 userData (Linux ~/.config/<name>, Windows %APPDATA%\<name>)
 * @returns {string}
 */
function resolveUserDataDir () {
  if (isPackagedPortableMode()) {
    return path.join(resolveWritableRoot(), 'user-data')
  }
  return app.getPath('userData') // setPath 前即为默认值, 直接采用
}

// ========== 决策63: 旧版数据迁移 (安装目录 → 系统 userData) ==========
// 旧版 Windows 把数据放在 <安装目录>/user-data; 新策略改落 %APPDATA%\hundundesktop。
// 首次启动时把遗留目录**补齐**到新位置 (已存在的文件不覆盖), 写标记避免重复。
// 原目录**不删** (数据安全优先, 由用户自行清理)。
const MIGRATION_MARKER = '.user-data-migrated-from-install-dir'

// 纯缓存/临时目录, 迁移时跳过 (体积大且无价值)
const MIGRATION_SKIP_DIRS = new Set([
  'Cache', 'Code Cache', 'GPUCache', 'DawnCache', 'DawnGraphiteCache',
  'DawnWebGPUCache', 'ShaderCache', 'GrShaderCache', 'Crashpad',
  'Dictionaries', 'blob_storage', 'gpu-cache'
])

/** 旧版遗留数据目录 (打包态 = exe 旁 user-data; 开发态无意义 → 空串) */
function legacyUserDataDir () {
  if (!app.isPackaged) return ''
  return path.join(path.dirname(process.execPath), 'user-data')
}

/**
 * 把旧版 <安装目录>/user-data 补齐到 targetDir (决策63)
 * @param {string} targetDir 新的 userData 目录
 * @param {{legacyDir?:string, log?:(msg:string)=>void}} [opts]
 * @returns {{migrated:boolean, copied:number, skipped:number, reason?:string}}
 */
function migrateLegacyUserData (targetDir, opts = {}) {
  const log = typeof opts.log === 'function' ? opts.log : () => {}
  const legacyDir = opts.legacyDir || legacyUserDataDir()
  if (!legacyDir) return { migrated: false, copied: 0, skipped: 0, reason: 'no-legacy-dir' }
  try {
    if (path.resolve(legacyDir) === path.resolve(String(targetDir || ''))) {
      return { migrated: false, copied: 0, skipped: 0, reason: 'same-dir' }
    }
  } catch (_) { /* resolve 失败忽略 */ }
  if (!legacyDir || !fs.existsSync(legacyDir)) {
    return { migrated: false, copied: 0, skipped: 0, reason: 'legacy-missing' }
  }
  if (fs.existsSync(path.join(targetDir, MIGRATION_MARKER))) {
    return { migrated: false, copied: 0, skipped: 0, reason: 'already-migrated' }
  }

  let copied = 0
  let skipped = 0
  let entries = []
  try {
    fs.mkdirSync(targetDir, { recursive: true })
    entries = fs.readdirSync(legacyDir)
  } catch (error) {
    return { migrated: false, copied: 0, skipped: 0, reason: 'unreadable:' + error.message }
  }

  for (const name of entries) {
    if (name === MIGRATION_MARKER) continue
    const src = path.join(legacyDir, name)
    const dest = path.join(targetDir, name)
    let isDir = false
    try { isDir = fs.statSync(src).isDirectory() } catch (_) { /* 视为文件 */ }
    if (isDir && MIGRATION_SKIP_DIRS.has(name)) { skipped++; continue }
    try {
      fs.cpSync(src, dest, { recursive: true, force: false, errorOnExist: false })
      copied++
    } catch (error) {
      // 单项失败不影响其它项 (常见: 旧版文件被占用/权限不足)
      log(`[Paths] 迁移失败 ${name}: ${error.message}`)
      skipped++
    }
  }

  try {
    fs.writeFileSync(path.join(targetDir, MIGRATION_MARKER),
      `migrated-from=${legacyDir}\nat=${new Date().toISOString()}\ncopied=${copied} skipped=${skipped}\n`)
  } catch (_) { /* 标记写失败不影响本次迁移结果 */ }

  log(`[Paths] 旧数据已迁移: ${legacyDir} → ${targetDir} (新增 ${copied} 项, 跳过 ${skipped} 项; 原目录保留)`)
  return { migrated: true, copied, skipped, legacyDir }
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
 * 用户安装插件的落盘目录（可写, 决策47）
 *   - 开发态/便携模式: <可写根>/plugins (现行为)
 *   - 回退模式: <Electron 默认 userData>/installed-plugins
 *     (与插件数据目录 <userData>/plugins/<id>/file 分离, 避免卸载删数据时误删代码)
 * 目录不存在时自动创建（写入失败由调用方处理）。
 * @returns {string}
 */
function resolveInstallPluginsDir () {
  const dir = isPackagedPortableMode()
    ? path.join(resolveWritableRoot(), 'plugins')
    : path.join(app.getPath('userData'), 'installed-plugins')
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
  resolveUserDataDir,
  resolveWritableRoot,
  isPackagedPortableMode,
  canWriteDir,
  // 决策63: 便携模式判定 + 旧数据迁移
  PORTABLE_ENV,
  MIGRATION_MARKER,
  MIGRATION_SKIP_DIRS,
  isPortableRequested,
  shouldUsePortableMode,
  legacyUserDataDir,
  migrateLegacyUserData,
  MAIN_PRELOAD,
  PLUGIN_PRELOAD
}
