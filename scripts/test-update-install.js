/**
 * 自动下载 + 安装更新测试 (决策74)
 *
 * 运行: node scripts/test-update-install.js   (退出码 0 = 全过, 纯 Node 不依赖 electron)
 *
 * 覆盖:
 *   A. detectTargetKind  运行形态 → 安装包类型 (deb / appimage / exe / dmg / dev=null)
 *   B. pickAssetFor      按类型选资产后缀
 *   C. collectAssetCandidates  汇总资产 + URL 白名单
 *   D. resolveDownloadSources  Gitee 优先 / 版本必须一致 / 去重 / 全无资产
 *   E. downloadTo        流式下载 / 进度回报 / 大小不符 / 摘要 / 非白名单 URL / HTTP 错误
 *   F. verifyFileMagic   ar 头 / ELF / MZ / 垃圾文件
 *   G. planInstallSteps  deb 两步 (sudo -n → pkexec) / nsis / dmg / appimage
 */
'use strict'
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const svc = require('../src/main/update-service')

let passed = 0
const ok = (name) => { passed++; console.log('  ✓ ' + name) }

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hundun-update-test-'))
const tmpFile = (name) => path.join(tmpDir, name)

// 造一个可流式读的假 Response
function fakeResponse (buf, { status = 200, contentLength = buf.length } = {}) {
  let offset = 0
  const chunkSize = 4
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (String(name).toLowerCase() === 'content-length' ? String(contentLength) : null) },
    body: {
      getReader: () => ({
        read: async () => {
          if (offset >= buf.length) return { done: true, value: undefined }
          const slice = buf.subarray(offset, Math.min(offset + chunkSize, buf.length))
          offset += slice.length
          return { done: false, value: new Uint8Array(slice) }
        }
      })
    }
  }
}

// 假 feed: url → json, 其它抛网络错误
function fakeFetch (map) {
  return async (url) => {
    if (map[url] === undefined) throw new Error('ENOTFOUND ' + url)
    const entry = map[url]
    if (entry && entry.__status) return { ok: false, status: entry.__status, headers: { get: () => null }, json: async () => ({}) }
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => entry }
  }
}

;(async () => {
  // ---------- A. detectTargetKind ----------
  console.log('A. detectTargetKind')
  assert.strictEqual(svc.detectTargetKind({ platform: 'win32', isPackaged: true }), 'exe'); ok('win32 打包 -> exe')
  assert.strictEqual(svc.detectTargetKind({ platform: 'darwin', isPackaged: true }), 'dmg'); ok('darwin 打包 -> dmg')
  assert.strictEqual(svc.detectTargetKind({ platform: 'linux', isPackaged: true }), 'deb'); ok('linux deb 安装 -> deb')
  assert.strictEqual(svc.detectTargetKind({ platform: 'linux', isPackaged: true, appImagePath: '/tmp/x.AppImage' }), 'appimage'); ok('linux AppImage 运行 -> appimage')
  assert.strictEqual(svc.detectTargetKind({ platform: 'linux', isPackaged: false }), null); ok('dev 运行 -> null')
  assert.strictEqual(svc.detectTargetKind({ platform: 'freebsd', isPackaged: true }), null); ok('未知平台 -> null')

  // ---------- B. pickAssetFor ----------
  console.log('B. pickAssetFor')
  const mixed = [
    { name: 'HundunDesktop Setup 2026.4.3.exe' },
    { name: 'HundunDesktop Setup 2026.4.3.exe.blockmap' },
    { name: 'hundundesktop_2026.4.3_amd64.deb' },
    { name: 'HundunDesktop-2026.4.3.AppImage' },
    { name: 'HundunDesktop-2026.4.3.dmg' },
    { name: 'v2026.4.3.zip' }
  ]
  assert.strictEqual(svc.pickAssetFor(mixed, 'deb').name, 'hundundesktop_2026.4.3_amd64.deb'); ok('deb 精确匹配')
  assert.strictEqual(svc.pickAssetFor(mixed, 'appimage').name, 'HundunDesktop-2026.4.3.AppImage'); ok('appimage 匹配 (大小写不敏感)')
  assert.strictEqual(svc.pickAssetFor(mixed, 'exe').name, 'HundunDesktop Setup 2026.4.3.exe'); ok('exe 不误中 blockmap')
  assert.strictEqual(svc.pickAssetFor(mixed, 'dmg').name, 'HundunDesktop-2026.4.3.dmg'); ok('dmg 匹配')
  assert.strictEqual(svc.pickAssetFor(mixed, 'bogus'), null); ok('未知类型 -> null')
  assert.strictEqual(svc.pickAssetFor([{ name: 'v2026.4.3.zip' }], 'deb'), null); ok('只有源码包 -> null')

  // ---------- C. collectAssetCandidates ----------
  console.log('C. collectAssetCandidates')
  const relWithAssets = {
    tag_name: 'v2026.4.3',
    assets: [
      { name: 'hundundesktop_2026.4.3_amd64.deb', browser_download_url: 'https://gitee.com/o/r/releases/download/v2026.4.3/a.deb', size: 10, digest: 'sha256:abc' },
      { name: 'v2026.4.3.zip', browser_download_url: 'https://gitee.com/o/r/archive/v2026.4.3.zip' },
      { name: 'evil.deb', browser_download_url: 'https://evil.example.com/a.deb' }
    ]
  }
  const cands = svc.collectAssetCandidates(relWithAssets, 'deb', svc.GITEE_FEED)
  assert.strictEqual(cands.length, 1); ok('只留该类型资产 (源码 zip 排除)')
  assert.strictEqual(cands[0].url, 'https://gitee.com/o/r/releases/download/v2026.4.3/a.deb'); ok('保留下载地址')
  assert.strictEqual(cands[0].size, 10); ok('保留 size')
  assert.strictEqual(cands[0].digest, 'sha256:abc'); ok('保留 digest')
  assert.strictEqual(cands[0].feedType, 'gitee'); ok('标记来源 feed')
  ok('非白名单域名资产被过滤')
  assert.deepStrictEqual(svc.collectAssetCandidates(null, 'deb', svc.GITEE_FEED), []); ok('null release -> 空数组')

  // ---------- D. resolveDownloadSources ----------
  console.log('D. resolveDownloadSources')
  const giteeUrl = svc.GITEE_FEED.api
  const ghUrl = svc.UPDATE_FEED.api
  const giteeRel = {
    tag_name: 'v2026.4.3',
    assets: [{ name: 'hundundesktop_2026.4.3_amd64.deb', browser_download_url: 'https://gitee.com/o/r/releases/download/v2026.4.3/a.deb', size: 100 }]
  }
  const ghRel = {
    tag_name: 'v2026.4.3',
    assets: [
      { name: 'hundundesktop_2026.4.3_amd64.deb', browser_download_url: 'https://github.com/o/r/releases/download/v2026.4.3/a.deb', size: 100 },
      { name: 'HundunDesktop Setup 2026.4.3.exe', browser_download_url: 'https://github.com/o/r/releases/download/v2026.4.3/setup.exe', size: 100 }
    ]
  }
  let r = await svc.resolveDownloadSources('2026.4.3', 'deb', undefined, fakeFetch({ [giteeUrl]: giteeRel, [ghUrl]: ghRel }))
  assert.strictEqual(r.ok, true); ok('两个源都有 deb -> ok')
  assert.strictEqual(r.sources.length, 2); ok('两个源都收进来 (兜底)')
  assert.ok(r.sources[0].url.includes('gitee.com')); ok('Gitee 排第一 (国内直连优先)')
  assert.ok(r.sources[1].url.includes('github.com')); ok('GitHub 排第二')

  r = await svc.resolveDownloadSources('2026.4.3', 'deb', undefined, fakeFetch({ [giteeUrl]: { __status: 500 }, [ghUrl]: ghRel }))
  assert.strictEqual(r.ok, true); ok('Gitee 挂了仍能从 GitHub 拿到')
  assert.strictEqual(r.sources.length, 1); ok('只剩 GitHub 一个源')

  r = await svc.resolveDownloadSources('2026.4.3', 'deb', undefined, fakeFetch({ [giteeUrl]: { tag_name: 'v2026.4.2', assets: giteeRel.assets }, [ghUrl]: ghRel }))
  assert.strictEqual(r.sources.length, 1); ok('tag 与目标版本不一致的源跳过 (不会下到旧包)')
  assert.ok(r.errors.some(e => e.reason === 'version-mismatch')); ok('记录 version-mismatch')

  r = await svc.resolveDownloadSources('2026.4.3', 'deb', undefined, fakeFetch({ [giteeUrl]: giteeRel, [ghUrl]: ghRel }))
  assert.strictEqual(r.sources.length, 2); ok('去重按 URL, 不同源同文件名都保留')

  r = await svc.resolveDownloadSources('2026.4.3', 'appimage', undefined, fakeFetch({ [giteeUrl]: giteeRel, [ghUrl]: ghRel }))
  assert.strictEqual(r.ok, false); ok('目标版本没有 appimage 资产 -> no-asset')
  assert.strictEqual(r.reason, 'no-asset'); ok('reason=no-asset')

  r = await svc.resolveDownloadSources('bad', 'deb', undefined, fakeFetch({}))
  assert.strictEqual(r.reason, 'bad-target-version'); ok('目标版本非法直接拒绝')

  r = await svc.resolveDownloadSources('2026.4.3', 'zip', undefined, fakeFetch({}))
  assert.strictEqual(r.reason, 'bad-target-kind'); ok('未知安装包类型直接拒绝')

  // ---------- E. downloadTo ----------
  console.log('E. downloadTo')
  const payload = Buffer.from('!<arch>\n' + 'x'.repeat(200))
  const destOk = tmpFile('ok.deb')
  const progress = []
  let dl = await svc.downloadTo('https://gitee.com/o/r/releases/download/v2026.4.3/a.deb', destOk, {
    fetchImpl: async () => fakeResponse(payload),
    onProgress: (p) => progress.push(p.received)
  })
  assert.strictEqual(dl.ok, true); ok('流式下载成功')
  assert.strictEqual(fs.statSync(destOk).size, payload.length); ok('落地文件字节数一致')
  assert.strictEqual(dl.size, payload.length); ok('返回 size')
  assert.strictEqual(dl.sha256, require('crypto').createHash('sha256').update(payload).digest('hex')); ok('返回 sha256')
  assert.ok(progress.length > 1); ok('分块回报进度')
  assert.strictEqual(progress[progress.length - 1], payload.length); ok('最后一块进度 = 总字节')
  assert.ok(!fs.existsSync(destOk + '.part')); ok('.part 临时文件已清理')

  dl = await svc.downloadTo('https://gitee.com/o/r/a.deb', tmpFile('bad-size.deb'), {
    fetchImpl: async () => fakeResponse(payload, { contentLength: payload.length + 50 })
  })
  assert.strictEqual(dl.reason, 'size-mismatch'); ok('大小不符 -> size-mismatch (不落盘)')
  assert.ok(!fs.existsSync(tmpFile('bad-size.deb'))); ok('失败时不留下半截文件')

  dl = await svc.downloadTo('https://gitee.com/o/r/a.deb', tmpFile('http.deb'), {
    fetchImpl: async () => fakeResponse(payload, { status: 404 })
  })
  assert.strictEqual(dl.reason, 'http-404'); ok('HTTP 错误透传')

  dl = await svc.downloadTo('http://gitee.com/o/r/a.deb', tmpFile('insecure.deb'), { fetchImpl: async () => fakeResponse(payload) })
  assert.strictEqual(dl.reason, 'url-not-allowed'); ok('http/非白名单 URL 拒绝')

  dl = await svc.downloadTo('https://evil.example.com/a.deb', tmpFile('evil.deb'), { fetchImpl: async () => fakeResponse(payload) })
  assert.strictEqual(dl.reason, 'url-not-allowed'); ok('陌生域名拒绝')

  dl = await svc.downloadTo('https://gitee.com/o/r/a.deb', tmpFile('net.deb'), { fetchImpl: async () => { throw new Error('ECONNRESET') } })
  assert.strictEqual(dl.reason, 'network'); ok('网络异常 -> network')

  dl = await svc.downloadTo('https://gitee.com/o/r/a.deb', tmpFile('empty.deb'), {
    fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => '0' }, body: { getReader: () => ({ read: async () => ({ done: true }) }) } })
  })
  assert.strictEqual(dl.reason, 'empty-body'); ok('空响应体 -> empty-body')

  // ---------- F. verifyFileMagic ----------
  console.log('F. verifyFileMagic')
  fs.writeFileSync(tmpFile('real.deb'), Buffer.concat([Buffer.from('!<arch>\n'), Buffer.alloc(32)]))
  assert.deepStrictEqual(svc.verifyFileMagic(tmpFile('real.deb'), 'deb'), { ok: true }); ok('ar 头 -> 合法 deb')
  fs.writeFileSync(tmpFile('html.deb'), Buffer.from('<!DOCTYPE html><html>error</html>'))
  assert.strictEqual(svc.verifyFileMagic(tmpFile('html.deb'), 'deb').reason, 'not-a-deb'); ok('HTML 错误页 -> not-a-deb')
  fs.writeFileSync(tmpFile('app.AppImage'), Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0]))
  assert.deepStrictEqual(svc.verifyFileMagic(tmpFile('app.AppImage'), 'appimage'), { ok: true }); ok('ELF 头 -> 合法 AppImage')
  fs.writeFileSync(tmpFile('setup.exe'), Buffer.concat([Buffer.from('MZ'), Buffer.alloc(16)]))
  assert.deepStrictEqual(svc.verifyFileMagic(tmpFile('setup.exe'), 'exe'), { ok: true }); ok('MZ 头 -> 合法 exe')
  fs.writeFileSync(tmpFile('setup.txt'), Buffer.from('not an exe'))
  assert.strictEqual(svc.verifyFileMagic(tmpFile('setup.txt'), 'exe').reason, 'not-an-exe'); ok('非 MZ -> not-an-exe')
  fs.writeFileSync(tmpFile('empty.deb2'), Buffer.alloc(0))
  assert.strictEqual(svc.verifyFileMagic(tmpFile('empty.deb2'), 'deb').reason, 'file-empty'); ok('空文件 -> file-empty')
  assert.strictEqual(svc.verifyFileMagic(tmpFile('nope.deb'), 'deb').reason, 'file-unreadable'); ok('文件不存在 -> file-unreadable')

  // ---------- G. planInstallSteps ----------
  console.log('G. planInstallSteps')
  let plan = svc.planInstallSteps('deb', { filePath: '/tmp/a.deb' })
  assert.strictEqual(plan.ok, true); ok('deb 有计划')
  assert.strictEqual(plan.steps.length, 2); ok('deb 两步: sudo -n → pkexec')
  assert.deepStrictEqual(plan.steps[0].args, ['-n', 'dpkg', '-i', '/tmp/a.deb']); ok('第一步 sudo -n dpkg -i')
  assert.strictEqual(plan.steps[0].optional, true); ok('sudo 失败可继续 (免密不一定有)')
  assert.strictEqual(plan.steps[1].cmd, 'pkexec'); ok('第二步 pkexec (弹系统授权框)')
  assert.strictEqual(plan.steps[1].optional, false); ok('pkexec 失败即终止')

  plan = svc.planInstallSteps('exe', { filePath: 'C:\\Temp\\Setup.exe' })
  assert.strictEqual(plan.mode, 'nsis'); ok('exe -> nsis')
  assert.deepStrictEqual(plan.steps[0].args, ['/S']); ok('NSIS 静默安装 /S')
  assert.strictEqual(plan.steps[0].detached, true); ok('安装器脱离父进程 (父进程要退出)')

  plan = svc.planInstallSteps('dmg', { filePath: '/tmp/a.dmg' })
  assert.strictEqual(plan.mode, 'dmg'); ok('dmg -> 打开安装包 (需手动拖入)')
  assert.deepStrictEqual(plan.steps[0].args, ['/tmp/a.dmg']); ok('dmg 用 open 打开')

  plan = svc.planInstallSteps('appimage', { filePath: '/tmp/a.AppImage' })
  assert.strictEqual(plan.mode, 'appimage'); ok('appimage -> 原地替换 (无外部命令)')
  assert.deepStrictEqual(plan.steps, []); ok('appimage 不跑外部命令')

  assert.strictEqual(svc.planInstallSteps('deb', {}).reason, 'missing-file'); ok('缺文件路径 -> missing-file')
  assert.strictEqual(svc.planInstallSteps('zip', { filePath: '/tmp/a.zip' }).reason, 'bad-target-kind'); ok('未知类型 -> bad-target-kind')

  // 清理
  try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch (e) { /* ignore */ }

  console.log(`\n全部通过: ${passed} 项断言`)
})().catch(err => {
  console.error('\n✗ 测试失败:', err && err.message)
  console.error(err && err.stack)
  process.exit(1)
})
