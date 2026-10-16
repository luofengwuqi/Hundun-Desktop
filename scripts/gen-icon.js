/**
 * 像素掌机图标生成器 (决策47, 零依赖)
 *
 * ⚠️ 2026-10-15 起应用 logo 已改为「桌面插画抠图」的馄饨图标 (决策48 见 AGENTS.md):
 *    src/renderer/assets/logo-512.png → src/renderer/public/icon.png + src/renderer/assets/icon.ico
 *    **本脚本运行会覆盖新 logo 三件套, 除非要换回像素掌机图标, 否则不要跑 npm run gen-icon**
 *
 * 运行: node scripts/gen-icon.js
 * 产出:
 *   src/renderer/public/icon.png  — 256×256 RGBA (窗口图标 / vite publicDir / Linux 构建图标)
 *   src/renderer/assets/icon.ico  — 256×256 PNG-in-ICO (Windows NSIS 图标)
 *
 * 设计: 32×32 虚拟像素网格 × 8 缩放 → 复古掌机 (深色机身 + 霓虹绿屏 + 像素 H + 十字键 + 双彩键)
 * 手写 PNG 编码 (IHDR/IDAT/IEND + CRC32) 与 ICO 容器, 不依赖任何第三方包。
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

// ========== CRC32 (PNG 块校验) ==========
let crcTable = null
function crc32 (buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
      crcTable[n] = c
    }
  }
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk (type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

/** RGBA 像素 (Buffer, w*h*4) → PNG 文件字节 */
function encodePng (width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // color type RGBA
  // 每行前置 filter=0 (None)
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4)
    raw[rowStart] = 0
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

/** PNG 字节 → 256×256 单层 ICO (Vista+ 支持 PNG 压缩条目) */
function wrapIco (pngBuf) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)          // reserved
  header.writeUInt16LE(1, 2)          // type: icon
  header.writeUInt16LE(1, 4)          // count
  const entry = Buffer.alloc(16)
  entry[0] = 0                        // width 0 = 256
  entry[1] = 0                        // height 0 = 256
  entry[2] = 0                        // colors
  entry[3] = 0                        // reserved
  entry.writeUInt16LE(1, 4)           // planes
  entry.writeUInt16LE(32, 6)          // bit count
  entry.writeUInt32LE(pngBuf.length, 8)
  entry.writeUInt32LE(6 + 16, 12)     // offset
  return Buffer.concat([header, entry, pngBuf])
}

// ========== 像素画 (32×32 网格, 调色板 RGBA) ==========
const GRID = 32
const SCALE = 8 // 32×8 = 256

function hex (h, a = 255) {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, a]
}

const C = {
  clear: [0, 0, 0, 0],
  bodyDark: hex('#0d0d0d'),
  body: hex('#1c1c1c'),
  bezel: hex('#000000'),
  screen: hex('#00ff88'),
  scan: hex('#00cc6a'),
  logo: hex('#003d1f'),
  dpad: hex('#3a3a3a'),
  btnA: hex('#ff0080'),
  btnB: hex('#00d4ff'),
  accent: hex('#00ff88')
}

function drawIcon () {
  const px = Buffer.alloc(GRID * GRID * 4)
  const set = (x, y, color) => {
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return
    const i = (y * GRID + x) * 4
    px[i] = color[0]; px[i + 1] = color[1]; px[i + 2] = color[2]; px[i + 3] = color[3]
  }
  const rect = (x, y, w, h, color) => {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) set(x + dx, y + dy, color)
  }

  // 机身 (深色外壳 + 内层)
  rect(4, 2, 24, 28, C.bodyDark)
  rect(5, 3, 22, 26, C.body)
  // 顶部霓虹 accent 条
  rect(5, 3, 22, 1, C.accent)

  // 屏幕: 黑色 bezel + 霓虹绿屏
  rect(7, 5, 18, 11, C.bezel)
  rect(8, 6, 16, 9, C.screen)
  // 扫描线 (复古 CRT)
  rect(8, 7, 16, 1, C.scan)
  rect(8, 10, 16, 1, C.scan)
  rect(8, 13, 16, 1, C.scan)
  // 像素 H (Hundun)
  rect(13, 7, 1, 6, C.logo)
  rect(18, 7, 1, 6, C.logo)
  rect(14, 9, 4, 2, C.logo)

  // 十字键 (左下)
  rect(9, 21, 5, 3, C.dpad)
  rect(10, 20, 3, 5, C.dpad)

  // 双彩键 (右下, 交错)
  rect(18, 21, 3, 3, C.btnA)
  rect(22, 19, 3, 3, C.btnB)

  // 喇叭孔 (右下角)
  rect(21, 25, 1, 2, C.dpad)
  rect(23, 25, 1, 2, C.dpad)
  rect(25, 25, 1, 2, C.dpad)

  // 网格 → 256 RGBA
  const size = GRID * SCALE
  const rgba = Buffer.alloc(size * size * 4)
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const si = (gy * GRID + gx) * 4
      for (let sy = 0; sy < SCALE; sy++) {
        for (let sx = 0; sx < SCALE; sx++) {
          const di = (((gy * SCALE + sy) * size) + (gx * SCALE + sx)) * 4
          px.copy(rgba, di, si, si + 4)
        }
      }
    }
  }
  return { rgba, size }
}

// ========== 产出 ==========
const { rgba, size } = drawIcon()
const pngBuf = encodePng(size, size, rgba)

const root = path.join(__dirname, '..')
const pngOut = path.join(root, 'src', 'renderer', 'public', 'icon.png')
const icoOut = path.join(root, 'src', 'renderer', 'assets', 'icon.ico')

fs.mkdirSync(path.dirname(pngOut), { recursive: true })
fs.mkdirSync(path.dirname(icoOut), { recursive: true })
fs.writeFileSync(pngOut, pngBuf)
fs.writeFileSync(icoOut, wrapIco(pngBuf))

console.log(`[gen-icon] ${size}x${size} PNG -> ${path.relative(root, pngOut)} (${pngBuf.length} bytes)`)
console.log(`[gen-icon] ICO (PNG-in-ICO) -> ${path.relative(root, icoOut)} (${6 + 16 + pngBuf.length} bytes)`)
