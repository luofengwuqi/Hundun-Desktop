// ========== 检查更新服务 (决策62, 决策73, 决策74) ==========
// 主更新源用 GitHub Releases; 预留 feed 抽象 —— 后续自建服务器时只需
// 把 UPDATE_FEED 换成 { type:'custom', api:..., page:... } 并在 ALLOWED_HOSTS
// 放行对应域名, 解析层再做适配, 渲染层与 IPC 契约不变。
// 决策73: 中国大陆访问 api.github.com 不稳, 新增 GITEE_FEED 备用源 ——
// 主源失败时退回 Gitee 检测版本号, 解决「刚下载完检测不到最新 release」。
// 决策74: 更新改为「下载 + 装好」, 不再开浏览器 —— 本模块新增安装包定位
//        (resolveDownloadSources) 与流式下载 (downloadTo)。Gitee 附件是国内
//        唯一直连可用的下载源, 故解析顺序 Gitee 优先、GitHub 兜底; 版本必须
//        与目标 tag 完全一致, 避免下到旧包覆盖新版本。
// 设计约定 (与 git-service 同风格): 零依赖、fetch 注入可单测、返回 { ok } 结构不抛异常。
'use strict'
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// 更新源配置: 本期固定 GitHub (公开仓库, 匿名限额 60 次/小时/IP, 检查更新频度足够)
const UPDATE_FEED = {
  type: 'github',
  owner: 'luofengwuqi',
  repo: 'Hundun-Desktop',
  // GitHub Releases latest API —— 302 重定向到最新非 prerelease、非 draft 的 Release
  api: 'https://api.github.com/repos/luofengwuqi/Hundun-Desktop/releases/latest',
  // 按 tag 精确取某个 Release —— 下载时用这个, 不依赖 latest 指针 (见 decision 74 补充)
  tagApi: 'https://api.github.com/repos/luofengwuqi/Hundun-Desktop/releases/tags/{tag}',
  // 发现新版本后让用户打开的 Release 页面
  page: 'https://github.com/luofengwuqi/Hundun-Desktop/releases/latest'
}

// 更新源 URL 白名单: 必须 https 且 host 在列 (即使未来接自建 feed 也要先放行域名)
const ALLOWED_HOSTS = new Set(['api.github.com', 'github.com', 'gitee.com'])

// 备用更新源 (决策73): 中国大陆访问 api.github.com 经常超时/被墙,
// 「刚下载完却检测不到最新 release」即由此而来。Gitee 为国内平台、访问稳定,
// 主源失败时退回 Gitee 检测版本号 (只比对 tag_name, 不依赖其安装包资产)。
const GITEE_FEED = {
  type: 'gitee',
  owner: 'luofengwuqi',
  repo: 'chaos-lite',
  // Gitee Releases latest API —— 返回最新非 prerelease 的 Release (含 tag_name / created_at)
  // 注意: Gitee 的 latest 是「最近发布/更新」的那条, 编辑旧 Release 的正文会把它顶飞,
  //       所以下载一律按 tag 精确取, latest 只用于「检查有没有新版本」
  api: 'https://gitee.com/api/v5/repos/luofengwuqi/chaos-lite/releases/latest',
  tagApi: 'https://gitee.com/api/v5/repos/luofengwuqi/chaos-lite/releases/tags/{tag}',
  // 备用源没有 html_url 字段, 展示页由 extractReleaseInfo 按 owner/repo/tag 拼出
  page: 'https://gitee.com/luofengwuqi/chaos-lite/releases'
}

// 单次请求超时 (毫秒)
const TIMEOUT_MS = 10000

function isAllowedFeedUrl (url) {
  try {
    const u = new URL(String(url || ''))
    return u.protocol === 'https:' && ALLOWED_HOSTS.has(u.hostname)
  } catch (e) {
    return false
  }
}

// 'v2026.4.1' / '2026.4.1' -> [2026, 4, 1]; 非法 (含 prerelease 后缀) 返回 null
function parseVersion (text) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(text || '').trim())
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

// a > b -> 1; a < b -> -1; 相等 -> 0; 任一版本非法 -> null
// 注意三段都是数字比较 (2026.4.10 > 2026.4.9), 不是字符串比较
function compareVersions (a, b) {
  const va = parseVersion(a)
  const vb = parseVersion(b)
  if (!va || !vb) return null
  for (let i = 0; i < 3; i++) {
    if (va[i] !== vb[i]) return va[i] > vb[i] ? 1 : -1
  }
  return 0
}

// 安装包类型 → 文件名后缀 (决策74)。linux 分两种: deb 走系统包管理, AppImage 自替换
const ASSET_SUFFIX = { deb: '.deb', appimage: '.appimage', exe: '.exe', dmg: '.dmg' }
// 安装包类型 → 平台 (给 extractReleaseInfo 的旧接口用)
const KIND_PLATFORM = { deb: 'linux', appimage: 'linux', exe: 'win32', dmg: 'darwin' }

// 本次运行该下载哪种安装包 (决策74): AppImage 运行时 process.env.APPIMAGE 有值,
// 否则 Linux 视为 deb 安装 (deb 装到 /opt, 只能靠 dpkg 升级); 未打包 (dev) 返回 null
function detectTargetKind ({ platform, isPackaged, appImagePath } = {}) {
  if (!isPackaged) return null
  if (platform === 'win32') return 'exe'
  if (platform === 'darwin') return 'dmg'
  if (platform === 'linux') return appImagePath ? 'appimage' : 'deb'
  return null
}

// 按安装包类型挑资产; 找不到返回 null
function pickAssetFor (assets, kind) {
  const suffix = ASSET_SUFFIX[kind]
  if (!suffix) return null
  const list = Array.isArray(assets) ? assets : []
  return list.find(a => a && typeof a.name === 'string' && a.name.toLowerCase().endsWith(suffix)) || null
}

// 按平台挑选安装包资产 (决策62): win32 -> NSIS .exe; linux -> .deb 优先、退回 .AppImage; darwin -> .dmg
// blockmap 文件以 .exe.blockmap 结尾, 不会被 endsWith('.exe') 命中
function pickAsset (assets, platform) {
  if (platform === 'win32') return pickAssetFor(assets, 'exe')
  if (platform === 'darwin') return pickAssetFor(assets, 'dmg')
  return pickAssetFor(assets, 'deb') || pickAssetFor(assets, 'appimage')
}

// 从一个 release JSON 里汇总该类型的所有可下载资产 (可能多个源各有一份)
// digest 只有 GitHub 新上传的资产才有 (sha256:...), Gitee 没有 → 空串跳过校验
function collectAssetCandidates (json, kind, feed) {
  const suffix = ASSET_SUFFIX[kind]
  if (!suffix) return []
  const list = json && Array.isArray(json.assets) ? json.assets : []
  return list
    .filter(a => a && typeof a.name === 'string' && a.name.toLowerCase().endsWith(suffix))
    .map(a => ({
      url: String(a.browser_download_url || ''),
      name: a.name,
      size: Number(a.size) || 0,
      digest: typeof a.digest === 'string' ? a.digest : '',
      feedType: (feed && feed.type) || ''
    }))
    .filter(a => isAllowedFeedUrl(a.url))
}

// 从 release JSON 中抽取本平台关心的字段; 结构不合预期返回 null。
// feed 可选: 传入 Gitee feed 时适配其字段差异 (无 html_url → 按 owner/repo/tag 拼;
//          无 published_at → 退用 created_at)
function extractReleaseInfo (json, platform, feed) {
  if (!json || typeof json !== 'object') return null
  const parsed = parseVersion(json.tag_name)
  if (!parsed) return null // draft/prerelease 或非日期式版本号一律视为不可用
  const asset = pickAsset(json.assets, platform)
  const tagName = String(json.tag_name)
  let htmlUrl = typeof json.html_url === 'string' ? json.html_url : ''
  if (!htmlUrl && feed && feed.type === 'gitee' && feed.owner && feed.repo) {
    htmlUrl = `https://gitee.com/${feed.owner}/${feed.repo}/releases/tag/${tagName}`
  }
  return {
    version: parsed.join('.'),
    tagName,
    htmlUrl,
    downloadUrl: asset && typeof asset.browser_download_url === 'string' ? asset.browser_download_url : '',
    assetName: asset ? asset.name : '',
    publishedAt: typeof json.published_at === 'string'
      ? json.published_at
      : (typeof json.created_at === 'string' ? json.created_at : '')
  }
}

// 拉一份 release JSON。tag 省略时用 latest; 传 tag 时优先按 tag 精确取
// (Gitee/GitHub 都支持 /releases/tags/{tag}), 取不到再退回 latest 由调用方校验版本。
// fetchImpl 注入便于单测; 返回 { ok:true, json, viaTag } 或 { ok:false, reason }
async function fetchReleaseJson (feed, fetchImpl, tag) {
  const impl = typeof fetchImpl === 'function' ? fetchImpl : fetch
  const latestUrl = (feed && feed.api) || UPDATE_FEED.api
  const tagUrl = tag && feed && feed.tagApi ? String(feed.tagApi).replace('{tag}', encodeURIComponent(tag)) : ''
  const urls = [tagUrl, latestUrl].filter(Boolean)

  let lastErr = null
  for (let i = 0; i < urls.length; i++) {
    const feedUrl = urls[i]
    const viaTag = i === 0 && !!tagUrl
    if (!isAllowedFeedUrl(feedUrl)) {
      lastErr = { ok: false, reason: 'feed-url-not-allowed', feedUrl }
      continue
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const resp = await impl(feedUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'HundunDesktop-UpdateCheck',
          Accept: 'application/vnd.github+json'
        }
      })
      if (!resp.ok) {
        lastErr = { ok: false, reason: 'http-' + resp.status, status: resp.status }
        continue
      }
      return { ok: true, json: await resp.json(), viaTag }
    } catch (err) {
      const aborted = err && (err.name === 'AbortError' || (err.responseInfo && err.responseInfo.status === 'ABORT_ERR'))
      lastErr = {
        ok: false,
        reason: aborted ? 'timeout' : 'network',
        detail: String((err && err.message) || err)
      }
    } finally {
      clearTimeout(timer)
    }
  }
  return lastErr || { ok: false, reason: 'network' }
}

// 拉取最新 Release。返回 { ok:true, release, feedPage } 或 { ok:false, reason }
async function fetchLatestRelease (feed, platform, fetchImpl) {
  const res = await fetchReleaseJson(feed, fetchImpl)
  if (!res.ok) return res
  const info = extractReleaseInfo(res.json, platform, feed)
  if (!info) return { ok: false, reason: 'bad-payload' }
  return { ok: true, release: info, feedPage: (feed && feed.page) || UPDATE_FEED.page }
}

// 一次完整检查: 当前版本 vs 最新版本。
// 决策73: 主源 (默认 GitHub) 失败时退回 Gitee 备用源 —— 国内网络下 GitHub 不可达
//         也能靠 Gitee 的 tag_name 判定「是否有新版本」。
async function checkForUpdate (currentVersion, platform, feed, fetchImpl) {
  const cur = parseVersion(currentVersion)
  if (!cur) return { ok: false, reason: 'bad-current-version', currentVersion: String(currentVersion || '') }
  const primary = feed || UPDATE_FEED
  const feeds = primary === GITEE_FEED ? [primary] : [primary, GITEE_FEED]
  // 两个源并行查, 取版本最高的那个 —— 任一源的 latest 指针过期/被编辑顶飞,
  // 都不会让用户误以为「已是最新」(决策74 补充: Gitee 编辑旧 Release 正文会顶飞 latest)
  const results = await Promise.all(feeds.map(f => fetchLatestRelease(f, platform, fetchImpl)))
  const usable = results.map((r, i) => ({ r, feed: feeds[i] })).filter(x => x.r.ok)
  if (!usable.length) return results[0]
  let best = usable[0]
  for (const cand of usable.slice(1)) {
    if (compareVersions(cand.r.release.version, best.r.release.version) === 1) best = cand
  }
  return {
    ok: true,
    hasUpdate: compareVersions(best.r.release.version, currentVersion) === 1,
    currentVersion: cur.join('.'),
    latest: best.r.release,
    feedPage: best.r.feedPage,
    usedFallback: !results[0].ok,
    feeds: usable.map(x => x.feed.type)
  }
}

// ========== 决策74: 安装包定位与下载 ==========

// 目标版本的可下载源, 按 feeds 顺序 (默认 Gitee 优先) 逐个 latest 取:
// 只认 tag 与目标版本完全一致的 release (避免 latest 已滚到更新的版本时下错包),
// 同一 URL 只留一次。
async function resolveDownloadSources (targetVersion, kind, feeds, fetchImpl) {
  const target = parseVersion(targetVersion)
  if (!target) return { ok: false, reason: 'bad-target-version', targetVersion: String(targetVersion || '') }
  if (!ASSET_SUFFIX[kind]) return { ok: false, reason: 'bad-target-kind', kind }
  const list = Array.isArray(feeds) && feeds.length ? feeds : [GITEE_FEED, UPDATE_FEED]
  const sources = []
  const seen = new Set()
  const errors = []
  const tag = 'v' + target.join('.')
  for (const feed of list) {
    const res = await fetchReleaseJson(feed, fetchImpl, tag)
    if (!res.ok) {
      errors.push({ feed: (feed && feed.type) || 'unknown', reason: res.reason })
      continue
    }
    const parsed = parseVersion(res.json && res.json.tag_name)
    if (!parsed || parsed.join('.') !== target.join('.')) {
      errors.push({ feed: (feed && feed.type) || 'unknown', reason: 'version-mismatch' })
      continue
    }
    const found = collectAssetCandidates(res.json, kind, feed)
    if (!found.length) errors.push({ feed: (feed && feed.type) || 'unknown', reason: 'no-asset' })
    for (const a of found) {
      if (seen.has(a.url)) continue
      seen.add(a.url)
      sources.push(a)
    }
  }
  if (!sources.length) return { ok: false, reason: 'no-asset', kind, errors }
  return { ok: true, sources, errors }
}

// 安装包魔数校验 (决策74): 下载完先认文件头, 防止拿到 HTML 错误页 / 半截文件就当安装包执行
function verifyFileMagic (filePath, kind) {
  let fd = null
  try {
    fd = fs.openSync(filePath, 'r')
    const head = Buffer.alloc(8)
    const read = fs.readSync(fd, head, 0, 8, 0)
    if (read < 2) return { ok: false, reason: 'file-empty' }
    const hex = head.subarray(0, read)
    if (kind === 'deb') {
      // ar 归档: "!<arch>\n"
      const arMagic = Buffer.from('!<arch>\n')
      const ok = read >= arMagic.length && hex.subarray(0, arMagic.length).equals(arMagic)
      return ok ? { ok: true } : { ok: false, reason: 'not-a-deb' }
    }
    if (kind === 'appimage') {
      const elf = hex.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))
      return elf ? { ok: true } : { ok: false, reason: 'not-an-appimage' }
    }
    if (kind === 'exe') {
      return hex[0] === 0x4d && hex[1] === 0x5a ? { ok: true } : { ok: false, reason: 'not-an-exe' }
    }
    return { ok: true } // dmg 的校验在末尾 (koly), 这里不做头部判断
  } catch (err) {
    return { ok: false, reason: 'file-unreadable', detail: String((err && err.message) || err) }
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd) } catch (e) { /* ignore */ }
    }
  }
}

// 流式下载到 destPath: 写 .part 临时文件, 校验大小/摘要后原子改名。
// 空闲超时 (idleTimeout) 而不是总超时 —— 73MB 的 deb 在慢网下总时长可能几分钟。
// 返回 { ok:true, path, size, sha256 } 或 { ok:false, reason }
async function downloadTo (url, destPath, opts = {}) {
  const impl = typeof opts.fetchImpl === 'function' ? opts.fetchImpl : fetch
  const idleMs = Number(opts.idleTimeout) > 0 ? Number(opts.idleTimeout) : 30000
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null
  const expectedSize = Number(opts.expectedSize) || 0
  if (!isAllowedFeedUrl(url)) return { ok: false, reason: 'url-not-allowed' }

  const tmpPath = String(destPath) + '.part'
  const controller = new AbortController()
  let idleTimer = null
  let stream = null
  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => controller.abort(), idleMs)
  }
  const cleanup = () => {
    if (idleTimer) clearTimeout(idleTimer)
    try { fs.unlinkSync(tmpPath) } catch (e) { /* ignore */ }
  }

  resetIdle()
  let resp
  try {
    resp = await impl(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'HundunDesktop-UpdateCheck', Accept: '*/*' }
    })
  } catch (err) {
    cleanup()
    const aborted = err && err.name === 'AbortError'
    return { ok: false, reason: aborted ? 'timeout' : 'network', detail: String((err && err.message) || err) }
  }
  if (!resp.ok) {
    cleanup()
    return { ok: false, reason: 'http-' + resp.status, status: resp.status }
  }

  const headerTotal = Number(resp.headers && resp.headers.get ? resp.headers.get('content-length') : 0) || 0
  const total = expectedSize || headerTotal
  const hash = crypto.createHash('sha256')
  let received = 0
  try {
    fs.mkdirSync(path.dirname(destPath), { recursive: true })
    stream = fs.createWriteStream(tmpPath)
    // 只挂一个 error 监听 (每块都挂会触发 MaxListenersExceededWarning)
    let streamError = null
    stream.on('error', err => { streamError = err })
    const writeChunk = async (chunk) => {
      if (!stream.write(chunk)) {
        await new Promise(resolve => {
          const onDrain = () => { stream.removeListener('drain', onDrain); resolve() }
          stream.once('drain', onDrain)
        })
      }
      if (streamError) throw streamError
    }
    if (resp.body && typeof resp.body.getReader === 'function') {
      const reader = resp.body.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value || !value.length) continue
        received += value.length
        hash.update(Buffer.from(value))
        resetIdle()
        await writeChunk(Buffer.from(value))
        if (onProgress) onProgress({ received, total })
      }
    } else {
      const buf = Buffer.from(await resp.arrayBuffer())
      received = buf.length
      hash.update(buf)
      await writeChunk(buf)
    }
    await new Promise((resolve, reject) => stream.end(err => (err ? reject(err) : resolve())))
    stream = null
  } catch (err) {
    if (stream) {
      try { stream.destroy() } catch (e) { /* ignore */ }
    }
    cleanup()
    const aborted = err && err.name === 'AbortError'
    return { ok: false, reason: aborted ? 'timeout' : 'write-failed', detail: String((err && err.message) || err) }
  }
  if (idleTimer) clearTimeout(idleTimer)

  if (!received) { cleanup(); return { ok: false, reason: 'empty-body' } }
  if (total > 0 && received !== total) {
    cleanup()
    return { ok: false, reason: 'size-mismatch', received, expected: total }
  }
  try {
    fs.renameSync(tmpPath, destPath)
  } catch (err) {
    cleanup()
    return { ok: false, reason: 'write-failed', detail: String((err && err.message) || err) }
  }
  return { ok: true, path: destPath, size: received, sha256: hash.digest('hex') }
}

// 安装步骤计划 (决策74, 纯函数便于单测): 返回按序尝试的命令列表。
// deb: 先试免密 sudo (开发机常见 NOPASSWD), 不行再走 pkexec 弹系统密码框;
//      optional=true 表示该步失败可以继续下一步, 否则失败即中止。
// exe: NSIS 静默安装 /S (per-user 安装不需要管理员), 装完由安装器重启应用。
function planInstallSteps (kind, ctx = {}) {
  const file = String(ctx.filePath || '')
  if (!file) return { ok: false, reason: 'missing-file' }
  if (kind === 'deb') {
    return {
      ok: true,
      mode: 'deb',
      steps: [
        { cmd: 'sudo', args: ['-n', 'dpkg', '-i', file], optional: true },
        { cmd: 'pkexec', args: ['dpkg', '-i', file], optional: false }
      ]
    }
  }
  if (kind === 'exe') {
    return { ok: true, mode: 'nsis', steps: [{ cmd: file, args: ['/S'], optional: false, detached: true }] }
  }
  if (kind === 'dmg') {
    return { ok: true, mode: 'dmg', steps: [{ cmd: 'open', args: [file], optional: false }], manual: true }
  }
  if (kind === 'appimage') {
    // AppImage 不跑外部命令: 原地替换文件后重启 (由 update-installer 处理)
    return { ok: true, mode: 'appimage', steps: [] }
  }
  return { ok: false, reason: 'bad-target-kind', kind }
}

module.exports = {
  UPDATE_FEED,
  GITEE_FEED,
  ALLOWED_HOSTS,
  TIMEOUT_MS,
  ASSET_SUFFIX,
  KIND_PLATFORM,
  isAllowedFeedUrl,
  parseVersion,
  compareVersions,
  detectTargetKind,
  pickAssetFor,
  pickAsset,
  collectAssetCandidates,
  fetchReleaseJson,
  extractReleaseInfo,
  fetchLatestRelease,
  resolveDownloadSources,
  downloadTo,
  verifyFileMagic,
  planInstallSteps,
  checkForUpdate
}
