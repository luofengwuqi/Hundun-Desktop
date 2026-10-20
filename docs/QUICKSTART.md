# 快速开始

## 环境要求

- Node.js >= 18（推荐 20 LTS）
- npm >= 9
- Windows 10+ 或主流 Linux 发行版

## 安装与运行

```bash
git clone https://github.com/luofengwuqi/Hundun-Desktop.git
cd Hundun-Desktop
npm install
npm run dev
```

Linux 下可直接运行 `./start.sh`。脚本会自动安装缺失依赖，并在 `chrome-sandbox` 未设置 SUID 时追加 `--noSandbox`：

```bash
sudo chown root:root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
```

只想查看界面效果时，可直接用浏览器打开 `hundundesktop-prototype.html`。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发模式（Vite 热更新 + Electron） |
| `npm run build` | 构建到 `out/` |
| `npm run build:win` | 打包 Windows NSIS 安装程序 |
| `npm run build:linux` | 打包 Linux AppImage + deb |
| `npm run build:setup` | 一次产出 Windows / Linux 三件套 |
| `npm run preview` | 预览构建结果 |

产物位于 `dist/`：

```text
HundunDesktop Setup <version>.exe
HundunDesktop-<version>.AppImage
hundundesktop_<version>_amd64.deb
```

国内网络构建前建议设置镜像：

```bash
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
export ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
```

在 Linux 上构建 Windows 包还需要 `wine64`。

## 项目结构

```text
HundunDesktop/
├── src/
│   ├── main/        # 主进程：窗口、IPC、插件与镜像管理、安装器
│   ├── renderer/    # Vue 3 母程序：卡带货架、设置、i18n、音效
│   └── shared/      # 插件加载器与 PluginSDK
├── plugins/         # 内置子程序：calculator / fast-txt / task / fast-cmd
├── scripts/         # 构建补丁与回归测试
├── sounds/          # 音效资源
├── docs/            # 开发文档（本文件也在这里）
├── user-data/       # 运行期数据（不提交）
└── package.json
```

## 基础操作

| 按键 | 功能 |
| --- | --- |
| `W` / `↑` | 切换到卡带行 |
| `S` / `↓` | 切换到按钮 / 插槽行 |
| `A` / `D`、`←` / `→` | 左右移动 |
| `Space` / `Enter` | 插入卡带 / 执行按钮 |
| `Esc` | 关闭弹窗 / 返回母程序 |

- 点击卡带选中，再按 Enter 或再次点击将其插入插槽并启动
- 底部 `+` 安装 `.zip` 插件，`⚙` 打开设置，镜像按钮开启第二个母窗口
- 设置页的插件列表支持实时运行状态、拖拽排序、移除与恢复

## 开发子程序

1. 在 `plugins/` 下新建目录，目录名即插件 ID
2. 编写 `manifest.json` 与入口页面（如 `index.html`）
3. 重启应用，卡带会自动出现在货架上

```json
{
  "id": "my-plugin",
  "name": "MYAPP",
  "version": "1.0.0",
  "description": "我的第一个子程序",
  "icon": "🎮",
  "color": "#00ff88",
  "entry": "index.html",
  "permissions": ["storage"]
}
```

插件通过 `window.hundun` 使用存储、文件、主题、音效、窗口控制等能力。完整说明见：

- [插件开发指南](PLUGIN_DEVELOPMENT.md)
- [子程序开发规范](PLUGIN_SPEC.md)

也可以把插件目录打包为 `.zip`，通过母程序 `+` 按钮安装。

## 自定义外观

- 深色 / 浅色主题：母程序左上角拨动开关
- 音效：设置页调整总音量或静音，插件音效同样跟随
- 主题色与卡带色：见 `src/renderer/assets/styles/main.css` 与各插件 `manifest.json` 的 `color`

## 回归测试

```bash
npx electron --no-sandbox scripts/test-mirror.js
npx electron --no-sandbox scripts/test-window-lifecycle.js
npx electron --no-sandbox scripts/test-plugin-uninstall.js
npx electron --no-sandbox scripts/test-task.js
node scripts/test-platform-support.js
```

## 常见问题

**应用启动后没有窗口 / 立即退出？**

检查 Node.js 版本、是否已执行 `npm install`，以及终端中的 Electron 报错。Linux 下优先尝试 `./start.sh`。

**Linux 下提示 No usable sandbox？**

给 `chrome-sandbox` 设置 root 属主与 4755 权限，或使用 `--noSandbox` 启动。

**AppImage 双击无反应？**

安装 `libfuse2`（Ubuntu 24.04+ 为 `libfuse2t64`）。AppImage 构建时已自动注入 `--no-sandbox`。

**音效不播放？**

确认 `sounds/` 与 `src/renderer/public/sounds/` 存在，并在设置页检查音量与静音状态。

**插件没有出现在货架上？**

检查 `manifest.json` 的 `id`、`entry` 是否有效，以及 `platforms` 是否包含当前系统。必要时到设置 → 插件中刷新或恢复。
