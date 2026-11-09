#!/usr/bin/env node
/**
 * 构建产物自检：out/main 下每个模块的相对 require 是否都能解析。
 *
 * 背景（决策 21 的教训，2026-10-24 复现）：
 *   主进程除入口外是「原样复制」到 out/main，不走 rollup。
 *   新增 src/main/xxx.js 若没被复制，npm run dev（直读 src/）一切正常，
 *   但 npm run build 后启动即弹 "Cannot find module './xxx'"。
 *   electron.vite.config.js 已改为目录扫描，此脚本作为事后兜底。
 *
 * 用法：node scripts/check-main-build.js   （先 npm run build）
 * 退出码：0 全部找到；1 有缺失或未见构建产物
 */
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const outMain = path.join(root, 'out', 'main')

if (!fs.existsSync(outMain)) {
  console.error('[x] 未找到 out/main，请先执行 npm run build')
  process.exit(1)
}

const files = fs.readdirSync(outMain).filter((f) => f.endsWith('.js'))
const missing = []

for (const file of files) {
  const code = fs.readFileSync(path.join(outMain, file), 'utf8')
  for (const m of code.matchAll(/require\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g)) {
    const spec = m[1]
    const target = path.resolve(outMain, spec)
    const ok = [target, `${target}.js`, `${target}.json`, path.join(target, 'index.js')].some((p) =>
      fs.existsSync(p)
    )
    if (!ok) missing.push(`${file} → ${spec}`)
  }
}

// 入口里的本地 require 若指向 out/main 内不存在的模块，同样要报出来
if (missing.length) {
  console.error(`[x] out/main 相对依赖缺失 ${missing.length} 项：`)
  for (const line of missing) console.error(`    - ${line}`)
  console.error('    检查 electron.vite.config.js 的 copyMainModules()，或直接 npm run build 重试')
  process.exit(1)
}

console.log(`[ok] out/main 共 ${files.length} 个模块，相对 require 全部可解析`)
