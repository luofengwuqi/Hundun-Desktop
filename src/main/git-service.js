/**
 * HundunDesktop - 加固的 git 调用层
 *
 * 设计原则:
 *  1. 渲染进程永远不能传 git 参数进来 —— 只允许调用下面导出的语义化函数,
 *     所有 git 子命令在主进程内拼装, 杜绝命令注入与任意仓库操作。
 *  2. 不用 shell: 一律 execFile(gitPath, args[]), 路径/URL 都作为独立 argv 元素。
 *  3. 令牌只出现在单次命令的 argv 里 (鉴权 URL), 不写进 .git/config;
 *     日志与返回给渲染进程的文本统一 sanitize, 绝不回显令牌。
 *  4. 禁交互: GIT_TERMINAL_PROMPT=0 + credential.helper 置空 —— 需要凭据时
 *     直接失败, 不会在后台卡住等输入。
 *
 * 使用者: 母程序「仓库」同步 (决策67, src/main/sync-service.js)。
 */

const { execFile } = require('child_process')
const fs = require('fs')
const path = require('path')

const GIT_TIMEOUT = 120000
const MAX_BUFFER = 12 * 1024 * 1024

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
  if (!_gitPath) throw new GitError('NO_GIT', '未检测到 git，请先安装 git 后再使用仓库同步')
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

// ========== 错误分类 ==========

/**
 * 把 git 的报错文本归到可读的原因上。
 * 返回值恒为 GitError，调用方需要先自己判断「不是错误」的情形。
 */
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

module.exports = {
  GitError,
  detectGit,
  buildAuthUrl,
  publicRemoteUrl,
  sanitize,
  isRepo,
  readConflicts,
  classifyNetworkError,
  // 决策67: 母程序「仓库」复用同一套加固过的 git 调用 (禁交互 / 无 shell /
  // 固定 BASE_CONFIG / 超时与缓冲上限), 但仍各自拼装语义化子命令 ——
  // 渲染进程永远传不进 git 参数。
  requireGitPath,
  runGit: (cwd, args, opts) => execGit(requireGitPath(), cwd, args, opts)
}
