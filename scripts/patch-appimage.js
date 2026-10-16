/**
 * afterAllArtifactBuild 钩子: 给 AppImage 内 AppRun 补 --no-sandbox (决策47 补充)
 *
 * 背景: Ubuntu 24.04+ 默认 `kernel.apparmor_restrict_unprivileged_userns=1`, 未配置文件
 *   命名空间的程序无法创建 user namespace; 而 AppImage 挂载为只读 FUSE, 其中
 *   chrome-sandbox 无法 root + 4755 (SUID), 双击 (直接执行 AppRun) 时 Electron 报
 *   `No usable sandbox!` / `SUID sandbox helper ... not configured correctly` 崩溃。
 *   electron-builder 只把 --no-sandbox 写进 .desktop 的 Exec, 双击不走该 Exec。
 *
 * 做法: 解包 → 在 AppRun 的 exec 行补 --no-sandbox → mksquashfs 重打包 → 拼接原 runtime。
 *   deb 不受影响 (安装时 postinst chmod 4755 + root 属主, SUID 沙箱正常)。
 *   幂等: AppRun 已含 --no-sandbox 则跳过。
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

function findMksquashfs () {
  const cacheRoot = process.env.ELECTRON_BUILDER_CACHE || path.join(os.homedir(), '.cache', 'electron-builder')
  const appimageRoot = path.join(cacheRoot, 'appimage')
  if (fs.existsSync(appimageRoot)) {
    for (const version of fs.readdirSync(appimageRoot)) {
      const candidate = path.join(appimageRoot, version, 'linux-x64', 'mksquashfs')
      if (fs.existsSync(candidate)) return candidate
    }
  }
  return 'mksquashfs'
}

function patchAppRun (appDir) {
  const appRunPath = path.join(appDir, 'AppRun')
  const source = fs.readFileSync(appRunPath, 'utf8')
  if (source.includes('--no-sandbox')) return false
  const patched = source
    .replace('exec "$BIN" "${args[@]}"', 'exec "$BIN" --no-sandbox "${args[@]}"')
    .replace('exec "$BIN"\n', 'exec "$BIN" --no-sandbox\n')
  if (patched === source) return false
  fs.writeFileSync(appRunPath, patched)
  return true
}

exports.default = async function afterAllArtifactBuild (buildResult) {
  const appImages = (buildResult.artifactPaths || []).filter(
    p => p.endsWith('.AppImage') && fs.existsSync(p)
  )
  if (appImages.length === 0) return []

  const mksquashfs = findMksquashfs()
  for (const appImage of appImages) {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'huntun-appimage-'))
    try {
      const offset = parseInt(
        execFileSync(appImage, ['--appimage-offset'], { encoding: 'utf8' }).trim(),
        10
      )
      if (!Number.isInteger(offset) || offset <= 0) {
        console.warn(`[patch-appimage] 无法解析 offset, 跳过: ${appImage}`)
        continue
      }
      execFileSync(appImage, ['--appimage-extract'], { cwd: workDir, stdio: 'ignore' })
      const appDir = path.join(workDir, 'squashfs-root')
      if (!patchAppRun(appDir)) {
        console.log(`[patch-appimage] AppRun 已含 --no-sandbox, 跳过: ${path.basename(appImage)}`)
        continue
      }
      const squashed = path.join(workDir, 'new.squashfs')
      execFileSync(mksquashfs, [appDir, squashed, '-noappend', '-comp', 'gzip', '-b', '131072'], {
        stdio: 'ignore'
      })
      const original = fs.readFileSync(appImage)
      const patched = Buffer.concat([original.subarray(0, offset), fs.readFileSync(squashed)])
      fs.writeFileSync(appImage, patched)
      fs.chmodSync(appImage, 0o755)
      console.log(`[patch-appimage] AppRun 已补 --no-sandbox: ${path.basename(appImage)}`)
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true })
    }
  }
  return []
}
