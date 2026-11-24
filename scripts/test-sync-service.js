/**
 * sync-service 集成测试 (决策67) —— 用本地裸仓库当远端，全程真实跑 git
 *
 * 运行: node scripts/test-sync-service.js   (退出码 0 = 全过)
 *
 * 重点验证「不会传错东西」和「不会删东西」:
 *   1. 白名单之外的东西进不了库 (Cache/日志/未勾选插件/未勾选插件的 JSON)
 *   2. 超过 50MB 的文件被跳过, 且**本地文件仍在**
 *   3. 首次关联空库 → 首推; 远端有别人提交 → 再同步能合上
 *   4. 冲突时报 CONFLICT 并列出文件, 不自行丢改动
 *   5. 令牌不落进 .git/config
 */
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { createSyncService } = require('../src/main/sync-service')

let pass = 0
let fail = 0
const check = async (name, fn) => {
  try {
    await fn()
    pass++
    console.log(`PASS  ${name}`)
  } catch (error) {
    fail++
    console.log(`FAIL  ${name}\n      ${error.message}`)
  }
}

const GIT = 'git'
const git = (cwd, args) => execFileSync(GIT, args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@t' } })

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hundun-sync-'))
const userDataDir = path.join(tmpRoot, 'user-data')
const remoteDir = path.join(tmpRoot, 'remote.git')
const pluginsDirs = [path.join(tmpRoot, 'plugins')]

function mk (rel, content = 'x') {
  const abs = path.join(userDataDir, rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content)
  return abs
}

// 夹具: 两个可同步插件 (fast-txt / task) + 一个不可同步插件 (music, manifest 无 sync)
fs.mkdirSync(path.join(pluginsDirs[0], 'fast-txt'), { recursive: true })
fs.writeFileSync(path.join(pluginsDirs[0], 'fast-txt', 'manifest.json'), JSON.stringify({ id: 'fast-txt', name: 'FastTXT', sync: { paths: ['file/'] } }))
fs.mkdirSync(path.join(pluginsDirs[0], 'task'), { recursive: true })
fs.writeFileSync(path.join(pluginsDirs[0], 'task', 'manifest.json'), JSON.stringify({ id: 'task', name: 'TASK', sync: {} }))
fs.mkdirSync(path.join(pluginsDirs[0], 'music'), { recursive: true })
fs.writeFileSync(path.join(pluginsDirs[0], 'music', 'manifest.json'), JSON.stringify({ id: 'music', name: 'Music' }))

// 用户数据夹具
mk('settings.json', JSON.stringify({ theme: 'hun-tun-black' }))
mk('installed-plugins.json', JSON.stringify([{ id: 'fast-txt' }]))
mk('hundundesktop-data/fast-txt.json', JSON.stringify({ docs: 1 }))
mk('hundundesktop-data/task.json', JSON.stringify({ tasks: [] }))
mk('hundundesktop-data/music.json', JSON.stringify({ library: [] }))
mk('plugins/fast-txt/file/note.md', '# hello')
mk('plugins/fast-txt/file/sub/deep.txt', 'deep')
mk('plugins/task/file/t1.md', 'task file')
mk('plugins/music/file/song.mp3', 'not-really-audio')
mk('plugins/fast-txt/cloud.json', JSON.stringify({ token: 'SHOULD-NOT-LEAK' }))
mk('Cache/junk.bin', 'cache')
mk('Local Storage/leveldb/000001.log', 'leveldb')
mk('sync/config.json', '{}')
// 大文件: 用 truncate 造稀疏文件, 不真占 51MB
const bigPath = path.join(userDataDir, 'plugins/fast-txt/file/huge.bin')
fs.mkdirSync(path.dirname(bigPath), { recursive: true })
fs.writeFileSync(bigPath, '')
fs.truncateSync(bigPath, 51 * 1024 * 1024)

// 远端: 空裸仓库
git(tmpRoot, ['init', '--bare', '-q', remoteDir])
// 裸仓库默认 HEAD 指向 master, 本服务用 main → 显式对齐, 否则 ls-tree HEAD 全空
git(tmpRoot, ['--git-dir', remoteDir, 'symbolic-ref', 'HEAD', 'refs/heads/main'])

const service = createSyncService({
  userDataDir,
  pluginsDirs,
  safeStorage: null,          // 无密钥环 → 明文降级路径
  fetchImpl: null,
  allowLocalRemote: true,     // 测试专用: 允许本地裸仓库当远端
  log: () => {}
})

const lsRemote = () => {
  try {
    return git(tmpRoot, ['--git-dir', remoteDir, 'ls-tree', '-r', '--name-only', 'refs/heads/main']).split('\n').filter(Boolean).sort()
  } catch (_) {
    return []
  }
}

;(async () => {
  await check('listPlugins 识别 manifest.sync 声明', async () => {
    const plugins = service._internal.listPlugins()
    assert.deepStrictEqual(plugins.map(p => p.id), ['fast-txt', 'music', 'task'])
    assert.strictEqual(plugins.find(p => p.id === 'fast-txt').syncable, true)
    assert.strictEqual(plugins.find(p => p.id === 'music').syncable, false)
  })

  await check('gitignore 白名单: 只放行设置/清单/勾选插件', async () => {
    const oversize = service._internal.writeIgnoreFile({ settings: true, installedPlugins: true, plugins: ['fast-txt'] })
    assert.strictEqual(oversize.length, 1, '应只报出 huge.bin 一个超限文件')
    assert.ok(oversize[0].path.includes('huge.bin'))
    const ignore = fs.readFileSync(path.join(userDataDir, '.gitignore'), 'utf8')
    assert.ok(ignore.includes('!/settings.json'))
    assert.ok(ignore.includes('!/hundundesktop-data/fast-txt.json'))
    assert.ok(!ignore.includes('!/hundundesktop-data/music.json'), '未勾选插件的数据文件不应放行')
    assert.ok(ignore.includes('!/plugins/fast-txt/file/**'))
  })

  await check('关联空远端 → 首推, 且只推白名单文件', async () => {
    // 用户先在设置里勾选要同步的插件, 再关联仓库 (默认不勾任何插件)
    await service.updateConfig({ scopes: { settings: true, installedPlugins: true, plugins: ['fast-txt'] } })
    const result = await service.linkRemote({ remoteUrl: remoteDir, branch: 'main', token: '' })
    assert.strictEqual(result.ok, true, JSON.stringify(result).slice(0, 300))
    const files = lsRemote()
    assert.ok(files.includes('settings.json'), 'settings.json 应在库里')
    assert.ok(files.includes('installed-plugins.json'), 'installed-plugins.json 应在库里')
    assert.ok(files.includes('hundundesktop-data/fast-txt.json'), '勾选插件的 JSON 应在库里')
    assert.ok(files.includes('plugins/fast-txt/file/note.md'))
    assert.ok(files.includes('plugins/fast-txt/file/sub/deep.txt'), '子目录应递归带上')
    assert.ok(!files.includes('hundundesktop-data/music.json'), '未勾选插件的 JSON 不该进库')
    assert.ok(!files.includes('plugins/music/file/song.mp3'), '未勾选插件的文件不该进库')
    assert.ok(!files.includes('plugins/fast-txt/cloud.json'), '插件目录下的配置文件不该进库')
    assert.ok(!files.includes('plugins/fast-txt/file/huge.bin'), '超过 50MB 的文件应被跳过')
    assert.ok(!files.some(f => f.startsWith('Cache/')), '缓存不该进库')
    assert.ok(!files.some(f => f.startsWith('Local Storage/')), 'leveldb 不该进库')
    assert.ok(!files.some(f => f.startsWith('sync/')), '仓库自己的配置不该进库')
    assert.ok(fs.existsSync(bigPath), '被跳过的大文件本地必须保留')
  })

  await check('令牌不写进 .git/config', async () => {
    const cfg = fs.readFileSync(path.join(userDataDir, '.git', 'config'), 'utf8')
    assert.ok(!/token|password|@/i.test(cfg) || !cfg.includes('SHOULD-NOT'), cfg)
    assert.strictEqual(service.hasToken(), false)
  })

  await check('无改动时同步 → committed=false 且成功', async () => {
    const result = await service.sync()
    assert.strictEqual(result.ok, true)
    assert.strictEqual(result.committed, false)
  })

  await check('本地改动 → 同步后进库', async () => {
    fs.writeFileSync(path.join(userDataDir, 'settings.json'), JSON.stringify({ theme: 'handheld' }))
    const result = await service.sync()
    assert.strictEqual(result.ok, true)
    assert.strictEqual(result.committed, true)
    const content = git(tmpRoot, ['--git-dir', remoteDir, 'show', 'refs/heads/main:settings.json'])
    assert.ok(content.includes('handheld'))
  })

  await check('远端有别人的提交 → 再同步能合并 (不丢对方改动)', async () => {
    // 另开一个工作区, 模拟另一台机器
    const otherDir = path.join(tmpRoot, 'other')
    git(tmpRoot, ['clone', '-q', '-b', 'main', remoteDir, otherDir])
    fs.mkdirSync(path.join(otherDir, 'plugins/fast-txt/file'), { recursive: true })
    fs.writeFileSync(path.join(otherDir, 'plugins/fast-txt/file/from-other.txt'), 'from other machine')
    git(otherDir, ['add', '-A'])
    git(otherDir, ['commit', '-q', '-m', 'other: add note'])
    git(otherDir, ['push', '-q', 'origin', 'HEAD:refs/heads/main'])

    fs.writeFileSync(path.join(userDataDir, 'plugins/fast-txt/file/note.md'), '# hello v2')
    const result = await service.sync()
    assert.strictEqual(result.ok, true, JSON.stringify(result).slice(0, 300))
    const files = lsRemote()
    assert.ok(files.includes('plugins/fast-txt/file/from-other.txt'), '对方的文件必须留在库里')
  })

  await check('冲突 → 报 CONFLICT 并列出文件', async () => {
    const otherDir = path.join(tmpRoot, 'other')
    git(otherDir, ['pull', '-q', '--rebase', 'origin', 'main'])
    fs.writeFileSync(path.join(otherDir, 'plugins/fast-txt/file/note.md'), 'remote version')
    git(otherDir, ['add', '-A'])
    git(otherDir, ['commit', '-q', '-m', 'other: edit note'])
    git(otherDir, ['push', '-q', 'origin', 'HEAD:refs/heads/main'])

    fs.writeFileSync(path.join(userDataDir, 'plugins/fast-txt/file/note.md'), 'local version')
    const result = await service.sync()
    assert.strictEqual(result.ok, false)
    assert.strictEqual(result.code, 'CONFLICT')
    assert.ok(Array.isArray(result.conflicts) && result.conflicts.length >= 1, '应列出冲突文件')
    assert.ok(result.conflicts.some(c => c.path.includes('note.md')))
  })

  await check('冲突按「保留本地」解决 → 本地内容胜出且推送成功', async () => {
    const result = await service.resolveConflicts('local')
    assert.strictEqual(result.ok, true, JSON.stringify(result).slice(0, 300))
    const content = git(tmpRoot, ['--git-dir', remoteDir, 'show', 'refs/heads/main:plugins/fast-txt/file/note.md'])
    assert.ok(content.includes('local version'), content)
  })

  await check('状态回报: 插件清单 + 待同步数 + 不含令牌字段', async () => {
    const st = await service.status()
    assert.strictEqual(st.ok, true)
    assert.strictEqual(st.config.remoteUrl.endsWith('remote.git'), true)
    assert.strictEqual(st.pendingChanges, 0)
    assert.ok(Array.isArray(st.plugins) && st.plugins.length === 3)
    assert.ok(!JSON.stringify(st).includes('token"'), '状态里不该出现令牌字段')
  })

  await check('取消勾选某插件 → 文件从库里移除, 但本地文件保留', async () => {
    const upd = await service.updateConfig({ scopes: { plugins: [] } })
    assert.strictEqual(upd.ok, true)
    const result = await service.sync()
    assert.strictEqual(result.ok, true, JSON.stringify(result).slice(0, 200))
    assert.ok(Array.isArray(result.untracked) && result.untracked.length > 0, '应回报被取消跟踪的文件')
    const files = lsRemote()
    assert.ok(!files.some(f => f.startsWith('plugins/fast-txt/')), '取消勾选后插件文件不该还在库里')
    assert.ok(!files.includes('hundundesktop-data/fast-txt.json'), '插件 JSON 也不该还在库里')
    assert.ok(files.includes('settings.json'), '设置仍应留在库里')
    assert.ok(fs.existsSync(path.join(userDataDir, 'plugins/fast-txt/file/note.md')), '本地文件必须保留')
  })

  fs.rmSync(tmpRoot, { recursive: true, force: true })
  console.log(`\n${pass}/${pass + fail} 项通过`)
  process.exit(fail === 0 ? 0 : 1)
})().catch((error) => {
  console.error('测试异常:', error)
  process.exit(1)
})
