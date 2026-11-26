/**
 * 检查更新服务测试 (决策62)
 *
 * 运行: /home/wuqi/.workbuddy/binaries/node/versions/22.22.2/bin/node scripts/test-check-update.js
 *       (退出码 0 = 全过; 纯 Node, 不依赖 electron)
 *
 * 覆盖:
 *   A. parseVersion / compareVersions 数字三段比较
 *   B. isAllowedFeedUrl 白名单 (https + host)
 *   C. pickAsset 平台资产选择 (exe / deb 优先退 appimage / dmg / blockmap 不误中)
 *   D. extractReleaseInfo 结构校验 (非法 tag_name / 缺 assets)
 *   E. fetchLatestRelease 各失败路径 (url 不放行 / http 错误 / 超时 / 网络 / 坏 payload)
 *   F. checkForUpdate 端到端 (有更新 / 无更新 / 当前版本非法) + fetch 调用参数
 */
'use strict'
const assert = require('assert')
const svc = require('../src/main/update-service')

let passed = 0
const ok = (name) => { passed++; console.log('  ✓ ' + name) }

// ---------- A. 版本解析与比较 ----------
console.log('A. parseVersion / compareVersions')
assert.deepStrictEqual(svc.parseVersion('2026.4.1'), [2026, 4, 1]); ok('解析 2026.4.1')
assert.deepStrictEqual(svc.parseVersion('v2026.4.1'), [2026, 4, 1]); ok('容忍 v 前缀')
assert.strictEqual(svc.parseVersion('2026.4.1-beta.1'), null); ok('prerelease 后缀拒绝')
assert.deepStrictEqual(svc.parseVersion('26.2.1024'), [26, 2, 1024]); ok('旧三段号也能解析 (比较层拒绝依赖调用方)')
assert.strictEqual(svc.parseVersion(''), null); ok('空串拒绝')
assert.strictEqual(svc.parseVersion(null), null); ok('null 拒绝')
assert.strictEqual(svc.compareVersions('2026.4.10', '2026.4.9'), 1); ok('数字比较: 2026.4.10 > 2026.4.9 (非字符串比较)')
assert.strictEqual(svc.compareVersions('2026.4.2', '2026.4.10'), -1); ok('2026.4.2 < 2026.4.10')
assert.strictEqual(svc.compareVersions('v2027.1.1', '2026.4.99'), 1); ok('年份段优先')
assert.strictEqual(svc.compareVersions('2026.4.1', 'v2026.4.1'), 0); ok('相等 (v 前缀归一)')
assert.strictEqual(svc.compareVersions('2026.4.1', 'bad'), null); ok('非法版本返回 null')

// ---------- B. URL 白名单 ----------
console.log('B. isAllowedFeedUrl')
assert.strictEqual(svc.isAllowedFeedUrl('https://api.github.com/repos/x/y/releases/latest'), true); ok('https api.github.com 放行')
assert.strictEqual(svc.isAllowedFeedUrl('https://github.com/luofengwuqi/Hundun-Desktop/releases/latest'), true); ok('https github.com 放行')
assert.strictEqual(svc.isAllowedFeedUrl('http://api.github.com/repos/x/y'), false); ok('http 拒绝')
assert.strictEqual(svc.isAllowedFeedUrl('https://evil.example.com/releases'), false); ok('陌生 host 拒绝')
assert.strictEqual(svc.isAllowedFeedUrl('file:///etc/passwd'), false); ok('file 协议拒绝')
assert.strictEqual(svc.isAllowedFeedUrl('not a url'), false); ok('非 URL 拒绝')
assert.strictEqual(svc.isAllowedFeedUrl(null), false); ok('null 拒绝')

// ---------- C. pickAsset ----------
console.log('C. pickAsset')
const assets = [
  { name: 'HundunDesktop Setup 2026.4.1.exe.blockmap' },
  { name: 'HundunDesktop Setup 2026.4.1.exe' },
  { name: 'hundundesktop_2026.4.1_amd64.deb' },
  { name: 'HundunDesktop-2026.4.1.AppImage' }
]
assert.strictEqual(svc.pickAsset(assets, 'win32').name, 'HundunDesktop Setup 2026.4.1.exe'); ok('win32 -> .exe (blockmap 不误中)')
assert.strictEqual(svc.pickAsset(assets, 'linux').name, 'hundundesktop_2026.4.1_amd64.deb'); ok('linux -> .deb 优先')
assert.strictEqual(svc.pickAsset(assets.filter(a => !a.name.endsWith('.deb')), 'linux').name, 'HundunDesktop-2026.4.1.AppImage'); ok('linux 无 deb 退 .AppImage')
assert.strictEqual(svc.pickAsset([{ name: 'HundunDesktop-2026.4.1.dmg' }], 'darwin').name, 'HundunDesktop-2026.4.1.dmg'); ok('darwin -> .dmg')
assert.strictEqual(svc.pickAsset(assets, 'darwin'), null); ok('darwin 无 dmg -> null')
assert.strictEqual(svc.pickAsset([], 'win32'), null); ok('空资产 -> null')
assert.strictEqual(svc.pickAsset(null, 'win32'), null); ok('null 资产 -> null')

// ---------- D. extractReleaseInfo ----------
console.log('D. extractReleaseInfo')
const ghRelease = {
  tag_name: 'v2026.4.1',
  html_url: 'https://github.com/luofengwuqi/Hundun-Desktop/releases/tag/v2026.4.1',
  published_at: '2026-11-15T00:00:00Z',
  assets: [
    { name: 'HundunDesktop Setup 2026.4.1.exe', browser_download_url: 'https://github.com/x/y/releases/download/v2026.4.1/setup.exe' },
    { name: 'hundundesktop_2026.4.1_amd64.deb', browser_download_url: 'https://github.com/x/y/releases/download/v2026.4.1/pkg.deb' }
  ]
}
const info = svc.extractReleaseInfo(ghRelease, 'win32')
assert.deepStrictEqual(info, {
  version: '2026.4.1',
  tagName: 'v2026.4.1',
  htmlUrl: 'https://github.com/luofengwuqi/Hundun-Desktop/releases/tag/v2026.4.1',
  downloadUrl: 'https://github.com/x/y/releases/download/v2026.4.1/setup.exe',
  assetName: 'HundunDesktop Setup 2026.4.1.exe',
  publishedAt: '2026-11-15T00:00:00Z'
}); ok('完整 payload 抽取')
assert.strictEqual(svc.extractReleaseInfo({ tag_name: 'v2026.4.1-beta', assets: [] }, 'win32'), null); ok('prerelease tag 拒绝 (旧号 v0.9.0 能解析, 比较层自然判为更旧)')
assert.strictEqual(svc.extractReleaseInfo({ tag_name: 'v2026.4.2', assets: [] }, 'win32').downloadUrl, ''); ok('缺平台资产 -> downloadUrl 为空串')
assert.strictEqual(svc.extractReleaseInfo(null, 'win32'), null); ok('null payload -> null')

// ---------- E. fetchLatestRelease 失败路径 ----------
console.log('E. fetchLatestRelease')
const GOOD_FEED = { api: 'https://api.github.com/repos/luofengwuqi/Hundun-Desktop/releases/latest', page: 'https://github.com/luofengwuqi/Hundun-Desktop/releases/latest' }
const resp = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

;(async () => {
  let res = await svc.fetchLatestRelease({ api: 'http://api.github.com/x' }, 'win32', async () => resp(ghRelease))
  assert.strictEqual(res.ok, false); assert.strictEqual(res.reason, 'feed-url-not-allowed'); ok('http feed URL 拒绝且不发起请求')
  res = await svc.fetchLatestRelease({ api: 'https://evil.example.com/x' }, 'win32', async () => resp(ghRelease))
  assert.strictEqual(res.reason, 'feed-url-not-allowed'); ok('陌生 host 拒绝')

  res = await svc.fetchLatestRelease(GOOD_FEED, 'win32', async () => resp({ message: 'Not Found' }, 404))
  assert.strictEqual(res.ok, false); assert.strictEqual(res.reason, 'http-404'); ok('HTTP 404 -> http-404')
  res = await svc.fetchLatestRelease(GOOD_FEED, 'win32', async () => resp({ message: 'rate limited' }, 403))
  assert.strictEqual(res.reason, 'http-403'); ok('匿名限流 403 -> http-403')

  res = await svc.fetchLatestRelease(GOOD_FEED, 'win32', async () => { throw Object.assign(new Error('boom'), { name: 'AbortError' }) })
  assert.strictEqual(res.reason, 'timeout'); ok('AbortError -> timeout')
  res = await svc.fetchLatestRelease(GOOD_FEED, 'win32', async () => { throw new Error('ECONNREFUSED') })
  assert.strictEqual(res.reason, 'network'); ok('连接错误 -> network')

  res = await svc.fetchLatestRelease(GOOD_FEED, 'win32', async () => resp({ tag_name: 'release-2026' }))
  assert.strictEqual(res.reason, 'bad-payload'); ok('非法版本号 payload -> bad-payload')
  res = await svc.fetchLatestRelease(GOOD_FEED, 'win32', async () => resp('not-json-object'))
  assert.strictEqual(res.reason, 'bad-payload'); ok('非对象 payload -> bad-payload')

  // 正常路径 + 请求参数校验
  let captured = null
  res = await svc.fetchLatestRelease(GOOD_FEED, 'linux', async (url, opts) => {
    captured = { url, opts }
    return resp(ghRelease)
  })
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.release.version, '2026.4.1')
  assert.strictEqual(res.release.assetName, 'hundundesktop_2026.4.1_amd64.deb')
  assert.strictEqual(res.feedPage, GOOD_FEED.page); ok('正常路径返回 release + feedPage (linux -> deb 资产)')
  assert.strictEqual(captured.url, GOOD_FEED.api); ok('请求 URL = feed.api')
  assert.ok(captured.opts.signal && typeof captured.opts.signal.aborted === 'boolean', '带超时 signal')
  assert.strictEqual(captured.opts.headers['User-Agent'], 'HundunDesktop-UpdateCheck'); ok('带 UA 头')

  // ---------- F. checkForUpdate 端到端 ----------
  console.log('F. checkForUpdate')
  res = await svc.checkForUpdate('2026.4.1', 'win32', GOOD_FEED, async () => resp(ghRelease))
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.hasUpdate, false); ok('同版本 -> 无更新')
  assert.strictEqual(res.currentVersion, '2026.4.1'); ok('返回当前版本号')

  res = await svc.checkForUpdate('2026.3.2', 'win32', GOOD_FEED, async () => resp(ghRelease))
  assert.strictEqual(res.hasUpdate, true); ok('远端更新 -> hasUpdate=true')

  res = await svc.checkForUpdate('2026.5.1', 'win32', GOOD_FEED, async () => resp(ghRelease))
  assert.strictEqual(res.hasUpdate, false); ok('本地比远端新 (测试机场景) -> hasUpdate=false')

  res = await svc.checkForUpdate('not-a-version', 'win32', GOOD_FEED, async () => resp(ghRelease))
  assert.strictEqual(res.ok, false); assert.strictEqual(res.reason, 'bad-current-version'); ok('当前版本非法 -> 不发请求')

  res = await svc.checkForUpdate('2026.4.1', 'win32', GOOD_FEED, async () => resp({}, 500))
  assert.strictEqual(res.ok, false); assert.strictEqual(res.reason, 'http-500'); ok('服务器错误透传 { ok:false }')

  // ---------- G. 双源取最高版本 (决策74 补充) ----------
  console.log('G. 双源取最高版本')
  const byUrl = (map) => async (url) => {
    if (!(url in map)) throw new Error('ENOTFOUND ' + url)
    return resp(map[url])
  }
  const giteeApi = svc.GITEE_FEED.api
  const ghApi = svc.UPDATE_FEED.api

  res = await svc.checkForUpdate('2026.4.3', 'linux', undefined, byUrl({
    [ghApi]: { tag_name: 'v2026.4.4', assets: [] },
    [giteeApi]: { tag_name: 'v2026.4.3', assets: [] }
  }))
  assert.strictEqual(res.hasUpdate, true)
  assert.strictEqual(res.latest.version, '2026.4.4'); ok('Gitee 的 latest 落后 -> 仍以 GitHub 的 4.4 为准')

  res = await svc.checkForUpdate('2026.4.3', 'linux', undefined, byUrl({
    [giteeApi]: { tag_name: 'v2026.4.4', assets: [] }
  }))
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.hasUpdate, true)
  assert.strictEqual(res.usedFallback, true); ok('GitHub 不可达 -> 用 Gitee 的 4.4, 且 usedFallback=true')

  res = await svc.checkForUpdate('2026.4.4', 'linux', undefined, byUrl({
    [ghApi]: { tag_name: 'v2026.4.4', assets: [] },
    [giteeApi]: { tag_name: 'v2026.4.3', assets: [] }
  }))
  assert.strictEqual(res.hasUpdate, false); ok('已是 4.4 时任一源落后都不误报')

  res = await svc.checkForUpdate('2026.4.3', 'linux', undefined, byUrl({}))
  assert.strictEqual(res.ok, false)
  assert.strictEqual(res.reason, 'network'); ok('两个源都不可达 -> ok:false')

  console.log('\n全部通过: ' + passed + ' 项断言')
})().catch(err => {
  console.error('\n测试失败:', err.message)
  process.exit(1)
})
