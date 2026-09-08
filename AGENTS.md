# Hundun Lite - 项目进度文档

> 最后更新: 2026-09-07
> 当前阶段: Phase 4 - BrowserWindow 插件架构完成，Calculator/FastTXT 已迁移为独立 HTML 插件

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

## 🏗️ 插件系统架构 (2026-08-28 更新)

### 文件结构
```
src/
├── main/
│   ├── index.js              # 主进程入口 (IPC handlers + 窗口管理)
│   ├── database.js           # 数据存储管理器
│   ├── plugin-manager.js     # 插件管理器 (BrowserWindow 创建)
│   ├── plugin-preload.js     # 插件窗口预加载脚本 (window.hundun)
│   ├── preload.js            # 主窗口预加载脚本 (onPlaySound)
│   └── transition.html       # 跨窗口加载蒙版
├── renderer/
│   ├── App.vue               # 主界面 (IPC 启动插件，无硬编码 Vue 组件)
│   ├── components/
│   │   ├── CalculatorApp.vue # 原 Vue 组件 (已弃用，迁移到 plugins/calculator/)
│   │   ├── FastTXTApp.vue    # 原 Vue 组件 (已弃用，迁移到 plugins/fast-txt/)
│   │   ├── LoadingMask.vue   # 加载蒙版组件
│   │   └── Modal.vue         # 弹窗组件
│   └── stores/
│       └── plugin.js         # 插件状态管理 (scanAllPlugins IPC)
├── shared/
│   ├── plugin-loader.js      # 插件加载器 (扫描 plugins/ 目录)
│   └── plugin-sdk.js         # 插件开发 SDK (host API)
plugins/                       # 插件目录 (每个插件一个子目录)
├── calculator/                # 计算器插件 (独立 HTML)
│   ├── manifest.json
│   └── index.html
├── fast-txt/                  # 文本管理器插件 (多文件架构)
│   ├── manifest.json
│   ├── main.html             # 入口页面
│   ├── css/                  # 样式文件夹 (11个)
│   └── js/                   # 脚本文件夹 (15个)
├── command-executor/          # 命令执行器 (占位)
└── timer-manager/             # 定时任务管理器 (占位)
```

### 架构总览 (2026-08-28)
```
┌──────────────────────────────────────────────┐
│  主进程 (index.js)                             │
│  ├── IPC: plugin-manager:launch              │
│  ├── IPC: plugin-manager:returnToParent      │
│  ├── IPC: plugin:getTheme / themeRequestSender│
│  ├── IPC: plugin:playSound                   │
│  └── 渲染窗口 → App.vue (Vue3)               │
├──────────────────────────────────────────────┤
│  插件管理器 (plugin-manager.js)                │
│  ├── loadPlugin() — 扫描 plugins/<id>/       │
│  ├── startPlugin() — 创建 BrowserWindow      │
│  └── 每个插件: 独立进程 + plugin-preload.js   │
├──────────────────────────────────────────────┤
│  插件窗口 (独立 BrowserWindow)                │
│  ├── plugin-preload.js → window.hundun.*     │
│  ├── main.html (纯 HTML/CSS/JS)              │
│  └── PluginSDK (window.hundun.host/storage)  │
└──────────────────────────────────────────────┘
```

### 核心组件说明

#### 1. 主进程 IPC (index.js)
- **plugin-manager:launch** — 启动插件，返回 `{success, windowId}`
- **plugin-manager:returnToParent** — 插件关闭，触发 loading mask 过渡
- **plugin:minimize/maximize/close** — 窗口控制
- **plugin:getTheme** — 主题查询 (路由到 themeRequestSender)
- **plugin:playSound** — 音效播放 (转发到主窗口)
- **scanAll** — 扫描所有可用插件

#### 2. 插件管理器 (plugin-manager.js v2.0)
- **职责**: BrowserWindow 创建、生命周期管理
- **startPlugin()**: 创建窗口 + 加载 entry + 显示 loading mask
- **launchPluginWithTransition()**: 关闭当前插件 → loading mask → 启动新插件
- **getAllScannedPlugins()**: 扫描 plugins/ 目录获取全部插件信息

#### 3. 插件预加载脚本 (plugin-preload.js v2.0)
- **兼容性**: 直接挂载 `window.hundun = {...}` (兼容 `contextIsolation: false`)
- **不再使用**: `contextBridge.exposeInMainWorld` (已移除)
- **API**: storage / messaging / window / host / permissions / utils

#### 4. 主窗口预加载脚本 (preload.js)
- **音效路由**: `ipcRenderer.on('play-sound')` → 触发音频播放
- **主题监听**: `ipcRenderer.on('theme:toggle')` 同步主题

#### 5. 插件开发 SDK (plugin-sdk.js)
- **host API**: returnToParent / getTheme / onThemeChange / playSound / notify
- **storage API**: get / set / remove / clear
- **使用方式**: `<script src="path/to/plugin-sdk.js">`

### 插件 Manifest 规范
```json
{
  "id": "calculator",
  "name": "计算器",
  "version": "1.0.0",
  "description": "复古掌机风格计算器",
  "icon": "🔢",
  "color": "#00ff88",
  "entry": "index.html",
  "permissions": ["storage"],
  "windowSize": { "width": 400, "height": 500 }
}
```

### 插件生命周期
```
UNLOADED → LOADED → RUNNING → SUSPENDED → CLOSED
                  ↑                    │
                  └────────────────────┘
```

---

## 🚧 待完成任务

### Phase 2: Electron集成 (优先级: 高) ✅ 已完成

- [x] 安装项目依赖 (`npm install`)
- [x] 配置 electron-vite
- [x] 实现真正的窗口无边框
- [x] 将HTML原型拆分为Vue3组件
- [x] 实现键盘导航系统 (WASD/方向键)
- [x] 实现拖拽系统 (卡带拖入插槽)
- [x] 测试深色/浅色模式在Electron中的效果

### Phase 3: 插件系统 (优先级: 高) ✅ 已完成

#### 3.1 插件系统架构 (2026-08-21)
- [x] 设计插件系统技术选型
  - 插件沙箱: Electron BrowserWindow (独立进程隔离)
  - 通信机制: Electron IPC (双向通信)
  - 数据持久化: JSON 文件存储

#### 3.2 核心组件实现
- [x] 数据库管理器 (`src/main/database.js`)
- [x] 插件管理器 (`src/main/plugin-manager.js`)
- [x] 插件预加载脚本 (`src/main/plugin-preload.js`)

#### 3.3 通信和桥接
- [x] 主进程 IPC 处理器 (`src/main/index.js`)
- [x] 插件开发 SDK (`src/shared/plugin-sdk.js`)

#### 3.4 状态管理
- [x] 更新 Plugin Store (`src/renderer/stores/plugin.js`)

### Phase 4: 功能插件 (优先级: 中)

#### 4.1 插件架构迁移 (2026-08-28) ✅ 已完成
- [x] 重构为 BrowserWindow 独立进程架构
- [x] plugin-preload.js 兼容 contextIsolation: false
- [x] App.vue 改用 IPC 启动插件 (移除硬编码 Vue 组件)
- [x] themeRequestSender 路由修复 (theme:get → 正确窗口)
- [x] playSound 路由 (plugin → 主进程 → 主窗口)
- [x] transition.html 跨窗口加载蒙版

#### 4.2 Calculator 计算器插件 ✅ 已迁移
- [x] 1:1 移植 CalculatorApp.vue → plugins/calculator/index.html
- [x] manifest.json 配置
- [x] BrowserWindow 独立运行验证

#### 4.3 FastTXT 文本管理器插件 ✅ 已迁移
- [x] 1:1 移植 FastTXTApp.vue → plugins/fast-txt/index.html
- [x] 布局修复 (#view-main, #view-editor 填充 flex 容器)
- [x] BrowserWindow 独立运行验证
- [x] 文件存储改造: localStorage → 真实磁盘文件
- [x] 数据目录: `plugins/fast-txt/file/` (随安装位置动态变化，不硬编码)
- [x] 隐藏文件: `.order.json` (排序), `.trash/` (回收站)
- [x] 文件夹图标: 📁文件夹 / 📝.md / 📄.txt
- [x] 文件夹模式: 点击文件夹进入内部视图，面包屑导航 + 返回按钮
- [x] 文件夹模式与垃圾桶模式互斥切换
- [x] 文件夹内创建/导入/删除文件使用完整子路径
- [x] 磁盘操作: loadFilesFromDisk 递归读取文件夹内容，parentPath 记录归属
- [x] 存储文档: `plugins/fast-txt/STORAGE.md`
- [x] UI: 去除 hover 效果，点击选中再点击打开交互

#### 4.3.1 FastTXT 优化 (2026-09-02)
- [x] 搜索框聚焦时文件列表取消高亮 (isSearchFocused 条件判断)
- [x] 拖拽排序后强制重建DOM，修复排序后显示错位
- [x] 行号与编辑器行高对齐 (line-height 统一为 23.4px 绝对值)
- [x] Ctrl+滚轮缩放字体 (范围 8px~32px，行号行高同步)
- [x] 编辑器 X轴 overflow:hidden / Y轴 overflow:auto
- [x] 行号跟随textarea滚动同步 (scroll事件监听)
- [x] 文件夹按钮改为打开系统文件资源管理器 (openFolder)
- [x] 新建文件/文件夹重名检测 (自动拼接 "1" 后缀)
- [x] 编辑器标题显示实际文件名 + 文件类型图标

#### 4.3.2 FastTXT 优化 (2026-09-03)
- [x] 文件重命名 UI — M 键 + 卡片选中时显示 ✎ 按钮
- [x] 重命名交互：像素风 input 覆盖文件名 / Enter 确认 / Esc 取消 / Tab 下一个
- [x] 重名检测 + 空名保护 + 文件夹暂不支持重命名
- [x] 编辑器默认字号 13px → 16px
- [x] 数据持久化修复 — beforeunload 同步保存 (fasttxt:writeFileSync IPC)
- [x] openFile 始终从磁盘读取最新内容 + 立即写入 textarea (修复异步时序导致空内容覆盖)

#### 4.3.3 FastTXT 优化 (2026-09-06)
- [x] 拖入文件导入后自动删除原始文件 (通过 Electron file.path + Node.js fs.unlinkSync)
- [x] 插件音效修复 — 插件直接用绝对路径 `new Audio('file:///...')` 播放音效，不依赖主窗口 IPC 转发

#### 4.3.4 FastTXT Bug修复 (2026-09-07)
- [x] 修复行号列可被鼠标滚轮单独滚动导致与编辑器错位的bug (wheel事件拦截 + 转发至textarea)

#### 4.3.5 FastTXT 架构拆分 (2026-09-07)
- [x] 将单文件 index.html (3160行) 拆分为多文件架构，便于维护
- [x] 入口改为 main.html，manifest.json entry 同步更新
- [x] CSS 拆分为 11 个文件 (css/ 目录)，按功能模块划分
- [x] JS 拆分为 15 个文件 (js/ 目录)，严格保持原执行顺序
- [x] 保留原 index.html 作为备份（新入口已切换为 main.html）

**拆分后的目录结构：**
```
plugins/fast-txt/
├── main.html            ← 入口 (引用外部 css/js)
├── manifest.json        ← entry: "main.html"
├── css/                 ← 11 个 CSS 文件
│   ├── base.css         变量/深色浅色/基础/扫描线
│   ├── deco-screws.css  装饰螺丝
│   ├── header.css       头部
│   ├── content.css      内容区/搜索框/面包屑
│   ├── file-list.css    文件卡片/空态/重命名
│   ├── drop-zones.css   垃圾桶/粉碎机拖放区
│   ├── footer.css       底部按钮栏
│   ├── editor.css       编辑器/行号
│   ├── overlays.css     模态框/新建菜单/浅色适配
│   ├── find-bar.css     查找替换栏
│   └── status.css       自动保存指示/快捷键提示
├── js/                  ← 15 个 JS 文件 (执行顺序从上到下)
│   ├── sdk.js           playSound + returnToParent
│   ├── app-state.js     DOM引用 + State + Computed
│   ├── filesystem.js    fs API + 磁盘操作
│   ├── render.js        UI 渲染 + 选区钳制
│   ├── file-actions.js  文件点击/重命名/打开/关闭/导入
│   ├── reorder.js       文件拖拽排序
│   ├── modes.js         回收站/文件夹/粉碎机
│   ├── create.js        新建菜单
│   ├── find-replace.js  查找与替换
│   ├── autosave.js      自动保存
│   ├── modal.js         模态框
│   ├── keyboard.js      键盘导航
│   ├── events.js        事件绑定 + 字号缩放
│   ├── theme-sync.js    主题 + 同步保存
│   └── init.js          初始化入口
├── file/                ← 用户数据目录
├── .trash/              ← 回收站
└── STORAGE.md
```

**拆分校验结果：**
- 11 个 CSS 按序拼接 == 原 style 内容 ✅
- 15 个 JS 按序拼接 == 原 script 内容 ✅
- 全部 JS 语法检查通过 ✅

#### 4.3.6 FastTXT 可靠性修复 (2026-09-07)
- [x] 回收站改用**清单方案**: `.trash/.trash.json` 记录每个删除项的原路径/原名/类型
- [x] 删除文件保留**文件夹归属**: 恢复时移回原位置 (不再一律回根目录)
- [x] 回收站磁盘名**唯一化**: 同名文件再删除自动追加序号 (xxx → xxx1 → xxx2)
- [x] 文件夹删除语义: 空文件夹直接删; 非空弹警告 → 确认后整体级联入回收站, 恢复时整体还原子内容
- [x] 删除操作改为完整 await + 删除后重新读盘 (修复内存与磁盘脱节)
- [x] 新建重名检测改为**循环检测** (getUniqueName 遇 xxx1 已存在继续 xxx2...)
- [x] 行号渲染优化: **增量增删** DOM 节点, 打字不重建; 行高变化(缩放)才全量更新
- [x] 状态栏字数统计**防抖** (200ms), 避免大文件每次击键全量 split
- [x] openFolder fallback 兼容 main.html 入口
- [x] 修复逻辑通过内存文件系统冒烟测试 (删除/恢复/重名/级联/粉碎 全流程)
- [x] 存储文档更新: STORAGE.md 记录 .trash/.trash.json 结构与旧数据兼容说明

#### 4.3.7 FastTXT 删除/恢复逻辑简化 (2026-09-07)
- [x] 回收站改为**平铺方案**: 删除文件一律移入 `.trash/`, 不再保留原文件夹归属/路径
- [x] 删除文件夹 → 不再整目录入回收站: 遍历内部所有文件(含子目录, 递归)逐个平铺入 `.trash/`, 搬空后删除文件夹树; 空文件夹直接物理删除
- [x] 恢复 → 一律回到 `file/` 根目录 (不再还原到原文件夹)
- [x] 防重名规则统一: `file → file1 → file11 → file111...` (删入回收站 & 恢复到根目录均适用, 绝不覆盖现有文件)
- [x] 级联删除文件夹前二次核对无残留文件, 避免确认期间新文件被误删
- [x] 磁盘改名类操作串行队列 runFsOp (快速连按 Delete 也不并发改名)
- [x] 公共收尾 finalizeFsChange (读盘→保存排序→音效→刷新) 统一删除/恢复/粉碎
- [x] 移除回收站清单 `.trash.json` 全部读写逻辑 (旧清单文件保留但自动忽略; 旧文件夹型回收项兼容: 仍可整体恢复到根目录)

#### 4.3.8 FastTXT 书签/断点功能 (2026-09-08)
- [x] 行号点击添加/移除书签 (浅红色圆球标记, 模仿编译器断点)
- [x] 书签持久化存储 (`.bookmarks.json`, 按文件路径分组)
- [x] 打开文件时自动跳转到第一个书签位置
- [x] 打开文件时强制重建行号DOM + 清除缓存行高, 确保书签状态正确渲染
- [x] 修复: `BOOKMARKS_FILE` 常量缺失导致保存/加载静默失败
- [x] 修复: `focus()` 滚动到光标末尾覆盖书签跳转, 改为 focus 后再 scrollTop

#### 4.4 插件开发规范
- [x] PLUGIN_SPEC.md v2.0 (781行完整规范)
- [x] Architecture / 生命周期 / 通信 / Manifest / SDK 文档

#### 4.5 待开发插件
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
- [ ] 修复生产构建 (externalizeDepsPlugin 本地模块问题)

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
8. **数据持久化**: JSON 文件存储 (避免 SQLite 原生模块编译问题)

### 已决策 (2026-08-28)
9. **插件架构升级**: 从 Vue 动态组件 → BrowserWindow 独立进程 (每个插件独立窗口)
10. **插件加载方式**: 纯 HTML/CSS/JS (不依赖 Vue 编译)，支持 HTML-only 开发者
11. **preload 兼容性**: 直接挂载 `window.hundun` (兼容 `contextIsolation: false`)
12. **主题路由**: themeRequestSender 跟踪机制，theme:get 响应路由到正确窗口
13. **音效路由**: 插件 → plugin:playSound IPC → 主进程 → play-sound 事件 → 主窗口播放

### 待定
1. 插件市场实现方案
2. 插件签名和安全验证
3. 生产构建修复 (externalizeDepsPlugin 本地模块问题)

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

### 已完成
1. ✅ Electron基础配置
2. ✅ Vue3组件化架构
3. ✅ 插件系统架构设计和核心组件实现
4. ✅ BrowserWindow 插件架构迁移
5. ✅ Calculator/FastTXT 1:1 移植为独立 HTML 插件

### 下一步
1. 开发定时任务管理器/命令执行器等新插件
2. 修复生产构建 (externalizeDepsPlugin 本地模块)
3. 清理旧 Vue 组件文件 (CalculatorApp.vue, FastTXTApp.vue, TestApp.vue)

---

**项目状态**: 🟢 Phase 4 进行中 - BrowserWindow 插件架构完成，Calculator/FastTXT 已迁移为独立 HTML 插件
