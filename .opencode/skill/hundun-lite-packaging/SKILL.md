---
name: hundun-lite-packaging
description: Use when building, rebuilding, or debugging installers for Hundun Lite (a.k.a. chaos-lite / hundunDesktop — the Electron + Vue3 retro-handheld app) — producing the Windows NSIS "Hundun Lite Setup" exe, the Linux AppImage and deb, or changing the app logo/icon. Trigger on any mention of packaging Hundun Lite, electron-builder for this repo, AppImage/deb/NSIS outputs, wine/rcedit, "no usable sandbox" or libfuse2 on AppImage, or portable userData issues.
---

# Hundun Lite — cross-platform packaging

Hundun Lite is an **Electron + Vue3** app (`/home/wuqi/code/hundunDesktop`, git remote
`gitee.com/luofengwuqi/chaos-lite`). Packaging is one `electron-builder` run that yields
three installers. This skill captures the traps that cost real debugging time so the next
build is boring.

The authoritative, verbose record lives in the repo: `AGENTS.md` **决策 47** (packaging +
AppImage sandbox) and **决策 48** (logo), plus `CHANGELOG.md` 2026-10-15. Read those if a
detail here is insufficient.

## What a build produces

| Artifact (`dist/`) | Target | Notes |
|---|---|---|
| `Hundun Lite Setup <ver>.exe` | Windows `nsis` (x64) | one-click=false, changes install dir, desktop+start-menu shortcut |
| `Hundun Lite-<ver>.AppImage` | Linux AppImage | double-clickable; patched post-build (see below) |
| `huntun-lite_<ver>_amd64.deb` | Linux deb | packageName `hundun-lite` |

All three are configured in `package.json` → `build`. `electron-builder` stamps the version
from `package.json` `version`.

## The one command

```bash
cd /home/wuqi/code/hundunDesktop
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
export ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
npm run build:setup        # = npm run build && electron-builder --win nsis --linux AppImage deb --x64
```

Narrower runs (all first do `npm run build`):
- Linux only, no wine needed: `npx electron-builder --linux AppImage deb --x64`
- Windows only, needs wine: `npx electron-builder --win nsis --x64`

**Always export the two mirrors.** Without them electron/electron-builder fetch from GitHub
and time out on this network (this was the original "yesterday's blocker").

### Don't buffer the output

`electron-builder` takes several minutes. If you pipe it (`... | tail`) the shell buffers and
you see nothing until the very end, which looks hung. Run it to a log and tail that instead:

```bash
setsid bash -c 'npm run build:setup > /tmp/opencode/build.log 2>&1; echo EXIT=$? >> /tmp/opencode/build.log' &
tail -f /tmp/opencode/build.log
```

## Build pipeline (so you know where things can break)

```
npm run build   →  electron-vite
   ├─ main   src/main/index.js → out/main/index.js        (rollup)
   ├─ preload src/main/preload.js → out/preload/preload.js
   └─ renderer src/renderer → out/renderer/   (copies public/icon.png → out/renderer/icon.png)
   └─ copyMainModules() vite plugin: copies plugin-manager.js, paths.js, ... into out/main/
        (rollup can't statically see these, so they're copied, not bundled)
electron-builder  →  packages `out/`, `plugins/`, `sounds/` (files whitelist, !node_modules)
   └─ afterAllArtifactBuild: scripts/patch-appimage.js  →  patches the built AppImage
```

`build.files` is a whitelist (`out/**`, `plugins/**`, `sounds/**`, `!node_modules`). The app
has **zero native modules**, so no `electron-rebuild` is needed — keep it that way.

## Pitfalls → fixes (the important part)

### 1. GitHub downloads time out
Set `ELECTRON_MIRROR` and `ELECTRON_BUILDER_BINARIES_MIRROR` to the npmmirror URLs (above).

### 2. apt sources 403 when installing wine
The official/TUNA Ubuntu mirrors were blocked by the gateway. `/etc/apt/sources.list.d/ubuntu.sources`
was switched to `https://mirrors.aliyun.com/ubuntu/`. If apt 403s again, change the source.

### 3. Windows target needs wine on Linux
`win nsis` runs `rcedit` (executed via wine) to stamp the exe icon/version. Install
`wine64` (here wine 10.0) and run `wineboot --init` once. Linux-only builds skip this.

### 4. AppImage double-click does nothing → libfuse2
AppImage type-2 runtime needs **libfuse2**, but Ubuntu 24.04+ ships only fuse3. Symptom:
silent no-op or `error loading libfuse.so.2`. Fix on the *runtime* machine:
`sudo apt install libfuse2t64`.

### 5. AppImage crashes with "No usable sandbox!" → patch AppRun
Even with libfuse2, Ubuntu 24.04+ sets `kernel.apparmor_restrict_unprivileged_userns=1`.
Inside the read-only AppImage squashfs, `chrome-sandbox` can't be root+4755 (SUID), so
Electron aborts. Crucially:
- `app.commandLine.appendSwitch('no-sandbox')` **does not help** — it runs after sandbox
  init, the process dies first.
- `ELECTRON_DISABLE_SANDBOX=1` works but can't be injected on double-click.
- electron-builder only writes `--no-sandbox` into the `.desktop` `Exec`, and double-clicking
  a `.AppImage` runs `AppRun` directly, bypassing that.

Fix is bundled: `scripts/patch-appimage.js` is wired as `build.afterAllArtifactBuild`. It
unpacks the AppImage, adds `--no-sandbox` to both `exec "$BIN"` lines in `AppRun`, repacks
with electron-builder's cached `mksquashfs`, and splices the new squashfs onto the original
runtime (via `--appimage-offset`). It is idempotent. The `.deb` needs no patch — its
postinst makes `chrome-sandbox` root+4755. **Don't "simplify" this away.**

### 6. Packaged app writes to a read-only install dir
Packaged `userData` used to always be `<exe dir>/user-data`, which fails when installed to
`C:\Program Files`, `/opt`, or a mounted AppImage. `src/main/paths.js` now has
`isPackagedPortableMode()` (portable when the exe dir is writable and `APPIMAGE` unset →
`<writable root>/user-data`; otherwise fall back to `app.getPath('userData')`) and
`resolveInstallPluginsDir()` (fallback `<userData>/installed-plugins` — **never** reuse
`<userData>/plugins`, that name already holds plugin *data* and uninstall would delete code).
Dev mode is always portable, so `npm run dev` is unaffected.

### 7. Icon paths
- Window icon in `createWindow` must point at `../renderer/icon.png` (the file was once
  wrongly `../renderer/assets/icon.png`, which didn't exist).
- `src/renderer/public/icon.png` (256) is copied by vite into `out/renderer/`; it is also the
  Linux `build.linux.icon`.
- `src/renderer/assets/icon.ico` (256 PNG-in-ICO) is the Windows `build.win.icon`.
- **`npm run gen-icon` regenerates the OLD pixel-handheld placeholder and would overwrite the
  current illustration logo.** Only run it if you deliberately want to revert the logo.

### 8. deb build fails: "Please specify project homepage"
`fpm` (used for .deb) requires `homepage` in `package.json`. It's set — don't remove it.

### 9. Prefer `--x64` over `--universal`
`--universal` is heavier and was already dropped from `build:win`.

### 10. Stale installers after a logo/code change
`electron-builder` overwrites `dist/`, but if you built some targets earlier in the day and
changed the icon later, the older artifacts keep the old icon. **After any icon/logo change,
rebuild all three** (`npm run build:setup`) and re-verify. Timestamp-compare `dist/*` against
the icon source to catch this.

## Verifying artifacts (no target OS required)

```bash
cd /home/wuqi/code/hundunDesktop
NEW=$(md5sum src/renderer/public/icon.png | cut -d' ' -f1)

# AppImage: extract and compare icon(s)
./dist/*.AppImage --appimage-extract '*.png' >/dev/null 2>&1
md5sum squashfs-root/hundun-lite.png squashfs-root/.DirIcon     # both == $NEW
./dist/*.AppImage --appimage-help >/dev/null && echo runtime-ok

# deb: extract and compare, then inspect control
dpkg-deb -x dist/*.deb /tmp/debx && md5sum /tmp/debx/usr/share/icons/hicolor/*/apps/hundun-lite.png
dpkg-deb -I dist/*.deb | grep -E 'Package|Version|Depends|Homepage'

# exe: confirm the new logo PNG is embedded (rcedit stored it verbatim)
python3 - <<'PY'
import glob
ico=open('src/renderer/assets/icon.ico','rb').read()
png=ico[ico.index(b'\x89PNG'):]
for exe in glob.glob('dist/win-unpacked/*.exe') + glob.glob('dist/*Setup*.exe'):
    print(exe, 'full-logo hits =', open(exe,'rb').read().count(png))
PY

# Smoke test the app (briefly opens a window, then timeout kills it)
timeout 8 ./dist/linux-unpacked/hundun-lite --no-sandbox 2>&1 \
  | grep -E '\[Main\]|\[PluginManager\]'    # expect "Plugin manager initialized"
# (GPU process errors under this shell are non-fatal; clean up any dist/linux-unpacked/user-data)
```

## Changing the app logo

Per 决策 48, the logo is produced by a one-off flood-fill cut-out of
`~/桌面/一五馄饨设计与技术问答.png` (checkerboard fake-transparency + watermark):

1. **Flood-fill from all four edges** with tolerance ~40 against the checker white
   `(254,254,254)` / gray `(234,235,237)` — connectivity matters so the cream interior
   (protected by the solid red outline) survives; a plain color key would eat it.
2. Keep the **largest connected component** (drops the watermark island + speckles).
3. Remove fringe: iteratively delete pixels touching background that are bright
   (`lum>180`) and low-saturation (`sat<45`). Assert **zero interior holes**.
4. Crop to subject bbox + 48px padding → square → LANCZOS resize (`reducing_gap=3.0`);
   pre-fill transparent RGB with the red outline `(211,33,47)` to avoid white bloom.

Outputs: `src/renderer/assets/logo-512.png` (source), `src/renderer/public/icon.png` (256),
`src/renderer/assets/icon.ico` (256). Then `npm run build` and **rebuild all three installers**.

## Version bump

Edit `version` in `package.json`, rebuild. Artifact filenames and the NSIS version resource
follow automatically.

## After a successful build

- Report the three artifacts with sizes/timestamps and confirm icons match the current logo.
- The `dist/` tree is gitignored — no commits from packaging itself.
- Packaging changes to code (`paths.js`, `index.js`, `package.json`, `scripts/*`) follow the
  repo commit convention (one feature per commit, `feat:`/`fix:`/`chore:`), bundling the
  matching `AGENTS.md`/`CHANGELOG.md` entries.
