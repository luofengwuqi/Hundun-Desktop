# 插件开发指南

## 概述

Hundun Lite采用插件化架构，允许用户动态加载和使用各种功能模块。本指南将帮助开发者创建自己的插件。

## 插件结构

每个插件是一个独立的目录，包含以下文件：

### 单文件架构（推荐简单插件）

```
my-plugin/
├── manifest.json         # 插件元数据 (必须)
├── index.html           # 插件界面 (推荐)
├── index.js             # 插件逻辑 (可选)
├── styles.css           # 样式文件 (可选)
└── assets/              # 插件资源
    ├── icon.png         # 插件图标
    └── ...
```

### 多文件架构（推荐复杂插件）

对于较复杂的插件（如 FastTXT），建议拆分为多个文件便于维护：

```
my-plugin/
├── manifest.json        # 插件元数据
├── main.html            # 入口页面 (引用外部 css/js)
├── css/                 # 样式文件夹
│   ├── base.css         # 基础样式
│   ├── components.css   # 组件样式
│   └── ...
├── js/                  # 脚本文件夹
│   ├── sdk.js           # SDK 相关
│   ├── state.js         # 状态管理
│   ├── render.js        # 渲染逻辑
│   ├── events.js        # 事件绑定
│   └── init.js          # 初始化入口
└── assets/              # 插件资源
```

> **多文件架构要点：**
> - 入口文件通过 `manifest.json` 的 `entry` 字段指定
> - JS 文件按顺序加载（参考 FastTXT 的 js/ 目录）
> - CSS 文件通过 `<link>` 标签引入
> - 保持文件职责单一，便于后续维护

## manifest.json 规范

```json
{
  "id": "my-plugin",
  "name": "我的插件",
  "version": "1.0.0",
  "description": "插件描述",
  "icon": "🎮",
  "author": "作者名称",
  "entry": "index.html",
  "permissions": ["storage", "notifications"],
  "minAppVersion": "1.0.0",
  "settings": {
    "key": "value"
  }
}
```

### 必需字段

| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 插件唯一标识符 |
| name | string | 插件显示名称 |
| version | string | 语义化版本号 (x.y.z) |

### 可选字段

| 字段 | 类型 | 描述 |
|------|------|------|
| description | string | 插件描述 |
| icon | string | 插件图标 (emoji) |
| author | string | 作者名称 |
| entry | string | 入口文件 (默认: index.html) |
| permissions | array | 所需权限 |
| minAppVersion | string | 最低应用版本 |
| settings | object | 插件配置项 |

## 权限列表

| 权限 | 描述 |
|------|------|
| storage | 访问本地存储 |
| notifications | 发送系统通知 |
| shell | 执行系统命令 |
| filesystem | 访问文件系统 |
| network | 网络请求 |
| clipboard | 剪贴板访问 |

## 创建插件

### 1. 基本结构

创建一个新目录，命名为你的插件ID：

```bash
mkdir my-plugin
cd my-plugin
```

### 2. 创建 manifest.json

```json
{
  "id": "my-plugin",
  "name": "我的插件",
  "version": "1.0.0",
  "description": "这是一个示例插件",
  "icon": "🎮",
  "author": "开发者",
  "entry": "index.html"
}
```

### 3. 创建界面

创建 `index.html` 文件：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>我的插件</title>
  <style>
    body {
      font-family: 'Noto Sans SC', sans-serif;
      background: #1a1a1a;
      color: #e0e0e0;
      padding: 20px;
    }
    
    h1 {
      font-family: 'Press Start 2P', cursive;
      font-size: 14px;
      color: #00ff88;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <h1>🎮 我的插件</h1>
  <p>这是一个示例插件界面。</p>
  
  <script>
    // 插件逻辑
    console.log('Plugin loaded!')
  </script>
</body>
</html>
```

### 4. 添加到Hundun Lite

将插件目录复制到 `plugins/` 目录下：

```bash
cp -r my-plugin /path/to/huntunLite/plugins/
```

## 插件 API

### 全局对象

插件可以访问以下全局对象：

```javascript
// 应用信息
window.electronAPI

// Node.js 信息
window.nodeInfo

// 存储
window.localStorage
```

### 事件系统

插件可以监听和触发事件：

```javascript
// 监听事件
window.addEventListener('plugin-message', (event) => {
  console.log(event.detail)
})

// 发送事件
window.dispatchEvent(new CustomEvent('host-message', {
  detail: { type: 'update', data: {} }
}))
```

## 最佳实践

### 1. 保持轻量

- 插件应该专注于单一功能
- 避免引入大型依赖
- 优化加载速度

### 2. 遵循设计规范

- 使用统一的颜色变量
- 保持一致的字体风格
- 遵循复古像素艺术风格

### 3. 错误处理

```javascript
try {
  // 插件逻辑
} catch (error) {
  console.error('Plugin error:', error)
  // 显示用户友好的错误信息
}
```

### 4. 数据持久化

```javascript
// 保存数据
localStorage.setItem('my-plugin-data', JSON.stringify(data))

// 读取数据
const data = JSON.parse(localStorage.getItem('my-plugin-data') || '{}')
```

## 调试技巧

### 1. 使用控制台

打开开发者工具查看插件日志：

```javascript
console.log('调试信息')
console.error('错误信息')
```

### 2. 热重载

修改插件文件后，重启Hundun Lite即可看到变化。

### 3. 错误追踪

在插件中添加错误处理：

```javascript
window.onerror = function(msg, url, line) {
  console.error(`Error: ${msg} at ${url}:${line}`)
  return false
}
```

## 示例插件

参考 `plugins/` 目录下的示例插件：

- `calculator` - 计算器
- `fast-txt` - 文本管理器
- `timer-manager` - 定时任务管理器
- `fast-cmd` - 脚本管理器

## 常见问题

### Q: 插件无法加载？

A: 检查以下几点：
1. manifest.json 格式是否正确
2. 入口文件是否存在
3. 是否有语法错误

### Q: 如何访问系统资源？

A: 插件运行在浏览器环境中，无法直接访问系统资源。需要通过Hundun Lite提供的API。

### Q: 如何更新插件？

A: 直接替换插件目录中的文件，重启应用即可。

## 贡献

欢迎提交插件到Hundun Lite插件市场！

1. Fork 项目
2. 创建插件
3. 提交 PR
4. 等待审核

## 许可证

插件开发遵循 MIT 许可证。
