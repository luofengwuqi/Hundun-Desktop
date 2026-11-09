#!/usr/bin/env node
/**
 * 主题强约束自检（决策 58 / 59）：
 *   官方子程序的两套配色是强约束，不是建议 ——
 *     深色模式：恒为「黑绿」  --accent-primary: #00ff88，机身 #0a0a0a 系
 *     浅色模式：恒为「馄饨黄」--bg-primary: #FFF8E8 + 朱红 #C3272B
 *
 * 背景：
 *   母程序深色是黑机身 + 霓虹绿，浅色是馄饨黄 + 朱红。子程序若各自挑品牌色
 *   （Music 曾用青 #00d4ff 当主色、FastCmd 曾用橙 #ff9900、Music 浅色曾用
 *   藏蓝 #0077aa + 棕字），切进子程序就像换了个软件，与母程序割裂。
 *   故定成强约束，并用脚本兜底防止再次漂移。
 *
 * 检查范围：plugins/<id>/ 下所有 .css 与 .html
 *   - 首个 --accent-primary（深色变量块永远写在最前）：必须 #00ff88
 *   - 深色 --bg-primary / --bg-secondary / --shadow-color：必须黑底 + 绿辉光
 *   - 每个 .light-mode 块里的 --bg-primary / --accent-primary / --text-primary：
 *     必须 #FFF8E8 / #C3272B / #C3272B
 * 品牌色出口：manifest.json 的 color / iconColor 不受此约束（卡带身份色）。
 *
 * 用法：node scripts/check-plugin-theme.js   （npm run check:theme）
 * 退出码：0 全部合规；1 有子程序偏离母程序配色
 */
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const pluginsDir = path.join(root, 'plugins')

const DARK_RULES = [
  ['--bg-primary', '#0a0a0a', '深色机身底色'],
  ['--bg-secondary', '#141414', '深色面板底色'],
  ['--accent-primary', '#00ff88', '深色主强调（只能是霓虹绿）'],
  ['--shadow-color', 'rgba(0, 255, 136', '深色辉光（必须绿）']
]

const LIGHT_RULES = [
  ['--bg-primary', '#fff8e8', '浅色底（馄饨黄）'],
  ['--accent-primary', '#c3272b', '浅色主强调（朱红）'],
  ['--text-primary', '#c3272b', '浅色文字（朱红）']
]

const walk = (dir, out = []) => {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, out)
    else if (/\.(css|html)$/i.test(ent.name)) out.push(p)
  }
  return out
}

// 取某文件里第一次出现的变量值
const firstVar = (css, name) => {
  const m = css.match(new RegExp(name.replace(/-/g, '\\-') + '\\s*:\\s*([^;}]+)'))
  return m ? m[1].trim() : null
}

// 取出所有 .light-mode { ... } 块的声明体
const lightBlocks = (css) => {
  const out = []
  const re = /\.light-mode\s*\{([^}]*)\}/g
  let m
  while ((m = re.exec(css))) out.push(m[1])
  return out
}

const blockVar = (body, name) => {
  const m = body.match(new RegExp(name.replace(/-/g, '\\-') + '\\s*:\\s*([^;}]+)'))
  return m ? m[1].trim() : null
}

if (!fs.existsSync(pluginsDir)) {
  console.error('[x] 未找到 plugins/ 目录')
  process.exit(1)
}

const offenders = []
const plugins = fs.readdirSync(pluginsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(pluginsDir, d.name, 'manifest.json')))
  .map((d) => d.name)

for (const id of plugins) {
  const files = walk(path.join(pluginsDir, id))
  let hasDark = false
  let hasLight = false

  for (const file of files) {
    const css = fs.readFileSync(file, 'utf8')
    const rel = path.relative(root, file).replace(/\\/g, '/')

    // ---- 深色：文件里首个 --accent-primary 即深色块 ----
    if (!hasDark) {
      const accent = firstVar(css, '--accent-primary')
      if (accent) {
        hasDark = true
        for (const [name, want, label] of DARK_RULES) {
          const val = firstVar(css, name)
          if (val && !val.toLowerCase().startsWith(want)) {
            offenders.push(`${id}: ${rel} → ${name}: ${val}（${label} 应为 ${want}）`)
          }
        }
      }
    }

    // ---- 浅色：每个 .light-mode 块都要是馄饨黄 ----
    for (const body of lightBlocks(css)) {
      hasLight = true
      for (const [name, want, label] of LIGHT_RULES) {
        const val = blockVar(body, name)
        if (val && val.toLowerCase() !== want) {
          offenders.push(`${id}: ${rel} → .light-mode ${name}: ${val}（${label} 应为 ${want}）`)
        }
      }
    }
  }

  if (!hasDark) offenders.push(`${id}: 未声明深色 --accent-primary，无法判定黑绿主题`)
  if (!hasLight) offenders.push(`${id}: 未声明 .light-mode 变量块，未沿用馄饨黄配色`)
}

if (offenders.length) {
  console.error(`[x] 主题偏离母程序配色 ${offenders.length} 处（决策 58/59）：`)
  for (const line of offenders) console.error(`    - ${line}`)
  console.error('    规则见 docs/PLUGIN_SPEC.md §8.3；品牌色只允许放在 manifest.json 的 color / iconColor。')
  process.exit(1)
}

console.log(`[ok] ${plugins.length} 个官方子程序配色合规：深色黑绿 + 浅色馄饨黄`)
