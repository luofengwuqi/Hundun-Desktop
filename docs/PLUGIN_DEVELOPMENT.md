# 插件开发指南

> 本文是面向开发者的实践指南。完整的字段定义、权限与 API 规范见 [PLUGIN_SPEC.md](PLUGIN_SPEC.md)。

## 核心概念

每个子程序都是一个独立目录，由主进程创建独立的 `BrowserWindow` 加载。子程序与母程序通过 IPC 通信，通过 preload 注入的 `window.hundun` 使用宿主能力。

```text
母程序 (Vue 3)
  │  IPC: plugin-manager:launch / returnToParent / playSound / theme
  ▼
PluginManager ──► BrowserWindow(plugin) ──► plugin-preload.js
                                           └── window.hundun.*
```

- 子程序崩溃不会影响母程序
- 同一子程序同时只归属一个会话（镜像模式下会被拦截）
- 插件窗口默认启用 Node.js（`nodeIntegration: true`、`contextIsolation: false`）

## 目录结构

简单插件：

```text
plugins/my-plugin/
├── manifest.json      # 必须
├── index.html         # 入口页面
├── plugin.js          # 可选
└── assets/
```

复杂插件推荐多文件结构（参考 `plugins/fast-txt/`）：

```text
plugins/my-plugin/
├── manifest.json
├── main.html
├── css/
│   ├── base.css
│   └── ...
├── js/
│   ├── sdk.js
│   ├── app-state.js
│   ├── render.js
│   ├── events.js
│   └── init.js
└── assets/
```

> [!TIP]
> 多文件插件按 `<script>` 顺序加载，没有模块打包步骤。保持每个文件职责单一，并按依赖顺序引入。

## manifest.json

最小可用配置：

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
  "permissions": ["storage"]
}
```

常用可选字段：

| 字段 | 说明 |
| --- | --- |
| `color` | 卡带边框与高亮色 |
| `windowSize` | 子程序窗口尺寸，默认 400×400 |
| `permissions` | `storage` / `messaging` / `notifications` / `clipboard` |
| `platforms` | 支持平台，如 `["win32", "linux"]`；缺失表示不限制 |
| `minAppVersion` | 最低母程序版本 |
| `settings` | 插件自定义配置 |

`id` 仅允许小写字母、数字与连字符，且必须与目录名一致。完整字段说明见 [PLUGIN_SPEC.md](PLUGIN_SPEC.md#三manifestjson-规范)。

> [!IMPORTANT]
> 若声明了 `platforms`，主进程会在创建窗口**之前**校验。当前系统不在列表内时，母程序会直接提示，插件不会启动。

## 最小示例

`index.html`：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>MYAPP</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 100vw;
      height: 100vh;
      display: grid;
      place-items: center;
      background: var(--bg-secondary, #141414);
      color: var(--text-primary, #e0e0e0);
      font-family: 'Noto Sans SC', sans-serif;
    }
    button {
      padding: 10px 20px;
      cursor: pointer;
      background: var(--accent-primary, #00ff88);
      border: none;
      border-radius: 6px;
      font: inherit;
    }
  </style>
</head>
<body>
  <button id="close">返回母程序</button>

  <script>
    document.getElementById('close').addEventListener('click', () => {
      window.hundun.host.returnToParent()
    })

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') window.hundun.host.returnToParent()
    })
  </script>
</body>
</html>
```

## window.hundun API

preload 会把 API 直接挂到 `window.hundun`，无需导入。

### 存储

```javascript
await window.hundun.storage.set('settings', { fontSize: 14 })
const settings = await window.hundun.storage.get('settings', {})
const all = await window.hundun.storage.getAll()
await window.hundun.storage.remove('settings')
```

数据落在 `user-data/hundundesktop-data/<plugin-id>.json`，由主进程做原子写入，比 `localStorage` 更适合跨窗口 / 跨进程数据。

### 文件

```javascript
const base = await window.hundun.fs.getBasePath()

const files = await window.hundun.fs.readDir('')
const content = await window.hundun.fs.readFile('note.md')
await window.hundun.fs.writeFile('note.md', '# Hello')
await window.hundun.fs.rename('note.md', 'archive.md')
await window.hundun.fs.deleteFile('archive.md')
const exists = await window.hundun.fs.exists('note.md')
```

`fs` 只能访问插件自己的数据目录 `user-data/plugins/<plugin-id>/file/`，所有路径相对该目录解析。

### 宿主能力

```javascript
await window.hundun.host.returnToParent()

const theme = await window.hundun.host.getTheme() // 'dark' | 'light'
const off = window.hundun.host.onThemeChange((theme) => {
  document.body.classList.toggle('light-mode', theme === 'light')
})

await window.hundun.host.playSound('click')
window.hundun.host.notify('保存成功', 'success')

off()
```

音效 `click` / `change` / `OK` / `exit` / `error` / `bengbeng` / `home` / `setting` / `loading` 由母程序统一播放，自动遵循音量与静音设置。

### 窗口控制

```javascript
await window.hundun.window.minimize()
await window.hundun.window.maximize()
await window.hundun.window.setAlwaysOnTop(true)
window.hundun.window.setTitle('MYAPP v1.0.0')
await window.hundun.window.close()
```

### 插件消息

```javascript
await window.hundun.messaging.sendTo('task', { type: 'hello' })
await window.hundun.messaging.broadcast({ type: 'refresh' })

const off = window.hundun.messaging.onMessage((message) => {
  console.log('received', message)
})
```

### 自行播放音效

如果确实需要在插件内直接 `new Audio()`，请读取同一份音效设置，不要硬编码音量：

```javascript
const { soundEnabled, volume } = window.hundun.sound.getSettings()
const audio = new Audio('ding.mp3')
audio.volume = soundEnabled ? volume / 100 : 0

const off = window.hundun.sound.onSettingsChanged((next) => {
  audio.volume = next.soundEnabled ? next.volume / 100 : 0
})
```

## 主题与样式

母程序通过 CSS 变量提供两套主题，插件直接使用即可自动适配：

```css
var(--bg-primary)        /* 主背景 */
var(--bg-secondary)      /* 次背景 */
var(--bg-card)           /* 卡片背景 */
var(--text-primary)      /* 主文字 */
var(--text-secondary)    /* 次文字 */
var(--accent-primary)    /* 主强调色 */
var(--accent-secondary)  /* 次强调色 */
var(--accent-tertiary)   /* 第三强调色 */
var(--border-color)
var(--shadow-color)
```

浅色模式时给根节点加 `light-mode` 类（见上方主题监听示例）。

- 头部标题 / 徽章使用默认字体 `'Noto Sans SC', sans-serif`
- 像素字体 `'Press Start 2P'` 保留给正文、弹窗标签、键位帽等元素
- 可参考内置插件的 `css/base.css`、`css/header.css` 与 `deco-screws.css`

## 键盘与交互约定

- `Esc` 返回母程序
- 插件内部可自行支持 WASD → 方向键映射
- 点击脚本 / 卡带类条目后应有明确反馈（toast 或状态变化）
- 异步操作需捕获异常并通过 `hundun.host.notify` 给出可读提示

## 安装与分发

开发时直接放到 `plugins/` 下并重启应用。分发给用户时，将插件目录打包为 `.zip`：

```text
my-plugin-v1.0.0.zip
├── manifest.json
├── index.html
└── ...
```

> [!NOTE]
> ZIP 根目录必须直接包含 `manifest.json`，不要多包一层文件夹。安装器会校验字段、入口文件与路径穿越，并拒绝覆盖内置插件 ID。

用户通过母程序 `+` 按钮选择 zip 安装；安装后的插件位于用户插件目录，可在设置 → 插件中排序或移除。

## 调试

- 在插件窗口按 `F12` 或 `Ctrl+Shift+I` 打开 DevTools
- 日志建议带插件前缀：`console.log('[MyPlugin] ...')`
- 修改文件后返回母程序重新插入卡带即可；主进程改动需重启 `npm run dev`

## 参考实现

| 插件 | 可参考内容 |
| --- | --- |
| `plugins/calculator/` | 单文件 HTML 插件、像素按键布局 |
| `plugins/fast-txt/` | 多文件架构、文件读写、Markdown 浏览、i18n |
| `plugins/task/` | `hundun.storage` 持久化、提醒与通知、状态排序 |
| `plugins/fast-cmd/` | 平台感知、脚本执行、文件管理 |

对应的 Electron 冒烟测试位于 `scripts/test-*.js`，可作为行为参考。
