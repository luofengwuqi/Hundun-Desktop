// ========== 更新执行器 (决策74): 下载安装包 / 装好 / 重启 ==========
// 与 update-service.js 的分工:
//   update-service = 纯 Node (定位源、下载、校验、安装步骤计划), 可单测;
//   本模块 = 依赖 electron (userData 路径、spawn、relaunch) 的那一层。
// 三条硬约束:
//   ① 只接受 userData/updates/ 内的文件安装 (防止渲染层传任意路径来执行);
//   ② 安装前再验一次魔数, 下载后文件被换掉也不会被执行;
//   ③ 失败一律返回 { ok:false, reason }, 由界面给可读文案 + 手动下载页兜底。
'use strict'
const { app } = require('electron')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const updateService = require('./update-service')

// 下载空闲超时: 45s 没有任何数据才判定断流 (73MB deb 在慢网下总时长可达几分钟)
const DOWNLOAD_IDLE_TIMEOUT_MS = 45000
// 系统安装/授权等待上限 (pkexec 需要用户输密码, 给足时间)
const INSTALL_TIMEOUT_MS = 5 * 60 * 1000

// 本次运行对应的安装包类型 ('deb' | 'appimage' | 'exe' | 'dmg' | null=未打包)
function getTargetKind () {
  return updateService.detectTargetKind({
    platform: process.platform,
    isPackaged: app.isPackaged,
    appImagePath: process.env.APPIMAGE
  })
}

function updatesDir () {
  return path.join(app.getPath('userData'), 'updates')
}

// 渲染层传来的路径必须落在 updates 目录内
function isInsideUpdates (filePath) {
  try {
    const dir = path.resolve(updatesDir())
    const target = path.resolve(String(filePath || ''))
    return target.startsWith(dir + path.sep)
  } catch (e) {
    return false
  }
}

function removeQuiet (filePath) {
  try { fs.unlinkSync(filePath) } catch (e) { /* ignore */ }
}

// 只留本次要装的包, 别的历史下载删掉 (deb 70+MB, 别攒着占地方)
function pruneOldDownloads (dir, keepName) {
  try {
    for (const name of fs.readdirSync(dir)) {
      if (name === keepName) continue
      if (!/\.(deb|appimage|exe|dmg)(\.part)?$/i.test(name)) continue
      removeQuiet(path.join(dir, name))
    }
  } catch (e) { /* ignore */ }
}

// 下载目标版本安装包。sources 按 Gitee → GitHub 顺序逐个试, 首个通过校验的即采用。
// 进度经 upsert 节流 (10 次/秒): 73MB 会切成上千块, 每块发一次 IPC 会把渲染进程淹掉。
async function downloadUpdate (version, kind, onProgress) {
  const k = kind || getTargetKind()
  if (!k) return { ok: false, reason: 'not-packaged' }
  const resolved = await updateService.resolveDownloadSources(version, k)
  if (!resolved.ok) return resolved

  let lastEmit = 0
  const emitProgress = typeof onProgress === 'function'
    ? (p) => {
        const now = Date.now()
        const finished = p.total > 0 && p.received >= p.total
        if (!finished && now - lastEmit < 100) return
        lastEmit = now
        onProgress(p)
      }
    : null

  const dir = updatesDir()
  let last = { ok: false, reason: 'download-failed' }
  for (const src of resolved.sources) {
    const dest = path.join(dir, src.name)
    const dl = await updateService.downloadTo(src.url, dest, {
      onProgress: emitProgress,
      expectedSize: src.size,
      idleTimeout: DOWNLOAD_IDLE_TIMEOUT_MS
    })
    if (!dl.ok) {
      last = dl
      continue
    }
    const magic = updateService.verifyFileMagic(dest, k)
    if (!magic.ok) {
      removeQuiet(dest)
      last = magic
      continue
    }
    if (src.digest) {
      const expected = String(src.digest).replace(/^sha256:/i, '').toLowerCase()
      if (expected && expected !== String(dl.sha256 || '').toLowerCase()) {
        removeQuiet(dest)
        last = { ok: false, reason: 'checksum-mismatch' }
        continue
      }
    }
    pruneOldDownloads(dir, src.name)
    return { ok: true, filePath: dest, assetName: src.name, size: dl.size, source: src.feedType }
  }
  return last
}

// 跑一条命令 (不抛异常, 统一 { code, stdout, stderr })
function runCommand (cmd, args, opts = {}) {
  return new Promise(resolve => {
    let settled = false
    let timer = null
    const finish = (result) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      resolve(result)
    }
    let child
    try {
      child = spawn(cmd, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
        detached: !!opts.detached
      })
    } catch (err) {
      resolve({ code: -1, stdout: '', stderr: String((err && err.message) || err) })
      return
    }
    let stdout = ''
    let stderr = ''
    if (child.stdout) child.stdout.on('data', d => { stdout += String(d) })
    if (child.stderr) child.stderr.on('data', d => { stderr += String(d) })
    timer = setTimeout(() => {
      try { child.kill('SIGTERM') } catch (e) { /* ignore */ }
      finish({ code: -2, stdout, stderr: stderr + '\n[timeout]' })
    }, opts.timeout || INSTALL_TIMEOUT_MS)
    child.on('error', err => finish({ code: -1, stdout, stderr: String((err && err.message) || err) }))
    child.on('close', code => finish({ code: typeof code === 'number' ? code : -1, stdout, stderr }))
  })
}

// AppImage: 就地替换进程正在跑的那个文件, 再以新文件重启 (无需 root)
function replaceAppImage (filePath) {
  const target = process.env.APPIMAGE
  if (!target) return { ok: false, reason: 'appimage-path-missing' }
  try {
    const staging = target + '.new'
    fs.copyFileSync(filePath, staging)
    fs.chmodSync(staging, 0o755)
    fs.renameSync(staging, target) // 同目录 rename, 原子替换
    return { ok: true, mode: 'appimage', needRelaunch: true }
  } catch (err) {
    return { ok: false, reason: 'replace-failed', detail: String((err && err.message) || err) }
  }
}

// 安装已下载的安装包。返回 { ok, mode, needRelaunch, manual? }
// needRelaunch=true 表示"已装好, 需要界面提示后调用 relaunch() 重启"
async function installUpdate (filePath, kind) {
  const k = kind || getTargetKind()
  if (!k) return { ok: false, reason: 'not-packaged' }
  if (!isInsideUpdates(filePath)) return { ok: false, reason: 'path-not-allowed' }
  if (!fs.existsSync(filePath)) return { ok: false, reason: 'file-missing' }
  const magic = updateService.verifyFileMagic(filePath, k)
  if (!magic.ok) return magic

  const plan = updateService.planInstallSteps(k, { filePath })
  if (!plan.ok) return plan

  if (plan.mode === 'appimage') return replaceAppImage(filePath)

  if (plan.mode === 'dmg') {
    const r = await runCommand('open', [filePath], { timeout: 20000 })
    if (r.code !== 0) return { ok: false, reason: 'open-failed', detail: r.stderr.slice(0, 300) }
    return { ok: true, mode: 'dmg', needRelaunch: false, manual: true }
  }

  if (plan.mode === 'nsis') {
    // NSIS 安装器要覆盖正在运行的程序文件 → 拉起安装器后本进程尽快退出,
    // 装完由安装器 (runAfterFinish) 重启应用。这里不能等安装器退出 (它会跑很久,
    // 等待中的超时 kill 会直接打断安装).
    try {
      const child = spawn(filePath, ['/S'], { detached: true, stdio: 'ignore', env: process.env })
      if (child.unref) child.unref()
      child.on('error', () => { /* 由界面文案兜底, 进程即将退出 */ })
    } catch (err) {
      return { ok: false, reason: 'installer-failed', detail: String((err && err.message) || err) }
    }
    setTimeout(() => { try { app.exit(0) } catch (e) { /* ignore */ } }, 1200)
    return { ok: true, mode: 'nsis', needRelaunch: false }
  }

  // deb: sudo -n 试一次 → 失败落 pkexec (系统密码框)
  let last = null
  for (const step of plan.steps) {
    const r = await runCommand(step.cmd, step.args, { timeout: INSTALL_TIMEOUT_MS })
    if (r.code === 0) return { ok: true, mode: 'deb', needRelaunch: true, via: step.cmd }
    last = { cmd: step.cmd, code: r.code, stderr: r.stderr.slice(0, 400) }
    if (!step.optional) break
  }
  const code = last && last.code
  return {
    ok: false,
    // pkexec: 126 = 用户取消授权, 127 = 未授权; 报错文案要能区分"取消"和"装失败"
    reason: code === 126 || code === 127 ? 'auth-cancelled' : 'install-failed',
    detail: (last && last.stderr) || ''
  }
}

// 重启到新版本。AppImage 必须 exec 外层 .AppImage 文件 (进程内路径是临时挂载点,
// app.relaunch 会指向已消失的挂载目录), 其余平台走 electron 自带 relaunch。
function relaunch (kind) {
  const k = kind || getTargetKind()
  if (k === 'appimage' && process.env.APPIMAGE) {
    try {
      const child = spawn(process.env.APPIMAGE, [], { detached: true, stdio: 'ignore' })
      if (child.unref) child.unref()
    } catch (e) { /* ignore */ }
    app.exit(0)
    return { ok: true }
  }
  app.relaunch()
  app.exit(0)
  return { ok: true }
}

module.exports = {
  DOWNLOAD_IDLE_TIMEOUT_MS,
  INSTALL_TIMEOUT_MS,
  getTargetKind,
  updatesDir,
  isInsideUpdates,
  downloadUpdate,
  installUpdate,
  relaunch
}
