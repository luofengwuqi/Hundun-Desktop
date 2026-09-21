# 快速开始指南

## 1. 预览原型

直接在浏览器中打开 `huntun-lite-prototype.html` 文件，查看完整的交互效果：

```bash
# Windows
start huntun-lite-prototype.html

# macOS
open huntun-lite-prototype.html

# Linux
xdg-open huntun-lite-prototype.html
```

## 2. 项目安装

### 前置要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- Git

### 安装步骤

```bash
# 克隆项目
git clone <repository-url>
cd huntunLite

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 3. 项目结构

```
huntunLite/
├── huntun-lite-prototype.html    # 前端视觉原型
├── sounds/                       # 音效资源
├── src/                          # 源代码
│   ├── main/                     # Electron 主进程
│   ├── renderer/                 # Vue3 渲染进程
│   └── shared/                   # 共享代码
├── plugins/                      # 插件目录
├── package.json
└── README.md
```

## 4. 开发流程

### 开发模式

```bash
npm run dev
```

这将启动：
- Vite 开发服务器 (热重载)
- Electron 窗口

### 构建生产版本

```bash
# 构建
npm run build

# 打包 Windows 安装程序
npm run build:win
```

## 5. 插件开发

### 创建新插件

1. 在 `plugins/` 目录下创建新文件夹
2. 创建 `manifest.json` 和 `index.html`
3. 重启应用或刷新页面

### 插件示例

查看 `plugins/calculator/`、`plugins/fast-txt/`、`plugins/timer-manager/` 和 `plugins/fast-cmd/` 了解插件结构。

## 6. 自定义主题

### 修改颜色

编辑 `src/renderer/assets/styles/main.css` 中的 CSS 变量：

```css
:root {
  --accent-primary: #00ff88;    /* 主题色 */
  --accent-secondary: #ff0080;  /* 强调色 */
  /* ... */
}
```

### 切换主题

应用内置深色/浅色模式切换，点击左上角的拨动开关即可。

## 7. 音效系统

音效文件位于 `sounds/` 目录：

- `click.mp3` - 点击音效
- `change.mp3` - 切换音效
- `bengbeng.mp3` - 卡带入仓音效
- `OK.mp3` - 确认音效
- `exit.mp3` - 返回音效

## 8. 键盘快捷键

- `ESC` - 关闭弹窗/返回

## 9. 常见问题

### Q: 应用无法启动？

A: 检查：
1. Node.js 版本是否 >= 16
2. 是否已运行 `npm install`
3. 查看控制台错误信息

### Q: 音效无法播放？

A: 确保：
1. `sounds/` 目录存在且包含音效文件
2. 浏览器支持 Audio API
3. 用户已与页面交互（自动播放策略）

### Q: 如何添加新的插件？

A: 参考 `PLUGIN_DEVELOPMENT.md` 文档。

## 10. 下一步

1. 熟悉项目结构
2. 阅读插件开发指南
3. 尝试创建一个简单的插件
4. 参与项目贡献

## 获取帮助

- 查看 `README.md` 了解项目概述
- 查看 `PLUGIN_DEVELOPMENT.md` 了解插件开发
- 提交 Issue 反馈问题

---

**祝你开发愉快！** 🎮
