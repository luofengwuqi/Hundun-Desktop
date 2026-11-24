/**
 * 网格键盘导航纯函数单测 (纯 Node, 无 electron)
 * 跑法: node scripts/test-grid-nav.js
 *
 * 背景: 设置 → 主题的主题卡是两列网格, 旧逻辑「↑↓ 逐个 / ← 直接回左栏」
 * 会斜着跳 (↓ 从右列跳到下一行左列), 且 ← 永远无法行内左移。
 */
const assert = require('node:assert')
const { gridNavigate } = require('../src/renderer/utils/grid-nav.js')

let pass = 0
let fail = 0
const check = (name, fn) => {
  try {
    fn()
    pass++
    console.log('  PASS', name)
  } catch (e) {
    fail++
    console.log('  FAIL', name, '--', e.message)
  }
}
// 5 个主题卡 (2 官方 + 2 非官方 + 恢复入口), 两列, 行优先: 0 1 / 2 3 / 4
const N = 5
const g = (idx, key) => gridNavigate(idx, N, 2, key)

console.log('=== 网格导航 ===')

check('1. ↓ 从左列卡 (0) 跳到下一行同列 (2), 不斜跳', () => assert.deepStrictEqual(g(0, 'ArrowDown'), { index: 2, exit: false }))
check('2. ↓ 从右列卡 (1) 跳到下一行同列 (3)', () => assert.deepStrictEqual(g(1, 'ArrowDown'), { index: 3, exit: false }))
check('3. ↑ 从 (3) 回上一行同列 (1)', () => assert.deepStrictEqual(g(3, 'ArrowUp'), { index: 1, exit: false }))
check('4. ↑ 在第一行 (0) 钳到 0', () => assert.deepStrictEqual(g(0, 'ArrowUp'), { index: 0, exit: false }))
check('5. ↓ 在末尾 (4) 钳在 4', () => assert.deepStrictEqual(g(4, 'ArrowDown'), { index: 4, exit: false }))
check('6. → 从左列 (0) 右移到 (1)', () => assert.deepStrictEqual(g(0, 'ArrowRight'), { index: 1, exit: false }))
check('7. → 在最右列 (1) 不动', () => assert.deepStrictEqual(g(1, 'ArrowRight'), { index: 1, exit: false }))
check('8. → 在奇数末尾单项 (4, 独占一行) 不动', () => assert.deepStrictEqual(g(4, 'ArrowRight'), { index: 4, exit: false }))
check('9. ← 从右列 (3) 左移到 (2)', () => assert.deepStrictEqual(g(3, 'ArrowLeft'), { index: 2, exit: false }))
check('10. ← 在最左列 (2) 退出网格 (回左侧标签栏)', () => assert.deepStrictEqual(g(2, 'ArrowLeft'), { index: 2, exit: true }))
check('11. ← 在末尾单项 (4) 退出网格', () => assert.deepStrictEqual(g(4, 'ArrowLeft'), { index: 4, exit: true }))

console.log('=== WASD 归一化 ===')
check('12. w = ↑', () => assert.deepStrictEqual(g(0, 'w'), { index: 0, exit: false }))
check('13. s = ↓', () => assert.deepStrictEqual(g(0, 's'), { index: 2, exit: false }))
check('14. a = ← (右列内左移)', () => assert.deepStrictEqual(g(1, 'a'), { index: 0, exit: false }))
check('15. d = →', () => assert.deepStrictEqual(g(0, 'd'), { index: 1, exit: false }))
check('16. 大写 WASD 同样归一化', () => assert.deepStrictEqual(g(0, 'S'), { index: 2, exit: false }))

console.log('=== 非方向键 / 边界 ===')
check('17. Enter 返回 null (交给通用分支执行)', () => assert.strictEqual(g(0, 'Enter'), null))
check('18. 空格返回 null', () => assert.strictEqual(g(0, ' '), null))
check('19. 未选中 (index=-1) 返回 null', () => assert.strictEqual(gridNavigate(-1, N, 2, 'ArrowDown'), null))
check('20. 空列表返回 null', () => assert.strictEqual(gridNavigate(0, 0, 2, 'ArrowDown'), null))
check('21. 越界下标返回 null', () => assert.strictEqual(gridNavigate(9, N, 2, 'ArrowDown'), null))

console.log('=== 不同列表形状 (激活态切换) ===')
// 非官方激活: [非官方0, 非官方1, 恢复] — 恢复独占第二行
const g3 = (idx, key) => gridNavigate(idx, 3, 2, key)
check('22. 3 项时 ↓ 从 (1) 钳到末尾 (2)', () => assert.deepStrictEqual(g3(1, 'ArrowDown'), { index: 2, exit: false }))
check('23. 3 项时 ↑ 从恢复入口 (2) 回第一行左列 (0)', () => assert.deepStrictEqual(g3(2, 'ArrowUp'), { index: 0, exit: false }))
check('24. 3 项时 → 在恢复入口 (2) 不动', () => assert.deepStrictEqual(g3(2, 'ArrowRight'), { index: 2, exit: false }))
check('25. 3 项时 ← 在 (0) 退出网格', () => assert.deepStrictEqual(g3(0, 'ArrowLeft'), { index: 0, exit: true }))

console.log('==========')
console.log(`结果: ${pass}/${pass + fail} 通过`)
process.exit(fail > 0 ? 1 : 0)
