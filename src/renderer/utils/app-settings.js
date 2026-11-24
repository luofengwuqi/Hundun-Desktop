/**
 * HundunDesktop - 应用设置读写门面 (决策66)
 *
 * 单一数据源: <userData>/settings.json (主进程 src/main/settings-store.js 负责原子写)
 * 老版本存在 localStorage 的键在**首次读取时补写**过去 (只补不覆盖, 不删原值)。
 *
 * 为什么不用 async: theme / i18n / plugin store 都在模块初始化时同步读设置,
 * 改成 await 会让主题和语言闪一帧。所以 preload 在加载阶段用一次 sendSync
 * 把整份快照拿到内存, 这里的 get() 全部是同步取值。
 */

// ========== 键 ==========
export const SETTING_KEY = Object.freeze({
  theme: 'theme',
  locale: 'locale',
  sound: 'sound',
  pluginOrder: 'plugins.order',
  pluginOrderVersion: 'plugins.orderVersion',
  pluginRemoved: 'plugins.removed',
  meta: 'meta'
})

// 老版本 localStorage 键 (只作迁移来源, 迁移后不删 —— 多留一份可恢复的副本)
// 键必须与 SETTING_KEY 的**值**一致 (点路径), 否则 readLegacy 查不到
export const LEGACY_STORAGE_KEY = Object.freeze({
  theme: 'hundundesktop-theme',
  locale: 'hundundesktop-locale',
  sound: 'hundundesktop-settings',
  'plugins.order': 'hundundesktop-plugins',
  'plugins.orderVersion': 'hundundesktop-plugin-order-version',
  'plugins.removed': 'hundundesktop-plugins-removed'
})

// 老值的解码方式: theme/locale 存的是裸字符串, 其余是 JSON (orderVersion 是数字字符串)
const LEGACY_DECODER = {
  theme: (raw) => raw,
  locale: (raw) => raw,
  sound: decodeJson,
  'plugins.order': decodeJson,
  'plugins.removed': decodeJson,
  'plugins.orderVersion': (raw) => {
    const n = parseInt(raw, 10)
    return Number.isFinite(n) ? n : undefined
  }
}

function decodeJson (raw) {
  try {
    return JSON.parse(raw)
  } catch (_) {
    return undefined
  }
}

// 无 preload 时的降级缓存 (单元测试 / 浏览器直开 prototype 时)
const memoryFallback = new Map()

const bridge = () => {
  if (typeof window === 'undefined') return null
  const api = window.electronAPI
  return api && api.settings ? api.settings : null
}

/** 当前是否存在主进程桥 (设置页可据此提示"配置文件不可用") */
export const hasSettingsBridge = () => !!bridge()

/**
 * 同步读设置
 * @param {string} dotted 见 SETTING_KEY
 * @param {*} [fallback] 缺失时返回 (不会写盘)
 */
export const getSetting = (dotted, fallback = null) => {
  const api = bridge()
  if (api) {
    const value = api.get(dotted, undefined)
    return value === undefined ? fallback : value
  }
  return memoryFallback.has(dotted) ? memoryFallback.get(dotted) : fallback
}

/** 是否存在该设置项 (区分"没设置过") */
export const hasSetting = (dotted) => {
  const api = bridge()
  if (api && typeof api.has === 'function') return api.has(dotted)
  return memoryFallback.has(dotted)
}

/**
 * 异步写设置 (主进程校验 + 原子写 + 广播)
 * @returns {Promise<{ok:boolean, changed?:boolean, reason?:string}>}
 */
export const setSetting = (dotted, value) => {
  const api = bridge()
  if (!api) {
    memoryFallback.set(dotted, value)
    return Promise.resolve({ ok: true, changed: true, degraded: true })
  }
  try {
    return Promise.resolve(api.set(dotted, value)).catch((error) => {
      console.warn(`[app-settings] 写入失败 ${dotted}:`, error.message)
      return { ok: false, reason: error.message }
    })
  } catch (error) {
    console.warn(`[app-settings] 写入异常 ${dotted}:`, error.message)
    return Promise.resolve({ ok: false, reason: error.message })
  }
}

/** 订阅跨窗口设置变更; 返回取消函数 */
export const onSettingsChanged = (callback) => {
  const api = bridge()
  if (!api || typeof api.onChanged !== 'function') return () => {}
  return api.onChanged(callback)
}

/** 设置文件绝对路径 (设置页展示用; 无桥时返回空串) */
export const getSettingsFilePath = async () => {
  const api = bridge()
  if (!api || typeof api.filePath !== 'function') return ''
  try {
    return await api.filePath()
  } catch (_) {
    return ''
  }
}

// ========== 老数据迁移 (只补不覆盖) ==========

// 已迁移的键, 用于写一次说明性的 meta (避免每次读都写盘)
const migratedKeys = new Set()

const readLegacy = (path) => {
  const legacyKey = LEGACY_STORAGE_KEY[path]
  if (!legacyKey || typeof localStorage === 'undefined') return undefined
  let raw = null
  try {
    raw = localStorage.getItem(legacyKey)
  } catch (_) {
    return undefined
  }
  if (raw === null || raw === '') return undefined
  const decode = LEGACY_DECODER[path]
  return decode ? decode(raw) : undefined
}

const noteMigration = (path) => {
  if (migratedKeys.has(path)) return
  migratedKeys.add(path)
  const meta = getSetting(SETTING_KEY.meta, {})
  setSetting(SETTING_KEY.meta, {
    ...(meta && typeof meta === 'object' ? meta : {}),
    localStorageMigratedAt: new Date().toISOString(),
    localStorageMigratedKeys: [...migratedKeys]
  })
}

/**
 * 读设置, 缺失时尝试从 localStorage 老键补一次
 *
 * 只补不覆盖: settings.json 里已有值就**直接用它**, 老值不参与比较也不覆盖;
 * 补写成功后老键仍留在 localStorage (回滚/排查时还能捞回来)。
 *
 * @param {string} dotted SETTING_KEY 中的路径
 * @param {*} [fallback] 两边都没有时的兜底
 */
export const getSettingMigrating = (dotted, fallback = null) => {
  const value = getSetting(dotted, undefined)
  if (value !== undefined && value !== null) return value

  const legacy = readLegacy(dotted)
  if (legacy === undefined || legacy === null) return fallback

  // 老值先给调用方用 (同步), 补写异步进行, 失败也不影响本次启动
  setSetting(dotted, legacy).then((result) => {
    if (result && result.ok) noteMigration(dotted)
    else console.warn(`[app-settings] 老设置迁移失败 ${dotted}:`, result && result.reason)
  })
  return legacy
}

export default {
  SETTING_KEY,
  LEGACY_STORAGE_KEY,
  hasSettingsBridge,
  getSetting,
  hasSetting,
  setSetting,
  getSettingMigrating,
  onSettingsChanged,
  getSettingsFilePath
}
