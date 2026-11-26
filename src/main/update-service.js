// ========== 检查更新服务 (决策62, 决策73) ==========
// 主更新源用 GitHub Releases; 预留 feed 抽象 —— 后续自建服务器时只需
// 把 UPDATE_FEED 换成 { type:'custom', api:..., page:... } 并在 ALLOWED_HOSTS
// 放行对应域名, 解析层再做适配, 渲染层与 IPC 契约不变。
// 决策73: 中国大陆访问 api.github.com 不稳, 新增 GITEE_FEED 备用源 ——
// 主源失败时退回 Gitee 检测版本号, 解决「刚下载完检测不到最新 release」。
// 设计约定 (与 git-service 同风格): 零依赖、fetch 注入可单测、返回 { ok } 结构不抛异常。
'use strict'

// 更新源配置: 本期固定 GitHub (公开仓库, 匿名限额 60 次/小时/IP, 检查更新频度足够)
const UPDATE_FEED = {
  type: 'github',
  owner: 'luofengwuqi',
  repo: 'Hundun-Desktop',
  // GitHub Releases latest API —— 302 重定向到最新非 prerelease、非 draft 的 Release
  api: 'https://api.github.com/repos/luofengwuqi/Hundun-Desktop/releases/latest',
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
  api: 'https://gitee.com/api/v5/repos/luofengwuqi/chaos-lite/releases/latest',
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

// 按平台挑选安装包资产 (决策62): win32 -> NSIS .exe; linux -> .deb 优先、退回 .AppImage; darwin -> .dmg
// blockmap 文件以 .exe.blockmap 结尾, 不会被 endsWith('.exe') 命中
function pickAsset (assets, platform) {
  const list = Array.isArray(assets) ? assets : []
  const names = list.filter(a => a && typeof a.name === 'string')
  const endsWith = suffix => names.find(a => a.name.toLowerCase().endsWith(suffix)) || null
  if (platform === 'win32') return endsWith('.exe')
  if (platform === 'darwin') return endsWith('.dmg')
  return endsWith('.deb') || endsWith('.appimage')
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

// 拉取最新 Release。fetchImpl 注入便于单测; 返回 { ok:true, release, feedPage } 或 { ok:false, reason }
async function fetchLatestRelease (feed, platform, fetchImpl) {
  const impl = typeof fetchImpl === 'function' ? fetchImpl : fetch
  const feedUrl = (feed && feed.api) || UPDATE_FEED.api
  if (!isAllowedFeedUrl(feedUrl)) {
    return { ok: false, reason: 'feed-url-not-allowed', feedUrl }
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
      return { ok: false, reason: 'http-' + resp.status, status: resp.status }
    }
    const json = await resp.json()
    const info = extractReleaseInfo(json, platform, feed)
    if (!info) return { ok: false, reason: 'bad-payload' }
    return { ok: true, release: info, feedPage: (feed && feed.page) || UPDATE_FEED.page }
  } catch (err) {
    const aborted = err && (err.name === 'AbortError' || (err.responseInfo && err.responseInfo.status === 'ABORT_ERR'))
    return {
      ok: false,
      reason: aborted ? 'timeout' : 'network',
      detail: String((err && err.message) || err)
    }
  } finally {
    clearTimeout(timer)
  }
}

// 一次完整检查: 当前版本 vs 最新版本。
// 决策73: 主源 (默认 GitHub) 失败时退回 Gitee 备用源 —— 国内网络下 GitHub 不可达
//         也能靠 Gitee 的 tag_name 判定「是否有新版本」。
async function checkForUpdate (currentVersion, platform, feed, fetchImpl) {
  const cur = parseVersion(currentVersion)
  if (!cur) return { ok: false, reason: 'bad-current-version', currentVersion: String(currentVersion || '') }
  const primary = feed || UPDATE_FEED
  let res = await fetchLatestRelease(primary, platform, fetchImpl)
  let usedFallback = false
  if (!res.ok && primary !== GITEE_FEED) {
    res = await fetchLatestRelease(GITEE_FEED, platform, fetchImpl)
    usedFallback = true
  }
  if (!res.ok) return res
  return {
    ok: true,
    hasUpdate: compareVersions(res.release.version, currentVersion) === 1,
    currentVersion: cur.join('.'),
    latest: res.release,
    feedPage: res.feedPage,
    usedFallback
  }
}

module.exports = {
  UPDATE_FEED,
  GITEE_FEED,
  ALLOWED_HOSTS,
  TIMEOUT_MS,
  isAllowedFeedUrl,
  parseVersion,
  compareVersions,
  pickAsset,
  extractReleaseInfo,
  fetchLatestRelease,
  checkForUpdate
}
