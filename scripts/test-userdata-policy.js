/**
 * 数据目录策略 + 旧数据迁移测试 (决策63)
 *
 * 运行: node scripts/test-userdata-policy.js   (退出码 0 = 全过; 纯 Node, 不依赖 electron)
 *
 * 覆盖:
 *   A. shouldUsePortableMode: 开发态 / Windows 打包态 / AppImage / deb / 显式便携
 *   B. isPortableRequested: --portable / HUNDUN_PORTABLE=1
 *   C. migrateLegacyUserData: 文件+目录补齐 / 不覆盖已有文件 / 跳过缓存目录
 *      / 写标记且只迁一次 / 同目录 / 遗留目录不存在
 */
'use strict'
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const p = require('../src/main/paths')

let passed = 0
const ok = (name) => { passed++; console.log('  ✓ ' + name) }

// ---------- A. 便携模式判定 ----------
console.log('A. shouldUsePortableMode')
assert.strictEqual(p.shouldUsePortableMode({ isPackaged: false }), true); ok('开发态恒便携 (项目根/user-data)')
assert.strictEqual(p.shouldUsePortableMode({ isPackaged: true, platform: 'win32', installDirWritable: true }), false)
ok('Windows 打包态即使安装目录可写也不便携 (决策63 核心)')
assert.strictEqual(p.shouldUsePortableMode({ isPackaged: true, platform: 'win32', portableRequested: true }), true)
ok('Windows 显式 --portable 仍可便携 (用户自担风险)')
assert.strictEqual(p.shouldUsePortableMode({ isPackaged: true, platform: 'linux', isAppImage: true, installDirWritable: true }), false)
ok('AppImage 非便携 (execPath 只读挂载)')
assert.strictEqual(p.shouldUsePortableMode({ isPackaged: true, platform: 'linux', installDirWritable: false }), false)
ok('deb /opt 不可写 -> 非便携')
assert.strictEqual(p.shouldUsePortableMode({ isPackaged: true, platform: 'linux', installDirWritable: true }), true)
ok('Linux 可写安装位置 (便携目录) -> 仍便携')
assert.strictEqual(p.shouldUsePortableMode({ isPackaged: true, platform: 'darwin', installDirWritable: true }), true)
ok('macOS 可写 -> 便携 (未额外限制)')

// ---------- B. 显式便携开关 ----------
console.log('B. isPortableRequested')
assert.strictEqual(p.isPortableRequested(['node', 'app', '--portable'], {}), true); ok('--portable 生效')
assert.strictEqual(p.isPortableRequested(['node', 'app', '--portable-mode'], {}), true); ok('--portable-mode 生效')
assert.strictEqual(p.isPortableRequested(['node', 'app'], { HUNDUN_PORTABLE: '1' }), true); ok('HUNDUN_PORTABLE=1 生效')
assert.strictEqual(p.isPortableRequested(['node', 'app'], {}), false); ok('不带开关 -> false')
assert.strictEqual(p.isPortableRequested(['node', 'app'], { HUNDUN_PORTABLE: '0' }), false); ok('HUNDUN_PORTABLE=0 -> false')

// ---------- C. 旧数据迁移 ----------
console.log('C. migrateLegacyUserData')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'udmig-'))
const legacy = path.join(tmp, 'install', 'user-data')
const target = path.join(tmp, 'appdata', 'hundundesktop')
fs.mkdirSync(path.join(legacy, 'plugins', 'fast-txt', 'file'), { recursive: true })
fs.mkdirSync(path.join(legacy, 'Cache'), { recursive: true })
fs.mkdirSync(path.join(legacy, 'hundundesktop-data'), { recursive: true })
fs.writeFileSync(path.join(legacy, 'plugins', 'fast-txt', 'file', 'note.md'), '我的文档')
fs.writeFileSync(path.join(legacy, 'hundundesktop-data', 'tasks.json'), '{"tasks":[]}')
fs.writeFileSync(path.join(legacy, 'installed-plugins.json'), '[]')
fs.writeFileSync(path.join(legacy, 'Cache', 'blob.bin'), 'cache-should-be-skipped')
fs.mkdirSync(target, { recursive: true })
fs.writeFileSync(path.join(target, 'installed-plugins.json'), '[{"id":"existing"}]')

const logs = []
const r1 = p.migrateLegacyUserData(target, { legacyDir: legacy, log: m => logs.push(m) })
assert.strictEqual(r1.migrated, true); ok('首次迁移执行')
assert.strictEqual(fs.readFileSync(path.join(target, 'plugins', 'fast-txt', 'file', 'note.md'), 'utf8'), '我的文档')
ok('嵌套目录 + 文件补齐')
assert.strictEqual(fs.readFileSync(path.join(target, 'hundundesktop-data', 'tasks.json'), 'utf8'), '{"tasks":[]}')
ok('应用数据目录补齐')
assert.strictEqual(fs.readFileSync(path.join(target, 'installed-plugins.json'), 'utf8'), '[{"id":"existing"}]')
ok('已存在文件不被覆盖 (force:false)')
assert.strictEqual(fs.existsSync(path.join(target, 'Cache')), false); ok('缓存目录跳过 (Cache)')
assert.ok(fs.existsSync(path.join(target, p.MIGRATION_MARKER))); ok('写入迁移标记')
assert.ok(fs.existsSync(path.join(legacy, 'plugins', 'fast-txt', 'file', 'note.md'))); ok('原目录保留不删 (数据安全)')
assert.ok(logs.length > 0, '输出迁移日志'); ok('输出迁移日志')

const r2 = p.migrateLegacyUserData(target, { legacyDir: legacy })
assert.strictEqual(r2.migrated, false); assert.strictEqual(r2.reason, 'already-migrated'); ok('第二次调用不再迁移')

const r3 = p.migrateLegacyUserData(legacy, { legacyDir: legacy })
assert.strictEqual(r3.migrated, false); assert.strictEqual(r3.reason, 'same-dir'); ok('源与目标同目录 -> 跳过')

const r4 = p.migrateLegacyUserData(path.join(tmp, 'nowhere'), { legacyDir: path.join(tmp, 'no-such-dir') })
assert.strictEqual(r4.migrated, false); assert.strictEqual(r4.reason, 'legacy-missing'); ok('遗留目录不存在 -> 跳过')

// 空遗留目录也会写标记 (避免每次启动都扫盘)
const emptyLegacy = path.join(tmp, 'empty', 'user-data')
const emptyTarget = path.join(tmp, 'emptytarget')
fs.mkdirSync(emptyLegacy, { recursive: true })
fs.mkdirSync(emptyTarget, { recursive: true })
const r5 = p.migrateLegacyUserData(emptyTarget, { legacyDir: emptyLegacy })
assert.strictEqual(r5.migrated, true); ok('空遗留目录也算迁移完成')
assert.ok(fs.existsSync(path.join(emptyTarget, p.MIGRATION_MARKER))); ok('空目录也写标记')

fs.rmSync(tmp, { recursive: true, force: true })
console.log(`\n全部通过: ${passed} 项断言`)
