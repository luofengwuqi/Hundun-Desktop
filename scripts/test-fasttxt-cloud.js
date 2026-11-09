/**
 * FastTXT 云端文档库 (git) 回归测试
 *
 * 纯 Node 运行 (不需要 Electron):
 *   node scripts/test-fasttxt-cloud.js
 *
 * 用本地 bare 仓库模拟远端, 覆盖:
 *   1. 首次关联空仓库 (init → commit → push)
 *   2. 反向同步 (远端新增文件 → 本地 sync 拉到)
 *   3. 冲突四种策略  2.0 auto / 2.1 cloud / 2.2 local / 2.3 both
 *   4. 只同步文档 (.trash / .order.json / .bookmarks.json 不进版本库)
 *   5. 令牌注入 URL 与日志脱敏
 *   6. 关闭云同步后文档仍在
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const {
  setupRepo,
  syncRepo,
  resolveConflicts,
  repoState,
  detectGit,
  classifyNetworkError,
  buildAuthUrl,
  sanitize,
  mergeInProgress
} = require('../src/main/git-service')

let passed = 0
let failed = 0
const failures = []

function check(name, cond, extra) {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    failures.push(name)
    console.log(`  ✗ ${name}${extra ? `  → ${extra}` : ''}`)
  }
}

function section(title) {
  console.log(`\n${title}`)
}

function git(cwd, ...args) {
  return execFileSync('git', ['-c', 'core.autocrlf=false', ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    stdio: ['ignore', 'pipe', 'pipe']
  })
}

function gitSafe(cwd, ...args) {
  try { return git(cwd, ...args) } catch (err) { return String((err.stdout || '') + (err.stderr || '')) }
}

const fileUrl = (p) => 'file:///' + p.replace(/\\/g, '/')

/** 建一个世界: bare 远端 + A (本机) 初始文档, A 已完成首次关联 */
function makeWorld(initialFiles = { 'note.txt': 'base\n' }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fasttxt-cloud-'))
  const remote = path.join(root, 'remote.git')
  fs.mkdirSync(remote, { recursive: true })
  git(remote, 'init', '--bare', '-b', 'main')

  const A = path.join(root, 'A')
  fs.mkdirSync(A, { recursive: true })
  for (const [name, content] of Object.entries(initialFiles)) {
    fs.writeFileSync(path.join(A, name), content, 'utf8')
  }
  // 本地视图状态 (不应进版本库)
  fs.writeFileSync(path.join(A, '.order.json'), '{"ids":[]}', 'utf8')
  fs.writeFileSync(path.join(A, '.bookmarks.json'), '{}', 'utf8')
  fs.mkdirSync(path.join(A, '.trash'), { recursive: true })
  fs.writeFileSync(path.join(A, '.trash', 'old.txt'), 'deleted\n', 'utf8')

  const cfg = {
    enabled: true,
    remoteUrl: fileUrl(remote),
    username: '',
    token: '',
    branch: 'main',
    lastSyncAt: null,
    lastResult: null
  }
  return { root, remote, A, cfg }
}

/** 模拟另一台机器: 克隆远端到 B 并提交改动 */
function makePeer(world, files, message = 'peer commit') {
  const B = path.join(world.root, `B-${Math.random().toString(36).slice(2, 7)}`)
  git(world.root, 'clone', world.remote, B)
  for (const [name, content] of Object.entries(files)) {
    const abs = path.join(B, name)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content, 'utf8')
  }
  git(B, 'add', '-A')
  git(B, '-c', 'user.name=Peer', '-c', 'user.email=peer@test', 'commit', '-m', message)
  git(B, 'push', 'origin', 'main')
  return B
}

async function testInit() {
  section('[1] 首次关联空仓库')
  const w = makeWorld()
  const res = await setupRepo(w.A, w.cfg)

  check('setup 返回 ok', res.ok === true, JSON.stringify(res.error || '').slice(0, 200))
  check('创建了 .git', fs.existsSync(path.join(w.A, '.git')))
  check('远端 main 已有提交', git(w.remote, 'log', '--oneline', 'main').trim().length > 0)
  check('状态: enabled + 已初始化', res.state.enabled === true && res.state.initialized === true)

  const tracked = git(w.A, 'ls-files').split('\n').map((s) => s.trim()).filter(Boolean)
  check('文档进入版本库', tracked.includes('note.txt'), tracked.join(','))
  check('.gitignore 进入版本库', tracked.includes('.gitignore'))
  check('.order.json 未跟踪', !tracked.includes('.order.json'), tracked.join(','))
  check('.bookmarks.json 未跟踪', !tracked.includes('.bookmarks.json'))
  check('.trash 未跟踪', !tracked.some((f) => f.startsWith('.trash/')))
  check('工作区干净', git(w.A, 'status', '--porcelain').trim() === '', git(w.A, 'status', '--porcelain'))

  // 幂等性: 再跑一次 setup 不炸
  const again = await setupRepo(w.A, w.cfg)
  check('重复 setup 仍 ok', again.ok === true)

  fs.rmSync(w.root, { recursive: true, force: true })
}

async function testPull() {
  section('[2] 反向同步: 远端新增文件 → 本地')
  const w = makeWorld()
  await setupRepo(w.A, w.cfg)
  makePeer(w, { 'from-cloud.txt': 'hello from peer\n', 'note.txt': 'base\n' })

  fs.writeFileSync(path.join(w.A, 'local.txt'), 'local only\n', 'utf8')
  const res = await syncRepo(w.A, w.cfg)

  check('sync 返回 ok', res.ok === true, JSON.stringify(res).slice(0, 300))
  check('拉到远端新增文件', fs.existsSync(path.join(w.A, 'from-cloud.txt')))
  check('远端文件内容正确',
    fs.existsSync(path.join(w.A, 'from-cloud.txt')) &&
    fs.readFileSync(path.join(w.A, 'from-cloud.txt'), 'utf8') === 'hello from peer\n')
  check('本地提交已推送', git(w.remote, 'log', '--oneline', 'main').includes('local.txt') ||
    git(w.remote, 'ls-tree', '--name-only', 'main').includes('local.txt'))

  fs.rmSync(w.root, { recursive: true, force: true })
}

async function makeConflictWorld() {
  const w = makeWorld({ 'note.txt': 'base\n' })
  await setupRepo(w.A, w.cfg)
  makePeer(w, { 'note.txt': 'cloud-version\n', 'side.txt': 'side change\n' }, 'cloud edits note')
  fs.writeFileSync(path.join(w.A, 'note.txt'), 'local-version\n', 'utf8')
  const res = await syncRepo(w.A, w.cfg)
  return { w, res }
}

async function testConflict(strategy, expect) {
  const labels = { auto: '2.0 自动合并', cloud: '2.1 以云端为准', local: '2.2 以本地为准', both: '2.3 两端都保留' }
  section(`[3] 冲突处理 — ${labels[strategy]}`)
  const { w, res } = await makeConflictWorld()

  check('同步返回 CONFLICT', res.ok === false && Array.isArray(res.conflicts) && res.conflicts.length === 1,
    JSON.stringify({ ok: res.ok, n: (res.conflicts || []).length }))
  const conflict = (res.conflicts || [])[0] || {}
  check('冲突文件为 note.txt', conflict.path === 'note.txt', conflict.path)
  check('冲突页有本地预览', !!(conflict.ours && conflict.ours.preview.includes('local-version')))
  check('冲突页有云端预览', !!(conflict.theirs && conflict.theirs.preview.includes('cloud-version')))
  check('合并处于进行中', await mergeInProgress(w.A))

  const r = await resolveConflicts(w.A, w.cfg, strategy)
  check('resolve 返回 ok', r.ok === true, JSON.stringify(r).slice(0, 300))
  const note = fs.readFileSync(path.join(w.A, 'note.txt'), 'utf8')

  if (strategy === 'auto') {
    check('保留 git 冲突标记', note.includes('<<<<<<<') && note.includes('>>>>>>>'), note.slice(0, 80))
  } else if (strategy === 'cloud') {
    check('内容 = 云端版本', note === 'cloud-version\n', JSON.stringify(note))
  } else if (strategy === 'local') {
    check('内容 = 本地版本', note === 'local-version\n', JSON.stringify(note))
  } else if (strategy === 'both') {
    check('原文件保留本地内容', note === 'local-version\n', JSON.stringify(note))
    check('云端版本另存 (云端)', fs.existsSync(path.join(w.A, 'note (云端).txt')),
      fs.readdirSync(w.A).join(','))
    if (fs.existsSync(path.join(w.A, 'note (云端).txt'))) {
      check('另存内容 = 云端版本',
        fs.readFileSync(path.join(w.A, 'note (云端).txt'), 'utf8') === 'cloud-version\n')
    }
  }

  check('合并已结束', !(await mergeInProgress(w.A)))
  check('工作区干净', git(w.A, 'status', '--porcelain').trim() === '', git(w.A, 'status', '--porcelain'))

  if (strategy === 'local') {
    check('云端非冲突改动仍保留 (side.txt)', fs.existsSync(path.join(w.A, 'side.txt')))
  }

  // 处理完再同步一次 → 合并提交推上云端
  const after = await syncRepo(w.A, w.cfg)
  check('后续 sync 推送成功', after.ok === true, JSON.stringify(after).slice(0, 300))
  const remoteContent = gitSafe(w.A, 'show', 'main:note.txt')
  if (strategy === 'cloud') check('云端内容为 cloud-version', remoteContent.includes('cloud-version'))
  if (strategy === 'local' || strategy === 'both') check('云端内容为 local-version', remoteContent.includes('local-version'))

  fs.rmSync(w.root, { recursive: true, force: true })
}

async function testToken() {
  section('[5] 令牌注入与脱敏')
  const cfg = { remoteUrl: 'https://github.com/me/notes.git', username: '', token: 'ghp_secret123' }
  const url = buildAuthUrl(cfg)
  // 2026-10-24 起 GitHub 默认用 x-access-token（oauth2 是 GitLab 的写法，留给非 GitHub 主机）
  check('GitHub 默认用户名 x-access-token', url.startsWith('https://x-access-token:ghp_secret123@github.com/'), url)
  const named = buildAuthUrl({ ...cfg, username: 'me' })
  check('自定义用户名', named.startsWith('https://me:ghp_secret123@'), named)
  const ssh = buildAuthUrl({ remoteUrl: 'git@github.com:me/notes.git', token: 'x' })
  check('ssh 地址不注入令牌', ssh === 'git@github.com:me/notes.git', ssh)
  const masked = sanitize('fatal: https://oauth2:ghp_secret123@github.com/x 401', cfg)
  check('日志脱敏', !masked.includes('ghp_secret123') && masked.includes('***'), masked)
}

async function testDisable() {
  section('[6] 关闭云同步')
  const w = makeWorld()
  await setupRepo(w.A, w.cfg)
  const disabledCfg = { ...w.cfg, enabled: false }
  const state = await repoState(w.A, disabledCfg)
  check('state.enabled = false', state.enabled === false)
  check('文档仍在', fs.existsSync(path.join(w.A, 'note.txt')))
  check('.git 历史仍在', fs.existsSync(path.join(w.A, '.git')))
  fs.rmSync(w.root, { recursive: true, force: true })
}

/**
 * 回归: 云端页打开时 detect() 与 state() 是并行发出的。
 * 旧实现在探测进行中把 _gitChecked 置 true 并清空 _gitPath，
 * 第二个调用走「已检查」早退 → available:false，
 * 表现为「本地装了 git 却提示未检测到」。
 */
async function testConcurrentDetect() {
  section('[0] 并发探测 (detect 与 state 同时发出)')
  const w = makeWorld()
  const [d1, d2, d3] = await Promise.all([detectGit(), detectGit(), detectGit()])
  check('三路并发 detectGit 都能检测到', d1.available && d2.available && d3.available,
    JSON.stringify([d1.available, d2.available, d3.available]))
  check('并发结果版本一致', !!d1.version && d1.version === d3.version, `${d1.version} / ${d3.version}`)
  const [detect, state] = await Promise.all([detectGit(), repoState(w.A, w.cfg)])
  check('detect 与 repoState 并发时 gitAvailable 不丢',
    detect.available === true && state.gitAvailable === true,
    JSON.stringify({ detect: detect.available, state: state.gitAvailable }))
  fs.rmSync(w.root, { recursive: true, force: true })
}

/**
 * 认证失败的文案要能直接指路：GitHub 早已停用密码，
 * 用户最常见的两种错是「没填令牌」和「令牌没权限」。
 */
function testAuthMessages() {
  section('[7] 认证失败文案')
  const gh = {
    stderr: "remote: Invalid username or token. Password authentication is not supported for Git operations.\n" +
      "fatal: Authentication failed for 'https://github.com/luofengwuqi/File.git/'"
  }
  const noToken = classifyNetworkError(gh, {})
  const withToken = classifyNetworkError(gh, { token: 'ghp_dummy' })
  check('无令牌 → 提示去填 PAT', /没有填写访问令牌/.test(noToken.message), noToken.message.slice(0, 30))
  check('有令牌 → 提示令牌无效/权限', /令牌无效或权限不足/.test(withToken.message), withToken.message.slice(0, 30))
  check('两条文案不同', noToken.message !== withToken.message)

  const notFound = classifyNetworkError({ stderr: 'remote: Repository not found.' }, {})
  check('仓库不存在 → 明确说去建库', /仓库不存在或无权访问/.test(notFound.message), notFound.message.slice(0, 20))

  const netErr = classifyNetworkError({ stderr: 'fatal: unable to access: Could not resolve host: github.com' }, {})
  check('断网仍归为网络问题', netErr.code === 'NETWORK', netErr.code)

  // 用户名留空的兜底: GitHub 官方示例 x-access-token, GitLab 用 oauth2
  const ghUrl = buildAuthUrl({ remoteUrl: 'https://github.com/a/b.git', token: 'ghp_x' })
  const glUrl = buildAuthUrl({ remoteUrl: 'https://gitlab.com/a/b.git', token: 'glpat_x' })
  check('GitHub 空用户名 → x-access-token', ghUrl.includes('x-access-token:'), ghUrl.replace(/ghp_x/, '***'))
  check('GitLab 空用户名 → oauth2', glUrl.includes('oauth2:'), glUrl.replace(/glpat_x/, '***'))
  check('无令牌时不注入任何凭据', buildAuthUrl({ remoteUrl: 'https://github.com/a/b.git' }) === 'https://github.com/a/b.git')
}

async function main() {
  console.log('FastTXT Cloud (git) regression test')
  try {
    await testConcurrentDetect()
    await testInit()
    await testPull()
    await testConflict('auto')
    await testConflict('cloud')
    await testConflict('local')
    await testConflict('both')
    await testToken()
    await testDisable()
    testAuthMessages()
  } catch (err) {
    failed++
    failures.push('uncaught: ' + err.message)
    console.error('\n未捕获异常:', err)
  }

  console.log(`\n==== ${passed}/${passed + failed} 通过 ====`)
  if (failed) {
    console.log('失败项:')
    failures.forEach((f) => console.log('  - ' + f))
    process.exit(1)
  }
}

main()
