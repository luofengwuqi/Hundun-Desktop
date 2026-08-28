# Hundun Lite - 子程序开发规范 v2.0

> 本文档定义了 Hundun Lite 子程序（插件）的完整开发规范。
> 所有子程序必须遵循本规范，以便母程序能够自动发现、加载和管理。

---

## 一、架构概述

### 1.1 核心概念

```
┌─────────────────────────────────────────────────┐
│  母程序 (Main Process + Renderer)                │
│  - 卡带货架 UI                                   │
│  - 卡带插槽 UI                                   │
│  - 过渡动画管理                                   │
│  - 插件注册表 (自动发现)                          │
├─────────────────────────────────────────────────┤
│  子程序 (独立 BrowserWindow)                      │
│  - 每个子程序运行在独立进程中                       │
│  - 通过 IPC 与母程序通信                          │
│  - 使用 PluginSDK 访问宿主能力                    │
│  - 崩溃不影响母程序                               │
└─────────────────────────────────────────────────┘
```

### 1.2 生命周期

```
UNLOADED → LOADED → RUNNING → SUSPENDED → RUNNING → CLOSED
   ↓         ↓         ↓          ↓          ↓        ↓
 未发现   已注册    窗口运行    窗口隐藏   窗口恢复   已关闭
```

### 1.3 通信机制

| 方向 | 机制 | 用途 |
|------|------|------|
| 母程序 → 子程序 | `webContents.send()` | 发送命令、主题变更通知 |
| 子程序 → 母程序 | `ipcRenderer.invoke()` | 请求关闭、获取数据 |
| 子程序 ↔ 其他子程序 | 通过母程序路由 | 插件间消息传递 |

---

## 二、目录结构

### 2.1 标准子程序目录

```
plugins/
└── my-plugin/                    # 子程序目录 (目录名 = 插件ID)
    ├── manifest.json             # [必须] 插件元数据
    ├── index.html                # [必须] 入口页面
    ├── styles.css                # [可选] 样式文件
    ├── plugin.js                 # [可选] 插件逻辑
    └── assets/                   # [可选] 资源目录
        ├── icon.png
        └── ...
```

### 2.2 Vue 开发者模板目录 (高级)

```
plugins/
└── my-plugin/
    ├── manifest.json
    ├── package.json              # Vue 项目配置
    ├── vite.config.js            # Vite 构建配置
    ├── index.html                # Vite 入口
    └── src/
        ├── main.js               # Vue 应用入口
        └── App.vue               # Vue 组件
```

> **注意**: Vue 模式需要先运行 `npm run build` 构建为纯 HTML，
> 或使用 `npm run dev` 在开发模式下运行（需手动配置 Vite 端口）。

---

## 三、manifest.json 规范

### 3.1 完整示例

```json
{
  "id": "calculator",
  "name": "CALC",
  "version": "1.0.0",
  "description": "Retro pocket calculator",
  "icon": "🔢",
  "author": "Hundun Lite",
  "entry": "index.html",
  "color": "#88ff00",
  "windowSize": {
    "width": 400,
    "height": 540
  },
  "permissions": ["storage"],
  "minAppVersion": "1.0.0",
  "settings": {
    "precision": 10
  }
}
```

### 3.2 字段说明

| 字段 | 类型 | 必须 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | string | ✅ | - | 插件唯一标识符 (仅允许小写字母、数字、连字符) |
| `name` | string | ✅ | - | 显示名称 (卡带上显示，建议 ≤8 字符) |
| `version` | string | ✅ | - | 语义化版本号 (x.y.z) |
| `description` | string | ❌ | `""` | 插件描述 |
| `icon` | string | ❌ | `"📦"` | 卡带图标 (emoji 或路径) |
| `author` | string | ❌ | `"Unknown"` | 作者名称 |
| `entry` | string | ❌ | `"index.html"` | 入口文件路径 (相对于插件目录) |
| `color` | string | ❌ | `"#00ff88"` | 卡带颜色 (hex，用于卡带边框和高亮) |
| `windowSize` | object | ❌ | `{width:400,height:400}` | 子程序窗口尺寸 |
| `permissions` | string[] | ❌ | `[]` | 所需权限列表 |
| `minAppVersion` | string | ❌ | `"1.0.0"` | 最低母程序版本 |
| `settings` | object | ❌ | `{}` | 插件自定义配置 |

### 3.3 ID 命名规范

- ✅ `calculator`, `fast-txt`, `note-taker`, `system-monitor`
- ❌ `Calculator`, `FAST_TXT`, `note.taker`, `system/monitor`

### 3.4 权限列表

| 权限 | 说明 | 需要用户授权 |
|------|------|-------------|
| `storage` | 访问插件专属数据存储 | ❌ |
| `messaging` | 与其他插件通信 | ❌ |
| `notifications` | 发送系统通知 | ✅ |
| `clipboard` | 访问剪贴板 | ❌ |

---

## 四、入口页面规范 (index.html)

### 4.1 最小模板

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Plugin</title>
  <!-- 引入 PluginSDK (推荐) -->
  <script src="path/to/plugin-sdk.js"></script>
  <style>
    /* 使用母程序提供的 CSS 变量 */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 100vw;
      height: 100vh;
      background: var(--bg-secondary, #141414);
      color: var(--text-primary, #e0e0e0);
      font-family: 'Noto Sans SC', sans-serif;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <div id="app">
    <!-- 你的插件 UI -->
    <h1>My Plugin</h1>
  </div>

  <script>
    // 插件逻辑
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[MyPlugin] Loaded!')
    })
  </script>
</body>
</html>
```

### 4.2 CSS 变量 (继承母程序主题)

子程序窗口自动继承母程序的 CSS 变量，可直接使用：

```css
/* 背景色 */
var(--bg-primary)       /* 主背景 #0a0a0a (深色) / #FFF8E8 (浅色) */
var(--bg-secondary)     /* 次背景 #141414 / #FFF3D6 */
var(--bg-card)          /* 卡片背景 */

/* 强调色 */
var(--accent-primary)   /* 主强调 #00ff88 (深色) / #C3272B (浅色) */
var(--accent-secondary) /* 次强调 #ff0080 / #cc0066 */
var(--accent-tertiary)  /* 第三强调 #00d4ff / #0099cc */

/* 文字色 */
var(--text-primary)     /* 主文字 #e0e0e0 */
var(--text-secondary)   /* 次文字 */
var(--text-muted)       /* 弱化文字 */

/* 边框 */
var(--border-color)     /* 边框色 */

/* 阴影 */
var(--shadow-color)     /* 阴影色 */

/* CRT 效果 */
var(--scanline-opacity) /* 扫描线透明度 */
```

### 4.3 字体

- **像素字体**: `'Press Start 2P', monospace` (标题、标签)
- **正文字体**: `'Noto Sans SC', sans-serif` (内容)

> 母程序已加载这两种字体，子程序可直接使用。

---

## 五、PluginSDK API

### 5.1 引入方式

```html
<!-- 方式1: 通过 script 标签引入 (推荐) -->
<script src="path/to/plugin-sdk.js"></script>

<!-- 方式2: 在 plugin.js 中使用 -->
const sdk = window.HundunSDK
```

### 5.2 API 列表

#### 存储 API

```javascript
// 获取数据
const value = await sdk.storage.get('key', defaultValue)

// 设置数据
await sdk.storage.set('key', value)

// 删除数据
await sdk.storage.remove('key')

// 获取所有数据
const allData = await sdk.storage.getAll()
```

#### 消息 API

```javascript
// 发送消息到其他插件
await sdk.messaging.sendTo('target-plugin-id', { type: 'hello' })

// 广播消息给所有插件
await sdk.messaging.broadcast({ type: 'update' })

// 监听消息
const unsubscribe = sdk.messaging.onMessage((message) => {
  console.log('Received:', message)
})

// 监听广播
const unsubscribe = sdk.messaging.onBroadcast((message) => {
  console.log('Broadcast:', message)
})
```

#### 窗口 API

```javascript
// 最小化窗口
await sdk.window.minimize()

// 最大化/还原
await sdk.window.maximize()

// 关闭窗口 (返回母程序)
await sdk.window.close()

// 设置标题
sdk.window.setTitle('My Plugin v2.0')

// 获取窗口尺寸
const { width, height } = sdk.window.getSize()

// 监听窗口大小变化
sdk.window.onResize(({ width, height }) => {
  console.log('Resized:', width, height)
})
```

#### 宿主 API (新)

```javascript
// 返回母程序 (带过渡动画)
await sdk.host.returnToParent()

// 获取当前主题
const theme = sdk.host.getTheme() // 'dark' | 'light'

// 监听主题变更
sdk.host.onThemeChange((theme) => {
  console.log('Theme changed to:', theme)
})

// 播放音效
sdk.host.playSound('click') // click | change | OK | exit | error | ...

// 显示通知
sdk.host.notify('Hello!', 'success')
```

#### 工具 API

```javascript
// 延迟
await sdk.utils.sleep(1000)

// 生成唯一ID
const id = sdk.utils.generateId()

// 深拷贝
const copy = sdk.utils.deepClone(obj)

// 格式化日期
const str = sdk.utils.formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss')
```

### 5.3 事件系统

```javascript
// 监听事件
sdk.on('ready', (data) => {
  console.log('Plugin ready:', data.pluginId)
})

// 移除监听
sdk.off('ready', handler)
```

---

## 六、开发模式

### 6.1 HTML 模式 (推荐新手)

1. 在 `plugins/` 下创建目录
2. 创建 `manifest.json`
3. 创建 `index.html` (包含所有 CSS 和 JS)
4. 重启母程序或刷新，子程序自动出现在卡带货架

**优点**: 无需构建工具，单文件即可运行
**缺点**: 无法使用 Vue/React 等框架的 SFC 语法

### 6.2 Vue 模式 (推荐有经验的开发者)

1. 在 `plugins/` 下创建目录
2. 初始化 Vue 项目:
   ```bash
   cd plugins/my-plugin
   npm init -y
   npm install vue@3
   npm install -D vite @vitejs/plugin-vue
   ```
3. 创建 `vite.config.js`:
   ```javascript
   import { defineConfig } from 'vite'
   import vue from '@vitejs/plugin-vue'

   export default defineConfig({
     plugins: [vue()],
     base: './',  // 关键：使用相对路径
     build: {
       outDir: '.',       // 输出到当前目录
       emptyOutDir: false, // 不清空目录
       rollupOptions: {
         input: 'index.html',
         output: {
           entryFileNames: 'assets/[name].js',
           chunkFileNames: 'assets/[name].js',
           assetFileNames: 'assets/[name].[ext]'
         }
       }
     }
   })
   ```
4. 创建 `index.html` (Vite 入口)
5. 创建 `src/main.js` 和 `src/App.vue`
6. 开发: `npm run dev` (Vite 开发服务器)
7. 构建: `npm run build` (输出到插件目录)

**优点**: 完整的 Vue 生态、SFC、热更新
**缺点**: 需要构建步骤

### 6.3 快速创建脚本 (未来)

```bash
# 创建 HTML 模式插件
npx huntun create-plugin my-plugin --template html

# 创建 Vue 模式插件
npx huntun create-plugin my-plugin --template vue
```

---

## 七、生命周期钩子

子程序可以通过 PluginSDK 监听生命周期事件：

```javascript
sdk.on('ready', (data) => {
  // 插件已加载，可以初始化
  console.log('Plugin ID:', data.pluginId)
})

sdk.on('activate', () => {
  // 插件窗口从隐藏变为可见
  // 适合恢复定时器、重新连接等
})

sdk.on('deactivate', () => {
  // 插件窗口变为隐藏
  // 适合暂停定时器、断开连接等
})

sdk.on('theme-change', (data) => {
  // 主题变更
  // data.theme: 'dark' | 'light'
  // data.isDarkMode: boolean
})

sdk.on('message', (message) => {
  // 收到其他插件或母程序的消息
})
```

---

## 八、主题适配

### 8.1 深色模式 (默认)

```css
:root {
  --bg-primary: #0a0a0a;
  --bg-secondary: #141414;
  --accent-primary: #00ff88;
  --accent-secondary: #ff0080;
  --accent-tertiary: #00d4ff;
}
```

### 8.2 浅色模式

```css
.light-mode {
  --bg-primary: #FFF8E8;
  --bg-secondary: #FFF3D6;
  --accent-primary: #C3272B;
  --accent-secondary: #cc0066;
  --accent-tertiary: #0099cc;
}
```

### 8.3 自动适配

```javascript
// 监听主题变更
sdk.host.onThemeChange((theme) => {
  document.body.classList.toggle('light-mode', theme === 'light')
})

// 初始化时设置
const currentTheme = sdk.host.getTheme()
document.body.classList.toggle('light-mode', currentTheme === 'light')
```

---

## 九、CRT 扫描线效果

子程序可选择启用 CRT 扫描线效果：

```css
/* 扫描线覆盖层 */
.crt-overlay::before {
  content: '';
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, var(--scanline-opacity, 0.03)) 0px,
    rgba(0, 0, 0, var(--scanline-opacity, 0.03)) 1px,
    transparent 1px,
    transparent 2px
  );
  pointer-events: none;
  z-index: 1000;
}
```

---

## 十、装饰螺丝

子程序可选择添加装饰螺丝：

```css
.deco-screw {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--border-color);
  border-radius: 50%;
  z-index: 1001;
}
.deco-screw::before {
  content: '+';
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  font-size: 6px;
  color: #000;
}
.screw-tl { top: 12px; left: 12px; }
.screw-tr { top: 12px; right: 12px; }
.screw-bl { bottom: 15px; left: 20px; }
.screw-br { bottom: 15px; right: 20px; }
```

---

## 十一、关闭/返回母程序

子程序提供两种方式返回母程序：

### 方式1: 通过 PluginSDK (推荐)

```javascript
// 用户点击关闭按钮
document.getElementById('close-btn').addEventListener('click', () => {
  sdk.window.close()  // 带过渡动画关闭
})
```

### 方式2: 直接关闭窗口

```javascript
// 直接关闭 (无过渡动画)
window.close()
```

### 键盘 Esc 返回

```javascript
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault()
    sdk.window.close()
  }
})
```

---

## 十二、最佳实践

### 12.1 保持轻量

- 子程序应专注于单一功能
- 避免引入大型依赖
- 优化加载速度 (< 100ms)

### 12.2 遵循设计规范

- 使用统一的 CSS 变量
- 保持一致的字体风格
- 遵循复古掌机视觉风格

### 12.3 错误处理

```javascript
try {
  // 插件逻辑
} catch (error) {
  console.error('[MyPlugin] Error:', error)
  sdk.host.notify('操作失败: ' + error.message, 'error')
}
```

### 12.4 数据持久化

```javascript
// 使用 PluginSDK 存储 (推荐，跨进程安全)
await sdk.storage.set('settings', { theme: 'dark' })
const settings = await sdk.storage.get('settings', {})

// 不要使用 localStorage (子程序独立进程，localStorage 不共享)
```

### 12.5 键盘导航

```javascript
document.addEventListener('keydown', (e) => {
  // Esc: 返回母程序
  if (e.key === 'Escape') {
    sdk.window.close()
    return
  }
  
  // WASD → 方向键映射
  let key = e.key
  if (key === 'w' || key === 'W') key = 'ArrowUp'
  if (key === 's' || key === 'S') key = 'ArrowDown'
  if (key === 'a' || key === 'A') key = 'ArrowLeft'
  if (key === 'd' || key === 'D') key = 'ArrowRight'
  if (key === ' ') key = 'Enter'
  
  // 处理导航...
})
```

---

## 十三、调试技巧

### 13.1 开发者工具

子程序运行在独立 BrowserWindow 中，可以：
- 按 `F12` 或 `Ctrl+Shift+I` 打开 DevTools
- 查看控制台日志
- 检查网络请求
- 调试 DOM 结构

### 13.2 日志格式

```javascript
console.log('[MyPlugin] Normal message')
console.warn('[MyPlugin] Warning')
console.error('[MyPlugin] Error:', error)
```

### 13.3 热重载

- HTML 模式: 修改文件后重启母程序
- Vue 模式: `npm run dev` 支持热更新

---

## 十四、发布流程

### 14.1 版本号

遵循语义化版本:
- `1.0.0` → `1.0.1`: Bug 修复
- `1.0.0` → `1.1.0`: 新功能
- `1.0.0` → `2.0.0`: 破坏性变更

### 14.2 插件包

将插件目录打包为 `.zip` 文件:
```
my-plugin-v1.0.0.zip
├── manifest.json
├── index.html
├── styles.css
└── assets/
```

### 14.3 安装方式

将插件目录复制到 `plugins/` 下:
```bash
cp -r my-plugin /path/to/huntunLite/plugins/
```

或解压:
```bash
unzip my-plugin-v1.0.0.zip -d /path/to/huntunLite/plugins/my-plugin/
```

---

## 十五、示例插件

### 15.1 Hello World

**manifest.json**:
```json
{
  "id": "hello-world",
  "name": "HELLO",
  "version": "1.0.0",
  "description": "Hello World 示例",
  "icon": "👋",
  "color": "#00ff88"
}
```

**index.html**:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Hello World</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 100vw; height: 100vh;
      background: var(--bg-secondary, #141414);
      color: var(--text-primary, #e0e0e0);
      display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 20px;
      font-family: 'Press Start 2P', monospace;
    }
    h1 { font-size: 24px; color: var(--accent-primary, #00ff88); }
    button {
      font-family: 'Press Start 2P', monospace;
      font-size: 12px; padding: 12px 24px;
      background: var(--accent-primary, #00ff88);
      color: #000; border: none; border-radius: 8px;
      cursor: pointer;
    }
    button:hover { transform: scale(1.05); }
  </style>
</head>
<body>
  <h1>👋 HELLO</h1>
  <p style="font-size: 10px;">Hello World Plugin</p>
  <button onclick="window.close()">CLOSE</button>
</body>
</html>
```

### 15.2 完整功能插件

参考 `plugins/calculator/` 目录。

---

## 附录 A: CSS 变量完整列表

| 变量名 | 深色值 | 浅色值 | 说明 |
|--------|--------|--------|------|
| `--bg-primary` | `#0a0a0a` | `#FFF8E8` | 主背景 |
| `--bg-secondary` | `#141414` | `#FFF3D6` | 次背景 |
| `--bg-card` | `#1a1a1a` | `#FFF` | 卡片背景 |
| `--accent-primary` | `#00ff88` | `#C3272B` | 主强调 |
| `--accent-secondary` | `#ff0080` | `#cc0066` | 次强调 |
| `--accent-tertiary` | `#00d4ff` | `#0099cc` | 第三强调 |
| `--text-primary` | `#e0e0e0` | `#333` | 主文字 |
| `--text-secondary` | `#aaa` | `#666` | 次文字 |
| `--text-muted` | `#666` | `#999` | 弱化文字 |
| `--border-color` | `#333` | `#d8cbb2` | 边框 |
| `--shadow-color` | `rgba(0,255,136,0.3)` | `rgba(195,39,43,0.3)` | 阴影 |

## 附录 B: 音效列表

| 音效名 | 文件 | 触发场景 |
|--------|------|---------|
| `click` | `click.mp3` | 按钮点击 |
| `change` | `change.mp3` | 主题切换 |
| `OK` | `OK.mp3` | 确认操作 |
| `exit` | `exit.mp3` | 返回/退出 |
| `error` | `error.mp3` | 错误 |
| `bengbeng` | `bengbeng.mp3` | 卡带入仓 |
| `home` | `home.mp3` | 回到主页 |
| `setting` | `setting.mp3` | 设置 |
| `loading` | `loading.mp3` | 加载中 |

---

**文档版本**: 2.0
**最后更新**: 2026-08-26
**适用版本**: Hundun Lite 2.0+
