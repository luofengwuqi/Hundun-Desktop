/**
 * HundunDesktop - 用户数据仓库同步 (决策67)
 *
 * 背景: 早期版本曾按「一个插件一个远端仓库」的思路做过一套云端同步，只能同步
 *       单个插件的文档目录。现把它提升为母程序能力: 版本库根目录 = userData 本身
 *       （原地建仓，不做副本），同步范围是一份**白名单子集**，由子程序 manifest 的
 *       `sync` 字段声明 + 用户勾选。
 *
 * 安全边界 (沿用早期方案已固化的结论，并补两条):
 *  1. 渲染进程永远传不进 git 参数 —— 只调用下面导出的语义化方法，子命令在主进程拼装。
 *  2. 不用 shell: 一律 execFile(gitPath, args[])，路径/URL 都作为独立 argv 元素。
 *  3. 令牌不出现在命令行回显、日志、返回体里；只以鉴权 URL 形式存在单次 argv 中，
 *     不写进 .git/config。落盘优先 safeStorage 加密，系统无密钥环时降级明文并标记。
 *  4. 禁交互: GIT_TERMINAL_PROMPT=0 + credential.helper 置空 (见 git-service)。
 *  5. **不做破坏性操作**: 本模块不调用 reset / clean / checkout -f / push --force。
 *     冲突只允许 `checkout --ours/--theirs` 这种按文件取值的方式解决。
 *  6. 任何"删除"都必须在返回结果里逐条说出来 (deleted 数组)，不静默传播。
 *
 * 本模块不 require electron (注入 userDataDir / safeStorage / fetch / pluginsDirs)，
 * 便于 scripts/ 下纯 Node 单测；需要单例时用 getSyncService()。
 */

const fs = require('fs')
const path = require('path')
const gitService = require('./git-service')

const SYNC_DIRNAME = 'sync'
const CONFIG_FILENAME = 'config.json'
const TOKEN_FILENAME = 'token.bin'
const BRANCH_DEFAULT = 'main'
const MAX_FILE_BYTES = 50 * 1024 * 1024        // 单文件上限 50MB，超了跳过并在结果里列出
const COMMIT_IDENTITY = ['-c', 'user.name=HundunDesktop', '-c', 'user.email=hundun@hundundesktop.local']
const GITEE_API = 'https://gitee.com/api/v5'

const DEFAULT_SCOPES = Object.freeze({
  settings: true,
  installedPlugins: true,
  plugins: []
})

// ========== 小工具 ==========

const toPosix = (p) => String(p).split(path.sep).join('/')

function readJsonSafe (file, fallback) {
  try {
    const raw = fs.readFileSync(file, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch (_) {
    return fallback
  }
}

function writeFileAtomic (file, data, mode = 0o600) {
  const dir = path.dirname(file)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, data, { encoding: 'utf8', mode })
  fs.renameSync(tmp, file)
}

function normalizeScopes (raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const plugins = Array.isArray(r.plugins)
    ? [...new Set(r.plugins.filter(id => typeof id === 'string' && /^[\w.-]{1,64}$/.test(id)))]
    : []
  return {
    settings: r.settings !== false,
    installedPlugins: r.installedPlugins !== false,
    plugins
  }
}

function normalizeRemoteUrl (input, allowLocal) {
  const url = String(input || '').trim()
  if (!url) throw new gitService.GitError('EMPTY_REMOTE', '请先关联远程仓库')
  if (url.length > 500) throw new gitService.GitError('BAD_REMOTE', '仓库地址过长')
  // allowLocal 仅供测试使用 (单测里用本地裸仓库当远端), 生产分支不接受 file:// 与裸路径
  if (allowLocal && (/^file:\/\//i.test(url) || path.isAbsolute(url))) return url
  if (!/^https?:\/\//i.test(url)) {
    throw new gitService.GitError('BAD_REMOTE', '只支持 https:// 形式的仓库地址')
  }
  return url
}

function normalizeBranch (input) {
  const branch = String(input == null || input === '' ? BRANCH_DEFAULT : input).trim()
  if (!/^[A-Za-z0-9._/-]{1,100}$/.test(branch) || branch.startsWith('-') || branch.includes('..')) {
    throw new gitService.GitError('BAD_BRANCH', '分支名不合法 (只允许字母、数字、- _ . /)')
  }
  return branch
}

function formatBytes (n) {
  const size = Number(n) || 0
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

// ========== 服务 ==========

/**
 * @param {{
 *   userDataDir: string,
 *   pluginsDirs?: string[],
 *   safeStorage?: {isEncryptionAvailable:()=>boolean, encryptString:(s:string)=>Buffer, decryptString:(b:Buffer)=>string},
 *   fetchImpl?: Function,
 *   log?: (msg: string) => void
 * }} opts
 */
function createSyncService (opts = {}) {
  const userDataDir = opts.userDataDir
  if (!userDataDir) throw new TypeError('createSyncService 需要 userDataDir')
  const pluginsDirs = Array.isArray(opts.pluginsDirs) ? opts.pluginsDirs.filter(Boolean) : []
  const safeStorage = opts.safeStorage || null
  const fetchImpl = opts.fetchImpl || (typeof fetch === 'function' ? fetch : null)
  const log = typeof opts.log === 'function' ? opts.log : () => {}
  const allowLocalRemote = !!opts.allowLocalRemote

  const syncDir = path.join(userDataDir, SYNC_DIRNAME)
  const configPath = path.join(syncDir, CONFIG_FILENAME)
  const tokenPath = path.join(syncDir, TOKEN_FILENAME)

  // 同一仓库串行执行 (两次同步并发会把 index.lock 撞坏)
  let queue = Promise.resolve()
  const withLock = (fn) => {
    const run = queue.then(fn, fn)
    queue = run.then(() => {}, () => {})
    return run
  }

  // ---------- 配置 ----------

  function readConfig () {
    const raw = readJsonSafe(configPath, {})
    return {
      enabled: !!raw.enabled,
      provider: raw.provider === 'gitee' ? 'gitee' : 'custom',
      remoteUrl: String(raw.remoteUrl || ''),
      username: String(raw.username || ''),
      branch: String(raw.branch || BRANCH_DEFAULT),
      scopes: normalizeScopes(raw.scopes),
      tokenStorage: raw.tokenStorage || null,
      lastSyncAt: raw.lastSyncAt || null,
      lastResult: raw.lastResult || null,
      createdAt: raw.createdAt || null
    }
  }

  function writeConfig (cfg) {
    writeFileAtomic(configPath, JSON.stringify(cfg, null, 2))
    return cfg
  }

  /** 对外状态: 绝不含令牌 */
  function publicConfig (cfg = readConfig()) {
    return {
      enabled: cfg.enabled,
      provider: cfg.provider,
      remoteUrl: gitService.publicRemoteUrl(cfg.remoteUrl),
      username: cfg.username,
      branch: cfg.branch,
      scopes: cfg.scopes,
      tokenStorage: cfg.tokenStorage,
      lastSyncAt: cfg.lastSyncAt,
      lastResult: cfg.lastResult
    }
  }

  // ---------- 令牌 ----------

  function saveToken (token) {
    const value = String(token || '').trim()
    if (!value) {
      try { fs.unlinkSync(tokenPath) } catch (_) {}
      return { ok: true, tokenStorage: null }
    }
    const canEncrypt = !!(safeStorage && safeStorage.isEncryptionAvailable && safeStorage.isEncryptionAvailable())
    if (canEncrypt) {
      fs.mkdirSync(syncDir, { recursive: true })
      fs.writeFileSync(tokenPath, safeStorage.encryptString(value), { mode: 0o600 })
      return { ok: true, tokenStorage: 'safeStorage' }
    }
    writeFileAtomic(tokenPath, value)
    return { ok: true, tokenStorage: 'plain' }
  }

  function readToken () {
    let buf = null
    try {
      buf = fs.readFileSync(tokenPath)
    } catch (_) {
      return ''
    }
    const canEncrypt = !!(safeStorage && safeStorage.isEncryptionAvailable && safeStorage.isEncryptionAvailable())
    if (canEncrypt) {
      try {
        return String(safeStorage.decryptString(buf) || '')
      } catch (error) {
        log(`[Sync] 令牌解密失败 (可能换了系统用户/密钥环): ${error.message}`)
        return ''
      }
    }
    return buf.toString('utf8').trim()
  }

  const hasToken = () => !!readToken()

  // ---------- 子程序清单 (manifest.sync 声明) ----------

  function listPlugins () {
    const out = []
    const seen = new Set()
    for (const dir of pluginsDirs) {
      let entries = []
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
      } catch (_) {
        continue
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const pluginDir = path.join(dir, entry.name)
        const manifest = readJsonSafe(path.join(pluginDir, 'manifest.json'), null)
        if (!manifest || typeof manifest.id !== 'string' || typeof manifest.name !== 'string') continue
        if (seen.has(manifest.id)) continue
        seen.add(manifest.id)
        const sync = manifest.sync && typeof manifest.sync === 'object' ? manifest.sync : null
        out.push({
          id: manifest.id,
          name: manifest.name,
          syncable: !!sync,
          // sync.paths 缺省 = ['file/'] (整个插件数据目录);
          // 显式给空数组 = 只同步它的 hundun.storage JSON, 不传文件 (如 Music 的音频)
          syncPaths: sync && Array.isArray(sync.paths) ? sync.paths.map(normalizeSyncPath).filter(Boolean) : ['file/'],
          syncIgnore: sync && Array.isArray(sync.ignore)
            ? sync.ignore.map(item => String(item || '').trim().replace(/\\/g, '/')).filter(item => item && !item.includes('..'))
            : []
        })
      }
    }
    return out.sort((a, b) => a.id.localeCompare(b.id))
  }

  /** manifest 里的相对路径: 只允许插件目录内的子路径, 统一成以 / 结尾的 posix 前缀 */
  function normalizeSyncPath (raw) {
    const p = String(raw || '').trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '')
    if (!p || p.includes('..')) return ''
    return p.endsWith('/') ? p : `${p}/`
  }

  /** 勾选插件 → [{id, paths}] (路径来自各自 manifest.sync.paths) */
  function resolveScopes (scopes) {
    const byId = new Map(listPlugins().map(item => [item.id, item]))
    return (scopes.plugins || [])
      .map(id => {
        const meta = byId.get(id)
        if (!meta) return null
        return { id, paths: meta.syncPaths, ignore: meta.syncIgnore || [] }
      })
      .filter(Boolean)
  }

  // ---------- .gitignore 白名单 ----------
  // git 只能"排除", 所以白名单要写成「先排除一切, 再逐个 !重新包含」。
  // 嵌套目录必须逐级重新包含, 否则父目录被排除后 git 根本不会进去看。

  function buildIgnoreLines (scopes) {
    const lines = [
      '# 本文件由 HundunDesktop「仓库」自动生成，每次同步都会重写，请勿手改',
      '# 白名单策略：先排除一切，再逐个 ! 放行（保证不会有缓存/日志/密钥被误传）',
      '*',
      '!/.gitignore'
    ]
    if (scopes.settings) lines.push('!/settings.json')
    if (scopes.installedPlugins) lines.push('!/installed-plugins.json')

    const entries = resolveScopes(scopes)
    if (entries.length) {
      // 插件 JSON 存储 (hundun.storage) —— 逐插件放行, 其余插件的数据文件不传
      const dataFiles = entries.map(e => `!/hundundesktop-data/${e.id}.json`)
      lines.push('!/hundundesktop-data/', '/hundundesktop-data/*', ...dataFiles)
      // 插件数据目录 —— 逐级重新包含, 否则父目录被排除后 git 不会进去
      lines.push('!/plugins/', '/plugins/*')
      for (const entry of entries) {
        const pluginDir = path.join(userDataDir, 'plugins', entry.id)
        if (!fs.existsSync(pluginDir)) continue
        lines.push(`!/plugins/${entry.id}/`, `/plugins/${entry.id}/*`)
        for (const rel of entry.paths) {
          if (fs.existsSync(path.join(pluginDir, rel))) {
            lines.push(`!/plugins/${entry.id}/${rel}`, `!/plugins/${entry.id}/${rel}**`)
          }
        }
        // 声明里的排除项 (回收站/排序等本地视图状态) —— 放在最后, 后者覆盖前者
        for (const ign of entry.ignore) lines.push(`/plugins/${entry.id}/${ign}`)
      }
    }
    return lines
  }

  /** 扫描白名单内的文件, 找出超过上限的 (git 不能按大小跳过, 只能额外排除) */
  function scanOversize (scopes) {
    const big = []
    const walk = (relDir) => {
      const absDir = path.join(userDataDir, relDir)
      let entries = []
      try {
        entries = fs.readdirSync(absDir, { withFileTypes: true })
      } catch (_) {
        return
      }
      for (const entry of entries) {
        const rel = path.posix.join(toPosix(relDir), entry.name)
        if (entry.isDirectory()) {
          if (entry.name === '.git') continue
          walk(rel)
          continue
        }
        let st = null
        try { st = fs.statSync(path.join(userDataDir, rel)) } catch (_) { continue }
        if (st.size > MAX_FILE_BYTES) big.push({ path: `/${rel}`, size: st.size, sizeText: formatBytes(st.size) })
      }
    }
    if (scopes.settings && fs.existsSync(path.join(userDataDir, 'settings.json'))) {
      const st = fs.statSync(path.join(userDataDir, 'settings.json'))
      if (st.size > MAX_FILE_BYTES) big.push({ path: '/settings.json', size: st.size, sizeText: formatBytes(st.size) })
    }
    if (scopes.installedPlugins && fs.existsSync(path.join(userDataDir, 'installed-plugins.json'))) {
      const st = fs.statSync(path.join(userDataDir, 'installed-plugins.json'))
      if (st.size > MAX_FILE_BYTES) big.push({ path: '/installed-plugins.json', size: st.size, sizeText: formatBytes(st.size) })
    }
    for (const entry of resolveScopes(scopes)) {
      for (const rel of entry.paths) {
        if (fs.existsSync(path.join(userDataDir, 'plugins', entry.id, rel))) walk(`plugins/${entry.id}/${rel}`)
      }
      const id = entry.id
      const dataRel = `hundundesktop-data/${id}.json`
      if (fs.existsSync(path.join(userDataDir, dataRel))) {
        const st = fs.statSync(path.join(userDataDir, dataRel))
        if (st.size > MAX_FILE_BYTES) big.push({ path: `/${dataRel}`, size: st.size, sizeText: formatBytes(st.size) })
      }
    }
    return big
  }

  /** 生成并写入 .gitignore; 返回被跳过的大文件清单 (同时写进排除行) */
  function writeIgnoreFile (scopes) {
    const oversize = scanOversize(scopes)
    const lines = buildIgnoreLines(scopes)
    if (oversize.length) {
      lines.push('', '# 以下文件超过 50MB，本次同步跳过（本地文件保留，不会被删）')
      for (const item of oversize) lines.push(item.path)
    }
    writeFileAtomic(path.join(userDataDir, '.gitignore'), lines.join('\n') + '\n', 0o644)
    return oversize
  }

  // ---------- git 基础 ----------

  const isRepo = () => gitService.isRepo(userDataDir)

  async function git (args, opts) {
    return gitService.runGit(userDataDir, args, opts)
  }

  async function ensureRepo (branch) {
    // runGit 底层是 requireGitPath(): 没探测过会直接抛"未检测到 git"
    const gitInfo = await gitService.detectGit(false)
    if (!gitInfo.available) throw new gitService.GitError('NO_GIT', '未检测到 git，请先安装 git 后再使用仓库同步')
    if (!isRepo()) {
      const init = await git(['init', '-q'])
      if (!init.ok) throw new gitService.GitError('INIT_FAILED', '初始化版本库失败', init.stderr)
      log(`[Sync] 已初始化版本库: ${userDataDir}`)
    }
    const head = await git(['symbolic-ref', '--short', 'HEAD'])
    if (!head.ok) {
      // 空仓还没有 HEAD → 明确指向目标分支, 避免默认 master
      await git(['symbolic-ref', 'HEAD', `refs/heads/${branch}`])
    }
  }

  function authUrlFor (cfg) {
    const token = readToken()
    return gitService.buildAuthUrl({ remoteUrl: cfg.remoteUrl, username: cfg.username, token })
  }

  async function countChanges () {
    const res = await git(['status', '--porcelain'])
    if (!res.ok) return 0
    return res.stdout.split('\n').filter(line => line.trim()).length
  }

  async function previewInternal (cfg) {
    const oversize = writeIgnoreFile(cfg.scopes)
    const added = await git(['add', '-A', '--dry-run'])
    const entries = added.ok
      ? added.stdout.split('\n').map(l => {
          const m = /^add '(.+)'$/.exec(l.trim())
          return m ? m[1] : ''
        }).filter(Boolean)
      : []
    return {
      entries,
      count: entries.length,
      skipped: oversize,
      branch: cfg.branch,
      remoteUrl: gitService.publicRemoteUrl(cfg.remoteUrl)
    }
  }

  /** 白名单对应的精确路径 / 前缀 (用来判断某个已跟踪文件是否还该留在库里) */
  function allowSet (scopes) {
    const exact = new Set(['.gitignore'])
    const prefixes = []
    if (scopes.settings) exact.add('settings.json')
    if (scopes.installedPlugins) exact.add('installed-plugins.json')
    for (const entry of resolveScopes(scopes)) {
      exact.add(`hundundesktop-data/${entry.id}.json`)
      for (const rel of entry.paths) prefixes.push(`plugins/${entry.id}/${rel}`)
    }
    return { exact, prefixes }
  }

  const isAllowedPath = (p, { exact, prefixes }) =>
    exact.has(p) || prefixes.some(pre => p === pre || p.startsWith(pre))

  /**
   * 取消勾选某个插件后, 它已入库的文件仍会被 git 继续跟踪 (.gitignore 管不了已跟踪文件)。
   * 这里把它们**从索引**里移除 (`git rm --cached`, 不删本地文件), 让"取消勾选"真的生效。
   * 返回被移除的路径清单 —— 调用方必须把它显示给用户 (这是会传播到远端的删除)。
   */
  async function untrackDisallowed (scopes) {
    const allow = allowSet(scopes)
    const listed = await git(['ls-files'])
    if (!listed.ok) return []
    const tracked = listed.stdout.split('\n').map(s => s.trim()).filter(Boolean)
    const drop = tracked.filter(p => !isAllowedPath(p, allow))
    if (!drop.length) return []
    for (let i = 0; i < drop.length; i += 200) {
      const chunk = drop.slice(i, i + 200)
      await git(['rm', '--cached', '--ignore-unmatch', '-r', '--', ...chunk])
    }
    log(`[Sync] 已取消跟踪 ${drop.length} 个文件 (本地文件保留)`)
    return drop
  }

  // ---------- 对外: 状态 ----------

  async function status () {
    const cfg = readConfig()
    const plugins = listPlugins()
    const gitInfo = await gitService.detectGit(false)
    const state = {
      ok: true,
      config: publicConfig(cfg),
      hasToken: hasToken(),
      gitAvailable: gitInfo.available,
      gitVersion: gitInfo.version || '',
      initialized: isRepo(),
      pendingChanges: 0,
      plugins
    }
    if (gitInfo.available && isRepo()) {
      try {
        state.pendingChanges = await countChanges()
      } catch (_) {
        state.pendingChanges = 0
      }
    }
    return state
  }

  async function detectGit (refresh) {
    const info = await gitService.detectGit(!!refresh)
    return { ok: true, gitAvailable: info.available, gitVersion: info.version || '' }
  }

  // ---------- 对外: 配置 ----------

  async function updateConfig (patch = {}) {
    const cfg = readConfig()
    const next = { ...cfg }
    if (patch.scopes) next.scopes = normalizeScopes({ ...cfg.scopes, ...patch.scopes })
    if (patch.branch !== undefined) next.branch = normalizeBranch(patch.branch)
    if (patch.enabled !== undefined) next.enabled = !!patch.enabled
    // 右栏上栏的「Gitee 访问令牌」直接写这里: 空串 = 清除令牌
    if (patch.token !== undefined) {
      const saved = saveToken(patch.token)
      next.tokenStorage = saved.tokenStorage
    }
    writeConfig(next)
    return { ok: true, config: publicConfig(next) }
  }

  /** 关联远程仓库 (已有仓库地址)。空库首推, 有内容则合并。 */
  async function linkRemote ({ remoteUrl, username, token, branch, provider } = {}) {
    return withLock(async () => {
      const cfg = readConfig()
      const next = {
        ...cfg,
        enabled: true,
        provider: provider === 'gitee' ? 'gitee' : 'custom',
        remoteUrl: normalizeRemoteUrl(remoteUrl, allowLocalRemote),
        username: String(username || '').trim().slice(0, 100),
        branch: normalizeBranch(branch || cfg.branch),
        createdAt: cfg.createdAt || new Date().toISOString()
      }
      if (token !== undefined) {
        const saved = saveToken(token)
        next.tokenStorage = saved.tokenStorage
      } else if (!cfg.tokenStorage) {
        next.tokenStorage = null
      }
      writeConfig(next)
      try {
        await ensureRepo(next.branch)
        writeIgnoreFile(next.scopes)
        const result = await syncInternal(next)
        return {
          ok: true,
          code: result.code,
          state: await status(),
          conflicts: result.conflicts || [],
          skipped: result.skipped || [],
          untracked: result.untracked || []
        }
      } catch (error) {
        writeConfig({ ...next, lastResult: 'error' })
        throw error
      }
    })
  }

  // ---------- 对外: 预览 / 同步 ----------

  async function preview () {
    const cfg = readConfig()
    if (!cfg.remoteUrl) return { ok: false, code: 'NOT_LINKED', message: '尚未关联远程仓库' }
    return withLock(async () => {
      const gitInfo = await gitService.detectGit(false)
      if (!gitInfo.available) return { ok: false, code: 'NO_GIT', message: '未检测到 git，请先安装 git' }
      const info = await previewInternal(cfg)
      return { ok: true, ...info }
    })
  }

  async function syncInternal (cfg) {
    // 先探 git —— runGit 内部是 requireGitPath(), 没探测过会直接抛"未检测到 git"
    const gitInfo = await gitService.detectGit(false)
    if (!gitInfo.available) throw new gitService.GitError('NO_GIT', '未检测到 git，请先安装 git 后再使用仓库同步')

    await ensureRepo(cfg.branch)
    const oversize = writeIgnoreFile(cfg.scopes)
    // 取消勾选的插件: 已入库的文件从索引移除 (本地文件保留, 但会从远端消失 —— 必须回报)
    const untracked = await untrackDisallowed(cfg.scopes)

    // 1) 暂存 + 提交 (没有变化就跳过 commit)
    const add = await git(['add', '-A'])
    if (!add.ok) throw new gitService.GitError('ADD_FAILED', '暂存文件失败', add.stderr)
    const staged = await git(['diff', '--cached', '--name-only'])
    const stagedFiles = staged.ok ? staged.stdout.split('\n').filter(l => l.trim()) : []
    let committed = false
    if (stagedFiles.length) {
      const msg = `HundunDesktop 同步 ${new Date().toISOString()}`
      const commit = await git([...COMMIT_IDENTITY, 'commit', '-q', '-m', msg])
      if (!commit.ok) throw new gitService.GitError('COMMIT_FAILED', '创建提交失败', commit.stderr)
      committed = true
    }

    // 2) 拉取 + 合并 (远端为空/无该分支 → 视为首推)
    const url = authUrlFor(cfg)
    let remoteHasBranch = true
    const fetchRes = await git(['fetch', '--prune', url, cfg.branch])
    if (!fetchRes.ok) {
      const text = `${fetchRes.stderr}${fetchRes.stdout}`
      // 先判"分支不存在"再交给网络/鉴权分类 —— classifyNetworkError 一定会返回错误对象
      if (/couldn't find remote ref|no such remote ref|Remote branch .* not found/i.test(text)) {
        remoteHasBranch = false
      } else {
        throw gitService.classifyNetworkError(fetchRes, cfg)
      }
    }

    let conflicts = []
    if (remoteHasBranch) {
      const merge = await git(['merge', 'FETCH_HEAD', '--allow-unrelated-histories', '--no-edit',
        '-m', `合并远端改动 ${new Date().toISOString()}`])
      if (!merge.ok) {
        const text = `${merge.stderr}${merge.stdout}`
        if (/CONFLICT|Automatic merge failed/i.test(text)) {
          const list = await gitService.readConflicts(userDataDir, { ...cfg, token: '' }).catch(() => [])
          conflicts = Array.isArray(list) ? list : []
          return { ok: false, code: 'CONFLICT', conflicts, skipped: oversize, untracked, committed }
        }
        throw gitService.classifyNetworkError(merge, cfg)
      }
    }

    // 3) 推送
    const push = await git(['push', url, `HEAD:refs/heads/${cfg.branch}`])
    if (!push.ok) {
      const text = `${push.stderr}${push.stdout}`
      if (/non-fast-forward|\[rejected\]|fetch first/i.test(text)) {
        return { ok: false, code: 'REJECTED', message: '云端有本地没有的提交，请再同步一次', skipped: oversize, untracked, committed }
      }
      throw gitService.classifyNetworkError(push, cfg)
    }

    return { ok: true, code: 'OK', committed, skipped: oversize, untracked, conflicts: [] }
  }

  async function sync () {
    const cfg = readConfig()
    if (!cfg.remoteUrl) return { ok: false, code: 'NOT_LINKED', message: '尚未关联远程仓库' }
    if (!cfg.enabled) return { ok: false, code: 'DISABLED', message: '仓库同步未启用' }
    return withLock(async () => {
      const gitInfo = await gitService.detectGit(false)
      if (!gitInfo.available) return { ok: false, code: 'NO_GIT', message: '未检测到 git，请先安装 git' }
      try {
        const result = await syncInternal(cfg)
        writeConfig({ ...cfg, lastSyncAt: Date.now(), lastResult: result.ok ? 'ok' : result.code.toLowerCase() })
        return { ...result, state: await status() }
      } catch (error) {
        writeConfig({ ...cfg, lastResult: 'error' })
        throw error
      }
    })
  }

  // ---------- 对外: 四个显式动作 (拉取 / 推送 / 云端覆盖本地 / 本地覆盖云端) ----------
  //
  // 与 sync() 的区别: sync() 是"全流程一把梭"(commit→fetch→merge→push),
  // 这里拆成四个语义单一的动作, 用户点哪个就只做哪件事, 不做额外的事。
  //
  // 安全约定:
  //   - 拉取/推送都是非破坏的 (不 reset、不 force)
  //   - 两个"覆盖"是破坏性的, 但**执行前一定先打本地备份 tag**,
  //     出事了 `git reset --hard <tag>` 就能回来; 且只 reset/force, 绝不 clean
  //     —— 未被 git 跟踪的本地文件永远不动

  function assertReady (cfg) {
    if (!cfg.remoteUrl) throw new gitService.GitError('NOT_LINKED', '尚未关联远程仓库')
    if (!cfg.enabled) throw new gitService.GitError('DISABLED', '仓库同步未启用')
  }

  /** 工作区有改动就提交；没改动返回 false。调用方需先 writeIgnoreFile。 */
  async function commitLocal (prefix) {
    const add = await git(['add', '-A'])
    if (!add.ok) throw new gitService.GitError('ADD_FAILED', '暂存文件失败', add.stderr)
    const staged = await git(['diff', '--cached', '--name-only'])
    const stagedFiles = staged.ok ? staged.stdout.split('\n').filter(l => l.trim()) : []
    if (!stagedFiles.length) return { committed: false, count: 0 }
    const msg = `${prefix || 'HundunDesktop 同步'} ${new Date().toISOString()}`
    const commit = await git([...COMMIT_IDENTITY, 'commit', '-q', '-m', msg])
    if (!commit.ok) throw new gitService.GitError('COMMIT_FAILED', '创建提交失败', commit.stderr)
    return { committed: true, count: stagedFiles.length }
  }

  /**
   * 破坏性操作前留个指针: 本地 tag。
   * 只写本地 .git, 不推远端, 也不出现在文件系统里 —— 代价几乎为零。
   */
  async function makeBackupTag (label) {
    const head = await git(['rev-parse', '--verify', '--quiet', 'HEAD'])
    if (!head.ok) return null            // 还没有任何提交, 没东西可备份
    const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-')
    const name = `hundun-backup-${label}-${ts}`
    const res = await git(['tag', name])
    return res.ok ? name : null
  }

  /**
   * fetch 远端分支，并判断云端到底有没有内容。
   * 只靠 stderr 正则不够：远端是本地目录、或裸仓库没有该分支时，
   * git 可能静默成功且不写 FETCH_HEAD —— 所以再验一次 FETCH_HEAD。
   */
  async function fetchRemoteBranch (cfg) {
    const url = authUrlFor(cfg)
    const res = await git(['fetch', '--prune', url, cfg.branch])
    if (!res.ok) {
      const text = `${res.stderr}${res.stdout}`
      if (/couldn't find remote ref|no such remote ref|Remote branch .* not found/i.test(text)) {
        return { ok: true, hasContent: false }
      }
      throw gitService.classifyNetworkError(res, cfg)
    }
    const head = await git(['rev-parse', '--verify', '--quiet', 'FETCH_HEAD'])
    const sha = head.ok ? head.stdout.trim() : ''
    return { ok: true, hasContent: !!sha }
  }

  /** 从云端拉取到本地: fetch + merge, 不推。本地未提交的改动会先落成提交, 不会丢。 */
  async function pull () {
    const cfg = readConfig()
    assertReady(cfg)
    return withLock(async () => {
      await ensureRepo(cfg.branch)
      const oversize = writeIgnoreFile(cfg.scopes)
      const untracked = await untrackDisallowed(cfg.scopes)
      const local = await commitLocal('拉取前的本地改动')

      const fetched = await fetchRemoteBranch(cfg)
      if (!fetched.hasContent) {
        // 云端还没有这个分支: 没东西可拉, 也不算错
        writeConfig({ ...cfg, lastSyncAt: Date.now(), lastResult: 'ok' })
        return { ok: true, code: 'EMPTY_REMOTE', committed: local.committed, updated: false, changed: 0, skipped: oversize, untracked, conflicts: [] }
      }

      const before = await git(['rev-parse', 'HEAD'])
      const merge = await git(['merge', 'FETCH_HEAD', '--allow-unrelated-histories', '--no-edit',
        '-m', `合并云端改动 ${new Date().toISOString()}`])
      if (!merge.ok) {
        const text = `${merge.stderr}${merge.stdout}`
        if (/CONFLICT|Automatic merge failed/i.test(text)) {
          const list = await gitService.readConflicts(userDataDir, { ...cfg, token: '' }).catch(() => [])
          return { ok: false, code: 'CONFLICT', conflicts: Array.isArray(list) ? list : [], skipped: oversize, untracked, committed: local.committed }
        }
        throw gitService.classifyNetworkError(merge, cfg)
      }
      const after = await git(['rev-parse', 'HEAD'])
      const updated = !(before.ok && after.ok && before.stdout.trim() === after.stdout.trim())
      let changed = 0
      if (updated && before.ok) {
        const diff = await git(['diff', '--name-only', before.stdout.trim(), 'HEAD'])
        changed = diff.ok ? diff.stdout.split('\n').filter(l => l.trim()).length : 0
      }

      writeConfig({ ...cfg, lastSyncAt: Date.now(), lastResult: 'ok' })
      return { ok: true, code: 'OK', committed: local.committed, updated, changed, skipped: oversize, untracked, conflicts: [] }
    })
  }

  /** 从本地推送到云端: commit + push, 不拉不合并。云端更新过则拒绝, 让用户先拉。 */
  async function pushOnly () {
    const cfg = readConfig()
    assertReady(cfg)
    return withLock(async () => {
      await ensureRepo(cfg.branch)
      const oversize = writeIgnoreFile(cfg.scopes)
      const untracked = await untrackDisallowed(cfg.scopes)
      const local = await commitLocal('本地推送')

      const url = authUrlFor(cfg)
      const push = await git(['push', url, `HEAD:refs/heads/${cfg.branch}`])
      if (!push.ok) {
        const text = `${push.stderr}${push.stdout}`
        if (/non-fast-forward|\[rejected\]|fetch first/i.test(text)) {
          return {
            ok: false,
            code: 'REJECTED',
            message: '云端有本地没有的提交。先点「从云端拉取到本地」，或者用「从本地覆盖到云端」强制覆盖',
            committed: local.committed, skipped: oversize, untracked
          }
        }
        throw gitService.classifyNetworkError(push, cfg)
      }

      writeConfig({ ...cfg, lastSyncAt: Date.now(), lastResult: 'ok' })
      return { ok: true, code: 'OK', committed: local.committed, pushed: local.count, skipped: oversize, untracked }
    })
  }

  /**
   * 从云端覆盖到本地 (破坏性): 本地已跟踪文件回退成云端版本。
   * - 先打本地 tag 备份, 出事 `git reset --hard <backup>` 回来
   * - 只 `reset --hard`, 不 `clean` —— 未被跟踪的本地文件原样保留
   */
  async function overwriteLocal () {
    const cfg = readConfig()
    assertReady(cfg)
    return withLock(async () => {
      await ensureRepo(cfg.branch)
      writeIgnoreFile(cfg.scopes)

      const fetched = await fetchRemoteBranch(cfg)
      if (!fetched.hasContent) {
        return { ok: false, code: 'EMPTY_REMOTE', message: '云端还没有可用的内容，没有东西可以覆盖到本地' }
      }

      const backup = await makeBackupTag('before-local-overwrite')
      const reset = await git(['reset', '--hard', 'FETCH_HEAD'])
      if (!reset.ok) throw new gitService.GitError('RESET_FAILED', '覆盖本地失败', reset.stderr)

      let changed = 0
      if (backup) {
        const diff = await git(['diff', '--name-only', backup, 'HEAD'])
        changed = diff.ok ? diff.stdout.split('\n').filter(l => l.trim()).length : 0
      }

      writeConfig({ ...cfg, lastSyncAt: Date.now(), lastResult: 'ok' })
      return { ok: true, code: 'OK', backup, changed, detail: String(reset.stdout || '').trim() }
    })
  }

  /**
   * 从本地覆盖到云端 (破坏性): `push --force`, 云端历史被本地历史替换。
   * - 先打本地 tag 备份（覆盖前那一刻的本地状态）
   * - 调用方必须先拿到用户二次确认（IPC 层校验 confirm）
   */
  async function overwriteRemote () {
    const cfg = readConfig()
    assertReady(cfg)
    return withLock(async () => {
      await ensureRepo(cfg.branch)
      const oversize = writeIgnoreFile(cfg.scopes)
      const untracked = await untrackDisallowed(cfg.scopes)
      const local = await commitLocal('覆盖云端前快照')

      const backup = await makeBackupTag('before-remote-overwrite')
      const url = authUrlFor(cfg)
      const push = await git(['push', '--force', url, `HEAD:refs/heads/${cfg.branch}`])
      if (!push.ok) throw gitService.classifyNetworkError(push, cfg)

      writeConfig({ ...cfg, lastSyncAt: Date.now(), lastResult: 'ok' })
      return { ok: true, code: 'OK', backup, committed: local.committed, skipped: oversize, untracked }
    })
  }

  // ---------- 对外: 冲突解决 (只按文件取值, 不做 reset) ----------

  async function resolveConflicts (strategy) {
    if (!['local', 'cloud'].includes(strategy)) {
      throw new gitService.GitError('BAD_STRATEGY', '未知的冲突处理方式')
    }
    const cfg = readConfig()
    return withLock(async () => {
      const list = await gitService.readConflicts(userDataDir, { ...cfg, token: '' }).catch(() => [])
      const files = Array.isArray(list) ? list.map(item => (item && item.path) || '').filter(Boolean) : []
      if (!files.length) return { ok: false, code: 'NO_CONFLICT', message: '当前没有待解决的冲突', resolved: [] }
      for (const file of files) {
        const pick = await git(['checkout', strategy === 'local' ? '--ours' : '--theirs', '--', file])
        if (!pick.ok) throw new gitService.GitError('CHECKOUT_FAILED', `取用${strategy === 'local' ? '本地' : '云端'}版本失败: ${file}`, pick.stderr)
        await git(['add', '--', file])
      }
      const commit = await git([...COMMIT_IDENTITY, 'commit', '-q', '-m', `解决冲突 (${strategy === 'local' ? '保留本地' : '采用云端'})`])
      if (!commit.ok && !/nothing to commit/i.test(`${commit.stdout}${commit.stderr}`)) {
        throw new gitService.GitError('COMMIT_FAILED', '提交冲突解决结果失败', commit.stderr)
      }
      const result = await syncInternal(cfg)
      writeConfig({ ...cfg, lastSyncAt: Date.now(), lastResult: result.ok ? 'ok' : result.code.toLowerCase() })
      return { ok: result.ok, code: result.code, resolved: files, conflicts: result.conflicts || [], state: await status() }
    })
  }

  // ---------- 对外: Gitee 代建仓库 ----------

  async function fetchJson (url, init) {
    if (!fetchImpl) throw new gitService.GitError('NO_FETCH', '当前运行环境不支持网络请求')
    const res = await fetchImpl(url, {
      ...init,
      headers: { Accept: 'application/json', ...(init && init.headers) }
    })
    let body = null
    try {
      body = await res.json()
    } catch (_) {
      body = null
    }
    return { status: res.status, ok: res.ok, body }
  }

  /**
   * 用令牌在 Gitee 上代建仓库 (默认私有)，成功后直接关联。
   * @param {{token?:string, name?:string, description?:string, private?:boolean}} opts
   */
  async function createGiteeRepo (optsIn = {}) {
    const token = String(optsIn.token || readToken() || '').trim()
    if (!token) throw new gitService.GitError('NO_TOKEN', '请先填写 Gitee 访问令牌')
    const baseName = String(optsIn.name || 'hundun-data').trim().replace(/[^\w.-]/g, '-').slice(0, 60) || 'hundun-data'
    const isPrivate = optsIn.private !== false

    // 1) 取当前账号 (确认令牌有效 + 拿到 login 拼 clone 地址)
    const me = await fetchJson(`${GITEE_API}/user?access_token=${encodeURIComponent(token)}`)
    if (!me.ok || !me.body || !me.body.login) {
      throw new gitService.GitError('BAD_TOKEN', '令牌无效或没有权限（请确认勾选 projects 权限）')
    }
    const login = String(me.body.login)

    // 2) 建仓 (名字被占用则依次试 -2 … -5)
    const tried = []
    for (let i = 1; i <= 5; i++) {
      const name = i === 1 ? baseName : `${baseName}-${i}`
      tried.push(name)
      const created = await fetchJson(`${GITEE_API}/user/repos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: token,
          name,
          path: name,
          private: isPrivate,
          has_issues: false,
          has_wiki: false,
          auto_init: false,
          description: String(optsIn.description || 'HundunDesktop 用户数据')
        })
      })
      if (created.ok && created.body && created.body.full_name) {
        const remoteUrl = `https://gitee.com/${created.body.full_name}.git`
        const linked = await linkRemote({ remoteUrl, token, username: login, branch: BRANCH_DEFAULT, provider: 'gitee' })
        return { ok: true, name: created.body.name || name, remoteUrl, login, linked }
      }
      const message = String((created.body && (created.body.message || created.body.error)) || '')
      // 400/422 且提示已存在 → 换名字重试；其它错误直接抛
      if (created.status !== 400 && created.status !== 422) {
        throw new gitService.GitError('GITEE_FAILED', `创建仓库失败 (HTTP ${created.status}) ${message}`.trim())
      }
      log(`[Sync] Gitee 仓库名 ${name} 不可用: ${message}`)
    }
    throw new gitService.GitError('GITEE_NAME_TAKEN', `仓库名 ${tried.join(' / ')} 都被占用，请手动换个名字`)
  }

  return {
    userDataDir,
    syncDir,
    // 配置
    readConfig,
    publicConfig,
    updateConfig,
    // 令牌
    hasToken,
    saveToken,
    readToken,
    // 状态
    status,
    detectGit,
    preview,
    // 仓库
    linkRemote,
    createGiteeRepo,
    sync,
    pull,
    push: pushOnly,
    overwriteLocal,
    overwriteRemote,
    resolveConflicts,
    // 给测试用
    _internal: { buildIgnoreLines, scanOversize, writeIgnoreFile, listPlugins, MAX_FILE_BYTES }
  }
}

// ========== 单例 (主进程用; 才需要 electron) ==========

let _instance = null

function getSyncService () {
  if (_instance) return _instance
  const { app, safeStorage } = require('electron')
  const { resolvePluginsDirs } = require('./paths')
  _instance = createSyncService({
    userDataDir: app.getPath('userData'),
    pluginsDirs: resolvePluginsDirs(),
    safeStorage,
    log: (msg) => console.log(msg)
  })
  return _instance
}

module.exports = {
  createSyncService,
  getSyncService,
  MAX_FILE_BYTES,
  DEFAULT_SCOPES,
  SYNC_DIRNAME
}
