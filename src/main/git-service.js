/**
 * HundunDesktop - FastTXT 云端文档库 (git)
 *
 * 设计原则 (决策56):
 *  1. 渲染进程永远不能传 git 参数进来 —— 只允许调用下面导出的语义化函数,
 *     所有 git 子命令在主进程内拼装, 杜绝命令注入与任意仓库操作。
 *  2. 不用 shell: 一律 execFile(gitPath, args[]), 路径/URL 都作为独立 argv 元素。
 *  3. 令牌只出现在单次命令的 argv 里 (鉴权 URL), 不写进 .git/config;
 *     日志与返回给渲染进程的文本统一 sanitize, 绝不回显令牌。
 *  4. 禁交互: GIT_TERMINAL_PROMPT=0 + credential.helper 置空 —— 需要凭据时
 *     直接失败, 不会在后台卡住等输入。
 */

const { execFile } = require('child_process')
const fs = require('fs')
const path = require('path')

const GIT_TIMEOUT = 120000
const MAX_BUFFER = 12 * 1024 * 1024

// 只同步文档: 回收站/排序/书签属于本地视图状态, 不进版本库
const IGNORE_LINES = ['.trash/', '.order.json', '.bookmarks.json', '*.tmp', 'Thumbs.db', '.DS_Store']

const COMMIT_IDENTITY = ['-c', 'user.name=FastTXT', '-c', 'user.email=fasttxt@hundundesktop.local']

// 统一的基础配置: 关掉 CRLF 转换与分页, 输出按 UTF-8 原样透传
const BASE_CONFIG = [
  '-c', 'core.quotepath=false',
  '-c', 'core.autocrlf=false',
  '-c', 'core.safecrlf=false',
  '-c', 'credential.helper=',
  '-c', 'advice.detachedHead=false'
]

let _gitPath = null
let _gitVersion = null
let _gitChecked = false
let _gitProbe = null      // 进行中的探测 (并发调用共享同一 Promise)

// ========== 进程调用 ==========

function candidateGitPaths() {
  const list = ['git']
  if (process.platform === 'win32') {
    const pf = process.env.ProgramFiles || 'C:\\Program Files'
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
    const local = process.env.LOCALAPPDATA || ''
    list.push(
      path.join(pf, 'Git', 'cmd', 'git.exe'),
      path.join(pf86, 'Git', 'cmd', 'git.exe'),
      path.join(pf, 'Git', 'bin', 'git.exe'),
      path.join(local, 'Programs', 'Git', 'cmd', 'git.exe')
    )
  } else {
    list.push('/usr/bin/git', '/usr/local/bin/git', '/snap/bin/git')
  }
  return list
}

function execGit(gitPath, cwd, args, { timeout = GIT_TIMEOUT } = {}) {
  return new Promise((resolve) => {
    execFile(
      gitPath,
      BASE_CONFIG.concat(args),
      {
        cwd,
        timeout,
        maxBuffer: MAX_BUFFER,
        windowsHide: true,
        encoding: 'utf8',
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GCM_INTERACTIVE: 'never',
          GIT_ASKPASS: 'echo',
          SSH_ASKPASS: 'echo',
          GIT_OPTIONAL_LOCKS: '0',
          LC_ALL: 'C',
          LANG: 'C'
        }
      },
      (err, stdout, stderr) => {
        resolve({
          ok: !err,
          code: err && typeof err.code === 'number' ? err.code : err ? 1 : 0,
          stdout: String(stdout || ''),
          stderr: String(stderr || ''),
          timedOut: !!(err && err.killed),
          error: err || null
        })
      }
    )
  })
}

/**
 * 探测系统 git。结果缓存；force=true 可重新探测 (用户装了 git 后重试)。
 *
 * 注意：并发调用必须复用同一个探测 Promise。
 * 旧实现里第一个调用把 _gitChecked 置 true 并清空 _gitPath 后 await 探测，
 * 第二个并发调用会走「已检查」的早退分支，读到 _gitPath === null，
 * 于是返回 available:false —— 云端页的 detect 与 state 是并行发出的，
 * 会稳定复现「本地装了 git 却提示未检测到」。
 */
async function detectGit(force = false) {
  // 先看有没有进行中的探测: 有就共享它, 绝不能落到下面的「已检查」早退
  if (_gitProbe) return _gitProbe
  if (_gitChecked && !force) {
    return { available: !!_gitPath, version: _gitVersion, path: _gitPath }
  }
  _gitChecked = true
  _gitPath = null
  _gitVersion = null

  _gitProbe = (async () => {
    for (const candidate of candidateGitPaths()) {
      const res = await new Promise((resolve) => {
        execFile(candidate, ['--version'], { timeout: 8000, windowsHide: true }, (err, stdout) => {
          resolve({ ok: !err, out: String(stdout || '').trim() })
        })
      })
      if (res.ok && /git version/i.test(res.out)) {
        _gitPath = candidate
        _gitVersion = res.out.replace(/^git version\s*/i, '')
        break
      }
    }
    return { available: !!_gitPath, version: _gitVersion, path: _gitPath }
  })()

  try {
    return await _gitProbe
  } finally {
    _gitProbe = null
  }
}

function requireGitPath() {
  if (!_gitPath) throw new GitError('NO_GIT', '未检测到 git，请先安装 git 再启用云端文档库')
  return _gitPath
}

class GitError extends Error {
  constructor(code, message, detail) {
    super(message || code)
    this.name = 'GitError'
    this.code = code
    this.detail = detail || ''
  }
}

// ========== 令牌脱敏 ==========

function sanitize(text, cfg) {
  let out = String(text == null ? '' : text)
  const token = cfg && cfg.token
  if (token && token.length >= 4) {
    out = out.split(token).join('***')
    // 鉴权 URL 里可能被 percent-encode
    try {
      const enc = encodeURIComponent(token)
      if (enc !== token) out = out.split(enc).join('***')
    } catch (_) {}
  }
  // 兜底: 抹掉 https://user:pass@ 形式的凭据
  out = out.replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1***@')
  return out
}

/**
 * 构造带凭据的 URL。只用于单次网络命令的 argv, 不落盘。
 * - ssh 地址 (git@host:path) 不做处理, 交给系统 ssh key / agent
 * - 无令牌时原样返回 (公开仓库 / 系统凭据助手已保存的情况)
 */
function buildAuthUrl(cfg) {
  const raw = String((cfg && cfg.remoteUrl) || '').trim()
  if (!raw) throw new GitError('EMPTY_REMOTE', '远程仓库地址为空')
  if (!cfg || !cfg.token) return raw
  if (!/^https?:\/\//i.test(raw)) return raw
  let u
  try {
    u = new URL(raw)
  } catch (_) {
    throw new GitError('BAD_REMOTE', '远程仓库地址格式不正确')
  }
  // 用户名留空时的兜底：GitHub 官方示例用 x-access-token，GitLab 用 oauth2
  const host = (u.hostname || '').toLowerCase()
  u.username = cfg.username || (host.includes('github') ? 'x-access-token' : 'oauth2')
  u.password = cfg.token
  return u.toString()
}

/** 对外展示用: 去掉 URL 中可能带的用户名密码 */
function publicRemoteUrl(raw) {
  const str = String(raw || '').trim()
  if (!/^https?:\/\//i.test(str)) return str
  try {
    const u = new URL(str)
    u.username = ''
    u.password = ''
    return u.toString()
  } catch (_) {
    return str
  }
}

// ========== 仓库基础 ==========

const isRepo = (repoDir) => fs.existsSync(path.join(repoDir, '.git'))

async function currentBranch(repoDir) {
  const res = await execGit(requireGitPath(), repoDir, ['rev-parse', '--abbrev-ref', 'HEAD'])
  return res.ok ? res.stdout.trim() : ''
}

async function ensureIgnoreFile(repoDir) {
  const file = path.join(repoDir, '.gitignore')
  let existing = ''
  try {
    existing = fs.readFileSync(file, 'utf8')
  } catch (_) {}
  const have = new Set(existing.split(/\r?\n/).map((l) => l.trim()))
  const missing = IGNORE_LINES.filter((l) => !have.has(l))
  if (!missing.length) return false
  const prefix = existing && !existing.endsWith('\n') ? '\n' : ''
  fs.writeFileSync(file, existing + prefix + missing.join('\n') + '\n', 'utf8')
  return true
}

async function commitAll(repoDir, message) {
  const git = requireGitPath()
  await execGit(git, repoDir, ['add', '-A'])
  // 暂存区为空则跳过 (git diff --cached --quiet 退出码 0 = 无差异)
  const diff = await execGit(git, repoDir, ['diff', '--cached', '--quiet'])
  if (diff.ok) return { committed: false }
  const res = await execGit(git, repoDir, COMMIT_IDENTITY.concat(['commit', '--no-verify', '-m', message]))
  if (!res.ok) {
    throw new GitError('COMMIT_FAILED', '本地提交失败', res.stderr || res.stdout)
  }
  return { committed: true }
}

async function changedFiles(repoDir) {
  const res = await execGit(requireGitPath(), repoDir, ['status', '--porcelain'])
  if (!res.ok) return []
  return res.stdout
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => {
      const code = line.slice(0, 2).trim()
      let p = line.slice(3).trim()
      if (p.startsWith('"') && p.endsWith('"')) {
        p = p.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      }
      return { code, path: p }
    })
    .slice(0, 200)
}

async function aheadBehind(repoDir, branch) {
  const git = requireGitPath()
  const ref = `refs/remotes/origin/${branch}`
  const exists = await execGit(git, repoDir, ['rev-parse', '--verify', '--quiet', ref])
  if (!exists.ok) return { hasRemoteRef: false, ahead: 0, behind: 0 }
  const res = await execGit(git, repoDir, ['rev-list', '--left-right', '--count', `HEAD...origin/${branch}`])
  if (!res.ok) return { hasRemoteRef: true, ahead: 0, behind: 0 }
  const [ahead, behind] = res.stdout.trim().split(/\s+/).map((n) => parseInt(n, 10) || 0)
  return { hasRemoteRef: true, ahead, behind }
}

async function lastCommit(repoDir) {
  const res = await execGit(requireGitPath(), repoDir, ['log', '-1', '--format=%cI%x09%s'])
  if (!res.ok || !res.stdout.trim()) return null
  const [date, ...rest] = res.stdout.trim().split('\t')
  return { date, subject: rest.join('\t') }
}

/** 是否处于未完成的合并状态 */
async function mergeInProgress(repoDir) {
  if (fs.existsSync(path.join(repoDir, '.git', 'MERGE_HEAD'))) return true
  const res = await execGit(requireGitPath(), repoDir, ['rev-parse', '-q', '--verify', 'MERGE_HEAD'])
  return res.ok
}

// ========== 冲突读取 ==========

/**
 * 读取冲突清单 + 两端预览。
 * ours = stage 2, theirs = stage 3; 缺失 (删除/新增冲突) 返回 null。
 */
async function readConflicts(repoDir, cfg, { previewLimit = 600 } = {}) {
  const git = requireGitPath()
  const res = await execGit(git, repoDir, ['diff', '--name-status', '--diff-filter=U'])
  if (!res.ok) return []
  const rows = res.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t')
      return { status: parts[0], path: parts.slice(1).join('\t') }
    })

  const conflicts = []
  for (const row of rows) {
    if (!row.path) continue
    const ours = await stageContent(repoDir, row.path, 2)
    const theirs = await stageContent(repoDir, row.path, 3)
    conflicts.push({
      path: row.path,
      status: row.status,
      ours: ours == null ? null : { preview: ours.slice(0, previewLimit), size: ours.length },
      theirs: theirs == null ? null : { preview: theirs.slice(0, previewLimit), size: theirs.length }
    })
  }
  return conflicts
}

async function stageContent(repoDir, filePath, stage) {
  const res = await execGit(requireGitPath(), repoDir, ['show', `:${stage}:${filePath}`])
  if (!res.ok) return null
  return res.stdout
}

// ========== 状态 ==========

async function repoState(repoDir, cfg) {
  const detected = await detectGit()
  const enabled = !!(cfg && cfg.enabled)
  const base = {
    gitAvailable: detected.available,
    gitVersion: detected.version,
    enabled,
    initialized: isRepo(repoDir),
    remote: publicRemoteUrl(cfg && cfg.remoteUrl),
    branch: (cfg && cfg.branch) || 'main',
    hasToken: !!(cfg && cfg.token),
    username: (cfg && cfg.username) || '',
    lastSyncAt: (cfg && cfg.lastSyncAt) || null,
    lastResult: (cfg && cfg.lastResult) || null,
    merging: false,
    ahead: 0,
    behind: 0,
    dirty: [],
    lastCommit: null
  }
  if (!base.initialized) return base

  // 这几项互不依赖，并行执行：Windows 上每 spawn 一次 git 要 100~300ms，
  // 串行 6~8 次就是 1~2 秒，用户点开云端页会明显觉得「卡了很久」。
  const wantedBranch = base.branch
  const [resolved, merging, dirty, ab, last] = await Promise.all([
    currentBranch(repoDir).catch(() => null),
    mergeInProgress(repoDir).catch(() => false),
    changedFiles(repoDir).catch(() => []),
    aheadBehind(repoDir, wantedBranch).catch(() => ({ hasRemoteRef: false, ahead: 0, behind: 0 })),
    lastCommit(repoDir).catch(() => null)
  ])

  const branch = resolved || wantedBranch
  base.branch = branch
  base.merging = merging
  base.dirty = dirty
  base.lastCommit = last

  // 真实分支与配置分支不一致时，ahead/behind 要按真实分支重算
  const abFinal = branch === wantedBranch ? ab : await aheadBehind(repoDir, branch)
  base.ahead = abFinal.ahead
  base.behind = abFinal.behind
  base.hasRemoteRef = abFinal.hasRemoteRef

  if (base.merging) base.conflicts = await readConflicts(repoDir, cfg)
  return base
}

// ========== 网络操作 ==========

async function fetchRemote(repoDir, cfg) {
  const git = requireGitPath()
  const auth = buildAuthUrl(cfg)
  const branch = (cfg && cfg.branch) || 'main'
  const refspec = `+refs/heads/${branch}:refs/remotes/origin/${branch}`
  return execGit(git, repoDir, ['fetch', '--prune', '--no-tags', auth, refspec], { timeout: GIT_TIMEOUT })
}

async function pushBranch(repoDir, cfg) {
  const git = requireGitPath()
  const auth = buildAuthUrl(cfg)
  const branch = (cfg && cfg.branch) || 'main'
  return execGit(git, repoDir, ['push', auth, `HEAD:refs/heads/${branch}`], { timeout: GIT_TIMEOUT })
}

function classifyNetworkError(res, cfg) {
  const text = `${res.stderr || ''}\n${res.stdout || ''}`
  const hasToken = !!(cfg && cfg.token)
  // GitHub/Gitee 已停用账号密码：这条几乎总是「没填令牌」或「令牌无效/权限不够」
  if (/Password authentication is not supported|Invalid username or token|Support for password authentication was removed/i.test(text)) {
    return new GitError(
      'AUTH',
      hasToken
        ? '认证失败：令牌无效或权限不足。请确认 PAT 未过期、已勾选 repo（私有库需读写权限）；GitHub 的用户名建议填 x-access-token 或你的 GitHub 用户名'
        : '认证失败：没有填写访问令牌。GitHub / Gitee 已不支持账号密码，请在「访问令牌」填 Personal Access Token（GitHub 勾 repo 权限；Gitee 用私人令牌）',
      text
    )
  }
  if (/Repository not found|does not appear to be a git repository/i.test(text)) {
    return new GitError(
      'REPO_NOT_FOUND',
      '仓库不存在或无权访问：请先在平台上创建这个仓库（空库，不要勾选初始化 README），再确认令牌对该仓库有权限',
      text
    )
  }
  if (/Authentication failed|could not read Username|Invalid username or password|403|401|Permission denied|access denied/i.test(text)) {
    return new GitError('AUTH', '认证失败：请检查仓库地址、用户名与访问令牌权限', text)
  }
  if (/Could not resolve host|Connection (refused|timed out|reset)|network is unreachable|Failed to connect|TLS|SSL/i.test(text)) {
    return new GitError('NETWORK', '网络不可达：请检查网络或代理设置', text)
  }
  if (/\[rejected\]|non-fast-forward|fetch first/i.test(text)) {
    return new GitError('REJECTED', '推送被拒绝：云端有本地没有的提交，请先同步（拉取合并）', text)
  }
  if (/not found|couldn't find remote ref/i.test(text)) {
    return new GitError('NO_REMOTE_BRANCH', '云端仓库或分支不存在', text)
  }
  return new GitError('GIT_FAILED', 'git 执行失败', text)
}

/**
 * 把远端分支合并进本地。返回 {ok, conflicts} 或 {ok:false, error}
 * --allow-unrelated-histories: 首次关联一个已有内容的仓库时, 两端历史无共同祖先
 */
async function mergeRemote(repoDir, cfg) {
  const git = requireGitPath()
  const branch = (cfg && cfg.branch) || 'main'
  const res = await execGit(git, repoDir, ['merge', '--no-edit', '--allow-unrelated-histories', '-m', `merge: 合并云端 ${branch}`, `origin/${branch}`])
  if (res.ok) return { ok: true, conflicts: [] }
  // 冲突: merge 退出码 1 且存在未合并路径
  const conflicts = await readConflicts(repoDir, cfg)
  if (conflicts.length) return { ok: false, conflicts, error: null }
  return { ok: false, conflicts: [], error: classifyNetworkError(res, cfg) }
}

// ========== 对外语义化操作 ==========

/**
 * 首次关联云端仓库 (新建 or 已有, 行为一致: 有内容就合并, 空库就首推)
 * @returns {Promise<{ok:boolean, state:object, conflicts?:Array, error?:GitError}>}
 */
async function setupRepo(repoDir, cfg) {
  const detected = await detectGit()
  if (!detected.available) throw new GitError('NO_GIT', '未检测到 git，请先安装 git 再启用云端文档库')

  const git = requireGitPath()
  const branch = cfg.branch || 'main'
  const fresh = !isRepo(repoDir)

  if (fresh) {
    const init = await execGit(git, repoDir, ['init'])
    if (!init.ok) throw new GitError('INIT_FAILED', 'git init 失败', init.stderr)
    // 统一分支名 (init 默认分支随 git 版本变化); 已有仓库不动 HEAD, 避免切走未提交内容
    await execGit(git, repoDir, ['symbolic-ref', 'HEAD', `refs/heads/${branch}`])
  }
  await ensureIgnoreFile(repoDir)
  await commitAll(repoDir, 'chore: FastTXT 初始化云端文档库')

  const fetchRes = await fetchRemote(repoDir, { ...cfg, branch })
  if (!fetchRes.ok) {
    // 空仓库: fetch 拿不到分支引用是正常情况 → 直接首推
    const err = classifyNetworkError(fetchRes, cfg)
    if (err.code !== 'NO_REMOTE_BRANCH') throw err
    const pushRes = await pushBranch(repoDir, { ...cfg, branch })
    if (!pushRes.ok) throw classifyNetworkError(pushRes, cfg)
  } else {
    const merge = await mergeRemote(repoDir, { ...cfg, branch })
    if (!merge.ok && merge.error) throw merge.error
    if (!merge.ok) {
      return { ok: false, state: await repoState(repoDir, cfg), conflicts: merge.conflicts, error: null }
    }
    // 合并成功且本地有新提交 (合并提交/首推) → 推送
    const pushRes = await pushBranch(repoDir, { ...cfg, branch })
    if (!pushRes.ok) throw classifyNetworkError(pushRes, cfg)
  }

  const state = await repoState(repoDir, cfg)
  return { ok: true, state, conflicts: [] }
}

/**
 * 手动同步: 提交本地改动 → 拉取 → (必要时) 合并 → 推送
 */
async function syncRepo(repoDir, cfg) {
  const detected = await detectGit()
  if (!detected.available) throw new GitError('NO_GIT', '未检测到 git，请先安装 git 再启用云端文档库')
  if (!isRepo(repoDir)) throw new GitError('NOT_INITIALIZED', '云端文档库尚未初始化')

  const branch = cfg.branch || (await currentBranch(repoDir)) || 'main'
  const workCfg = { ...cfg, branch }

  // 未完成的合并: 必须先解决冲突
  if (await mergeInProgress(repoDir)) {
    const conflicts = await readConflicts(repoDir, workCfg)
    if (conflicts.length) {
      return { ok: false, state: await repoState(repoDir, workCfg), conflicts, error: null }
    }
    // 冲突已解决但没提交 → 补一个合并提交
    await execGit(requireGitPath(), repoDir, COMMIT_IDENTITY.concat(['commit', '--no-edit']))
  }

  await commitAll(repoDir, `sync: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} 本地改动`)

  const fetchRes = await fetchRemote(repoDir, workCfg)
  if (!fetchRes.ok) {
    const err = classifyNetworkError(fetchRes, cfg)
    if (err.code !== 'NO_REMOTE_BRANCH') throw err
    // 云端还没有这个分支 → 首次推送
    const pushRes = await pushBranch(repoDir, workCfg)
    if (!pushRes.ok) throw classifyNetworkError(pushRes, cfg)
    return { ok: true, state: await repoState(repoDir, workCfg), conflicts: [] }
  }

  const ab = await aheadBehind(repoDir, branch)
  if (ab.behind > 0) {
    const merge = await mergeRemote(repoDir, workCfg)
    if (!merge.ok && merge.error) throw merge.error
    if (!merge.ok) {
      return { ok: false, state: await repoState(repoDir, workCfg), conflicts: merge.conflicts, error: null }
    }
  }

  const after = await aheadBehind(repoDir, branch)
  if (after.ahead > 0 || !after.hasRemoteRef) {
    const pushRes = await pushBranch(repoDir, workCfg)
    if (!pushRes.ok) throw classifyNetworkError(pushRes, cfg)
    // push 后本地 origin/ 引用不会自动更新 → 再 fetch 一次让状态准确
    await fetchRemote(repoDir, workCfg)
  }

  return { ok: true, state: await repoState(repoDir, workCfg), conflicts: [] }
}

/** 2.3 的改名: "文件.txt" → "文件 (云端).txt"; 同名已存在则递增 */
function cloudSiblingPath(repoDir, filePath) {
  const dir = path.posix.dirname(filePath)
  const base = path.posix.basename(filePath)
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot) : ''
  let idx = 1
  let candidate
  do {
    const suffix = idx === 1 ? ' (云端)' : ` (云端${idx})`
    const name = `${stem}${suffix}${ext}`
    candidate = dir === '.' ? name : `${dir}/${name}`
    idx++
  } while (fs.existsSync(path.join(repoDir, candidate)) && idx < 999)
  return candidate
}

/**
 * 解决冲突
 * @param {'auto'|'cloud'|'local'|'both'} strategy
 *   auto  = 2.0 交给 git, 保留冲突标记后再提交
 *   cloud = 2.1 以云端为准 (丢弃本地对冲突文件的修改)
 *   local = 2.2 以本地为准 (只覆盖冲突文件, 云端其它改动仍保留)
 *   both  = 2.3 两份都留: 原文件保本地, 云端版本另存 "(云端)"
 */
async function resolveConflicts(repoDir, cfg, strategy) {
  const git = requireGitPath()
  if (!(await mergeInProgress(repoDir))) throw new GitError('NO_MERGE', '当前没有进行中的合并')
  const conflicts = await readConflicts(repoDir, cfg)
  if (!conflicts.length) {
    // 已全部标记解决, 直接补合并提交
    const commit = await execGit(git, repoDir, COMMIT_IDENTITY.concat(['commit', '--no-edit']))
    return { ok: commit.ok, resolved: [], state: await repoState(repoDir, cfg) }
  }

  const resolved = []

  for (const item of conflicts) {
    const p = item.path
    const hasOurs = item.ours !== null
    const hasTheirs = item.theirs !== null

    if (strategy === 'auto') {
      // 保留 git 写入的冲突标记, 直接 add
      await execGit(git, repoDir, ['add', '--', p])
      resolved.push({ path: p, result: 'markers' })
      continue
    }

    if (strategy === 'cloud') {
      if (hasTheirs) {
        const co = await execGit(git, repoDir, ['checkout', '--theirs', '--', p])
        if (!co.ok) {
          // 部分场景 (add/add) 直接写入 stage 3 内容
          const content = await stageContent(repoDir, p, 3)
          if (content != null) fs.writeFileSync(path.join(repoDir, p), content, 'utf8')
        }
        await execGit(git, repoDir, ['add', '--', p])
        resolved.push({ path: p, result: 'cloud' })
      } else {
        // 云端删除了该文件 → 跟随云端删除
        await execGit(git, repoDir, ['rm', '-f', '--', p])
        resolved.push({ path: p, result: 'cloud-deleted' })
      }
      continue
    }

    if (strategy === 'local') {
      if (hasOurs) {
        const co = await execGit(git, repoDir, ['checkout', '--ours', '--', p])
        if (!co.ok) {
          const content = await stageContent(repoDir, p, 2)
          if (content != null) fs.writeFileSync(path.join(repoDir, p), content, 'utf8')
        }
        await execGit(git, repoDir, ['add', '--', p])
        resolved.push({ path: p, result: 'local' })
      } else {
        // 本地删除了该文件 → 保持删除
        await execGit(git, repoDir, ['rm', '-f', '--', p])
        resolved.push({ path: p, result: 'local-deleted' })
      }
      continue
    }

    // both: 原文件留本地, 云端内容另存
    const oursContent = hasOurs ? await stageContent(repoDir, p, 2) : null
    const theirsContent = hasTheirs ? await stageContent(repoDir, p, 3) : null
    let savedAs = null

    if (oursContent != null) {
      fs.mkdirSync(path.dirname(path.join(repoDir, p)), { recursive: true })
      fs.writeFileSync(path.join(repoDir, p), oursContent, 'utf8')
      await execGit(git, repoDir, ['add', '--', p])
    } else {
      await execGit(git, repoDir, ['rm', '-f', '--', p])
    }

    if (theirsContent != null) {
      savedAs = cloudSiblingPath(repoDir, p)
      fs.mkdirSync(path.dirname(path.join(repoDir, savedAs)), { recursive: true })
      fs.writeFileSync(path.join(repoDir, savedAs), theirsContent, 'utf8')
      await execGit(git, repoDir, ['add', '--', savedAs])
    }

    resolved.push({ path: p, result: 'both', savedAs })
  }

  const commit = await execGit(git, repoDir, COMMIT_IDENTITY.concat(['commit', '--no-edit']))
  if (!commit.ok) {
    throw new GitError('MERGE_COMMIT_FAILED', '合并提交失败', commit.stderr || commit.stdout)
  }

  // 合并提交后还需要推送 (手动模式: 由用户点"同步"再推, 避免一次点击多重副作用)
  return { ok: true, resolved, state: await repoState(repoDir, cfg) }
}

/** 关闭云同步: 只停用, 文档与 .git 历史都保留 */
async function disable(repoDir, cfg) {
  return { ok: true, state: await repoState(repoDir, { ...cfg, enabled: false }) }
}

module.exports = {
  GitError,
  detectGit,
  buildAuthUrl,
  publicRemoteUrl,
  sanitize,
  isRepo,
  ensureIgnoreFile,
  commitAll,
  repoState,
  setupRepo,
  syncRepo,
  resolveConflicts,
  disable,
  readConflicts,
  mergeInProgress,
  classifyNetworkError,
  IGNORE_LINES
}
