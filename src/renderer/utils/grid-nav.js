/**
 * 两列网格的键盘导航 (纯函数, 无依赖)
 *
 * 背景: 设置 → 主题的主题卡是 `grid-template-columns: 1fr 1fr` 的两列网格,
 * 通用列表导航「↑↓ 逐个 / ← 直接回左栏」在这种布局里会斜着跳 ——
 * ↓ 从右列卡跳到下一行左列卡、← 永远无法在行内左移 (直接退出到标签栏)。
 *
 * 这里按网格语义移动:
 *   ↑ / ↓ —— 整行跳 (±cols, 越界钳到边缘)
 *   →     —— 行内右移 (已在最右列则不动)
 *   ←     —— 行内左移 (已在最左列则退出, 返回左侧标签栏)
 * 其余按键返回 null, 交给调用方原有逻辑处理 (如 Enter 执行)。
 *
 * 索引为行优先扁平序: 0 1 / 2 3 / 4 …
 *
 * @param {number} index 当前选中下标
 * @param {number} count 项目总数
 * @param {number} cols 每行列数 (主题卡 = 2)
 * @param {string} key e.key 原始值 (WASD 会归一化为方向键)
 * @returns {{ index: number, exit: boolean } | null} null = 非方向键
 */
export const gridNavigate = (index, count, cols, key) => {
  if (!Number.isInteger(index) || !Number.isInteger(count) || count <= 0) return null
  if (index < 0 || index >= count) return null
  const norm = key === 'w' || key === 'W' ? 'ArrowUp'
    : key === 's' || key === 'S' ? 'ArrowDown'
    : key === 'a' || key === 'A' ? 'ArrowLeft'
    : key === 'd' || key === 'D' ? 'ArrowRight'
    : key
  const col = index % cols
  switch (norm) {
    case 'ArrowUp':
      return { index: Math.max(0, index - cols), exit: false }
    case 'ArrowDown':
      return { index: Math.min(count - 1, index + cols), exit: false }
    case 'ArrowRight':
      // 最右列不动; 末尾单项 (奇数个) 也不动
      return col === cols - 1 || index + 1 >= count
        ? { index, exit: false }
        : { index: index + 1, exit: false }
    case 'ArrowLeft':
      // 最左列 = 退出网格, 回左侧标签栏
      return col === 0
        ? { index, exit: true }
        : { index: index - 1, exit: false }
    default:
      return null
  }
}
