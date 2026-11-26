/**
 * 把本版本的安装包上传到 Gitee Release 附件 (决策74)
 *
 * 为什么需要: 应用内「立即更新」要下载安装包, Gitee 是唯一国内可直连的下载源。
 *           GitHub Releases 在大陆时常不可达, 而且需要额外 token; 每次发行都必须
 *           把 deb / exe 挂到 Gitee Release 上, 否则用户只会看到「该版本还没有
 *           上传可用的安装包」。
 *
 * 用法:
 *   node scripts/publish-gitee-assets.js            # 上传 package.json 版本对应的产物
 *   node scripts/publish-gitee-assets.js --dry-run  # 只打印将要做什么
 *   GITEE_TOKEN=xxx node scripts/publish-gitee-assets.js
 *
 * 令牌来源: 环境变量 GITEE_TOKEN → ~/.git-credentials 里 gitee.com 那条 (需 projects 权限)
 * 限制: Gitee 单个附件 ≤ 100MB (AppImage 常超过 → 会被跳过并提示)
 */
'use strict'
const fs = require('fs')
const os = require('os')
const path = require('path')

const OWNER = 'luofengwuqi'
const REPO = 'chaos-lite'
const API = 'https://gitee.com/api/v5'
const MAX_ATTACH_BYTES = 100 * 1024 * 1024

const ROOT = path.resolve(__dirname, '..')

function readToken () {
  if (process.env.GITEE_TOKEN) return process.env.GITEE_TOKEN.trim()
  try {
    const file = path.join(os.homedir(), '.git-credentials')
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line.includes('gitee.com')) continue
      const m = /https:\/\/([^:]+):([^@]+)@/.exec(line.trim())
      if (m) return m[2]
    }
  } catch (e) { /* ignore */ }
  return ''
}

function fmtBytes (n) {
  if (n >= 1024 * 1024 * 1024) return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB'
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB'
  return Math.round(n / 1024) + ' KB'
}

async function api (token, method, endpoint, body) {
  const res = await fetch(API + endpoint, {
    method,
    headers: {
      Authorization: 'token ' + token,
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch (e) { /* 非 JSON */ }
  if (!res.ok) {
    const message = (json && (json.message || json.error)) || text.slice(0, 200)
    throw new Error(`${method} ${endpoint} -> ${res.status} ${message}`)
  }
  return json
}

// 目标版本的 release (没有就按 tag 建一个, 指向当前 HEAD)
async function ensureRelease (token, version) {
  const tag = 'v' + version
  const releases = await api(token, 'GET', `/repos/${OWNER}/${REPO}/releases?per_page=100`)
  const found = (releases || []).find(r => r.tag_name === tag)
  if (found) return found
  console.log(`  未找到 ${tag} 的 release, 新建一个…`)
  return api(token, 'POST', `/repos/${OWNER}/${REPO}/releases`, {
    tag_name: tag,
    name: version,
    target_commitish: 'master',
    body: `## ${version}\n\n安装包见下方附件。`
  })
}

function candidateFiles (version) {
  return [
    path.join(ROOT, 'dist', `hundundesktop_${version}_amd64.deb`),
    path.join(ROOT, 'dist', `HundunDesktop-${version}.AppImage`),
    path.join(ROOT, 'dist', `HundunDesktop Setup ${version}.exe`)
  ]
}

// 附件列表 (release 对象里的 assets 只有 name/下载地址, 没有 id 和 size;
// 要删除同名旧附件必须走这个接口拿 id)
async function listAttachments (token, releaseId) {
  return (await api(token, 'GET', `/repos/${OWNER}/${REPO}/releases/${releaseId}/attach_files`)) || []
}

async function uploadOne (token, release, filePath, attachments, dryRun) {
  const name = path.basename(filePath)
  const size = fs.statSync(filePath).size
  if (size > MAX_ATTACH_BYTES) {
    console.log(`  ✗ ${name} (${fmtBytes(size)}) 超过 Gitee 100MB 附件上限, 跳过`)
    return false
  }
  const same = attachments.filter(a => a.name === name)
  if (same.length === 1 && same[0].size === size) {
    console.log(`  = ${name} 已是同大小 (${fmtBytes(size)}), 跳过`)
    return true
  }
  if (dryRun) {
    console.log(`  [dry-run] 删除同名旧附件 ${same.length} 个并上传 ${name} (${fmtBytes(size)})`)
    return true
  }
  // 同名旧附件先删干净: Gitee 允许同名重传, 会留下多个同 URL 的重复条目
  for (const old of same) {
    console.log(`  删除旧附件 ${old.name} (id=${old.id}, ${fmtBytes(old.size || 0)})…`)
    await api(token, 'DELETE', `/repos/${OWNER}/${REPO}/releases/${release.id}/attach_files/${old.id}`)
  }
  const form = new FormData()
  form.append('file', new Blob([fs.readFileSync(filePath)]), name)
  const t0 = Date.now()
  const up = await api(token, 'POST', `/repos/${OWNER}/${REPO}/releases/${release.id}/attach_files`, form)
  console.log(`  ✓ ${name} ${fmtBytes(size)} 上传完成 (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
  if (up && up.browser_download_url) console.log(`     ${up.browser_download_url}`)
  return true
}

;(async () => {
  const dryRun = process.argv.includes('--dry-run')
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version
  const token = readToken()
  if (!token) {
    console.error('没有 Gitee 令牌: 设置 GITEE_TOKEN 或确认 ~/.git-credentials 里有 gitee.com 记录')
    process.exit(1)
  }
  console.log(`版本 ${version}${dryRun ? ' (dry-run)' : ''}`)
  const files = candidateFiles(version).filter(f => fs.existsSync(f))
  if (!files.length) {
    console.error('dist/ 下没有本版本的安装包, 先跑 npm run build:linux (或 build:win)')
    process.exit(1)
  }
  console.log('待上传:'); files.forEach(f => console.log('  - ' + path.basename(f)))

  const release = await ensureRelease(token, version)
  console.log(`目标 release: ${release.tag_name} (id=${release.id})`)
  const attachments = await listAttachments(token, release.id)
  let uploaded = 0
  for (const f of files) {
    if (await uploadOne(token, release, f, attachments, dryRun)) uploaded++
  }
  const finalList = await listAttachments(token, release.id)
  console.log('release 现有附件:')
  for (const a of finalList) console.log(`  - ${a.name} (${fmtBytes(a.size || 0)})`)
  console.log(`完成: ${uploaded}/${files.length}`)
})().catch(err => {
  console.error('✗ 上传失败:', err.message)
  process.exit(1)
})
