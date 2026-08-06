# 馄饨Lite - 复古掌机效率工具

## 📋 项目概述

馄饨Lite是一个高度可扩展的桌面效率应用，采用"母程序+子程序"的插件架构。用户可以根据需要动态安装和定制各种功能模块。

### 技术栈
- **框架**: Electron + Vue3
- **窗口尺寸**: 800×600 (固定)
- **设计风格**: 复古掌机 × 像素艺术

## 🎨 设计风格指南

### 视觉关键词
- **深色/浅色模式**: 物理拨动开关切换
- **游戏卡带**: 极客像素风 (锯齿边角、8-bit字体、粗糙纹理)
- **复古掌机**: Nintendo Switch 混合 NES 风格

### 颜色系统

#### 深色模式 (默认)
```css
--bg-primary: #0a0a0a
--bg-secondary: #141414
--accent-primary: #00ff88 (霓虹绿)
--accent-secondary: #ff0080 (赛博粉)
--accent-tertiary: #00d4ff (电光蓝)
```

#### 浅色模式
```css
--bg-primary: #f0f0f0
--bg-secondary: #e0e0e0
--accent-primary: #00aa55
--accent-secondary: #cc0066
--accent-tertiary: #0099cc
```

### 字体规范
- **像素字体**: Press Start 2P (标题、标签、ID)
- **正文字体**: Noto Sans SC (描述、内容)

### 特效元素
- CRT 扫描线效果
- 噪点纹理叠加
- 机械卡带插入动画
- 物理拨动开关

## 🎮 核心交互

### 1. 主题切换
- 左上角物理拨动开关
- 左右滑动切换深色/浅色模式
- 带有机械回弹动画

### 2. 卡带系统
- 每个子程序对应一个"游戏卡带"
- 卡带包含: 图标、标题、描述、ID
- 点击触发卡带入仓动画:
  1. 卡带浮起
  2. 水平滑入插槽
  3. 机械按压回弹
  4. 卡带消失
  5. 子程序弹窗出现

### 3. 音效系统
使用 Switch 风格音效:
- `click.mp3` - 点击反馈
- `change.mp3` - 切换主题
- `bengbeng.mp3` - 卡带入仓
- `OK.mp3` - 确认/弹窗
- `exit.mp3` - 返回

## 📁 项目结构

```
huntunLite/
├── huntun-lite-prototype.html    # 前端视觉原型
├── sounds/                       # 音效资源
│   ├── bengbeng.mp3
│   ├── change.mp3
│   ├── click.mp3
│   ├── error.mp3
│   ├── exit.mp3
│   ├── home.mp3
│   ├── loading.mp3
│   ├── OK.mp3
│   └── setting.mp3
├── src/                          # 源代码 (后续)
│   ├── main/                     # Electron 主进程
│   ├── renderer/                 # Vue3 渲染进程
│   │   ├── components/           # 组件
│   │   ├── assets/               # 资源
│   │   └── plugins/              # 子程序插件
│   └── shared/                   # 共享代码
├── plugins/                      # 子程序目录
│   ├── timer-manager/            # 定时任务管理器
│   ├── command-executor/         # 命令执行器
│   └── note-taker/               # 极客记事本
└── package.json
```

## 🔌 插件架构

### 子程序规范

每个子程序是一个独立的目录，包含:

```
plugin-name/
├── manifest.json         # 插件元数据
├── index.html           # 插件界面
├── plugin.js            # 插件逻辑
└── assets/              # 插件资源
```

### manifest.json 示例

```json
{
  "id": "timer-manager",
  "name": "定时任务管理器",
  "version": "1.0.0",
  "description": "管理您的定时任务和提醒",
  "icon": "⏰",
  "author": "馄饨Lite",
  "entry": "index.html",
  "permissions": ["notifications", "alarms"]
}
```

## 🚀 后续开发计划

### 阶段一: 母程序核心
- [x] 前端视觉原型
- [ ] Electron 主进程搭建
- [ ] Vue3 渲染进程初始化
- [ ] 主题系统实现
- [ ] 插件加载器

### 阶段二: 基础子程序
- [ ] 定时任务管理器
- [ ] 命令执行器
- [ ] 极客记事本

### 阶段三: 高级功能
- [ ] 插件市场
- [ ] 插件热更新
- [ ] 用户自定义主题
- [ ] 数据同步

## 📝 开发规范

### 代码风格
- 使用 ESLint + Prettier
- 组件采用 Composition API
- 遵循 Vue3 官方风格指南

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

## 🎯 设计原则

1. **极简主义**: 界面简洁，功能聚焦
2. **一致性**: 所有子程序保持统一的视觉风格
3. **可访问性**: 支持键盘导航和屏幕阅读器
4. **性能优先**: 轻量级实现，快速响应
5. **用户友好**: 直观的操作，清晰的反馈

## 📄 License

MIT License

---

**开发者**: 馄饨Lite Team
**版本**: 1.0.0-alpha
**最后更新**: 2026-08-06
