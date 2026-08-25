# Hundun Lite - 项目进度文档

> 最后更新: 2026-08-25
> 当前阶段: Phase 4 - 功能插件开发 (FastTXT 文本管理器完成)

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
- [x] 窗口大小渐变动画 (时间戳驱动 easeInOut 缓动，约400ms)
- [x] Loading动画时间翻倍 (entering/exit: 900ms, visible: 1200ms)
- [x] 窗口缩放改为**中心基准** (四边对称缩放，非左上角)
- [x] 时间戳驱动动画 (消除 setTimeout 延迟漂移)
- [x] 防重入 token 机制 (快速切换不冲突)

### 3. 计算器子程序 (2026-08-25)

#### 3.1 CalculatorApp 组件
- [x] 复古掌机风格像素计算器 (`src/renderer/components/CalculatorApp.vue`)
- [x] 显示屏: 表达式行 + 大号霓虹发光结果 + POCKET CALC 品牌 + READY/ERROR 状态灯
- [x] 20键网格: AC/⌫/%/运算符/±/=，像素硬阴影 + 按下物理下沉效果
- [x] 数字滚动过渡动画 (Transition + key)
- [x] 按键 staggered 入场动画
- [x] 等号键实心霓虹填充 (深色: 绿 / 浅色: 朱红)
- [x] 深浅色主题自动适配 (CSS 变量)
- [x] CRT 扫描线 + 装饰螺丝

#### 3.2 计算功能
- [x] 标准四则运算 (连续运算、等号)
- [x] 百分比、正负号、退格、AC 清空
- [x] 键盘支持 (数字键、`+-*/`.`、Enter/Backspace、C)
- [x] 统一 click 音效 (所有按键)
- [x] 错误处理 (除零 → ERROR + 红色闪烁 + error 音效)
- [x] 精度处理 (10位有效数字、浮点误差修剪、超长科学计数法)

#### 3.3 集成与状态保留
- [x] App.vue 动态组件分发 (按插件 id 选择子程序组件)
- [x] 子程序键盘放行 (child 模式下只拦截 Esc，其余交子组件处理)
- [x] KeepAlive 缓存子程序实例 (返回母程序再进入时保留内容)
- [x] onActivated/onDeactivated 管理键盘监听生命周期

### 4. FastTXT 文本文件管理器 (2026-08-25)

#### 4.1 FastTXTApp 组件
- [x] 复古掌机风格文本文件管理器 (`src/renderer/components/FastTXTApp.vue`)
- [x] 三列网格文件列表 (水平卡片布局: 图标 + 文件名)
- [x] 搜索框 (浮动右上角，像素字体输入框)
- [x] 底部按钮栏: +新建 / 🗑️回收站 / 📁文件夹 / ⚙粉碎机 (条件显示)
- [x] CRT 扫描线 + 装饰螺丝

#### 4.2 文件操作
- [x] 新建菜单弹窗: .txt文件 / .md文件 / 文件夹
- [x] 拖放导入 (.txt/.md 文件从外部拖入)
- [x] 文件拖拽排序 + 拖到垃圾桶删除
- [x] 回收站系统 (软删除 → 列表显示已删除文件)
- [x] 粉碎机系统 (物理删除回收站中所有文件)
- [x] 恢复文件 (回收站中点击恢复)

#### 4.3 编辑器
- [x] 全屏文本编辑器 (行号显示 + 行高亮)
- [x] 自动保存 (编辑后返回自动保存到 localStorage)
- [x] Esc 退出编辑器 (stopImmediatePropagation 阻止父组件捕获)

#### 4.4 键盘导航 (模仿主页面)
- [x] `selectedRow` + `selectedCol` 焦点管理 (与主页面一致)
  - `selectedRow=0`: 文件区域, selectedCol=文件索引
  - `selectedRow=1`: 按钮区域, selectedCol=按钮索引
- [x] WASD → ArrowKey 统一映射 + switch 处理
- [x] W/↑: 切换到文件行
- [x] S/↓: 切换到按钮行
- [x] A/←: 左移 (文件/按钮)
- [x] D/→: 右移 (文件/按钮)
- [x] Enter/空格: 执行 (打开文件/点击按钮)
- [x] Delete/Backspace: 删除文件
- [x] Esc: 退出回收站模式 / 退出子程序
- [x] selectedCol 自动钳位 (displayFiles 变化时越界保护)

#### 4.5 数据持久化
- [x] localStorage 持久化 (文件列表、排序)
- [x] 默认文件 (readme.txt, notes.md, draft.txt)

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
| `Esc` | Escape | 关闭弹窗 / 子程序返回母程序 |

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

## 🏗️ 插件系统架构 (2026-08-21)

### 文件结构
```
src/
├── main/
│   ├── index.js              # 主进程入口 (含窗口缩放动画)
│   ├── database.js           # 数据存储管理器
│   ├── plugin-manager.js     # 插件管理器 (核心)
│   └── plugin-preload.js     # 插件窗口预加载脚本
├── renderer/
│   ├── components/
│   │   ├── CalculatorApp.vue # 计算器子程序 (Phase 4)
│   │   ├── FastTXTApp.vue    # 文本文件管理器 (Phase 4)
│   │   ├── LoadingMask.vue   # 加载蒙版
│   │   ├── Modal.vue         # 弹窗组件
│   │   └── TestApp.vue       # 测试子程序
│   ├── stores/
│   │   └── plugin.js         # 插件状态管理
│   └── services/
│       └── plugin-service.js # 渲染进程插件服务
└── shared/
    ├── plugin-loader.js      # 插件加载器
    ├── plugin-bridge.js      # 插件通信桥接
    └── plugin-sdk.js         # 插件开发 SDK
```

### 核心组件说明

#### 1. 插件管理器 (PluginManager)
- **职责**: 管理插件生命周期，创建 BrowserWindow 沙箱
- **状态**: UNLOADED → LOADED → RUNNING → SUSPENDED
- **特性**: 
  - 独立进程隔离，插件崩溃不影响主程序
  - 插件间消息路由
  - 权限控制系统

#### 2. 数据库管理器 (Database)
- **存储**: JSON 文件，按插件隔离
- **特性**:
  - 原子写入（临时文件+重命名）
  - 内存缓存 + 延迟写入
  - 进程退出时自动保存

#### 3. 插件预加载脚本 (Plugin Preload)
- **暴露 API**: `window.hundun`
  - `storage`: 数据存储
  - `messaging`: 插件通信
  - `window`: 窗口控制
  - `permissions`: 权限检查

#### 4. 插件开发 SDK
- **使用方式**: `<script src="path/to/plugin-sdk.js">`
- **自动初始化**: 页面加载完成后自动调用 `init()`
- **API**: storage, messaging, window, ui, utils

### 插件 Manifest 规范
```json
{
  "id": "plugin-id",
  "name": "插件名称",
  "version": "1.0.0",
  "description": "插件描述",
  "icon": "📦",
  "entry": "index.html",
  "permissions": ["storage", "messaging"],
  "windowSize": { "width": 400, "height": 400 }
}
```

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

#### 3.1 插件系统架构 (2026-08-21)
- [x] 设计插件系统技术选型
  - 插件沙箱: Electron BrowserWindow (独立进程隔离)
  - 通信机制: Electron IPC (双向通信)
  - 数据持久化: JSON 文件存储 (避免 SQLite 原生模块编译问题)

#### 3.2 核心组件实现
- [x] 数据库管理器 (`src/main/database.js`)
  - JSON 文件存储，原子写入
  - 内存缓存 + 延迟写入
  - 插件数据隔离存储
  
- [x] 插件管理器 (`src/main/plugin-manager.js`)
  - 插件生命周期管理 (加载、启动、暂停、恢复、卸载)
  - BrowserWindow 沙箱创建和管理
  - 插件间通信路由
  - 权限控制系统
  
- [x] 插件预加载脚本 (`src/main/plugin-preload.js`)
  - 为插件窗口提供安全的 API 接口
  - 存储、通信、窗口控制、权限检查

#### 3.3 通信和桥接
- [x] 主进程 IPC 处理器 (`src/main/index.js`)
  - 注册插件管理器所有 IPC 通道
  - 插件生命周期事件处理
  
- [x] 渲染进程插件服务 (`src/renderer/services/plugin-service.js`)
  - Vue3 组合式 API 封装
  - 插件状态管理和事件监听
  
- [x] 插件通信桥接 (`src/shared/plugin-bridge.js`)
  - 跨进程通信封装

#### 3.4 插件开发 SDK
- [x] 插件开发 SDK (`src/shared/plugin-sdk.js`)
  - 存储 API
  - 消息通信 API
  - 窗口控制 API
  - UI 工具 (通知、对话框)
  - 工具方法

#### 3.5 状态管理
- [x] 更新 Plugin Store (`src/renderer/stores/plugin.js`)
  - 支持动态插件加载
  - 插件状态同步
  - 本地存储持久化

### Phase 4: 功能插件 (优先级: 中)

- [x] 计算器子程序 (复古掌机风格，四则运算，键盘支持)
- [x] FastTXT 文本文件管理器 (文件管理、编辑器、回收站、键盘导航)
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

### 已决策 (2026-08-21)
6. **插件沙箱方案**: Electron BrowserWindow (独立进程隔离，完整 Node.js 能力)
7. **插件通信机制**: Electron IPC (官方推荐，性能好，双向通信)
8. **数据持久化**: JSON 文件存储 (避免 SQLite 原生模块编译问题，原子写入)

### 已决策 (2026-08-25)
9. **子程序集成方式**: Vue 动态组件 + KeepAlive (按插件 id 分发，缓存状态)
10. **窗口缩放基准**: 中心点缩放 (四边对称，非左上角)
11. **子程序键盘管理**: 父组件只处理 Esc，其余按键放行给子组件
12. **子程序状态保留**: KeepAlive 缓存 + onActivated/onDeactivated 生命周期管理

### 待定
1. 插件市场实现方案
2. 插件签名和安全验证

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
- ✅ 窗口缩放基准改为中心 (原: 左上角固定)
- ✅ 动画 setTimeout 漂移 (改为时间戳驱动)
- ✅ 子程序状态未保留 (KeepAlive 缓存)

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
3. ✅ 完成插件系统架构设计和核心组件实现

### 下一步 (Phase 4 继续)
1. 实现定时任务管理器子程序
2. 实现命令执行器子程序
3. 完善插件错误处理和恢复机制
4. 增加更多功能子程序 (记事本、剪贴板管理等)

---

**项目状态**: 🟢 Phase 4 进行中 - FastTXT 文本管理器完成，继续开发其他功能子程序
