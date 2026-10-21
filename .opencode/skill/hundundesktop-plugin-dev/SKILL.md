---
name: hundundesktop-plugin-dev
description: Use when creating, modifying, debugging or reviewing a HundunDesktop sub-program (plugin) under plugins/ — adding a new cartridge, editing manifest.json / entry HTML / CSS / JS of calculator, fast-txt, fast-cmd or task, wiring the window header buttons (pin ▬ minimize ✕), using the window.hundun host API (storage / fs / messaging / sound / window), plugin i18n, platform support, data directories, or adding a regression test. Trigger on any mention of 子程序/插件/卡带/plugin development, window.hundun API, manifest.json fields, plugin data paths, or a plugin that shows no icon, has dead header buttons, loses its data, or fails to start.
---

# HundunDesktop — 子程序 (插件) 开发

HundunDesktop 是「母程序 + 卡带式子程序」架构: 母程序是一个 800×540 的掌机壳, 每个子程序是
**独立 BrowserWindow** (独立进程, 崩溃不拖垮母程序), 通过 `window.hundun.*` 与宿主通信。

仓库: `/home/wuqi/code/hundunDesktop` (git remote gitee `chaos-lite`)。
权威记录: `AGENTS.md` (决策 26~29/37~52)、`CHANGELOG.md`、`docs/PLUGIN_SPEC.md`、
`docs/PLUGIN_DEVELOPMENT.md`。本 skill 只记「会踩坑的实操细节」。

> 打包 (NSIS / AppImage / deb) 见另一个 skill: `.opencode/skill/hundundesktop-packaging/SKILL.md`。

---

## 1. 子程序长什么样

```
plugins/<id>/
├── manifest.json      # 必需
├── main.html          # 入口 (entry 指定; 可多文件: css/ + js/ 按序 <script>)
├── css/*.css
├── js/*.js            # 纯全局脚本, 无模块; vendor/ 放第三方库
└── (可选) assets/ README.md
```

最小可运行: `manifest.json` + 一个 `index.html`。

`manifest.json` 关键字段:

| 字段 | 说明 |
|---|---|
| `id` | 目录名同款; 内置 id 不可被 zip 安装覆盖 |
| `name` | 母程序货架上显示的名字 (如 `TASK`) |
| `version` | semver |
| `entry` | 入口 html (相对插件目录) |
| `icon` / `color` | 货架卡带图标与主色 |
| `windowSize` | **内容区**尺寸; 实际窗口 = 内容 + 20px (母程序居中放置时留边) |
| `permissions` | 如 `["storage","notifications"]` |
| `platforms` | 如 `["win32","linux"]`; 缺失 = 不限制; **主进程在创建窗口前校验** |

窗口本身: `frame:false` (无边框, 自绘标题栏) + `nodeIntegration:true` + `contextIsolation:false`
+ preload `src/main/plugin-preload.js`。插件能直接用 `require('electron')`, 但**宿主能力只经
`window.hundun`**。

---

## 2. 窗口右上角按钮组 (最容易做错的地方)

母程序与全部内置子程序统一为三个圆形按钮, 从左到右 **📌 置顶 · ▬ 最小化 · ✕ 关闭**:

| 按钮 | 母程序 | 子程序 |
|---|---|---|
| 📌 置顶 | `.header-pin-btn` (flex, 顺序 pin→min→close) | `.xxx-pin-btn` `right:84px` |
| ▬ 最小化 | `.header-min-btn` | `.xxx-min-btn` `right:48px` |
| ✕ 关闭 | `.header-close-btn` | `.xxx-close-btn` `right:12px` |

规则:

1. **子程序按钮是绝对定位**, 尺寸一律 `28×28` 圆形; 位置 `top:10px`(calculator `top:8px`) /
   `right: 12 / 48 / 84px`。
2. **最小化图标不是字符, 是伪元素横线** (`▁` U+2581 墨迹偏下; em dash `—` 12px 下偏宽, 都弃用):
   ```css
   .xxx-min-btn::before {
     content: ''; display: block;
     width: 0.72em;            /* ≈8.6px @12px, 与 ✕ 字形相当 */
     height: 2px;
     border-radius: 1px;
     background: currentColor;
   }
   ```
   按钮**内容为空**, 字号与 ✕ 一致 (`font-size:12px; font-weight:bold`) 使横线随字号缩放,
   `align-items:center` 保证严格居中。
3. 所有头部按钮必须 `-webkit-app-region: no-drag` (头部本身是 drag 区), 否则在无边框窗口里点不动。
4. **按钮监听器要在任何 await 之前绑定** —— 若 `init()` 前半段有异步步骤 (读文件等) 且失败,
   绑定在末尾的监听器永远不会挂上, 按钮彻底失效。正确写法: `init()` 第一行就
   `setupPinButton(); setupMinButton();`。
5. i18n: 母程序用 `app.minimize`; 插件各自 `header.minimize` (zh/en), 由 `js/i18n-html.js`
   给按钮 `title` 赋值。

---

## 3. 母/子窗口互斥语义 (决策 38/45) —— 最小化按钮的特殊约定

会话 (母窗口 A / 镜像窗口 B 各自一组) 内**同时只有一个窗口可见**:

- 启动子程序 → 先藏母程序, 再显子程序;
- 子程序返回/关闭 → 母程序恢复可见;
- **子程序最小化 → 该会话将没有可见窗口 → 母程序自动恢复显示**;
- 子程序随后从任务栏恢复 → 母程序被**再次隐藏**。

主进程实现 (`src/main/plugin-manager.js`):

- `pluginMinimized: Map` —— **自己的标记**, 因为 Electron 的 `isVisible()` 在 `minimize()`
  之后有状态延迟 (仍可能短暂返回 true), 直接用它判定会导致「母程序恢复」被跳过;
  `getVisiblePluginWindows()` 排除已标记的插件。
- `minimizePlugin(id)` → 置标记 → `window.minimize()` → `_recoverMainWindowIfIdle(owner)` 恢复母程序。
- 插件窗口 `restore` / `show` 监听 → 清标记 + `_hideMainForPlugin(session)`。
- `startPlugin()` 的「已运行」分支必须先 `restore()` —— **`show()` 不会解除最小化**, 否则会话无可见窗口。
- 插件窗口控制 IPC (`plugin:close` / `plugin:minimize` / `plugin:maximize`) **在 `PluginManager._registerIPC()`**,
  不在 `index.js` (测试脚本 `new PluginManager()` 即可复用, 避免重复注册报错)。

插件侧调用: `await window.hundun.window.minimize()` (IPC `plugin:minimize`)。
母程序侧: `ipcRenderer.send('window-minimize')` → 主进程按 `event.sender` 反查窗口 (镜像各自独立)。

---

## 4. 数据与存储

| 数据 | 位置 | 访问方式 |
|---|---|---|
| 插件 JSON 数据 | `user-data/hundundesktop-data/<id>.json` | `window.hundun.storage.get/set/remove/getAll` |
| 插件文件 | `user-data/plugins/<id>/file/` | `window.hundun.fs.*` |

- **绝不要把用户数据写进 `plugins/<id>/` 目录** —— 打包后是只读 (asar / /opt)。
- 卸载插件时「保留数据 / 删除数据」由主进程 `uninstallPlugin(id, {removeData})` 处理:
  安装来的插件删目录+记录; 内置/手放的**只隐藏不删目录**; `removeData` 才删
  `user-data/plugins/<id>/` 与 `hundundesktop-data/<id>.json`。
- `window.__PLUGIN_ID__` 是主进程在 **did-finish-load** 才注入的 (晚于 DOMContentLoaded):
  插件 `init()` 首行要能从入口路径 `/plugins/<id>/` 解析出同值兜底, 否则 storage 会写到 `null.json`。
- 插件自身的 localStorage 键 (`<id>-theme` / `<id>-locale`) **无法按插件定位清理** (Chromium 分区不可寻址),
  这是已知取舍。

---

## 5. i18n / 主题 / 音效

- 每个插件自带 `js/i18n.js` (zh/en 词条) + `js/i18n-html.js` (把翻译套到静态 HTML 的 `title`/`placeholder`)。
- 语言来源统一读 `hundundesktop-locale` (与母程序同一键)。
- 主题: 母程序 → `window.hundun.host.getTheme()` / `onThemeChange()`; 插件本地偏好优先, 没有才同步母程序。
- 音效: 插件直放音效必须走 `window.hundun.sound.getSettings()` 拿主进程镜像的音量/静音设置,
  **禁止硬编码音量** (历史上出过「进入子程序后音效特别大」)。

---

## 6. 平台差异 (决策 42)

- `manifest.platforms` 由 `src/main/platform-support.js checkPlatformSupport()` 在**创建窗口之前**校验,
  不支持则拒绝启动并回友好错误 (母程序弹提示, 母窗口保持可见)。
- 插件内部还要自己按平台过滤 (例: fast-cmd win32 收 `.bat/.cmd/.ps1`, linux 收 `.sh`; 不支持的文件**不显示**)。
- 测试可用 `FASTCMD_PLATFORM` 环境变量覆盖平台, 在 Linux 上回归 Windows 分支。

---

## 7. 回归测试

测试都是 Electron 脚本 (`npx electron --no-sandbox scripts/test-xxx.js`), 退出码 0 = 全过。

| 脚本 | 覆盖 |
|---|---|
| `test-window-lifecycle.js` | 母/子互斥生命周期 (含最小化语义, J 段) |
| `test-mirror.js` | 镜像模式 / 镜像升格 / 插件归属 |
| `test-task.js` | TASK 插件交互 |
| `test-plugin-uninstall.js` | 卸载 / 保留数据 / 已移除名单 |
| `test-fastcmd-platform.js` | fast-cmd 平台分支 |
| `test-md-preview.js` / `test-md-scroll.js` | FastTXT Markdown 浏览 |
| `test-platform-support.js` | 纯 node, 平台校验 |
| `test-sound-settings.js` | 音效设置 |

写插件级测试的要点:

- 用 `new PluginManager(mainWindow)` 直接驱动插件管理器, 真实 `launchPluginWithTransition('<id>')` 起窗口。
- **真实点击按钮**: `win.webContents.executeJavaScript("document.getElementById('minBtn').click()")`,
  然后断言 `win.isMinimized()` 与母窗口可见性 (按钮监听器挂载较晚 → 轮询重试, 别只 sleep 一次)。
- 测试用 `app.setPath('userData', 临时目录)` 隔离, 避免写用户真实数据。

---

## 8. 常见坑速查

| 症状 | 原因 | 修法 |
|---|---|---|
| 头部按钮点了没反应 | 监听器绑在 `init()` 末尾, 前面 await 失败 | 按钮绑定提到 `init()` 第一行 |
| 插件窗口最小化后整个应用没窗口了 | 母程序没恢复 | `minimizePlugin()` 里恢复母程序; `pluginMinimized` 标记 |
| 恢复子程序后母程序也还在 | 缺 `restore`/`show` 监听 | 插件窗口监听这两个事件 → 藏母程序 |
| 点子程序没反应 (以为死机) | `show()` 不会解除最小化 | `startPlugin()` 已运行分支先 `restore()` |
| 数据写到 `null.json` | `__PLUGIN_ID__` 注入晚于 DOMContentLoaded | init 首行从路径解析 id 兜底 |
| 打包后插件存不了数据 | 写进了 `plugins/<id>/` (只读) | 用 `hundun.storage` / `hundun.fs` |
| 子程序音效忽大忽小 | 直放音效硬编码音量 | 读 `hundun.sound.getSettings()` |
| 头部按钮点不动 | 缺 `-webkit-app-region: no-drag` | 加上 |
| 窗口尺寸与 manifest 不符 | 实际窗口 = `windowSize` + 20px | manifest 填**内容区**尺寸 |
