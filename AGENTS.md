# Hundun Lite - 项目进度文档

> 最后更新: 2026-08-16
> 当前阶段: Phase 2 - Electron集成 (UI交互优化完成)

---

## 📋 项目概述

**Hundun Lite** 是一个高度可扩展的桌面效率应用，采用"母程序+子程序"的插件架构。

| 属性 | 值 |
|------|-----|
| 技术栈 | Electron + Vue3 |
| 窗口尺寸 | 800×540 (固定) |
| 设计风格 | 复古掌机 × 像素艺术 |
| 项目路径 | `E:\code2\huntunLite` |

---

## ✅ 已完成任务

### 1. 前端视觉原型 `huntun-lite-prototype.html`

#### 1.1 界面元素
- [x] 深色/浅色模式切换 (物理拨动开关)
- [x] Switch风格卡带 (128px × 192px)
- [x] 卡带信息栏 (显示选中项名称)
- [x] 卡带插槽 (单卡带，等比例缩放)
- [x] 装饰螺丝 + CRT扫描线效果
- [x] 底部按钮组 (+添加、⚙设置)

#### 1.2 交互功能
- [x] 卡带拖拽到插槽
- [x] 拖入后自动启动应用
- [x] 点击插槽弹窗显示运行中应用
- [x] 拔出后卡带返回列表
- [x] 鼠标滚轮水平滚动卡带列表
- [x] 鼠标点击选中卡带/按钮
- [x] 键盘WASD/方向键操控
- [x] 键盘Enter/空格执行操作

#### 1.3 样式系统
- [x] CSS变量驱动主题
- [x] 深色模式完整样式
- [x] 浅色模式完整样式 (#FFF8E8暖色调)
- [x] 选中态高亮效果

#### 1.4 音效系统
- [x] 9个Switch风格音效集成
- [x] 点击、切换、入仓、确认、返回音效

### 2. UI交互优化 (2026-08-16)

#### 2.1 弹窗系统增强
- [x] 弹窗支持两种尺寸：normal / large
- [x] 按钮支持键盘导航 (WASD/方向键选中，空格/回车执行)
- [x] 按钮支持鼠标操作 (第一次点击选中，第二次点击执行)
- [x] 按钮字体增大 (18px)
- [x] 按钮padding优化 (10px 18px)

#### 2.2 卡带插槽弹窗优化
- [x] 弹窗高度扩大 (large模式)
- [x] 按钮顺序调整：继续使用 → 拔出卡带 → 取消
- [x] "继续使用"按钮功能实现：切换到运行中的子程序视图

#### 2.3 键盘快捷键完善
- [x] Esc键逻辑：
  - 模态框打开时：关闭模态框
  - 子程序中：返回母程序
  - 母程序中：关闭运行中的子程序并退出

#### 2.4 窗口切换动画优化
- [x] 修复 `contextIsolation: false` 时 `window.electronAPI` 不可用的问题
- [x] 改用 `require('electron').ipcRenderer` 直接通信
- [x] 子程序模式下 `.console` 自适应窗口大小 (child-mode)
- [x] 子程序模式下去掉圆角边框
- [x] LoadingMask 支持 childMode 参数适配无圆角
- [x] 窗口大小渐变动画 (主进程20步eInOut缓动，约400ms)
- [x] Loading动画时间翻倍 (entering/exit: 900ms, visible: 1200ms)

---

## 🎮 交互逻辑详解 (重要)

### 状态管理
```javascript
let selectedIndex = -1;  // 当前选中的卡带索引
let selectedRow = 0;     // 0=卡带行, 1=按钮+插槽行
let selectedCol = 0;     // 按钮行中的列: 0=+, 1=设置, 2=插槽
let slotPlugin = null;   // 插槽中的卡带 (只能有一个)
```

### 两行布局
```
┌─────────────────────────────────────────┐
│  卡带行 (selectedRow=0)                  │
│  [卡带1] [卡带2] [卡带3] ...             │
├─────────────────────────────────────────┤
│  按钮+插槽行 (selectedRow=1)             │
│  [+ ] [⚙ ]              [卡带插槽]       │
│   col0  col1               col2          │
└─────────────────────────────────────────┘
```

### 键盘操控

| 按键 | 映射 | 功能 |
|------|------|------|
| `W` / `↑` | ArrowUp | 切换到卡带行 (selectedRow=0) |
| `S` / `↓` | ArrowDown | 切换到按钮+插槽行 (selectedRow=1) |
| `A` / `←` | ArrowLeft | 上一个 (卡带/按钮) |
| `D` / `→` | ArrowRight | 下一个 (卡带/按钮) |
| `空格` / `Enter` | Enter | 执行选中项 |
| `Esc` | Escape | 关闭弹窗 |

### 键盘映射代码
```javascript
let key = e.key;
if (key === 'a' || key === 'A') key = 'ArrowLeft';
if (key === 'd' || key === 'D') key = 'ArrowRight';
if (key === 'w' || key === 'W') key = 'ArrowUp';
if (key === 's' || key === 'S') key = 'ArrowDown';
if (key === ' ') key = 'Enter';
```

### 鼠标操控

| 操作 | 功能 |
|------|------|
| 点击卡带 | 选中该卡带 (selectedRow=0, selectedIndex=idx) |
| 点击+按钮 | 选中添加按钮 (selectedRow=1, selectedCol=0) |
| 点击⚙按钮 | 选中设置按钮 (selectedRow=1, selectedCol=1) |
| 点击插槽 | 选中插槽 (selectedRow=1, selectedCol=2) |
| 滚轮 | 水平滚动卡带列表 |

### 信息栏显示逻辑
```javascript
function updateInfoBar() {
    if (selectedRow === 0) {
        // 显示选中卡带名称
        info.innerHTML = shelfPlugins[selectedIndex].name;
    } else {
        // 显示按钮名称: ['添加应用', '设置', '卡带插槽']
        info.innerHTML = names[selectedCol];
    }
}
```

### Enter执行逻辑
```javascript
case 'Enter':
    if (selectedRow === 0) {
        // 卡带行: 插入选中的卡带到插槽
        insertSelectedToSlot();
    } else {
        // 按钮行: 执行对应操作
        handleBottomRowAction(); // 根据selectedCol执行
    }
```

### 视觉反馈
- **卡带选中**: `.cartridge.selected` - 发光边框 + 上移
- **按钮选中**: `.slot-btn.selected` - 发光边框 + 放大
- **插槽选中**: `.cartridge-slot.selected` - 发光边框

### 单卡带限制
- 插槽只能放一张卡带
- 拖入新卡带时，旧卡带自动返回列表
- 同一应用不能重复启动

---

## 🎨 设计规范

### 颜色系统

#### 深色模式
```css
--bg-primary: #0a0a0a
--bg-secondary: #141414
--accent-primary: #00ff88 (霓虹绿)
--accent-secondary: #ff0080 (赛博粉)
--accent-tertiary: #00d4ff (电光蓝)
```

#### 浅色模式
```css
--bg-primary: #FFF8E8 (奶油白)
--bg-secondary: #FFF3D6
--accent-primary: #C3272B (朱红)
--accent-secondary: #cc0066
--accent-tertiary: #0099cc
```

### 字体规范
- **像素字体**: Press Start 2P (标题、标签)
- **正文字体**: Noto Sans SC (描述、内容)

### 卡带规格
- **尺寸**: 128px × 192px (2:3比例)
- **插槽卡带**: 保持原始比例，等比缩放

---

## 🚧 待完成任务

### Phase 2: Electron集成 (优先级: 高)

- [x] 安装项目依赖 (`npm install`)
- [x] 配置 electron-vite
- [x] 实现真正的窗口无边框
- [x] 将HTML原型拆分为Vue3组件
- [x] 实现键盘导航系统 (WASD/方向键)
- [x] 实现拖拽系统 (卡带拖入插槽)
- [x] 测试深色/浅色模式在Electron中的效果

### Phase 3: 插件系统 (优先级: 高)

- [ ] 实现动态插件加载
- [ ] 插件沙箱隔离
- [ ] 插件通信机制
- [ ] 插件生命周期管理
- [ ] 插件配置持久化

### Phase 4: 功能插件 (优先级: 中)

- [ ] 定时任务管理器 (完整功能)
- [ ] 命令执行器 (完整功能)
- [ ] 极客记事本
- [ ] 剪贴板管理器
- [ ] 系统监控
- [ ] 快捷启动器

### Phase 5: 高级特性 (优先级: 低)

- [ ] 插件市场
- [ ] 用户账户系统
- [ ] 云同步
- [ ] 国际化支持
- [ ] 自动更新

---

## 🔧 技术决策

### 已确定
1. **固定窗口尺寸**: 800×540，不可调整
2. **无边框窗口**: 自定义标题栏
3. **插件架构**: 动态加载，manifest.json规范
4. **音效系统**: 预加载 + 按需播放
5. **交互方式**: 键盘(WASD+空格) + 鼠标(点击) 双模式

### 待定
1. 插件沙箱方案 (iframe vs Web Worker)
2. 插件通信机制 (postMessage vs SharedArrayBuffer)
3. 数据持久化方案 (localStorage vs SQLite)

---

## 📝 开发规范

### 代码风格
- ESLint + Prettier
- Vue3 Composition API
- 中文注释

### 提交规范
```
feat: 新功能
fix: 修复问题
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
perf: 性能优化
test: 测试相关
chore: 构建/工具链更新
```

---

## 🐛 已知问题

### 已修复
- ✅ 浅色模式卡带样式丢失
- ✅ 浅色模式拖拽插槽显示黑色
- ✅ 悬浮提示框被遮挡
- ✅ 浅色模式底部标签区过长

### 待修复
- [ ] Electron中音效可能无法播放 (自动播放策略)
- [ ] 大量卡带时性能优化

---

## 🎯 下一步行动

### 立即执行
1. ✅ ~~运行 `npm install` 安装依赖~~
2. ✅ ~~运行 `npm run dev` 测试Electron集成~~
3. ✅ ~~验证原型在Electron中的显示效果~~

### 本周目标
1. ✅ 完成Electron基础配置
2. ✅ 实现Vue3组件化架构
3. 开始插件系统开发

---

**项目状态**: 🟢 Phase 2完成 - Vue3+Electron集成成功，准备进入插件系统开发
