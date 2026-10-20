/**
 * HundunDesktop - 本地插件安装器
 *
 * 职责:
 *   1. pickZipFile()      — 打开系统文件资源管理器，让用户选择 .zip 插件包
 *   2. installFromZip()   — 解压 → 校验插件架构 → 落盘到可写插件目录 → 返回插件信息
 *
 * 设计要点:
 *   - 不依赖任何第三方解压库 (生产包 files 不含 node_modules，运行时 require 不到第三方包)，
 *     因此基于 Node 内置 zlib 自行解析 ZIP 中央目录。
 *   - 校验规则对齐 docs/PLUGIN_SPEC.md 第三章 manifest.json 规范。
 *   - 安全防护: zip slip 路径穿越 / 加密包 / ZIP64 / 解压炸弹(体积与条目上限) / CRC32 校验。
 *   - 落盘目录: 开发态 = 项目根/plugins, 打包态 = exe 目录/plugins (asar 只读，不能写入内置目录)。
 *   - 已安装记录: userData/installed-plugins.json，用于区分"内置插件(不可覆盖)"与
 *     "本工具安装的插件(允许覆盖升级)"。
 */

const { dialog, app } = require('electron')
const fs = require('fs')
const path = require('path')
const os = require('os')
const zlib = require('zlib')
const { resolvePluginsDirs, resolveInstallPluginsDir } = require('./paths')
const { validatePlatformsField } = require('./platform-support')
const { getDatabase } = require('./database')

// ========== 限制（防解压炸弹） ==========
const MAX_ENTRIES = 5000              // 最大文件数
const MAX_ENTRY_SIZE = 64 * 1024 * 1024      // 单文件最大 64MB
const MAX_TOTAL_SIZE = 200 * 1024 * 1024     // 解压后总大小最大 200MB

// ========== 校验规则 (对齐 docs/PLUGIN_SPEC.md) ==========
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/     // 小写字母 / 数字 / 连字符
const SEMVER_RE = /^\d+\.\d+\.\d+$/
const COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const NAME_MAX = 32
const WINDOW_MIN = 200
const WINDOW_MAX = 4000

// ZIP 常量
const SIG_EOCD = 0x06054b50        // End Of Central Directory
const SIG_CENTRAL = 0x02014b50    // Central directory file header
const SIG_LOCAL = 0x04034b50      // Local file header

// ========== CRC32 ==========
let crcTable = null
function getCrcTable () {
  if (crcTable) return crcTable
  crcTable = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    crcTable[n] = c
  }
  return crcTable
}

function crc32 (buf) {
  const table = getCrcTable()
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

// ========== 文本解码 (兼容常见编辑器写出的编码) ==========

/**
 * 把文件字节解码成字符串，兼容:
 *   - UTF-8 (带/不带 BOM)
 *   - UTF-16 LE / BE (记事本另存为的常见结果)
 *   - GBK (中文 Windows 记事本 ANSI 默认编码)
 * @param {Buffer} buf
 * @returns {string}
 */
function decodeTextBuffer (buf) {
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

  // UTF-8 解码出现替换字符 → 疑似 GBK，尝试回退解码
  if (text.indexOf('\uFFFD') !== -1) {
    try {
      const gbk = new TextDecoder('gbk').decode(buf)
      if (gbk.indexOf('\uFFFD') === -1) return gbk
    } catch (_) { /* 不支持 gbk 时保持 utf8 结果 */ }
  }
  return text
}

/**
 * 读取并解析 JSON 文件 (自动处理编码/BOM)
 */
function readJsonFile (filePath) {
  return JSON.parse(decodeTextBuffer(fs.readFileSync(filePath)))
}

// ========== ZIP 解析 ==========

/**
 * 解析 ZIP 中央目录，返回条目列表
 * @param {Buffer} buf
 * @returns {{entries: Array, buf: Buffer}}
 */
function parseZip (buf) {
  if (!buf || buf.length < 22) {
    throw new Error('文件内容为空或已损坏')
  }

  // 从尾部回溯查找 EOCD 签名 (考虑最长 64KB 的注释)
  let eocdOffset = -1
  const scanStart = Math.max(0, buf.length - 22 - 0xffff)
  for (let i = buf.length - 22; i >= scanStart; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) {
      eocdOffset = i
      break
    }
  }
  if (eocdOffset < 0) {
    throw new Error('不是有效的 .zip 文件 (未找到目录结束标记)，请确认文件未损坏')
  }

  const totalEntries = buf.readUInt16LE(eocdOffset + 10)
  const cdSize = buf.readUInt32LE(eocdOffset + 12)
  const cdOffset = buf.readUInt32LE(eocdOffset + 16)

  // ZIP64 标记
  if (totalEntries === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    throw new Error('暂不支持 ZIP64 大型压缩包，请使用普通 zip 打包插件目录')
  }
  if (cdOffset + cdSize > buf.length) {
    throw new Error('压缩包中央目录越界，文件已损坏')
  }
  if (totalEntries > MAX_ENTRIES) {
    throw new Error(`压缩包文件数量过多 (${totalEntries} > ${MAX_ENTRIES})`)
  }

  const entries = []
  let p = cdOffset
  for (let i = 0; i < totalEntries; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== SIG_CENTRAL) {
      throw new Error('压缩包中央目录损坏，无法读取文件清单')
    }
    const flags = buf.readUInt16LE(p + 8)
    const method = buf.readUInt16LE(p + 10)
    const crc = buf.readUInt32LE(p + 16)
    const compressedSize = buf.readUInt32LE(p + 20)
    const uncompressedSize = buf.readUInt32LE(p + 24)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const localOffset = buf.readUInt32LE(p + 42)
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8')

    entries.push({ name, flags, method, crc, compressedSize, uncompressedSize, localOffset })
    p += 46 + nameLen + extraLen + commentLen
    if (p > buf.length) throw new Error('压缩包中央目录损坏 (条目越界)')
  }

  return { buf, entries }
}

/**
 * 解出单个条目的内容 (store / deflate)
 */
function readEntry (buf, entry) {
  if (entry.flags & 0x1) {
    throw new Error('压缩包已加密，无法安装，请重新打包为非加密 zip')
  }

  const off = entry.localOffset
  if (off + 30 > buf.length || buf.readUInt32LE(off) !== SIG_LOCAL) {
    throw new Error(`压缩包条目损坏: ${entry.name}`)
  }
  const nameLen = buf.readUInt16LE(off + 26)
  const extraLen = buf.readUInt16LE(off + 28)
  const dataStart = off + 30 + nameLen + extraLen
  const dataEnd = dataStart + entry.compressedSize
  if (dataEnd > buf.length) {
    throw new Error(`压缩包条目数据越界: ${entry.name}`)
  }
  const raw = buf.slice(dataStart, dataEnd)

  let out
  if (entry.method === 0) {
    out = raw
  } else if (entry.method === 8) {
    try {
      out = zlib.inflateRawSync(raw)
    } catch (error) {
      throw new Error(`解压失败 (文件可能已损坏): ${entry.name}`)
    }
  } else {
    throw new Error(`不支持的压缩方式 (${entry.method}): ${entry.name}`)
  }

  // 体积上限 (解压炸弹防护)
  if (out.length > MAX_ENTRY_SIZE) {
    throw new Error(`单个文件过大 (${entry.name})，超过 ${MAX_ENTRY_SIZE / 1024 / 1024}MB 限制`)
  }
  // 完整性校验
  if (entry.uncompressedSize && out.length !== entry.uncompressedSize) {
    throw new Error(`文件长度与压缩包记录不一致: ${entry.name}`)
  }
  if (crc32(out) >>> 0 !== entry.crc) {
    throw new Error(`文件校验失败 (CRC 不匹配): ${entry.name}`)
  }

  return out
}

/**
 * 将压缩包内容安全解压到 staging 目录
 * 防护: 绝对路径 / 盘符路径 / `..` 穿越 / 符号链接式命名
 */
function extractZipTo (zipPath, destDir) {
  const buf = fs.readFileSync(zipPath)
  const { entries } = parseZip(buf)

  let totalWritten = 0
  for (const entry of entries) {
    const name = entry.name.replace(/\\/g, '/')

    // 跳过目录条目与系统垃圾文件
    if (name.endsWith('/')) continue
    if (name.startsWith('__MACOSX/') || name.split('/').pop().startsWith('._')) continue

    if (name.startsWith('/') || /^[a-zA-Z]:/.test(name) || name.split('/').some(seg => seg === '..')) {
      throw new Error(`压缩包含非法路径，已拒绝安装: ${entry.name}`)
    }

    const relParts = name.split('/').filter(seg => seg && seg !== '.')
    if (relParts.length === 0) continue

    const target = path.join(destDir, ...relParts)
    const rel = path.relative(destDir, target)
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(`压缩包含非法路径，已拒绝安装: ${entry.name}`)
    }

    const data = readEntry(buf, entry)
    totalWritten += data.length
    if (totalWritten > MAX_TOTAL_SIZE) {
      throw new Error(`解压后体积过大 (超过 ${MAX_TOTAL_SIZE / 1024 / 1024}MB)，已中止安装`)
    }

    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, data)
  }

  if (entries.length === 0) {
    throw new Error('压缩包为空')
  }
}

/**
 * 定位插件根目录 (压缩包根 或 唯一的一层子目录)
 * 兼容 "整个文件夹打包" 与 "进入目录后选中文件打包" 两种常见操作
 */
function findPluginRoot (stageDir) {
  if (fs.existsSync(path.join(stageDir, 'manifest.json'))) return stageDir

  const subDirs = fs.readdirSync(stageDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== '__MACOSX')

  for (const sub of subDirs) {
    const candidate = path.join(stageDir, sub.name)
    if (fs.existsSync(path.join(candidate, 'manifest.json'))) return candidate
  }
  return null
}

/**
 * 校验 manifest 是否符合插件架构规范
 * @returns {string|null} 错误信息，通过校验返回 null
 */
function validateManifest (manifest, pluginRoot) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return 'manifest.json 必须是一个 JSON 对象'
  }

  // id
  if (typeof manifest.id !== 'string' || !manifest.id.trim()) {
    return 'manifest.json 缺少必需字段: id (插件唯一标识)'
  }
  if (!ID_RE.test(manifest.id)) {
    return `插件 id "${manifest.id}" 不合法: 仅允许小写字母、数字、连字符，且以字母或数字开头 (最长 64 字符)`
  }

  // name
  if (typeof manifest.name !== 'string' || !manifest.name.trim()) {
    return 'manifest.json 缺少必需字段: name (显示名称)'
  }
  if (manifest.name.length > NAME_MAX) {
    return `插件 name 过长 (${manifest.name.length} 字符)，请控制在 ${NAME_MAX} 字符以内`
  }

  // version
  if (typeof manifest.version !== 'string' || !SEMVER_RE.test(manifest.version)) {
    return `插件 version 不合法: "${manifest.version}"，必须为语义化版本号 (如 1.0.0)`
  }

  // entry (默认 index.html)，且必须真实存在
  const entry = typeof manifest.entry === 'string' && manifest.entry.trim() ? manifest.entry : 'index.html'
  if (entry.startsWith('/') || /^[a-zA-Z]:/.test(entry) || entry.split(/[/\\]/).some(s => s === '..')) {
    return `entry 路径非法: ${entry}`
  }
  const entryPath = path.join(pluginRoot, ...entry.split(/[/\\]/))
  if (!fs.existsSync(entryPath) || !fs.statSync(entryPath).isFile()) {
    return `入口文件不存在: ${entry} (压缩包内缺少该文件)`
  }
  const entryExt = path.extname(entryPath).toLowerCase()
  if (entryExt !== '.html' && entryExt !== '.js') {
    return `入口文件类型不支持: ${entryExt || '(无扩展名)'}，仅支持 .html / .js`
  }

  // 可选字段类型检查
  for (const field of ['description', 'icon', 'author']) {
    if (manifest[field] !== undefined && typeof manifest[field] !== 'string') {
      return `manifest.json 字段 ${field} 必须是字符串`
    }
  }
  if (manifest.color !== undefined && (typeof manifest.color !== 'string' || !COLOR_RE.test(manifest.color))) {
    return `manifest.json 字段 color 不合法: "${manifest.color}"，必须是 hex 颜色 (如 #00ff88)`
  }
  if (manifest.permissions !== undefined) {
    if (!Array.isArray(manifest.permissions) || manifest.permissions.some(p => typeof p !== 'string')) {
      return 'manifest.json 字段 permissions 必须是字符串数组'
    }
  }
  if (manifest.windowSize !== undefined) {
    const ws = manifest.windowSize
    const ok = ws && typeof ws === 'object' &&
      Number.isFinite(Number(ws.width)) && Number.isFinite(Number(ws.height)) &&
      Number(ws.width) >= WINDOW_MIN && Number(ws.width) <= WINDOW_MAX &&
      Number(ws.height) >= WINDOW_MIN && Number(ws.height) <= WINDOW_MAX
    if (!ok) {
      return `manifest.json 字段 windowSize 不合法: 宽高需为 ${WINDOW_MIN}~${WINDOW_MAX} 之间的数字`
    }
  }
  if (manifest.minAppVersion !== undefined && (typeof manifest.minAppVersion !== 'string' || !SEMVER_RE.test(manifest.minAppVersion))) {
    return `manifest.json 字段 minAppVersion 不合法: "${manifest.minAppVersion}"`
  }

  // 可选: 支持的平台列表 (打开前的系统状态检查依据, 见 platform-support.js)
  const platformsErr = validatePlatformsField(manifest.platforms)
  if (platformsErr) return platformsErr

  return null
}

// ========== 已安装记录 ==========

function registryPath () {
  return path.join(app.getPath('userData'), 'installed-plugins.json')
}

function loadRegistry () {
  try {
    const file = registryPath()
    if (!fs.existsSync(file)) return {}
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'))
    return data && typeof data === 'object' ? data : {}
  } catch (error) {
    console.warn('[PluginInstaller] Failed to read registry:', error.message)
    return {}
  }
}

function saveRegistry (registry) {
  try {
    const file = registryPath()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = file + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(registry, null, 2), 'utf-8')
    fs.renameSync(tmp, file)
  } catch (error) {
    // 记录失败不影响本次安装，仅影响后续覆盖升级判断
    console.warn('[PluginInstaller] Failed to write registry:', error.message)
  }
}

// ========== 对外接口 ==========

/**
 * 打开文件资源管理器选择 .zip 插件包
 * @param {Electron.BrowserWindow} [browserWindow]
 * @returns {Promise<string|null>} 选中的文件路径，用户取消返回 null
 */
async function pickZipFile (browserWindow) {
  const options = {
    title: '选择插件压缩包',
    buttonLabel: '安装',
    properties: ['openFile'],
    filters: [
      { name: '插件压缩包', extensions: ['zip'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  }

  const win = browserWindow && !browserWindow.isDestroyed() ? browserWindow : null
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

/**
 * 安装 .zip 插件包
 * @param {string} zipPath
 * @returns {Promise<{success: boolean, plugin?: Object, error?: string}>}
 */
async function installFromZip (zipPath) {
  let stageDir = null
  try {
    if (!zipPath || typeof zipPath !== 'string') {
      return { success: false, error: '未选择文件' }
    }
    if (!/\.zip$/i.test(zipPath)) {
      return { success: false, error: '仅支持 .zip 格式的插件包' }
    }
    if (!fs.existsSync(zipPath)) {
      return { success: false, error: '文件不存在或无法访问' }
    }

    // 1. 解压到临时目录
    stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hundundesktop-install-'))
    extractZipTo(zipPath, stageDir)

    // 2. 定位插件根目录
    const pluginRoot = findPluginRoot(stageDir)
    if (!pluginRoot) {
      return { success: false, error: '未找到 manifest.json，不符合插件架构规范' }
    }

    // 3. 解析并校验 manifest
    let manifest
    try {
      manifest = readJsonFile(path.join(pluginRoot, 'manifest.json'))
    } catch (error) {
      return { success: false, error: `manifest.json 解析失败: ${error.message}` }
    }

    const invalid = validateManifest(manifest, pluginRoot)
    if (invalid) {
      return { success: false, error: invalid }
    }

    // 4. 冲突检查：内置插件不可覆盖；本工具安装过的允许覆盖升级
    const registry = loadRegistry()
    const installDir = resolveInstallPluginsDir()
    const conflictDir = resolvePluginsDirs()
      .map(dir => path.join(dir, manifest.id))
      .find(dir => fs.existsSync(dir))

    if (conflictDir) {
      if (registry[manifest.id]) {
        // 覆盖升级：删除旧版本后重新落盘
        fs.rmSync(conflictDir, { recursive: true, force: true })
      } else {
        return {
          success: false,
          error: `已存在 ID 为 "${manifest.id}" 的插件 (内置或手动放置)，无法重复安装`
        }
      }
    }

    // 5. 落盘到用户插件目录
    const target = path.join(installDir, manifest.id)
    try {
      fs.cpSync(pluginRoot, target, { recursive: true })
    } catch (error) {
      return {
        success: false,
        error: `无法写入插件目录 (请确认安装位置可写): ${error.message}`
      }
    }

    // 6. 记录已安装插件
    registry[manifest.id] = {
      name: manifest.name,
      version: manifest.version,
      installedAt: new Date().toISOString()
    }
    saveRegistry(registry)

    console.log(`[PluginInstaller] Installed: ${manifest.id}@${manifest.version} -> ${target}`)

    return {
      success: true,
      plugin: {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description || '',
        icon: manifest.icon || '📦',
        color: manifest.color || '#00ff88',
        windowSize: manifest.windowSize || { width: 400, height: 400 },
        path: target
      }
    }
  } catch (error) {
    console.error('[PluginInstaller] Install failed:', error)
    return { success: false, error: error.message || String(error) }
  } finally {
    if (stageDir) {
      try {
        fs.rmSync(stageDir, { recursive: true, force: true })
      } catch (_) { /* 临时目录清理失败可忽略 */ }
    }
  }
}

/**
 * 卸载插件 (设置页·插件删除, 决策46)
 *
 * 规则:
 *   - installed (installed-plugins.json 有记录): 删除安装目录 + 移除记录 (真卸载)
 *   - 内置/手动放置 (无记录): **不删插件目录** (app 自带文件/源码), 返回 builtin=true,
 *     由渲染层"已移除名单"负责隐藏 (挡 DEFAULT_PLUGINS/磁盘扫描回灌)
 *   - removeData: 删除 userData 数据 — user-data/plugins/<id>/ 目录
 *     + user-data/hundundesktop-data/<id>.json (Database 清缓存+删文件)
 *   - 插件自身 localStorage 键 (*-theme/locale) 无法按插件定位, 不处理 (文档已知取舍)
 *
 * @param {string} pluginId
 * @param {{ removeData?: boolean }} options
 * @returns {{success: boolean, builtin?: boolean, removedDir?: boolean, removedData?: boolean, error?: string}}
 */
function uninstallPlugin (pluginId, { removeData = false } = {}) {
  try {
    if (typeof pluginId !== 'string' || !ID_RE.test(pluginId)) {
      return { success: false, error: `插件 id 不合法: ${pluginId}` }
    }

    const registry = loadRegistry()
    const installed = !!registry[pluginId]
    let removedDir = false

    if (installed) {
      const installDir = resolveInstallPluginsDir()
      const target = path.resolve(path.join(installDir, pluginId))
      // 越界防护: 删除目标必须落在用户安装目录内
      if (target !== path.resolve(installDir) && !target.startsWith(path.resolve(installDir) + path.sep)) {
        return { success: false, error: '卸载路径越界，已中止' }
      }
      if (fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true })
      }
      delete registry[pluginId]
      saveRegistry(registry)
      removedDir = true
    }

    let removedData = false
    if (removeData) {
      // 文件系统数据目录 (fast-txt/fast-cmd 文档等): user-data/plugins/<id>/
      const dataDir = path.join(app.getPath('userData'), 'plugins', pluginId)
      if (fs.existsSync(dataDir)) {
        fs.rmSync(dataDir, { recursive: true, force: true })
      }
      // JSON 存储 (hundun.storage → hundundesktop-data/<id>.json): 清内存缓存 + 删文件
      try {
        getDatabase().deleteAll(pluginId)
      } catch (e) {
        console.warn('[PluginInstaller] deleteAll data failed:', e.message)
      }
      removedData = true
    }

    console.log(`[PluginInstaller] Uninstalled: ${pluginId} (builtin=${!installed}, dir=${removedDir}, data=${removedData})`)
    return { success: true, builtin: !installed, removedDir, removedData }
  } catch (error) {
    console.error('[PluginInstaller] Uninstall failed:', error)
    return { success: false, error: error.message || String(error) }
  }
}

module.exports = { pickZipFile, installFromZip, uninstallPlugin }
