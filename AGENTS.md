# Hundun Lite - 项目进度文档

> 最后更新: 2026-09-09
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
│   │   ├── Modal.vue         # 弹窗组件
│   │   └── Settings.vue      # 设置页面 (声音/主题/语言/插件/关于)
│   ├── i18n/
│   │   ├── index.js          # i18n 核心模块 (翻译函数、语言检测)
│   │   ├── zh.js             # 中文翻译
│   │   └── en.js             # 英文翻译
│   ├── stores/
│   │   ├── i18n.js           # 语言状态管理 (Pinia store)
│   │   ├── plugin.js         # 插件状态管理 (scanAllPlugins IPC)
│   │   └── theme.js          # 主题状态管理 (dark/light)
│   └── utils/
│       └── audio.js          # 音效管理器 (masterVolume 全局音量控制)
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
│   │   ├── base.css          # 全局样式 (普通字体)
│   │   ├── header.css        # 头部 (标题用像素字体)
│   │   ├── footer.css        # 页脚 (普通字体)
│   │   ├── editor.css        # 编辑器 (普通字体)
│   │   ├── drop-zones.css    # 垃圾桶/碎纸机/清空按钮区域
│   │   └── ...               # 其他样式 (普通字体)
│   └── js/                   # 脚本文件夹 (17个)
│       ├── i18n.js           # 多语言核心模块
│       ├── i18n-html.js      # 静态 HTML 翻译应用
│       └── ...
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
- **plugin:setAlwaysOnTop** — 设置插件窗口置顶
- **window-pin** — 母程序窗口置顶
- **plugin:getTheme** — 主题查询 (路由到 themeRequestSender)
- **plugin:playSound** — 音效播放 (转发到主窗口)
- **scanAll** — 扫描所有可用插件

#### 2. 插件管理器 (plugin-manager.js v2.0)
- **职责**: BrowserWindow 创建、生命周期管理
- **startPlugin()**: 创建窗口 + 加载 entry + 显示 loading mask
- **launchPluginWithTransition()**: 关闭当前插件 → loading mask → 启动新插件
- **getAllScannedPlugins()**: 扫描 plugins/ 目录获取全部插件信息
- **setAlwaysOnTop()**: 设置插件窗口置顶状态

#### 3. 插件预加载脚本 (plugin-preload.js v2.0)
- **兼容性**: 直接挂载 `window.hundun = {...}` (兼容 `contextIsolation: false`)
- **不再使用**: `contextBridge.exposeInMainWorld` (已移除)
- **API**: storage / messaging / window / host / permissions / utils
- **window.setAlwaysOnTop()**: 设置窗口置顶

#### 4. 主窗口预加载脚本 (preload.js)
- **音效路由**: `ipcRenderer.on('play-sound')` → 触发音频播放
- **主题监听**: `ipcRenderer.on('theme:toggle')` 同步主题
- **窗口置顶**: `windowPin()` API 暴露给渲染进程

#### 5. 插件开发 SDK (plugin-sdk.js)
- **host API**: returnToParent / getTheme / onThemeChange / playSound / notify
- **window API**: minimize / maximize / close / setAlwaysOnTop / setTitle / getSize / onResize
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
1. **固定窗口尺寸**: 800×540，母程序不可调整
2. **无边框窗口**: 自定义标题栏
3. **插件架构**: 动态加载，manifest.json规范
4. **音效系统**: 预加载 + 按需播放 + masterVolume 全局音量控制
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

### 已决策 (2026-09-08)
14. **多语言方案**: 轻量级 i18n 模块 (无第三方依赖)，Pinia store 响应式管理
15. **翻译文件结构**: `src/renderer/i18n/{lang}.js`，支持嵌套键和参数替换
16. **语言持久化**: localStorage 存储，自动检测浏览器语言作为默认值
17. **FastTXT 字体策略**: 仅标题保留像素字体 (Press Start 2P)，内容使用普通字体 (Noto Sans SC / Microsoft YaHei)
18. **FastTXT i18n**: 独立多语言模块，支持中英文切换，68 个翻译字符串
19. **音效开关实现**: 通过全局音量控制 (masterVolume)，关闭时设为0，开启时恢复原值
20. **设置页面键盘导航**: 左箭头键直接返回左侧栏，切换标签页时重置 detailIndex

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
- ✅ 设置页面键盘导航 detailIndex 未重置
- ✅ 设置页面左箭头需按两次才能返回左侧栏
- ✅ 关闭音效后仍有声音播放
- ✅ 子程序状态未保留 (KeepAlive 缓存)

### 待修复
- [ ] Electron中音效可能无法播放 (自动播放策略)
- [ ] 大量卡带时性能优化

---

## 🎯 下一步行动

### 下一步
1. 开发定时任务管理器/命令执行器等新插件
2. 修复生产构建 (externalizeDepsPlugin 本地模块)
3. 清理旧 Vue 组件文件 (CalculatorApp.vue, FastTXTApp.vue, TestApp.vue)

---

**项目状态**: 🟢 Phase 4 进行中 - BrowserWindow 插件架构完成，Calculator/FastTXT 已迁移为独立 HTML 插件，设置页面已开发
