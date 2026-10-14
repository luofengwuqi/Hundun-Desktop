# Hundun Lite - 项目进度文档

> 最后更新: 2026-10-14
> 当前阶段: Phase 4 - BrowserWindow 插件架构完成，生产构建已修复；新增 ADD 按钮本地安装插件 (.zip)；FastTXT 新增 Markdown 实时渲染浏览模式 (markdown-it, Typora 式, 单换行直接渲染为换行)；修复"进入子程序后音效音量异常变大"（插件直放无视音量设置 + 主窗口 preload 因 contextBridge 长期失效一并修复）；修复"子程序启动时母程序意外出现"（母子窗口可见性互斥不变式）；修复 FastCmd 脚本从未真实执行（相对路径 + 假成功 toast），改为绝对路径 + start /wait 可见控制台 + 退出码回报；FastCmd 移植底部刷新按钮；旧数据目录 plugins/fast-cmd/file/ 迁移至 user-data；修复中文 .ps1 执行报"意外的标记"（UTF-8 无 BOM 被 PowerShell 5.1 按 GBK 读取 → ensurePs1Bom 就地补 BOM）；**FastCmd 交互简化：点击脚本即运行（操作弹窗移除，结果走 toast）、移除编辑功能、移除文件夹（脚本仅一级目录）**；**FastCmd 平台感知：打开前按 manifest.platforms 检查系统状态（支持 Windows/Linux），不支持的脚本文件不显示，Linux 新增 .sh 可见终端执行链（决策42）**；**timer-manager 全量重构为 TASK 任务清单（纵向 400×520、状态徽章/排序/提醒弹窗/深浅色/键盘导航，旧进度不保留）；持久化 = hundun.storage JSON，SQLite 审核否决（决策43、44）**

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

## 🏗️ 插件系统架构 (2026-09-23 更新)

### 文件结构
```
src/
├── main/
│   ├── index.js              # 主进程入口 (IPC handlers + 窗口管理)
│   ├── database.js           # 数据存储管理器 (JSON 文件)
│   ├── plugin-manager.js     # 插件管理器 (BrowserWindow 创建)
│   ├── plugin-installer.js   # 本地插件安装器 (.zip 审核 + 解压 + 落盘)
│   ├── plugin-preload.js     # 插件窗口预加载脚本 (window.hundun, 含 hundun.sound)
│   ├── preload.js            # 主窗口预加载脚本 (window.electronAPI 直挂, onPlaySound/syncSoundSettings)
│   ├── sound-settings.js     # 音效设置主进程镜像 (sound:sync / get-sync / settings-changed 广播)
│   ├── platform-support.js   # 平台支持检查 (manifest.platforms 打开前拦截 + 安装器字段校验, 零依赖可单测)
│   ├── paths.js              # 路径解析 (appRoot / 插件目录 / 安装目录)
│   └── transition.html       # 跨窗口加载蒙版
├── renderer/
│   ├── App.vue               # 主界面 (IPC 启动插件，无硬编码 Vue 组件)
│   ├── components/
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
│       ├── audio.js          # 音效管理器 (masterVolume 全局音量控制, 启动时 applySavedVolume())
│       └── sound-settings.js # 音效设置读写 (localStorage key/默认值/校验, 供 audio.js 与 Settings.vue 共用)
├ shared/
│   ├── plugin-loader.js      # 插件加载器 (扫描 plugins/ 目录)
│   └── plugin-sdk.js         # 插件开发 SDK (host API)
plugins/                       # 插件目录 (每个插件一个子目录)
├── calculator/                # 计算器插件 (独立 HTML)
│   ├── manifest.json
│   └── index.html
├── fast-txt/                  # 文本管理器插件 (多文件架构)
│   ├── manifest.json          # entry: "main.html", 800×540, permissions: []
│   ├── main.html             # 入口页面 (css/ 12 个 + js/ 18 个按序加载, js/vendor 独立)
│   ├── STORAGE.md            # 存储文档 (数据目录 / 隐藏文件 / 回收站规则 / IPC)
│   ├── assets/               # 备用图标源文件 (refresh.svg, refresh-pixel.svg)
│   ├── css/                  # 样式文件夹 (12个)
│   │   ├── base.css          # 全局样式 (普通字体)
│   │   ├── header.css        # 头部 (标题用像素字体)
│   │   ├── footer.css        # 页脚 (普通字体)
│   │   ├── editor.css        # 编辑器 (普通字体)
│   │   ├── md-preview.css    # Markdown 浏览模式 (预览排版 + 浏览/编辑滑块)
│   │   ├── drop-zones.css    # 垃圾桶/碎纸机/清空按钮区域
│   │   └── ...               # 其他样式 (普通字体)
│   └── js/                   # 脚本文件夹 (18个, 全局脚本无模块)
│       ├── i18n.js           # 多语言核心模块 (zh/en 各 70 条)
│       ├── i18n-html.js      # 静态 HTML 翻译应用
│       ├── md-preview.js     # Markdown 浏览模式 (分块渲染/活动块编辑/模式滑块)
│       ├── vendor/
│       │   └── markdown-it.min.js  # markdown-it 14.1.0 (离线 vendor, 123KB)
│       └── ...
│   # ⚠️ 用户文件不在插件目录 → user-data/plugins/fast-txt/file/
│   #    旧的 plugins/fast-txt/file/ 迁移残留已于 2026-09-29 删除 (详见 STORAGE.md)
├── task/                      # TASK 任务清单 (2026-10-14 由 timer-manager 全量重构, 旧进度不保留)
│   ├── manifest.json          # id: task, name: TASK, entry: main.html, 400×520 (纵向矩形), permissions: [storage, notifications]
│   ├── main.html              # 入口: 共享 header + #view-main/#view-form 视图切换, css 7 个 + js 14 个按序加载
│   ├── css/                   # 7 个样式 (base/header/task-list/footer/form/overlays/toast)
│   └── js/                    # 14 个脚本 (全局脚本无模块, 与 fast-cmd 同构)
│       ├── tasks.js           # 任务模型: hundun.storage 单键 tasks, 状态计算/排序/自动命名 taskN
│       ├── render.js          # 列表/底部按钮渲染 (签名比对避免动画重放, 搬 DOM 前捕获 scrollTop)
│       ├── form.js            # 创建/编辑表单 + 切换完成/删除/清理操作流
│       ├── reminders.js       # 1s tick: 截止翻转重绘 + 提醒触发 (可见→应用内弹窗, 隐藏→Notification)
│       └── ...
│   # 数据 → hundun.storage key 'tasks' → userData/huntun-lite-data/task.json (决策43; SQLite 已否决)
├── fast-cmd/                 # 脚本管理器 (单级目录, 点击脚本即运行, 无编辑功能; 平台感知, 见决策42)
│   ├── manifest.json        # entry: "main.html", 800×540, permissions: [], platforms: ["win32","linux"]
│   ├── main.html            # 入口 (js/ 按序加载, platform.js 先于 app-state)
│   ├── css/                 # 9 个样式 (含 footer.css 刷新按钮 SVG 样式)
│   └── js/                  # 18 个脚本
│       ├── platform.js      # 平台感知 (win32=.bat .cmd .ps1 / linux=.sh / 其余不支持;
│       │                    #   过滤·新建菜单·图标·执行分发全走它, FASTCMD_PLATFORM 可覆盖)
│       ├── executor.js      # 脚本执行器 (win32: resolveScriptAbsPath 绝对路径 /
│       │                    #   wrapper+start /wait 可见控制台 + 退出码文件;
│       │                    #   linux: sh wrapper + 终端模拟器可见执行, 无终端回退后台直跑)
│       └── ...
│   # ⚠️ 用户脚本不在插件目录 → user-data/plugins/fast-cmd/file/
│   #    旧的 plugins/fast-cmd/file/ 已于 2026-10-04 迁移删除 (详见 CHANGELOG)
```

### 构建管线 (2026-09-23 修复)
```
electron-vite build
  ├── main:    src/main/index.js → out/main/index.js (rollup 打包)
  ├── preload: src/main/preload.js → out/preload/preload.js
  └── renderer: src/renderer/ → out/renderer/
         ↓
  copyMainModules() Vite 插件 (closeBundle 钩子)
  ├── plugin-manager.js  → out/main/plugin-manager.js
  ├── database.js        → out/main/database.js
  ├── plugin-preload.js  → out/main/plugin-preload.js
  ├── plugin-installer.js→ out/main/plugin-installer.js
  ├── paths.js           → out/main/paths.js
  ├── platform-support.js→ out/main/platform-support.js
  ├── sound-settings.js  → out/main/sound-settings.js
  └── plugin-loader.js   → out/main/plugin-loader.js
```

> **为什么需要 copyMainModules?**
> `externalizeDepsPlugin` 将 `node_modules` 依赖外部化, 但 rollup 也不打包 `plugin-manager.js` 等本地模块
> (因为 `plugin-manager.js` 内含动态 `require` 路径, rollup 无法静态分析)。
> 因此这些文件需要从 `src/` 复制到 `out/main/`, 由 `index.js` 在运行时 `require`。

### 开发/打包模式路径差异
```
                开发模式 (dev)              打包模式 ( packaged )
─────────────────────────────────────────────────────────────────
appRoot        项目根目录 (../..)          exe 所在目录
userData       项目根/user-data/           exe目录/user-data/
preload        out/main/preload.js         out/preload/preload.js
plugin-loader  src/shared/plugin-loader.js (开发) 或 out/main/plugin-loader.js (打包后)
FastTXT 数据   userData/plugins/fast-txt/  (统一, 不写 asar)
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
- **plugin:playSound** — 音效播放 (转发到主窗口 → App.vue → audio.js)
- **sound:sync / sound:get-sync / sound:get** — 音效设置镜像同步/读取，变更后 `sound:settings-changed` 广播所有窗口
- **scanAll** — 扫描所有可用插件

#### 2. 插件管理器 (plugin-manager.js v2.0)
- **职责**: BrowserWindow 创建、生命周期管理
- **插件目录**: `resolvePluginsDirs()` = 内置插件目录 + 用户安装目录（开发态两者同为 `项目根/plugins`）
- **startPlugin()**: 创建窗口 + 加载 entry + 显示 loading mask
- **launchPluginWithTransition()**: 关闭当前插件 → loading mask → 启动新插件
- **getAllScannedPlugins()**: 扫描 plugins/ 目录获取全部插件信息
- **setAlwaysOnTop()**: 设置插件窗口置顶状态
- **窗口互斥 (2026-10-03)**: `hasVisiblePluginWindow()` / `getVisiblePluginWindows()` 判定可见性；`_hideMainForPlugin()` 先藏母再显子；`_hideAllPluginWindows(except)` 保证单子程序；`_recoverMainWindowIfIdle()` 插件消失后恢复母程序；主窗口 `show` 事件中央拦截

#### 3. 插件预加载脚本 (plugin-preload.js v2.0)
- **兼容性**: 直接挂载 `window.hundun = {...}` (兼容 `contextIsolation: false`)
- **不再使用**: `contextBridge.exposeInMainWorld` (在 contextIsolation:false 下会抛错, 已移除)
- **API**: storage / messaging / window / host / permissions / sound / utils
- **window.setAlwaysOnTop()**: 设置窗口置顶
- **hundun.sound**: `getSettings()` (sendSync 读主进程镜像) / `onSettingsChanged(cb)` — 插件直放音效的音量/静音依据

#### 4. 主窗口预加载脚本 (preload.js)
- **兼容性**: 与 plugin-preload 一致直接挂载 `window.electronAPI = {...}` (2026-10-03 修复: contextBridge 在 contextIsolation:false 下抛错导致整个 preload 静默失效)
- **音效路由**: `onPlaySound(cb)` 把主进程转发的 `play-sound` 交给 App.vue → `audio.js` 单一播放器 (preload 不再自带 Audio)
- **音效设置**: `syncSoundSettings(settings)` → 主进程 `sound:sync` 镜像 (启动/保存时推送)
- **主题监听**: `ipcRenderer.on('theme:toggle')` 同步主题
- **窗口置顶**: `windowPin()` API 暴露给渲染进程

#### 4.1 音效设置主进程镜像 (sound-settings.js)
- **职责**: `sound:sync` 接收 renderer 推送并 normalize → 内存缓存 → `sound:settings-changed` 广播所有窗口; `sound:get-sync` (sendSync 供插件 preload 初始化) / `sound:get` (异步备用)
- **不持久化**: 持久化仍由 renderer localStorage 负责, 主进程只是运行期镜像

#### 5. 插件开发 SDK (plugin-sdk.js)
- **host API**: returnToParent / getTheme / onThemeChange / playSound / notify
- **window API**: minimize / maximize / close / setAlwaysOnTop / setTitle / getSize / onResize
- **storage API**: get / set / remove / clear
- **使用方式**: `<script src="path/to/plugin-sdk.js">`

#### 6. 本地插件安装器 (plugin-installer.js)
- **IPC**: `plugin-install:pick`（打开文件资源管理器选 .zip）→ `plugin-install:install`（审核 + 安装）
- **审核**: manifest 必需字段、id/version 规则、entry 存在性与类型、可选字段类型（见 PLUGIN_SPEC 第三章）
- **解压**: 自研 ZIP 解析（zlib.inflateRawSync），含 CRC32 校验与 zip slip / 解压炸弹防护
- **落盘**: 开发态 `项目根/plugins/<id>`，打包态 `exe目录/plugins/<id>`
- **冲突**: 内置插件 ID 不可覆盖；已安装记录 `userData/installed-plugins.json` 允许覆盖升级
- **安装后**: 渲染进程 `pluginStore.refreshFromDisk()` + `syncShelfWithStore()` 同步各页面
- **社区入口**: `app:openExternal`（仅允许 http/https）→ 系统默认浏览器

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

### 已决策 (2026-09-23)
21. **构建管线修复**: `copyMainModules()` Vite 插件自动复制未被 rollup 打包的主进程模块
22. **数据目录迁移**: FastTXT 数据从插件目录 (asar 内只读) 迁移到 `userData/plugins/` (可写)
23. **开发/打包路径分离**: `app.isPackaged` 判断运行环境，动态选择 `appRoot`/`preload`/`plugin-loader` 路径

### 已决策 (2026-09-25)
24. **音效设置单一数据源**: `src/renderer/utils/sound-settings.js` 统一 localStorage key (`huntun-lite-settings`)、默认值 (`{soundEnabled:true, volume:50}`) 与数值校验；`audio.js` 在模块加载时读取一次并应用，`Settings.vue` 复用同一读写函数
25. **插件音效音量对齐**: 主窗口 preload 转发的 `play-sound` 改为读取同一份音效设置 (替代固定 0.5)，静音开关/自定义音量对插件音效同样生效

### 已决策 (2026-09-27)
26. **本地插件安装**: 主进程自研 ZIP 解析（零第三方依赖，生产包不含 node_modules），审核通过后落盘到可写插件目录；内置插件目录保持只读
27. **插件多目录扫描**: `resolvePluginsDirs()` 返回 [内置, 用户安装] 目录数组，`PluginLoader` 按 id 去重合并，内置优先
28. **安装冲突策略**: 内置插件 ID 拒绝覆盖；经安装器装过的 ID 允许覆盖升级（`userData/installed-plugins.json` 记录）
29. **manifest 编码兼容**: 读取时自动处理 UTF-8 BOM / UTF-16 LE·BE / GBK，避免记事本另存为导致安装失败

### 已决策 (2026-09-28)
30. **弹窗字体**: `Modal.vue` 标题/按钮改用 body 普通字体 (`'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif`)，英文不再使用像素字体；像素字体 Press Start 2P 仅保留给主界面元素 (信息栏/卡带编号/页脚/加载蒙版)
31. **弹窗标题字号**: `Modal.vue` 新增 `titleSize` prop (`normal` 20px / `large` 30px)，`showModal()` 第 6 个参数控制；ADD 菜单使用 `large` 且不再显示标题下方说明小字 (`addApp.msg` 已删除)

### 已决策 (2026-09-30)
32. **FastTXT Markdown 渲染**: 选定 markdown-it (默认 `html:false` 防注入, 插件窗口 nodeIntegration:true 必须转义原始 HTML) 并 vendor 到 `js/vendor/` 离线使用；浏览模式采用 **按 token map 分块 + 活动块内嵌源码 textarea** 的 Typora 式方案 (行区间归一化保证光标任意落点可定位)；`editorContent` 仍为唯一事实源, 浏览/编辑仅是同一内容的两种视图；撤销栈改标准语义 (修差一 bug, 见 CHANGELOG 2026-09-30)

### 已决策 (2026-10-01)
33. **FastTXT Markdown 换行策略**: markdown-it 开启 `breaks: true` (GitHub 风格软换行) — 浏览模式段落内**单个换行直接渲染为 `<br>`**, 不再要求行尾两个空格；仅作用于内联渲染层, 块级 token map 不变, 分块/活动块定位零影响；行尾双空格硬换行与空行分段行为兼容保留

### 已决策 (2026-10-02)
34. **md 浏览模式滚动保持**: `renderMdPreview()` 一律在**移动 DOM 之前**捕获 `scrollTop`（构建 fragment 会把旧块搬出容器，容器搬空时 Chromium 立即把 scrollTop 钳为 0）；并以目标活动块重建前的顶边为锚点做位移补偿，保证点击块的视觉位置零位移；回归测试 `scripts/test-md-scroll.js`

### 已决策 (2026-10-03)
35. **音效设置单一真相 = 主进程镜像**: 持久化仍在 renderer localStorage（`sound-settings.js`），但保存/启动时经 `sound:sync` 推送到主进程 `src/main/sound-settings.js` 做运行期镜像，主进程以 `sound:settings-changed` 广播给所有窗口；插件经 `window.hundun.sound.getSettings()/onSettingsChanged()` 读取（sendSync 初值）。**插件直放音效必须按此设置播放，禁止硬编码音量**
36. **主窗口唯一音效播放器 = audio.js**: preload 不再自带 Audio 播放器；插件经 IPC 转发的音效由 `App.vue` 的 `onPlaySound` 接住后调用 `audio.js.playSound()`（复用 readyState 排队 / 错误恢复）。音效清单仍两份（母程序 `audio.js` / 插件 sdk `_pluginSoundMap`），后续可考虑由主进程统一下发
37. **preload 直接挂载（纠正历史偏差）**: `contextIsolation: false` 时 `contextBridge.exposeInMainWorld` 会抛错导致**整个 preload 静默失效**——主窗口 preload 改为直接 `window.electronAPI = {...}`（与 plugin-preload.js 的 `window.hundun` 一致）；preload 路径由 `resolvePreloadPath()` 候选解析（`out/preload/preload.js` 优先，兼容旧 `out/main/preload.js` 布局）

### 已决策 (2026-10-03, 窗口互斥)
38. **母程序/子程序可见性互斥不变式**: 任意时刻有且仅有一个窗口可见。实现三层防护:
   - **中央防护**: `PluginManager` 构造时给主窗口挂 `show` 监听，有可见插件窗口时立即重新隐藏（覆盖页面重载 `did-finish-load`、`ready-to-show`、`second-instance` 等一切 show 路径）
   - **顺序防护**: 一切"显子"操作前先 `_hideMainForPlugin()`（先藏母再显子）；`launchPluginWithTransition` 先 `_hideAllPluginWindows(新插件)` 再显示新插件；`returnToParent` 隐藏**所有**插件窗口后再 show 母
   - **恢复防护**: 插件窗口 `closed` / `suspendPlugin` → `_recoverMainWindowIfIdle()` 恢复母程序（含置顶状态），保证"不会两个都没了"
   - 主窗口显示入口收敛到 `maybeShowMainWindow(reason)`（index.js），有可见插件则跳过并打日志

### 已决策 (2026-10-04, FastCmd 执行链路)
39. **FastCmd 脚本执行 = 绝对路径 + wrapper + `start /wait`**: ①路径一律经 `resolveScriptAbsPath()` (`hundun.fs.getBasePath()` + 相对路径拼接), 禁止把相对路径交给 `spawn`/`stat`/`openPath`; ②启动链 `cmd /c start "" /wait cmd /c wrapper script exitfile` — `start /wait` 新开可见控制台 (`pause` 可交互、输出可见; 直接 spawn+stdio:ignore 时 pause 不阻塞), wrapper 纯 ASCII 且路径走参数 (规避中文/空格编码), 退出码用**延迟展开** `!errorlevel!` 写文件 (cmd 的 `%errorlevel%>file` 展开为空); ③外层 spawn `spawn`/`error` 事件判定真实启动成败, 退出码读文件 (外层 `start` 不传播), 非 0 弹 toast;    ④~~「编辑」必须走 edit 动词 (PowerShell `Start-Process -Verb Edit`)~~ (编辑功能已于 2026-10-12 整体移除, 见决策 41; `openInSystemEditor` 已删除)

### 已决策 (2026-10-07, FastCmd .ps1 编码守卫)
40. **.ps1 执行前 `ensurePs1Bom()` 就地补 UTF-8 BOM**: Windows PowerShell 5.1 `-File` 对无 BOM 文件按系统 ANSI(GBK) 解码, UTF-8 中文脚本乱码且引号配对被破坏 → 解析错误 ("意外的标记")。规则: 无 BOM + 含非 ASCII + 严格 UTF-8 校验通过 → 就地补 3 字节 BOM (字符不变, 保留 $PSScriptRoot/相对路径语义, 优于临时副本); 纯 ASCII / 已有 BOM / 非 UTF-8 (GBK, PS 按 ANSI 读本就正确) 不动; 写入失败 best effort 不阻断执行

### 已决策 (2026-10-12, FastCmd 交互简化)
41. **FastCmd 三化简**: ①**点击即运行** — 点击脚本卡直接 `runScript()` (结果 toast: 已启动→运行成功/退出码 N/启动失败), 不再"先选中再点击执行"两段式; 回收站条目仍两段式 (再次点击已选中项才恢复); 非脚本扩展名 (外部放入的杂项文件) 有 `isScriptFile` 守卫不执行; 键盘 Enter 同步直接运行; **双击重命名已移除** (会先触发两次点击运行, 重命名入口保留 ✎ 按钮与 M 键); ②**编辑功能移除** — `showScriptActionModal`/`editScript`/`openInSystemEditor`/`getScriptInfo` 删除, 相关 i18n 键清理; ③**单级目录** — CREATE NEW 不再有 Folder 项, `loadFilesFromDisk` 跳过目录 (根目录与回收站均只收文件), 移除 `parentPath`/`isFolderMode`/面包屑导航/文件夹删除链路, 路径一律 `file.name`; 底部 📁 按钮保留 (语义="在文件管理器中打开")

### 已决策 (2026-10-13, FastCmd 平台感知)
42. **FastCmd 打开前系统状态检查 + 按平台过滤脚本**: 两层防护 — ①**主进程打开前拦截**: `manifest.platforms` (如 `["win32","linux"]`, 缺失=不限制) 经 `src/main/platform-support.js checkPlatformSupport()` 在 `startPlugin()` 创建窗口**之前**校验, 不支持则抛友好错误 → `launchPluginWithTransition` 返回 `{success:false}` → 母程序弹提示 (拦截发生在藏母之前, 母程序保持可见); 安装器同步校验字段格式; ②**插件内平台感知** `js/platform.js`: win32 收 .bat .cmd .ps1 / linux 收 .sh / 其余系统不支持 (列表·回收站·拖拽·新建菜单·图标全部经 `isScriptFile`/`FastCmdPlatform` 过滤, **不支持的脚本文件不显示**, 默认脚本与 CREATE NEW 菜单按平台动态生成, 不支持系统显示「当前系统不受支持」空态且无底部按钮); ③**Linux 真实执行 .sh**: `executeScript` 按平台分发 — 每次运行生成独立 POSIX sh wrapper (路径内联 + cd 脚本目录 + 有执行位尊重 shebang), 优先探测 10 种终端模拟器开可见窗口并轮询退出码文件 (对应 Windows 可见控制台), 无终端/终端失败回退后台直跑取子进程退出码; Windows 分支链路不变; 测试经 `FASTCMD_PLATFORM` 环境变量覆盖平台 (Linux 上回归 Windows 链路)

### 已决策 (2026-10-14, TASK 子程序)
43. **TASK 持久化 = hundun.storage JSON, SQLite 审核否决**: ①`package.json build.files` 排除 `node_modules` → better-sqlite3 等原生模块无法随包分发; ②决策8 已明确规避原生模块编译 (electron-rebuild/ABI, build:win --universal 尤甚); ③插件层只有 storage/fs 两条数据通道, 接 SQLite 需新增主进程依赖 + IPC, 违背零第三方依赖原则 (自研 ZIP 解析、零依赖 platform-support 同源); ④个人任务清单 (百行级、单进程写入) 下 JSON 全量写 + tmp/rename 原子落盘 + 100ms 防抖 + 退出 flush 已覆盖 SQLite 收益且可人工查看。实现: 单键 `tasks` = `{version, tasks:[...]}`; localStorage `task-data` 仅作 storage API 不可用时的兜底镜像; **`__PLUGIN_ID__` 注入竞态兜底** — plugin-manager 在 did-finish-load 才注入 (晚于 DOMContentLoaded), init 首行从入口路径 `/plugins/<id>/` 解析同值, 避免 storage 写到 null.json

### 已决策 (2026-10-14, TASK 状态/排序/提醒语义)
44. **TASK 状态为计算值 + 固定排序 + 提醒防重放**: ①状态不落库: `completed ? 已完成 : (deadline != null && now >= deadline ? 已过期 : 未完成)`, 1s tick 按状态签名 (`id:status`) 比对决定是否重绘 (签名不变不重建 DOM, 避免卡片入场动画每秒重放); ②排序: **未完成 (有截止按截止升序, 无截止排未完成末尾, 同组 createdAt 升序) > 已过期 (deadline 降序, 最近过期在前) > 已完成 (completedAt 降序)**; ③提醒: 每任务 `fired[]` 持久化已触发记录防重启重弹; 到点后 ≤2min 窗口内触发 — **窗口可见→应用内弹窗 + bengbeng 音效, 隐藏→HTML5 Notification 系统通知** (多条排队逐个弹); 超窗视为"应用未运行时错过"静默补记; 已完成任务的提醒直接抑制; ④提醒方式字段仅在提醒时间非空时可填 (默认"弹窗提醒", 其他方式待补充)

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
- ✅ 设置页面键盘导航 detailIndex 未重置
- ✅ 设置页面左箭头需按两次才能返回左侧栏
- ✅ 关闭音效后仍有声音播放
- ✅ 子程序状态未保留 (KeepAlive 缓存)
- ✅ 生产构建 `Cannot find module './plugin-manager'` (copyMainModules 插件修复)
- ✅ 刚进入程序时音效满格音量 (audio.js 启动时 applySavedVolume() 读取保存的设置；无存档默认 50%)
- ✅ 插件音效转发路径固定 0.5 音量、忽略静音开关 (preload.js 改读同一份设置)
- ✅ 音效时有时无/刚启动无声 (playSound 改以 readyState 为准 + 多就绪事件监听 + error 恢复，不再死等 canplaythrough)
- ✅ FastTXT md 浏览模式点击/聚焦后视口跳回文档顶部 (`renderMdPreview()` 在搬空容器后才读 scrollTop，读到的已是 0；改为搬移 DOM 前捕获 + 目标块锚点补偿，见 CHANGELOG 2026-10-02)
- ✅ 进入子程序后音效特别大 (插件 sdk 直放硬编码 0.5 无视音量/静音；改为读主进程镜像 `hundun.sound`，见 CHANGELOG 2026-10-03)
- ✅ 主窗口 preload 长期失效 (`contextBridge` 在 contextIsolation:false 下抛错 → electronAPI 一直 undefined；插件 IPC 音效无声、插件磁盘扫描不生效、dev preload 路径错误一并修复，见 CHANGELOG 2026-10-03)
- ✅ 子程序启动时母程序意外出现 / 母子同时运行 (主窗口 show 路径无互斥保护：页面重载 did-finish-load、returnToParent 只藏活动插件、startPlugin 直启不藏母；中央 `show` 监听 + `maybeShowMainWindow` + 先藏母再显子，见 CHANGELOG 2026-10-03 与决策 38)
- ✅ 插件窗口 X 关闭/挂起后整个应用无可见窗口 (closed/suspend → `_recoverMainWindowIfIdle()` 恢复母程序)
- ✅ FastCmd 点运行弹「已启动」但脚本从未执行 (相对路径 spawn cwd 错位 + 异步 error 抓不到假成功；改 `resolveScriptAbsPath` 绝对路径 + `start /wait` 可见控制台 + wrapper 延迟展开写退出码文件，见 CHANGELOG 2026-10-04)
- ✅ FastCmd「编辑」用 `shell.openPath` 对 .bat 是 open 动词 = 执行而非编辑 (改 PowerShell `-Verb Edit`)
- ✅ FastCmd 执行中文 .ps1 报「表达式或语句中包含意外的标记」(UTF-8 无 BOM 被 PowerShell 5.1 按 GBK 读取 → 乱码+引号错位; `ensurePs1Bom` 执行前就地补 BOM, 见 CHANGELOG 2026-10-07 与决策 40)

### 待修复
- [ ] 插件窗口**非手势触发**的音效可能被自动播放策略拦截 (母程序有 `autoplayPolicy: no-user-gesture-required`，插件窗口未配置；插件窗口"直放"路径不受影响，仅 IPC 兜底路径理论上有风险)
- [ ] 大量卡带时性能优化

---

## 🎯 下一步行动

### 下一步
1. ~~完善定时任务管理器~~ ✅ 2026-10-14 已全量重构为 TASK 任务清单 (状态徽章/排序/截止过期/提醒弹窗); 后续: 提醒方式扩展 (现仅"弹窗提醒", 其他方式待补充)、FastCmd 执行类断言待 Windows 复跑
2. 插件社区/插件市场对接（ADD 菜单"逛逛社区"目前跳转 Gitee 仓库，待官网完成后切换）
3. ~~清理旧 Vue 组件文件 (CalculatorApp.vue, FastTXTApp.vue, TestApp.vue)~~ ✅ 2026-09-25 已完成
4. 音效架构后续整改 (可选): 音效文件清单由主进程统一下发（现存母程序 `audio.js` 与插件 sdk 两份）、清理无引用死代码 `src/renderer/services/plugin-service.js`、插件窗口统一配置 `autoplayPolicy`

---

**项目状态**: 🟢 Phase 4 完成 - BrowserWindow 插件架构完成，生产构建已修复
