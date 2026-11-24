<div align="center">
  <img src="src/renderer/assets/logo-512.png" width="140" alt="HundunDesktop logo" />
  <h1>HundunDesktop</h1>
  <p><strong>复古像素风的桌面效率工具</strong><br />母程序 + 卡带式子程序，功能装进卡带、随插随用</p>

  <p>
    <img alt="Electron" src="https://img.shields.io/badge/Electron-28-47848F?logo=electron&logoColor=white" />
    <img alt="Vue" src="https://img.shields.io/badge/Vue-3-42B883?logo=vuedotjs&logoColor=white" />
    <img alt="Vite" src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white" />
    <img alt="Platform" src="https://img.shields.io/badge/Windows%20%7C%20Linux-1F2937" />
  </p>
</div>

---

## 这是什么

HundunDesktop 是一个「卡带式」桌面效率应用。母程序是一个 800×540 的固定窗口，每个功能都是一个独立运行的**子程序卡带**：点击卡带、插入插槽，子程序就在自己的窗口中启动。

- **插件化架构**：每个子程序运行在独立 `BrowserWindow` 中，崩溃不会拖垮母程序
- **内置四张卡带**：计算器、文本管理器、任务清单、脚本管理器，开箱即用
- **复古视觉**：像素字体、CRT 扫描线、卡带入仓动画、深色 / 浅色双主题
- **键盘优先**：WASD / 方向键导航，空格 / Enter 确认，Esc 返回
- **镜像模式**：再开一个母窗口，双人并行使用不同子程序
- **本地优先**：数据保存在本机 JSON 文件，无需账户与网络
- **用户数据仓库**：底部「仓库」按钮可把整个数据目录接成 git 仓库（Gitee 一键建库 / 已有仓库），只同步你勾选的范围，拉取 / 推送 / 两个方向的覆盖各是一个独立按钮
- **插件安装**：从 `.zip` 安装第三方插件，设置页统一管理排序与卸载

> [!IMPORTANT]
> 母程序窗口固定为 **800×540**，不支持手动缩放。子程序窗口尺寸由各自 `manifest.json` 的 `windowSize` 决定。

## 内置卡带

| 卡带 | 子程序 | 尺寸 | 能做什么 |
| --- | --- | --- | --- |
| 🔢 `calculator` | CALC | 400×540 | 复古像素风计算器 |
| 📄 `fast-txt` | FastTXT | 800×540 | 文本文件管理、编辑、Markdown 实时浏览、查找替换 |
| 📋 `task` | TASK | 400×520 | 任务清单、截止时间、状态排序、到点提醒 |
| ⚡ `fast-cmd` | FastCmd | 800×540 | 脚本管理：Windows `.bat` `.cmd` `.ps1` / Linux `.sh`，点击即运行 |
| 🎵 `music` | Music | 800×540 | 音乐库、分组、播放队列、曲目导入（移动语义） |

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

### 用户数据仓库（同步）

底部按钮群第 4 个「仓库」进入全屏仓库页，用**你自己的 git 仓库**给数据目录做版本历史与云端副本。默认不联网。

- **仓库根就是数据目录本身**（`<userData>`），原地建库、不搬文件 —— 归档位置永远是真实数据所在，不存在「两份数据谁是准的」
- **两种接入**：① Gitee 一键建库（填私人令牌，自动建私有空库并关联）② 已有仓库（填地址+令牌，先拉取再与本地合并，两边都不丢）
- **只同步你勾的**：`.gitignore` 采用白名单 —— 先排除一切，再逐级放行 `settings.json`、各子程序的 `hundundesktop-data/*.json`、以及你勾选插件的数据目录。`Cache`、`Local Storage`、未勾选插件、令牌文件一律不进库
- **范围由子程序声明**：插件 `manifest.json` 的 `sync` 字段决定它能同步什么；`paths: []` 表示只同步设置不传文件（TASK / Music 数据全在 `*.json`）
- **四个动作各自独立**（左栏四个按钮，没有"一键全自动同步"）：
  - **从云端拉取到本地** —— 本地改动先落成提交 → `fetch` → `merge`，**不推送**
  - **从本地推送到云端** —— `add` → 有暂存才 commit → `push`，**不拉取**（被拒会提示先拉）
  - **从云端覆盖到本地** —— 取云端版本后 `reset --hard`，**不 `clean`**（未跟踪文件保留）
  - **从本地覆盖到云端** —— 提交后 `push --force`
- **覆盖动作要点两次**：第一次点会把按钮"上膛"（整块转品红、图标换警告三角、文案变「再点一次确认」），5 秒内不再点就自动撤回；执行前自动打本地备份 tag `hundun-backup-<动作>-<时间戳>`，结果条会报出 tag 名，反悔就 `git reset --hard <tag>`
- **冲突只按文件取值**：拉取遇到冲突时界面列出冲突文件，只能对整份文件选「保留本地」或「保留云端」，不动其他文件
- **云端为空就拒绝**：分支上没有任何提交时，「从云端覆盖到本地」会明确报错并原地不动，不会把本地清空
- **取消勾选不删文件**：只从索引里移除（`git rm --cached`），本地文件保留，结果里会列出来
- **大文件跳过**：单文件超过 50MB 不入库，本地文件不动
- **私有仓库要填访问令牌**（加密存本机，不写进仓库）：
  - **Gitee**：设置 → 私人令牌，勾 `projects`
  - **GitHub**：Settings → Developer settings → Personal access tokens，勾 `repo`；用户名填 `x-access-token`
  - 系统有密钥环时令牌走 `safeStorage` 加密，没有时降级明文并存成 `sync/token.bin`（权限 0600），界面上会标出来

### 卡片与插件管理

- 点击 `+` 可从本地选择 `.zip` 安装插件，或打开插件社区
- `⚙ 设置 → 插件` 可查看实时运行状态、拖拽排序、移除 / 恢复插件
- 插件数据默认保留；卸载时可选择一并删除

### 关于页

`⚙ 设置 → 关于` 展示应用 logo、版本号、技术栈、系统信息与作者信息。

- 版本号取自主进程 `app.getVersion()`，不再硬编码
- 「检查更新」按钮在最右侧：实时访问 GitHub Releases，发现新版本可一键打开下载页；已最新或网络异常时给出对应提示（10 秒超时保护）。更新源配置见 `src/main/update-service.js`（预留自建服务器切换）
- 「关于作者」板块包含头像、签名与 Gitee / GitHub / Bilibili 主页链接（点击用系统浏览器打开）

### 版本号规则

主程序版本号统一采用 **`年.季度.次数`**（`YYYY.Q.N`）：

| 段 | 含义 | 取值 |
| --- | --- | --- |
| `YYYY` | 发行年份 | 4 位年份，如 `2026` |
| `Q` | 发行日所在自然季度 | `1` = 1–3 月，`2` = 4–6 月，`3` = 7–9 月，`4` = 10–12 月 |
| `N` | 该季度内第几次发行 | 从 `1` 起，每发行一次 +1；进入新季度归零，重新从 `1` 开始 |

例如 2026 年第四季度第一次发行 = `2026.4.1`，同季度第二次发行 = `2026.4.2`，2027 年第一季度首次发行 = `2027.1.1`。**只数发行次数，不按具体日期编号**，同一天发两次也依次递增。

当前版本：`2026.4.2`。唯一事实源是 `package.json` 的 `version`（关于页经主进程 `app.getVersion()` 读取）；改版本时同步 `package-lock.json`、`plugins/fast-txt/manifest.json` 与 FastTXT 头部徽章。其他内置卡带 `manifest.json` 里的 `1.0.0` 是插件自身版本，不跟随主程序。

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
npm run check:main   # 构建后自检：out/main 里每个相对 require 都能解析
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
│   │   ├── settings-store.js # 应用设置读写（原子写 / 键白名单 / 坏文件留存）
│   │   ├── sync-service.js   # 用户数据仓库同步（四动作 / 备份 tag / 白名单入库 / 冲突处理）
│   │   ├── git-service.js    # 加固的 git 调用层（无 shell / 令牌脱敏 / 错误分类）
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

开发模式下，数据位于项目根目录的 `user-data/`。

打包后的位置（决策63）：

| 平台 / 安装方式 | 数据目录 |
| --- | --- |
| Windows（任何安装位置，默认 `%LOCALAPPDATA%\Programs`） | `%APPDATA%\hundundesktop` |
| Linux deb（`/opt/HundunDesktop`）、AppImage | `~/.config/hundundesktop` |
| 显式便携（启动参数 `--portable` 或环境变量 `HUNDUN_PORTABLE=1`） | 可执行文件旁的 `user-data/` |

> Windows 之所以固定不放安装目录：NSIS 卸载器会递归删除整个安装目录（`RMDir /r $INSTDIR`），覆盖安装（升级）时也会先运行旧卸载器 —— 数据放在里面会随卸载/升级一起消失。Windows 便携版请显式加 `--portable`，此时卸载会清空数据，需自行备份。
>
> 旧版（≤ 2026.4.1）Windows 用户的数据在 `<安装目录>\user-data`：新版安装器会在运行旧卸载器**之前**把它复制到 `%APPDATA%\hundundesktop`，应用首次启动时也会再做一次补齐（已存在的文件不覆盖，原目录保留不删）。

| 内容 | 位置（相对上面的数据目录） |
| --- | --- |
| 应用设置（主题 / 语言 / 音效 / 插件顺序与已移除名单） | `settings.json`（纯 JSON，原子写；坏文件会改名为 `settings.json.corrupt-<时间>.json` 留存） |
| 插件文件数据 | `plugins/<plugin-id>/file/` |
| 插件 JSON 存储 | `hundundesktop-data/<plugin-id>.json` |
| 已安装插件记录 | `installed-plugins.json`（清单）+ `installed-plugins/`（用户安装的插件本体，仅打包态） |
| 仓库同步配置 | `sync/config.json`（远程地址 / 分支 / 同步范围） |
| 仓库同步令牌 | `sync/token.bin`（有系统密钥环时 `safeStorage` 加密，否则明文 0600 并在界面标注） |
| 数据版本库 | `.git/` + `.gitignore`（白名单：只放行设置、子程序 JSON 与勾选插件的数据目录） |

> [!NOTE]
> 开发期数据键统一为 `hundundesktop-*`，不提供旧版 `hundun-lite-*` 数据迁移。
>
> 2026.4.2 及更早版本把主题/语言/音效/插件顺序存在渲染进程 `localStorage`（落在同一数据目录的 `Local Storage/`）。新版首次读取时会把它们**补写**到 `settings.json`：只补不覆盖（已有值优先），老键保留不删，可随时回滚。

## 测试

核心回归测试通过 Electron 运行：

```bash
npx electron --no-sandbox scripts/test-mirror.js
npx electron --no-sandbox scripts/test-window-lifecycle.js
npx electron --no-sandbox scripts/test-plugin-uninstall.js
npx electron --no-sandbox scripts/test-task.js
npx electron --no-sandbox scripts/test-settings-ipc.js        # 设置 IPC/preload 往返 + 跨窗口广播
npx electron --no-sandbox scripts/test-settings-migration.js  # 老 localStorage → settings.json 只补不覆盖
```

> 注: 本机 IDE 会注入 `ELECTRON_RUN_AS_NODE=1`，直接跑 electron 需前置 `env -u ELECTRON_RUN_AS_NODE`，否则 `require('electron')` 退化为路径字符串。

平台检查、仓库同步等纯 Node 测试可直接执行：

```bash
node scripts/test-platform-support.js
node scripts/test-sync-service.js    # 本地 bare 仓库当远端，真跑 git：四动作/备份 tag/白名单/冲突/取消勾选（17 项）
node scripts/test-settings-store.js  # 设置文件原子写/坏文件隔离/键白名单
node scripts/test-userdata-policy.js # 数据目录策略 + 旧目录迁移
node scripts/test-check-update.js    # 检查更新（注入 fetch）
npm run check:main                   # 构建后校验 out/main 相对依赖是否齐全（防漏复制）
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
