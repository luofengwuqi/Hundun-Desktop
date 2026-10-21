<div align="center">
  <img src="src/renderer/assets/logo-512.png" width="140" alt="HundunDesktop logo" />
  <h1>HundunDesktop</h1>
  <p><strong>复古掌机风格的桌面效率工具</strong><br />母程序 + 卡带式子程序，一台属于你的桌面掌机</p>

  <p>
    <img alt="Electron" src="https://img.shields.io/badge/Electron-28-47848F?logo=electron&logoColor=white" />
    <img alt="Vue" src="https://img.shields.io/badge/Vue-3-42B883?logo=vuedotjs&logoColor=white" />
    <img alt="Vite" src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white" />
    <img alt="Platform" src="https://img.shields.io/badge/Windows%20%7C%20Linux-1F2937" />
  </p>
</div>

---

## 这是什么

HundunDesktop 是一个以「游戏掌机」为隐喻的桌面效率应用。母程序是一台 800×540 的固定尺寸掌机，每个功能都是一个独立运行的**子程序卡带**：点击卡带、插入插槽，子程序就在自己的窗口中启动。

- **插件化架构**：每个子程序运行在独立 `BrowserWindow` 中，崩溃不会拖垮母程序
- **内置四张卡带**：计算器、文本管理器、任务清单、脚本管理器，开箱即用
- **复古视觉**：像素字体、CRT 扫描线、卡带入仓动画、深色 / 浅色双主题
- **键盘优先**：WASD / 方向键导航，空格 / Enter 确认，Esc 返回
- **镜像模式**：再开一个母窗口，双人并行使用不同子程序
- **本地优先**：数据保存在本机 JSON 文件，无需账户与网络
- **插件安装**：从 `.zip` 安装第三方插件，设置页统一管理排序与卸载

> [!IMPORTANT]
> 母程序窗口固定为 **800×540**，不支持手动缩放。子程序窗口尺寸由各自 `manifest.json` 的 `windowSize` 决定。

## 内置卡带

| 卡带 | 子程序 | 尺寸 | 能做什么 |
| --- | --- | --- | --- |
| 🔢 `calculator` | CALC | 400×540 | 复古掌机风格计算器 |
| 📄 `fast-txt` | FastTXT | 800×540 | 文本文件管理、编辑、Markdown 实时浏览、查找替换 |
| 📋 `task` | TASK | 400×520 | 任务清单、截止时间、状态排序、到点提醒 |
| ⚡ `fast-cmd` | FastCmd | 800×540 | 脚本管理：Windows `.bat` `.cmd` `.ps1` / Linux `.sh`，点击即运行 |

## 快速开始

### 环境要求

- Node.js >= 18（推荐 20 LTS）
- npm >= 9
- Windows 10+ 或主流 Linux 发行版

### 安装与运行

```bash
git clone https://github.com/luofengwuqi/Hundun-Desktop.git
cd Hundun-Desktop
npm install
npm run dev
```

Linux 下也可以直接执行 `./start.sh`：脚本会自动安装依赖，并在 `chrome-sandbox` 未设置 SUID 时追加 `--noSandbox`。

> [!TIP]
> 只想先看看界面？直接用浏览器打开 `hundundesktop-prototype.html`，即可预览完整的交互原型，无需安装任何依赖。

## 使用指南

### 键盘操作

| 按键 | 功能 |
| --- | --- |
| `W` / `↑` | 切换到卡带行 |
| `S` / `↓` | 切换到按钮 / 插槽行 |
| `A` / `D`、`←` / `→` | 在卡带或按钮之间移动 |
| `Space` / `Enter` | 插入卡带 / 执行当前按钮 |
| `Esc` | 关闭弹窗 / 从子程序返回母程序 |

### 窗口按钮

母程序与所有内置子程序的右上角都是三个圆形按钮（从左到右）：

| 按钮 | 功能 |
| --- | --- |
| 📌 | 窗口置顶 / 取消置顶 |
| ▬ | 最小化（短横线，宽度与 ✕ 相当） |
| ✕ | 关闭（子程序为返回母程序） |

子程序最小化后母程序会自动恢复显示；从任务栏恢复子程序时，母程序会再次隐藏（会话内母 / 子窗口互斥）。

### 镜像模式

点击底部工具栏的镜像按钮，可打开第二个母窗口（B）。

- A / B 两个会话可以同屏并行，各自运行不同的子程序
- 同一个子程序同一时间只属于一个会话，重复启动会被拦截
- 镜像窗口只能运行子程序，不能修改设置；关闭 A 后 B 会自动升格为完整母窗口

### 卡片与插件管理

- 点击 `+` 可从本地选择 `.zip` 安装插件，或打开插件社区
- `⚙ 设置 → 插件` 可查看实时运行状态、拖拽排序、移除 / 恢复插件
- 插件数据默认保留；卸载时可选择一并删除

### 关于页

`⚙ 设置 → 关于` 展示应用 logo、版本号、技术栈、系统信息与作者信息。

- 版本号取自主进程 `app.getVersion()`，不再硬编码
- 「检查更新」按钮在最右侧，功能开发中（点击会弹出提示）
- 「关于作者」板块包含头像、签名与 Gitee / GitHub / Bilibili 主页链接（点击用系统浏览器打开）

## 插件系统

一个插件就是 `plugins/` 下的一个目录，最少只需要两个文件：

```text
plugins/my-plugin/
├── manifest.json
└── index.html
```

```json
{
  "id": "my-plugin",
  "name": "MYAPP",
  "version": "1.0.0",
  "description": "我的第一个子程序",
  "icon": "🎮",
  "color": "#00ff88",
  "author": "you",
  "entry": "index.html",
  "windowSize": { "width": 400, "height": 400 },
  "permissions": ["storage"],
  "platforms": ["win32", "linux"]
}
```

插件窗口通过 `window.hundun` 访问宿主能力：

| 命名空间 | 能力 |
| --- | --- |
| `hundun.storage` | 插件专属 JSON 持久化（`get` / `set` / `remove` / `getAll`） |
| `hundun.fs` | 插件数据目录内的文件读写（`readDir` / `readFile` / `writeFile` / `deleteFile` / `rename`） |
| `hundun.host` | 返回母程序、读取主题、播放音效、发送通知 |
| `hundun.window` | 最小化、最大化、关闭、置顶、设置标题 |
| `hundun.sound` | 读取母程序音量 / 静音设置，并订阅变更 |
| `hundun.messaging` | 插件之间收发消息与广播 |

更完整的 manifest 字段、插件 API 用法和目录规范，见 [插件开发指南](docs/PLUGIN_DEVELOPMENT.md) 与 [子程序开发规范](docs/PLUGIN_SPEC.md)。

## 构建与打包

```bash
npm run build        # 构建到 out/
npm run build:win    # Windows NSIS 安装包
npm run build:linux  # Linux AppImage + deb
npm run build:setup  # 一次产出三件套
```

产物位于 `dist/`：

| 平台 | 产物 |
| --- | --- |
| Windows | `HundunDesktop Setup <version>.exe` |
| Linux | `HundunDesktop-<version>.AppImage` |
| Linux | `hundundesktop_<version>_amd64.deb` |

> [!NOTE]
> 在 Linux 上构建 Windows 包需要 `wine64`（electron-builder 使用 rcedit 写入 exe 图标和版本信息）。国内网络建议先设置镜像：
>
> ```bash
> export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
> export ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
> ```

> [!WARNING]
> AppImage 需要系统安装 `libfuse2`（Ubuntu 24.04+ 为 `libfuse2t64`）。构建脚本会自动为 AppImage 注入 `--no-sandbox`，以适配 Ubuntu 24.04+ 的 AppArmor user namespace 限制。

> [!NOTE]
> Linux 图标由 `build/icons/` 图标集目录提供（16/24/32/48/64/128/256/512 各级尺寸），`build.linux.icon` 必须指向**目录**——指向单个 PNG 时 electron-builder 解析不到尺寸，图标会被装进 `hicolor/0x0/`，安装后应用菜单就没有图标。换 logo 后跑 `npm run gen-icons`（需 Pillow）重新生成。

## 项目结构

```text
HundunDesktop/
├── src/
│   ├── main/                 # Electron 主进程
│   │   ├── index.js          # 窗口、IPC、单实例锁
│   │   ├── plugin-manager.js # 插件窗口、会话归属与母子互斥
│   │   ├── mirror-manager.js # 镜像窗口与升格
│   │   ├── plugin-installer.js # .zip 审核、解压、安装与卸载
│   │   ├── plugin-preload.js # window.hundun 插件 API
│   │   └── preload.js        # 主窗口 preload
│   ├── renderer/             # Vue 3 母程序界面
│   │   ├── App.vue           # 卡带货架与插槽
│   │   ├── components/       # 弹窗、设置、加载蒙版
│   │   ├── stores/           # Pinia: 插件、主题、语言
│   │   ├── i18n/             # 中英文案
│   │   └── utils/            # 音效与设置读写
│   └── shared/               # 插件加载器与 PluginSDK
├── plugins/                  # 内置子程序
│   ├── calculator/
│   ├── fast-txt/             # 文本管理器（含 STORAGE.md）
│   ├── task/
│   └── fast-cmd/
├── scripts/                  # 图标生成、AppImage 补丁、回归测试
├── sounds/                   # 9 个 Switch 风格音效
├── docs/                     # 开发文档
├── electron.vite.config.js
└── package.json
```

## 数据与配置

开发模式和便携安装下，数据位于项目 / 可执行文件旁的 `user-data/`；安装到 `Program Files`、`/opt` 或 AppImage 等只读位置时，自动回退到系统用户数据目录。

| 内容 | 位置 |
| --- | --- |
| 插件文件数据 | `user-data/plugins/<plugin-id>/file/` |
| 插件 JSON 存储 | `user-data/hundundesktop-data/<plugin-id>.json` |
| 已安装插件记录 | `user-data/installed-plugins.json` |
| 主题 / 语言 / 音效 / 插件顺序 | 渲染进程 `localStorage`（`hundundesktop-*`） |

> [!NOTE]
> 开发期数据键统一为 `hundundesktop-*`，不提供旧版 `hundun-lite-*` 数据迁移。

## 测试

核心回归测试通过 Electron 运行：

```bash
npx electron --no-sandbox scripts/test-mirror.js
npx electron --no-sandbox scripts/test-window-lifecycle.js
npx electron --no-sandbox scripts/test-plugin-uninstall.js
npx electron --no-sandbox scripts/test-task.js
```

平台检查与路径防护等纯 Node 测试可直接执行：

```bash
node scripts/test-platform-support.js
```

## 文档

- [快速开始](docs/QUICKSTART.md)
- [插件开发指南](docs/PLUGIN_DEVELOPMENT.md)
- [子程序开发规范](docs/PLUGIN_SPEC.md)
- [FastTXT 存储说明](plugins/fast-txt/STORAGE.md)
- [技术决策与项目进度](AGENTS.md)
- [更新日志](CHANGELOG.md)
- [历史开发报告（2026-08）](docs/archive/DEVELOPMENT_REPORT.md)

### opencode skills（给 AI 助手用）

- `.opencode/skill/hundundesktop-plugin-dev/` — 子程序（插件）开发：窗口按钮组规范、`window.hundun` API、数据目录、母/子互斥语义、插件级回归测试写法
- `.opencode/skill/hundundesktop-packaging/` — 跨平台打包：NSIS/AppImage/deb、wine、AppImage 沙箱、图标集、可写根回退

## 技术栈

| 层 | 选型 |
| --- | --- |
| 桌面框架 | Electron 28 |
| 界面 | Vue 3 + Pinia + Vue Router |
| 构建 | electron-vite 2 / Vite 5 |
| 打包 | electron-builder（NSIS / AppImage / deb） |
| 存储 | JSON 文件 + `localStorage`，无原生模块依赖 |
| 插件 | 纯 HTML / CSS / JS，独立 BrowserWindow + preload |
