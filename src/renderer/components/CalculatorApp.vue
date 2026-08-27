<template>
  <div class="calc-app">
    <!-- 装饰螺丝 -->
    <div class="deco-screw screw-tl"></div>
    <div class="deco-screw screw-tr"></div>
    <div class="deco-screw screw-bl"></div>
    <div class="deco-screw screw-br"></div>

    <!-- 头部 -->
    <header class="calc-header">
      <div class="calc-title-row">
        <span class="calc-title">CALCULATOR</span>
        <span class="calc-chip">POCKET EDITION</span>
      </div>
      <!-- 右上角返回按钮 -->
      <button class="calc-close-btn" @click="$emit('returnToParent')" title="返回母程序">
        ✕
      </button>
    </header>

    <!-- 内容：显示屏 + 按键 -->
    <main class="calc-content">
      <!-- 显示屏 -->
      <div class="calc-display">
        <div class="display-brand">
          <span class="brand-dot"></span>
          <span class="brand-text">POCKET&nbsp;CALC</span>
          <span class="brand-dot"></span>
        </div>
        <div class="display-expression">{{ expression || '\u00A0' }}</div>
        <Transition name="digit-pop" mode="out-in">
          <div class="display-result" :key="resultKey" :class="{ 'is-error': isError }">
            {{ displayText }}
          </div>
        </Transition>
        <div class="display-footer">
          <span class="foot-blink" :class="{ 'error': isError }">●</span>
          <span class="foot-label">{{ isError ? 'SYNTAX ERROR' : 'READY' }}</span>
        </div>
      </div>

      <!-- 按键网格 -->
      <div class="calc-pad">
        <button
          v-for="(key, idx) in padKeys"
          :key="key.id"
          class="calc-key"
          :class="[key.cls, { 'pad-selected': focusedIdx === idx }]"
          :style="{ animationDelay: `${0.15 + idx * 0.02}s` }"
          @click="onKeyPress(key)"
        >
          {{ key.label }}
        </button>
      </div>
    </main>

    <!-- 底部 -->
    <footer class="calc-footer">
      <span class="calc-version">MADE BY HUNDUN v1.0.0</span>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue'
import { playSound } from '../utils/audio'

const emit = defineEmits(['returnToParent'])

// ========== 状态 ==========
const currentInput = ref('0')     // 当前输入值（内部状态）
const acc = ref(0)                // 累计值
const pendingOp = ref(null)       // 待执行运算符
const waitingForOperand = ref(false) // 等待新操作数
const isError = ref(false)        // 错误状态
const expression = ref('')        // 上行表达式

// ========== 按键定义 ==========
const padKeys = [
  { id: 'ac',  label: 'AC', action: 'clear',     cls: 'fn' },
  { id: 'bs',  label: '⌫',  action: 'backspace', cls: 'fn' },
  { id: 'pct', label: '%',  action: 'percent',   cls: 'fn' },
  { id: 'div', label: '÷',  action: 'op',        cls: 'op' },
  { id: '7',   label: '7',  action: 'digit' },
  { id: '8',   label: '8',  action: 'digit' },
  { id: '9',   label: '9',  action: 'digit' },
  { id: 'mul', label: '×',  action: 'op',        cls: 'op' },
  { id: '4',   label: '4',  action: 'digit' },
  { id: '5',   label: '5',  action: 'digit' },
  { id: '6',   label: '6',  action: 'digit' },
  { id: 'sub', label: '−',  action: 'op',        cls: 'op' },
  { id: '1',   label: '1',  action: 'digit' },
  { id: '2',   label: '2',  action: 'digit' },
  { id: '3',   label: '3',  action: 'digit' },
  { id: 'add', label: '+',  action: 'op',        cls: 'op' },
  { id: 'sign',label: '±',  action: 'sign',      cls: 'fn' },
  { id: '0',   label: '0',  action: 'digit' },
  { id: 'dot', label: '.',  action: 'dot' },
  { id: 'eq',  label: '=',  action: 'equals',    cls: 'eq' }
]

// 键盘焦点索引（可选，预留方向键导航）
const focusedIdx = ref(-1)

// ========== 显示 ==========
const displayText = computed(() => {
  if (isError.value) return 'ERROR'
  let s = currentInput.value
  if (s.length > 12) s = s.slice(0, 12)
  return s
})
const resultKey = computed(() => (isError.value ? 'err' : displayText.value))

// ========== 核心计算 ==========
const calculate = (a, b, op) => {
  switch (op) {
    case '+': return a + b
    case '−': return a - b
    case '×': return a * b
    case '÷': return a / b
  }
}

// 数字 → 字符串（去浮点误差、去多余0）
const formatNumber = (num) => {
  if (num === 0) return '0'
  return String(Math.round(num * 1e10) / 1e10)
}

// 结果格式（限制长度，超长转科学计数法）
const formatResult = (num) => {
  if (num === 0) return '0'
  let str = String(Math.round(num * 1e10) / 1e10)
  if (str.length > 11) {
    str = num.toExponential(6)
  }
  return str
}

const showError = () => {
  isError.value = true
  currentInput.value = 'ERROR'
  pendingOp.value = null
  waitingForOperand.value = true
  playSound('error')
}

// ========== 输入操作 ==========
const inputDigit = (digit) => {
  playSound('click')
  if (isError.value) clearAll()
  if (waitingForOperand.value) {
    currentInput.value = String(digit)
    waitingForOperand.value = false
    return
  }
  if (currentInput.value === '0') {
    currentInput.value = String(digit)
    return
  }
  // 最多10位有效数字
  if (currentInput.value.replace(/[^0-9]/g, '').length >= 10) return
  currentInput.value += String(digit)
}

const inputDot = () => {
  playSound('click')
  if (isError.value) clearAll()
  if (waitingForOperand.value) {
    currentInput.value = '0.'
    waitingForOperand.value = false
    return
  }
  if (!currentInput.value.includes('.')) {
    currentInput.value += '.'
  }
}

const setOperator = (op) => {
  playSound('click')
  if (isError.value) return
  const inputValue = parseFloat(currentInput.value)

  if (pendingOp.value !== null && !waitingForOperand.value) {
    const result = calculate(acc.value, inputValue, pendingOp.value)
    if (isNaN(result) || !isFinite(result)) { showError(); return }
    acc.value = result
    currentInput.value = formatResult(result)
  } else {
    acc.value = inputValue
  }
  pendingOp.value = op
  waitingForOperand.value = true
  expression.value = `${formatNumber(acc.value)} ${op}`
}

const equals = () => {
  if (pendingOp.value === null || isError.value) return
  playSound('click')
  const inputValue = parseFloat(currentInput.value)
  const result = calculate(acc.value, inputValue, pendingOp.value)
  expression.value = `${formatNumber(acc.value)} ${pendingOp.value} ${formatNumber(inputValue)} =`
  pendingOp.value = null
  waitingForOperand.value = true

  if (isNaN(result) || !isFinite(result)) {
    showError()
  } else {
    currentInput.value = formatResult(result)
  }
}

const clearAll = () => {
  playSound('click')
  currentInput.value = '0'
  acc.value = 0
  pendingOp.value = null
  waitingForOperand.value = false
  isError.value = false
  expression.value = ''
}

const backspace = () => {
  playSound('click')
  if (waitingForOperand.value || isError.value) return
  if (currentInput.value.length <= 1 ||
      (currentInput.value.length === 2 && currentInput.value.startsWith('-'))) {
    currentInput.value = '0'
  } else {
    currentInput.value = currentInput.value.slice(0, -1)
  }
}

const toggleSign = () => {
  playSound('click')
  if (currentInput.value === '0' || isError.value) return
  currentInput.value = currentInput.value.startsWith('-')
    ? currentInput.value.slice(1)
    : '-' + currentInput.value
}

const percent = () => {
  playSound('click')
  if (isError.value) return
  const value = parseFloat(currentInput.value)
  currentInput.value = formatResult(value / 100)
}

// ========== 按键分发 ==========
const onKeyPress = (key) => {
  switch (key.action) {
    case 'digit':     inputDigit(key.label); break
    case 'dot':       inputDot(); break
    case 'op':        setOperator(key.label); break
    case 'equals':    equals(); break
    case 'clear':     clearAll(); break
    case 'backspace': backspace(); break
    case 'percent':   percent(); break
    case 'sign':      toggleSign(); break
  }
}

// ========== 键盘输入 ==========
const handleKey = (e) => {
  if (e.key === 'Escape') {
    emit('returnToParent')
    return
  }

  if (/^[0-9]$/.test(e.key)) inputDigit(e.key)
  else if (e.key === '.') inputDot()
  else if (e.key === '+') setOperator('+')
  else if (e.key === '-') setOperator('−')
  else if (e.key === '*') setOperator('×')
  else if (e.key === '/') { e.preventDefault(); setOperator('÷') }
  else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); equals() }
  else if (e.key === 'Backspace') backspace()
  else if (e.key === '%') percent()
  else if (e.key === 'c' || e.key === 'C') clearAll()
}

onMounted(() => {
  document.addEventListener('keydown', handleKey)
})
onActivated(() => {
  // KeepAlive 重新激活时恢复键盘监听
  document.addEventListener('keydown', handleKey)
})
onDeactivated(() => {
  // KeepAlive 缓存时移除键盘监听，避免返回母程序后仍响应按键
  document.removeEventListener('keydown', handleKey)
})
onUnmounted(() => {
  document.removeEventListener('keydown', handleKey)
})
</script>

<style scoped>
.calc-app {
  width: 100%;
  height: 100%;
  background: var(--bg-secondary);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* CRT Scanline */
.calc-app::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, var(--scanline-opacity, 0.03)) 0px,
    rgba(0, 0, 0, var(--scanline-opacity, 0.03)) 1px,
    transparent 1px,
    transparent 2px
  );
  pointer-events: none;
  z-index: 100;
}

/* 装饰螺丝 */
.deco-screw {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--border-color);
  border-radius: 50%;
  z-index: 101;
}
.deco-screw::before {
  content: '+';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 6px;
  color: #000;
}
.screw-tl { top: 12px; left: 12px; }
.screw-tr { top: 12px; right: 12px; }
.screw-bl { bottom: 15px; left: 20px; }
.screw-br { bottom: 15px; right: 20px; }

/* ========== Header ========== */
.calc-header {
  height: 44px;
  background: var(--bg-secondary);
  border-bottom: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  -webkit-app-region: drag;
  flex-shrink: 0;
  position: relative;
}

.calc-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.calc-title {
  font-family: 'Press Start 2P', monospace;
  font-size: 12px;
  color: var(--accent-primary);
  letter-spacing: 3px;
  text-shadow: 0 0 10px var(--accent-primary);
}

.calc-chip {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  color: var(--text-muted);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 3px 5px;
  letter-spacing: 1px;
  margin-left: 4px;
}

/* 右上角返回按钮 */
.calc-close-btn {
  position: absolute;
  top: 8px;
  right: 12px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--accent-primary);
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  -webkit-app-region: no-drag;
  z-index: 102;
}

.calc-close-btn:hover {
  color: var(--accent-secondary, #ff0080);
  box-shadow: 0 0 12px var(--shadow-color);
  transform: scale(1.1);
}

/* ========== Content ========== */
.calc-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px 18px 16px;
  min-height: 0;
}

/* ========== 显示屏 ========== */
.calc-display {
  background: var(--bg-card);
  border: 3px solid var(--border-color);
  border-radius: 12px;
  padding: 10px 14px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
  position: relative;
  box-shadow:
    inset 0 0 18px rgba(0, 0, 0, 0.35),
    0 2px 0 rgba(0, 0, 0, 0.2);
}

.display-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.brand-dot {
  width: 4px;
  height: 4px;
  background: var(--accent-primary);
  border-radius: 50%;
  opacity: 0.7;
}

.brand-text {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  color: var(--text-muted);
  letter-spacing: 2px;
}

.display-expression {
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  color: var(--text-muted);
  text-align: right;
  min-height: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  direction: rtl; /* 表达式从右往左优先显示最近部分 */
}

.display-result {
  font-family: 'Press Start 2P', monospace;
  font-size: clamp(18px, 7vw, 26px);
  color: var(--accent-primary);
  text-align: right;
  letter-spacing: 1px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 0 10px var(--accent-primary), 0 0 22px var(--shadow-color);
  word-break: break-all;
}

.display-result.is-error {
  color: var(--accent-secondary, #ff0080);
  text-shadow: 0 0 10px var(--accent-secondary, #ff0080);
  animation: errorFlash 0.5s steps(2) infinite;
}

.display-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 2px;
}

.foot-blink {
  font-size: 6px;
  color: var(--accent-primary);
  animation: pulse 1.6s infinite;
}

.foot-blink.error {
  color: var(--accent-secondary, #ff0080);
}

.foot-label {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  color: var(--text-muted);
  letter-spacing: 1px;
}

/* 数字滚动过渡 */
.digit-pop-enter-active {
  transition: all 0.13s ease-out;
}
.digit-pop-enter-from {
  opacity: 0;
  transform: translateY(5px) scale(0.97);
}
.digit-pop-leave-active {
  transition: all 0.07s ease-in;
}
.digit-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.99);
}

/* ========== 按键网格 ========== */
.calc-pad {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 1fr;
  gap: 10px;
  min-height: 0;
}

.calc-key {
  font-family: 'Press Start 2P', monospace;
  font-size: 15px;
  color: var(--text-primary);
  background: var(--bg-card);
  border: 2px solid var(--border-color);
  border-radius: 10px;
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 0 var(--border-color);
  transition: all 0.08s ease-out;
  animation: keyIn 0.35s ease-out both;
  -webkit-app-region: no-drag;
}

.calc-key:hover {
  border-color: var(--accent-primary);
  box-shadow: 0 4px 0 var(--border-color), 0 0 14px var(--shadow-color);
  color: var(--accent-primary);
  transform: translateY(-1px);
}

.calc-key:active {
  transform: translateY(3px);
  box-shadow: 0 1px 0 var(--border-color);
}

.calc-key:focus-visible {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 4px 0 var(--border-color), 0 0 14px var(--shadow-color);
}

/* 功能键 */
.calc-key.fn {
  color: var(--accent-tertiary);
  font-size: 13px;
}
.calc-key.fn:hover {
  color: var(--accent-tertiary);
  border-color: var(--accent-tertiary);
  box-shadow: 0 4px 0 var(--border-color), 0 0 14px var(--shadow-color);
}

/* 运算符键 */
.calc-key.op {
  color: var(--accent-primary);
  font-size: 17px;
}
.calc-key.op:hover {
  color: var(--accent-primary);
}

/* 等号键 - 实心强调 */
.calc-key.eq {
  background: var(--accent-primary);
  color: #000;
  border-color: var(--accent-primary);
  box-shadow: 0 4px 0 color-mix(in srgb, var(--accent-primary) 60%, #000);
  font-size: 18px;
}
.calc-key.eq:hover {
  background: var(--accent-secondary, #ff0080);
  border-color: var(--accent-secondary, #ff0080);
  color: #fff;
  box-shadow: 0 4px 0 color-mix(in srgb, var(--accent-secondary) 60%, #000), 0 0 14px var(--shadow-color);
}
.calc-key.eq:active {
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.5);
}

/* ========== Footer ========== */
.calc-footer {
  height: 32px;
  background: var(--bg-secondary);
  border-top: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
}

.calc-version {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  color: var(--text-muted);
  letter-spacing: 1px;
}

/* ========== 动画 ========== */
@keyframes keyIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes errorFlash {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* 浅色模式微调 */
.light-mode .calc-display {
  box-shadow:
    inset 0 0 12px rgba(0, 0, 0, 0.08),
    0 2px 0 rgba(0, 0, 0, 0.05);
}

.light-mode .calc-key {
  box-shadow: 0 4px 0 #d8cbb2;
}

.light-mode .calc-key:hover {
  box-shadow: 0 4px 0 #d8cbb2, 0 0 14px var(--shadow-color);
}

.light-mode .calc-key:active {
  box-shadow: 0 1px 0 #d8cbb2;
}

.light-mode .calc-key.eq {
  box-shadow: 0 4px 0 #8f1d20;
}
.light-mode .calc-key.eq:hover {
  box-shadow: 0 4px 0 #8a0c46, 0 0 14px var(--shadow-color);
}
.light-mode .calc-key.eq:active {
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.3);
}
</style>
