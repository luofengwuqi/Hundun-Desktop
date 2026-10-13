/**
 * 平台支持检查 — plain node 单元测试 (不依赖 electron)
 *
 * 覆盖: checkPlatformSupport (打开前拦截) / validatePlatformsField (安装器校验)
 * 运行: node scripts/test-platform-support.js
 * 退出码: 0 = 全部通过, 1 = 有失败
 */
const path = require('path')

const { checkPlatformSupport, validatePlatformsField, describePlatform } = require(
  path.join(__dirname, '..', 'src', 'main', 'platform-support.js')
)

const results = []
const check = (name, ok, detail) => {
  results.push({ name, ok })
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok || detail === undefined ? '' : '  <- ' + detail))
}

// ---------- 1. checkPlatformSupport ----------
console.log('== 1. checkPlatformSupport ==')
const fastCmdManifest = require(path.join(__dirname, '..', 'plugins', 'fast-cmd', 'manifest.json'))

check('fast-cmd manifest 声明 platforms', Array.isArray(fastCmdManifest.platforms), JSON.stringify(fastCmdManifest.platforms))
check('Windows 上打开 fast-cmd → 支持', checkPlatformSupport(fastCmdManifest, 'win32') === null)
check('Linux 上打开 fast-cmd → 支持', checkPlatformSupport(fastCmdManifest, 'linux') === null)

const macErr = checkPlatformSupport(fastCmdManifest, 'darwin')
check('macOS 上打开 fast-cmd → 拦截', typeof macErr === 'string' && macErr.length > 0, String(macErr))
check('拦截信息含系统名与插件名', typeof macErr === 'string' && macErr.includes('macOS') && macErr.includes('FastCmd'), macErr)

check('未声明 platforms → 不限制 (darwin 也放行)', checkPlatformSupport({ id: 'x', name: 'X' }, 'darwin') === null)
check('manifest 为 null → 不限制', checkPlatformSupport(null, 'darwin') === null)
check('platforms 非法 (字符串) → 从宽放行', checkPlatformSupport({ platforms: 'linux' }, 'darwin') === null)
check('platforms 空数组 → 从宽放行', checkPlatformSupport({ platforms: [] }, 'darwin') === null)
check('未知系统标识 → 拦截', typeof checkPlatformSupport(fastCmdManifest, 'sunos') === 'string')

// ---------- 2. describePlatform ----------
console.log('== 2. describePlatform ==')
check('win32 → Windows', describePlatform('win32') === 'Windows')
check('linux → Linux', describePlatform('linux') === 'Linux')
check('darwin → macOS', describePlatform('darwin') === 'macOS')
check('未知平台 → 原样返回', describePlatform('haiku') === 'haiku')

// ---------- 3. validatePlatformsField (安装器校验) ----------
console.log('== 3. validatePlatformsField ==')
check('未提供 → 合法', validatePlatformsField(undefined) === null)
check('["win32","linux"] → 合法', validatePlatformsField(['win32', 'linux']) === null)
check('[] → 非法', typeof validatePlatformsField([]) === 'string')
check('字符串 → 非法', typeof validatePlatformsField('linux') === 'string')
check('未知标识 "mac" → 非法', typeof validatePlatformsField(['mac']) === 'string')
check('非字符串元素 → 非法', typeof validatePlatformsField([123]) === 'string')
check('fast-cmd manifest.platforms 通过安装器校验', validatePlatformsField(fastCmdManifest.platforms) === null)

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length === 0 ? 0 : 1)
