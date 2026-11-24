/**
 * HundunDesktop - 应用设置持久化 (决策66)
 *
 * 背景: 应用设置(主题/语言/音效/插件排序与移除名单)一直存在 Chromium 的
 *       localStorage 里 —— 落点是 `<userData>/Local Storage/leveldb/`, 那是
 *       引擎内部格式: 换 Electron 大版本可能变结构、用户无法直接查看/备份、
 *       也无法纳入"用户数据同步"(子程序数据都在 user-data 下的 JSON)。
 *
 * 现策略: 统一存 `<userData>/settings.json`, 与子程序数据
 *       `hundundesktop-data/<pluginId>.json` 同级、同风格 (纯 JSON + 原子写)。
 *
 * 三条硬约束 (数据安全优先):
 *   1. 只补不覆盖 —— 文件不存在时**不主动创建**、不写默认值; 调用方拿 fallback,
 *      真正发生用户操作(改主题/改音量)时才落盘。
 *   2. 坏文件不覆盖 —— 解析失败时把原文件改名留存 (settings.corrupt-<ts>.json),
 *      然后以空数据继续; 绝不在坏文件上直接写。
 *   3. 原子写 —— 临时文件 + rename, 断电/崩溃不会留下半截 JSON。
 *
 * 本模块不 require electron (用 filePath 注入), 便于 scripts/ 下纯 Node 单测;
 * 需要单例时调用 getSettingsStore(), 它在内部才去取 app.getPath('userData')。
 */

const fs = require('fs')
const path = require('path')

const SETTINGS_FILENAME = 'settings.json'
const SCHEMA_VERSION = 1

// ========== 键白名单 ==========
// 渲染层只能写这些路径, 未列出的一律拒绝 —— 防止任意结构/垃圾数据写进用户配置。
const NORMALIZERS = {
  theme: (v) => normalizeString(v),
  locale: (v) => (v === 'zh' || v === 'en' ? v : undefined),

  'sound.soundEnabled': (v) => (typeof v === 'boolean' ? v : undefined),
  'sound.volume': (v) => {
    const n = Number(v)
    if (!Number.isFinite(n)) return undefined
    return Math.max(0, Math.min(100, Math.round(n)))
  },
  sound: (v) => {
    if (!v || typeof v !== 'object') return undefined
    const out = {}
    const enabled = NORMALIZERS['sound.soundEnabled'](v.soundEnabled)
    if (enabled !== undefined) out.soundEnabled = enabled
    const volume = NORMALIZERS['sound.volume'](v.volume)
    if (volume !== undefined) out.volume = volume
    return Object.keys(out).length ? out : undefined
  },

  'plugins.order': (v) => normalizePluginOrder(v),
  'plugins.orderVersion': (v) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined
  },
  'plugins.removed': (v) => normalizeRemovedRecords(v),
  plugins: (v) => {
    if (!v || typeof v !== 'object') return undefined
    const out = {}
    const order = normalizePluginOrder(v.order)
    if (order !== undefined) out.order = order
    const version = NORMALIZERS['plugins.orderVersion'](v.orderVersion)
    if (version !== undefined) out.orderVersion = version
    const removed = normalizeRemovedRecords(v.removed)
    if (removed !== undefined) out.removed = removed
    return Object.keys(out).length ? out : undefined
  },

  // 迁移痕迹/说明性字段 (只写不读业务逻辑)
  meta: (v) => (v && typeof v === 'object' && !Array.isArray(v) ? { ...v } : undefined)
}

const ALLOWED_PATHS = Object.keys(NORMALIZERS)

const MAX_STRING = 120

function normalizeString (v) {
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  if (!s || s.length > MAX_STRING) return undefined
  return s
}

/**
 * 插件顺序数组: [{id, enabled, customSettings}]
 * 顺序即显示顺序 (决策46), 故保留数组形态; 非法项丢弃而不整组拒绝。
 */
function normalizePluginOrder (v) {
  if (!Array.isArray(v)) return undefined
  const out = []
  const seen = new Set()
  for (const item of v) {
    if (!item || typeof item.id !== 'string') continue
    const id = item.id.trim()
    if (!id || id.length > MAX_STRING || seen.has(id)) continue
    seen.add(id)
    const entry = { id }
    if (typeof item.enabled === 'boolean') entry.enabled = item.enabled
    if (item.customSettings && typeof item.customSettings === 'object') {
      entry.customSettings = item.customSettings
    }
    out.push(entry)
  }
  return out
}

/** 已移除插件名单: [{id, name, icon, version, removedAt}] (只要求 id 合法) */
function normalizeRemovedRecords (v) {
  if (!Array.isArray(v)) return undefined
  const out = []
  for (const item of v) {
    if (!item || typeof item.id !== 'string' || !item.id.trim()) continue
    out.push({ ...item, id: item.id.trim() })
  }
  return out
}

// ========== 点路径读写 (只处理普通对象) ==========
function getIn (obj, dotted) {
  if (!obj || typeof obj !== 'object') return undefined
  const parts = String(dotted).split('.')
  let cur = obj
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = cur[p]
  }
  return cur
}

/** 返回新对象 (不可变更新, 便于比较是否有变化) */
function setIn (obj, dotted, value) {
  const parts = String(dotted).split('.')
  const clone = Array.isArray(obj) ? obj.slice() : { ...(obj || {}) }
  let cur = clone
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    const next = cur[key]
    cur[key] = next && typeof next === 'object' && !Array.isArray(next) ? { ...next } : {}
    cur = cur[key]
  }
  cur[parts[parts.length - 1]] = value
  return clone
}

function deleteIn (obj, dotted) {
  const parts = String(dotted).split('.')
  if (parts.length === 1) {
    const clone = { ...(obj || {}) }
    delete clone[parts[0]]
    return clone
  }
  const parentPath = parts.slice(0, -1).join('.')
  const parent = getIn(obj, parentPath)
  if (!parent || typeof parent !== 'object') return obj
  const clone = setIn(obj, parentPath, { ...parent })
  delete getIn(clone, parentPath)[parts[parts.length - 1]]
  return clone
}

function deepClone (value) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch (_) {
    return {}
  }
}

function isPlainObject (v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

class SettingsStore {
  /**
   * @param {string} filePath settings.json 绝对路径
   */
  constructor (filePath) {
    if (typeof filePath !== 'string' || !filePath) {
      throw new TypeError('SettingsStore 需要 settings.json 的绝对路径')
    }
    this.filePath = filePath
    this._data = null            // 懒加载缓存 (null = 还没读过盘)
    this._schema = SCHEMA_VERSION // 读到的文件 schema (更新版本写的文件保持原值, 不回写降级)
    this._loadError = null       // 读盘/解析失败原因 (供设置页提示)
    this._quarantined = null     // 坏文件被改名的落点
    this.onChange = null         // (snapshot) => void, 每次真的写盘后回调
  }

  // ---------- 读 ----------

  /**
   * 整份快照 (深拷贝, 调用方可随意改)
   * @returns {Object}
   */
  snapshot () {
    this._ensureLoaded()
    return deepClone(this._data)
  }

  /**
   * 读单个路径
   * @param {string} dotted 例 'theme' / 'sound.volume' / 'plugins.order'
   * @param {*} [fallback] 缺失时返回 (不会被持久化)
   */
  get (dotted, fallback = null) {
    this._ensureLoaded()
    const value = getIn(this._data, dotted)
    return value === undefined ? fallback : value
  }

  /** 是否存在该路径 (区别于"存在但为 null") */
  has (dotted) {
    this._ensureLoaded()
    return getIn(this._data, dotted) !== undefined
  }

  /** 读盘错误信息 (无错为 null) */
  lastError () {
    this._ensureLoaded()
    return this._loadError
  }

  // ---------- 写 ----------

  /**
   * 写单个路径 (校验 → 合并 → 原子写)
   * @param {string} dotted 必须在白名单内
   * @param {*} value
   * @returns {{ok:boolean, changed?:boolean, reason?:string}}
   */
  set (dotted, value) {
    const path_ = String(dotted || '')
    const normalize = NORMALIZERS[path_]
    if (!normalize) return { ok: false, reason: 'path-not-allowed' }

    const normalized = normalize(value)
    if (normalized === undefined) return { ok: false, reason: 'invalid-value' }

    this._ensureLoaded()
    if (JSON.stringify(getIn(this._data, path_)) === JSON.stringify(normalized)) {
      return { ok: true, changed: false }
    }
    this._data = setIn(this._data, path_, normalized)
    return this._commit()
  }

  /**
   * 批量写 (一次落盘)
   * @param {Object<string, *>} patch { path: value }
   * @returns {{ok:boolean, changed?:boolean, rejected?:string[]}}
   */
  setMany (patch) {
    if (!isPlainObject(patch)) return { ok: false, reason: 'invalid-patch' }
    this._ensureLoaded()
    let next = this._data
    const rejected = []
    for (const [dotted, value] of Object.entries(patch)) {
      const normalize = NORMALIZERS[dotted]
      if (!normalize) { rejected.push(dotted); continue }
      const normalized = normalize(value)
      if (normalized === undefined) { rejected.push(dotted); continue }
      next = setIn(next, dotted, normalized)
    }
    const changed = JSON.stringify(next) !== JSON.stringify(this._data)
    const result = { ok: true, changed }
    if (rejected.length) result.rejected = rejected
    if (!changed) return result
    this._data = next
    return Object.assign(this._commit(), result)
  }

  /** 删除单个路径 (存在的意义: 让"没设置过"和"设成 null"可区分) */
  remove (dotted) {
    this._ensureLoaded()
    if (getIn(this._data, dotted) === undefined) return { ok: true, changed: false }
    this._data = deleteIn(this._data, dotted)
    return this._commit()
  }

  /** 丢弃缓存, 下次访问重新读盘 (跨进程手工改了文件时用) */
  reload () {
    this._data = null
    this._loadError = null
    this._ensureLoaded()
    return this.snapshot()
  }

  // ---------- 内部 ----------

  _ensureLoaded () {
    if (this._data !== null) return
    this._data = {}
    this._loadError = null
    this._quarantined = null

    let raw = null
    try {
      raw = fs.readFileSync(this.filePath, 'utf8')
    } catch (error) {
      // 文件不存在是正常首启: 不创建、不写默认值 (约束 1)
      if (error.code !== 'ENOENT') this._loadError = `read-failed: ${error.message}`
      return
    }

    let parsed = null
    try {
      parsed = JSON.parse(raw)
    } catch (error) {
      this._loadError = `parse-failed: ${error.message}`
    }

    if (parsed !== null && !isPlainObject(parsed)) {
      this._loadError = 'parse-failed: 顶层不是对象'
      parsed = null
    }

    if (this._loadError) {
      // 约束 2: 坏文件改名留存, 绝不在原地写
      this._quarantined = this._quarantine(raw)
      console.warn(`[SettingsStore] 配置文件不可用 (${this._loadError}); 已备份到 ${this._quarantined || '(备份失败)'}`)
      return
    }

    const { schema, ...rest } = parsed
    const schemaNumber = Number(schema)
    if (Number.isFinite(schemaNumber) && schemaNumber > SCHEMA_VERSION) {
      // 未来版本写的文件: 字段原样保留 (不回写降级), 只记一条提示
      this._schema = schemaNumber
      this._loadError = `schema-too-new: ${schema}`
      this._data = rest
      return
    }
    if (Number.isFinite(schemaNumber) && schemaNumber >= 1) this._schema = schemaNumber
    this._data = rest
  }

  /** 把坏文件改名留存; 返回新路径 (失败返回 null) */
  _quarantine (raw) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const target = `${this.filePath}.corrupt-${stamp}`
    try {
      if (raw !== null && raw !== undefined) {
        fs.writeFileSync(target, raw, 'utf8')
        fs.unlinkSync(this.filePath)
      }
      return target
    } catch (error) {
      console.warn('[SettingsStore] 坏文件备份失败:', error.message)
      return null
    }
  }

  _commit () {
    const payload = {
      schema: Math.max(this._schema || SCHEMA_VERSION, SCHEMA_VERSION),
      updatedAt: new Date().toISOString(),
      ...deepClone(this._data)
    }
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      // 约束 3: 临时文件 + rename 原子替换
      const tmp = `${this.filePath}.${process.pid}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8')
      fs.renameSync(tmp, this.filePath)
    } catch (error) {
      console.error('[SettingsStore] 写入失败:', error.message)
      return { ok: false, reason: `write-failed: ${error.message}` }
    }
    if (typeof this.onChange === 'function') {
      try { this.onChange(this.snapshot()) } catch (error) { console.warn('[SettingsStore] onChange 回调出错:', error.message) }
    }
    return { ok: true, changed: true }
  }
}

// ========== 单例 (主进程用; 才需要 electron) ==========
let _instance = null

/**
 * 主进程共用单例: <userData>/settings.json
 * userData 已在 src/main/index.js 顶部按决策47/63 定好, 此处直接取。
 * @returns {SettingsStore}
 */
function getSettingsStore () {
  if (_instance) return _instance
  const { app } = require('electron')
  _instance = new SettingsStore(path.join(app.getPath('userData'), SETTINGS_FILENAME))
  return _instance
}

module.exports = {
  SettingsStore,
  getSettingsStore,
  SETTINGS_FILENAME,
  SCHEMA_VERSION,
  ALLOWED_PATHS,
  NORMALIZERS,
  // 纯函数导出 (单测/复用)
  getIn,
  setIn,
  deleteIn
}
