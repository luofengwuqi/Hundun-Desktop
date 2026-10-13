/**
 * 平台支持检查 (子程序"打开前"的系统状态检查)
 *
 * 背景 (决策42): 用户系统各异, 子程序不应在不支持的系统上被打开。
 * 约定: manifest.json 增加可选字段 `platforms` (如 ["win32", "linux"]),
 *       主进程在创建插件窗口之前调用 checkPlatformSupport() 拦截;
 *       字段缺失 = 不限制 (兼容历史插件与全平台插件)。
 *
 * 本模块零依赖 (不 require electron), 便于 plain node 单测。
 */

// Electron/Node 的 process.platform 取值 → 人类可读名
const OS_NAMES = {
  win32: 'Windows',
  darwin: 'macOS',
  linux: 'Linux',
  freebsd: 'FreeBSD',
  openbsd: 'OpenBSD',
  sunos: 'SunOS',
  aix: 'AIX',
}

// manifest.platforms 允许的取值 (当前仅支持 Windows / Linux)
const KNOWN_PLATFORMS = ['win32', 'darwin', 'linux']

/**
 * process.platform → 人类可读系统名
 * @param {string} platform
 * @returns {string}
 */
function describePlatform (platform) {
  return OS_NAMES[platform] || platform || '未知系统'
}

/**
 * 打开前检查: manifest 声明的平台是否包含当前系统
 * @param {Object|null} manifest 插件 manifest
 * @param {string} [platform=process.platform] 当前系统 (可注入便于测试)
 * @returns {string|null} null=支持; 字符串=不支持的友好错误信息
 */
function checkPlatformSupport (manifest, platform = process.platform) {
  const platforms = manifest && manifest.platforms
  // 字段缺失/非法 → 不限制 (安装器已校验新装包, 这里对历史/手改 manifest 从宽)
  if (platforms === undefined || platforms === null) return null
  if (!Array.isArray(platforms) || platforms.length === 0) {
    console.warn('[PlatformSupport] manifest.platforms 非法 (需非空数组), 忽略平台限制:', platforms)
    return null
  }
  if (platforms.includes(platform)) return null
  const name = (manifest && (manifest.name || manifest.id)) || '插件'
  return `插件 "${name}" 不支持当前系统 (${describePlatform(platform)}), 支持的系统: ${platforms.map(describePlatform).join(' / ')}`
}

/**
 * 安装器校验: manifest.platforms 字段格式
 * @param {*} platforms 字段值 (undefined = 未提供)
 * @returns {string|null} null=合法; 字符串=错误信息
 */
function validatePlatformsField (platforms) {
  if (platforms === undefined) return null
  if (!Array.isArray(platforms) || platforms.length === 0) {
    return 'manifest.json 字段 platforms 不合法: 需为非空字符串数组 (如 ["win32", "linux"])'
  }
  const invalid = platforms.filter((p) => typeof p !== 'string' || !KNOWN_PLATFORMS.includes(p))
  if (invalid.length > 0) {
    return `manifest.json 字段 platforms 不合法: ${JSON.stringify(invalid)} 不是受支持的平台标识, 仅允许 ${KNOWN_PLATFORMS.join(' / ')}`
  }
  return null
}

module.exports = {
  OS_NAMES,
  KNOWN_PLATFORMS,
  describePlatform,
  checkPlatformSupport,
  validatePlatformsField,
}
