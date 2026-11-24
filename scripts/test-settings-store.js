/**
 * settings-store 纯 Node 单测 (决策66)
 *
 * 运行: node scripts/test-settings-store.js   (退出码 0 = 全过)
 *
 * 覆盖三条数据安全硬约束:
 *   1. 只补不覆盖 —— 文件不存在时不创建、不写默认值
 *   2. 坏文件不覆盖 —— 解析失败改名留存, 绝不原地写
 *   3. 原子写 —— 临时文件 + rename, 不留半截文件
 * 以及: 键白名单 / 值归一化 / 幂等 / 嵌套合并 / 跨实例持久化 / onChange 回调
 */
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { SettingsStore, ALLOWED_PATHS } = require('../src/main/settings-store')

let pass = 0
let fail = 0
const check = (name, fn) => {
  try {
    fn()
    pass++
    console.log(`PASS  ${name}`)
  } catch (error) {
    fail++
    console.log(`FAIL  ${name}\n      ${error.message}`)
  }
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hundun-settings-'))
const newStore = (dirName) => {
  const dir = path.join(tmpRoot, dirName)
  return new SettingsStore(path.join(dir, 'settings.json'))
}
const readJson = (store) => JSON.parse(fs.readFileSync(store.filePath, 'utf8'))
const exists = (p) => fs.existsSync(p)
const leftovers = (store) => {
  const dir = path.dirname(store.filePath)
  if (!exists(dir)) return []
  return fs.readdirSync(dir).filter(n => n.endsWith('.tmp'))
}

// ---------- 约束 1: 首启不创建文件、不写默认值 ----------
check('首启: snapshot 为空且不创建文件', () => {
  const store = newStore('first-run')
  assert.deepStrictEqual(store.snapshot(), {})
  assert.strictEqual(exists(store.filePath), false, '不应创建 settings.json')
  assert.strictEqual(store.lastError(), null)
})

check('首启: get 返回 fallback 且不落盘', () => {
  const store = newStore('first-run-get')
  assert.strictEqual(store.get('theme', 'hun-tun-black'), 'hun-tun-black')
  assert.strictEqual(store.has('theme'), false, 'fallback 不应被当成"已设置"')
  assert.strictEqual(exists(store.filePath), false)
})

// ---------- 写 / 读 / 持久化 ----------
check('set 后文件创建、schema=1、无 .tmp 残留', () => {
  const store = newStore('basic')
  const result = store.set('theme', 'handheld')
  assert.deepStrictEqual(result, { ok: true, changed: true })
  const raw = readJson(store)
  assert.strictEqual(raw.schema, 1)
  assert.strictEqual(raw.theme, 'handheld')
  assert.strictEqual(typeof raw.updatedAt, 'string')
  assert.deepStrictEqual(leftovers(store), [])
})

check('跨实例持久化 (新实例读盘)', () => {
  const store = newStore('persist')
  store.set('theme', 'contact-sheet')
  const reopened = new SettingsStore(store.filePath)
  assert.strictEqual(reopened.get('theme'), 'contact-sheet')
})

check('同值再写幂等 (changed:false 且不重写文件)', () => {
  const store = newStore('idempotent')
  store.set('theme', 'handheld')
  const before = fs.statSync(store.filePath).mtimeMs
  const again = store.set('theme', 'handheld')
  assert.deepStrictEqual(again, { ok: true, changed: false })
  assert.strictEqual(fs.statSync(store.filePath).mtimeMs, before, '文件不应被重写')
})

check('嵌套写合并 (改音量不丢 soundEnabled)', () => {
  const store = newStore('nested')
  store.set('sound', { soundEnabled: false, volume: 30 })
  store.set('sound.volume', 70)
  assert.deepStrictEqual(store.get('sound'), { soundEnabled: false, volume: 70 })
})

check('plugins.order 与 plugins.removed 互不影响', () => {
  const store = newStore('plugins')
  store.set('plugins.order', [{ id: 'fast-txt', enabled: true }, { id: 'music' }])
  store.set('plugins.removed', [{ id: 'calculator', name: 'CALC' }])
  store.set('plugins.orderVersion', 2)
  const plugins = store.get('plugins')
  assert.strictEqual(plugins.order.length, 2)
  assert.strictEqual(plugins.order[0].id, 'fast-txt')
  assert.strictEqual(plugins.removed[0].id, 'calculator')
  assert.strictEqual(plugins.orderVersion, 2)
})

// ---------- 校验 ----------
check('白名单外路径被拒绝', () => {
  const store = newStore('whitelist')
  const result = store.set('hacked', 1)
  assert.deepStrictEqual(result, { ok: false, reason: 'path-not-allowed' })
  assert.strictEqual(exists(store.filePath), false, '被拒绝时不应落盘')
})

check('ALLOWED_PATHS 覆盖渲染层实际用到的键', () => {
  for (const key of ['theme', 'locale', 'sound', 'sound.volume', 'sound.soundEnabled',
    'plugins', 'plugins.order', 'plugins.removed', 'plugins.orderVersion', 'meta']) {
    assert.ok(ALLOWED_PATHS.includes(key), `缺少 ${key}`)
  }
})

check('非法值被拒绝 (theme 非字符串 / locale 不在 zh|en)', () => {
  const store = newStore('invalid')
  assert.strictEqual(store.set('theme', 42).reason, 'invalid-value')
  assert.strictEqual(store.set('theme', '').reason, 'invalid-value')
  assert.strictEqual(store.set('locale', 'fr').reason, 'invalid-value')
  assert.strictEqual(store.set('sound.volume', 'abc').reason, 'invalid-value')
  assert.strictEqual(exists(store.filePath), false)
})

check('音量钳制到 0~100 并取整', () => {
  const store = newStore('clamp')
  store.set('sound.volume', 999)
  assert.strictEqual(store.get('sound.volume'), 100)
  store.set('sound.volume', -5)
  assert.strictEqual(store.get('sound.volume'), 0)
  store.set('sound.volume', 33.7)
  assert.strictEqual(store.get('sound.volume'), 34)
})

check('插件顺序归一化: 丢弃无 id / 重复 id, 保留 customSettings', () => {
  const store = newStore('order-normalize')
  store.set('plugins.order', [
    { id: 'fast-txt', enabled: true, customSettings: { a: 1 } },
    { id: 'fast-txt' },
    { name: 'no-id' },
    null,
    { id: 'music', enabled: false }
  ])
  const order = store.get('plugins.order')
  assert.strictEqual(order.length, 2)
  assert.deepStrictEqual(order[0], { id: 'fast-txt', enabled: true, customSettings: { a: 1 } })
  assert.deepStrictEqual(order[1], { id: 'music', enabled: false })
})

check('setMany 一次落盘并列出非法键', () => {
  const store = newStore('set-many')
  const result = store.setMany({
    theme: 'handheld',
    'sound.volume': 20,
    bogus: 1,
    'plugins.orderVersion': 2
  })
  assert.strictEqual(result.ok, true)
  assert.deepStrictEqual(result.rejected, ['bogus'])
  assert.strictEqual(store.get('theme'), 'handheld')
  assert.strictEqual(store.get('sound.volume'), 20)
  assert.strictEqual(store.get('plugins.orderVersion'), 2)
  assert.deepStrictEqual(leftovers(store), [])
})

check('remove 只删该键, 兄弟键保留', () => {
  const store = newStore('remove')
  store.set('sound', { soundEnabled: true, volume: 55 })
  const result = store.remove('sound.volume')
  assert.deepStrictEqual(result, { ok: true, changed: true })
  assert.deepStrictEqual(store.get('sound'), { soundEnabled: true })
  assert.deepStrictEqual(store.remove('sound.volume'), { ok: true, changed: false })
})

// ---------- 约束 2: 坏文件不覆盖 ----------
check('坏 JSON: 隔离改名 + 空数据继续 + 原文件不被覆盖', () => {
  const store = newStore('corrupt')
  const dir = path.dirname(store.filePath)
  fs.mkdirSync(dir, { recursive: true })
  const broken = '{ "theme": "handheld", oops'
  fs.writeFileSync(store.filePath, broken, 'utf8')

  const reopened = new SettingsStore(store.filePath)
  assert.deepStrictEqual(reopened.snapshot(), {})
  assert.match(String(reopened.lastError()), /parse-failed/)

  const backup = fs.readdirSync(dir).find(n => n.includes('.corrupt-'))
  assert.ok(backup, '应留下 .corrupt-* 备份')
  assert.strictEqual(fs.readFileSync(path.join(dir, backup), 'utf8'), broken, '备份内容应与原文件一致')
})

check('顶层不是对象 (数组/字符串) 也按坏文件处理', () => {
  const store = newStore('corrupt-type')
  fs.mkdirSync(path.dirname(store.filePath), { recursive: true })
  fs.writeFileSync(store.filePath, '[1,2,3]', 'utf8')
  const reopened = new SettingsStore(store.filePath)
  assert.deepStrictEqual(reopened.snapshot(), {})
  assert.match(String(reopened.lastError()), /parse-failed/)
})

check('坏文件隔离后仍可正常写入新配置', () => {
  const store = newStore('corrupt-then-write')
  fs.mkdirSync(path.dirname(store.filePath), { recursive: true })
  fs.writeFileSync(store.filePath, 'not json', 'utf8')
  const reopened = new SettingsStore(store.filePath)
  assert.strictEqual(reopened.snapshot() && Object.keys(reopened.snapshot()).length, 0)
  reopened.set('theme', 'hun-tun-yellow')
  assert.strictEqual(JSON.parse(fs.readFileSync(store.filePath, 'utf8')).theme, 'hun-tun-yellow')
})

check('schema 更高的文件: 字段保留, schema 不被降级', () => {
  const store = newStore('future-schema')
  fs.mkdirSync(path.dirname(store.filePath), { recursive: true })
  fs.writeFileSync(store.filePath, JSON.stringify({ schema: 9, theme: 'handheld', futureField: 'keep-me' }), 'utf8')
  const reopened = new SettingsStore(store.filePath)
  assert.strictEqual(reopened.get('theme'), 'handheld')
  assert.match(String(reopened.lastError()), /schema-too-new/)
  reopened.set('locale', 'en')
  const raw = JSON.parse(fs.readFileSync(store.filePath, 'utf8'))
  assert.strictEqual(raw.schema, 9, '不应把 schema 降级成 1')
  assert.strictEqual(raw.futureField, 'keep-me', '未知字段应原样保留')
})

// ---------- onChange 回调 ----------
check('onChange: 真的写盘后回调一次, 幂等写不回调', () => {
  const store = newStore('onchange')
  const seen = []
  store.onChange = (snapshot) => seen.push(snapshot)
  store.set('theme', 'handheld')
  assert.strictEqual(seen.length, 1)
  assert.strictEqual(seen[0].theme, 'handheld')
  store.set('theme', 'handheld')
  assert.strictEqual(seen.length, 1, '幂等写不应触发回调')
})

check('onChange 回调抛错不影响写入结果', () => {
  const store = newStore('onchange-throw')
  store.onChange = () => { throw new Error('boom') }
  const result = store.set('theme', 'handheld')
  assert.strictEqual(result.ok, true)
  assert.strictEqual(store.get('theme'), 'handheld')
})

// ---------- 目录自动创建 ----------
check('目录不存在时自动创建', () => {
  const dir = path.join(tmpRoot, 'deep', 'nested', 'dir')
  const store = new SettingsStore(path.join(dir, 'settings.json'))
  store.set('locale', 'zh')
  assert.ok(exists(store.filePath))
})

// 清理
fs.rmSync(tmpRoot, { recursive: true, force: true })

console.log(`\n${pass}/${pass + fail} 项通过`)
process.exit(fail === 0 ? 0 : 1)
