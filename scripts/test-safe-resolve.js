/**
 * safeResolve 路径穿越防护 — 断言测试
 *
 * 直接从 src/main/index.js 抽取 safeResolve 源码执行，避免复制粘贴导致与实现漂移。
 * 运行: node scripts/test-safe-resolve.js
 */

const fs = require('fs')
const path = require('path')
const vm = require('vm')

const indexPath = path.join(__dirname, '..', 'src', 'main', 'index.js')
const source = fs.readFileSync(indexPath, 'utf-8')

// 抽取 function safeResolve (...) { ... } 的函数体（按大括号配对）
const startMarker = 'function safeResolve ('
const start = source.indexOf(startMarker)
if (start === -1) {
  console.error('FAIL: safeResolve not found in src/main/index.js')
  process.exit(1)
}

let depth = 0
let end = -1
for (let i = source.indexOf('{', start); i < source.length; i++) {
  if (source[i] === '{') depth++
  else if (source[i] === '}') {
    depth--
    if (depth === 0) { end = i + 1; break }
  }
}

if (end === -1) {
  console.error('FAIL: could not extract safeResolve body')
  process.exit(1)
}

const fnSource = source.slice(start, end)
const sandbox = { path, console, module: { exports: {} } }
vm.createContext(sandbox)
vm.runInContext(`${fnSource}\nmodule.exports = safeResolve`, sandbox)
const safeResolve = sandbox.module.exports

const BASE = process.platform === 'win32' ? 'D:\\data\\fast-txt\\file' : '/data/fast-txt/file'

const cases = [
  // [描述, 输入, 应当被接受]
  ['空路径 → base 本身', '', true],
  ['undefined → base 本身', undefined, true],
  ['普通文件名', 'readme.txt', true],
  ['子目录文件', 'NewFolder/nested.md', true],
  ['深层子目录', 'a/b/c/d.md', true],
  ['点开头的隐藏文件', '.order.json', true],
  ['回收站内文件', '.trash/old.txt', true],
  ['相对自身', './readme.txt', true],
  ['父目录穿越', '../evil.txt', false],
  ['多级父目录穿越', '../../../../Windows/System32/evil.dll', false],
  ['中途穿越再回来', 'a/../../evil.txt', false],
  ['Windows 绝对路径', 'D:\\Windows\\System32\\evil.dll', false],
  ['POSIX 绝对路径', '/etc/passwd', false],
  ['UNC 路径', '\\\\server\\share\\evil.txt', false],
  ['非字符串 (数字)', 123, false],
  ['非字符串 (对象)', { toString: () => 'x' }, false],
]

let failed = 0
const show = (v) => {
  const s = JSON.stringify(v)
  return (s === undefined ? String(v) : s).padEnd(48)
}

for (const [label, input, shouldPass] of cases) {
  const result = safeResolve(BASE, input)
  const passed = result.ok === shouldPass
  if (!passed) failed++
  const mark = passed ? 'PASS' : 'FAIL'
  const got = result.ok ? `ok → ${path.relative(path.resolve(BASE), result.target) || '.'}` : `rejected (${result.error})`
  console.log(`  [${mark}] ${label.padEnd(24)} ${show(input)} ${got}`)
}

// 额外断言: 接受的结果必须确实位于 base 之内
const inside = safeResolve(BASE, 'a/b/c.md')
const base = path.resolve(BASE)
const rel = path.relative(base, inside.target)
if (rel.startsWith('..') || path.isAbsolute(rel)) {
  failed++
  console.log('  [FAIL] accepted path is outside base:', inside.target)
}

console.log(failed === 0
  ? `\n所有 ${cases.length + 1} 项断言通过`
  : `\n${failed} 项断言失败`)

process.exit(failed === 0 ? 0 : 1)
