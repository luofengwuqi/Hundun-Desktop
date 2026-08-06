# 馄饨Lite - 项目进度文档

> 最后更新: 2026-08-06
> 当前阶段: Phase 1 - 前端原型

---

## 📋 项目概述

**馄饨Lite** 是一个高度可扩展的桌面效率应用，采用"母程序+子程序"的插件架构。

| 属性 | 值 |
|------|-----|
| 技术栈 | Electron + Vue3 |
| 窗口尺寸 | 800×600 (固定) |
| 设计风格 | 复古掌机 × 像素艺术 |
| 项目路径 | `E:\code2\huntunLite` |

---

## ✅ 已完成任务

### 1. 前端视觉原型 `huntun-lite-prototype.html`

#### 1.1 界面元素
- [x] 深色/浅色模式切换 (物理拨动开关)
- [x] Switch风格卡带 (128px × 192px)
- [x] 卡带信息栏 (显示悬停卡带名称)
- [x] 卡带插槽 (支持多卡带)
- [x] 装饰螺丝 + CRT扫描线效果

#### 1.2 交互功能
- [x] 卡带拖拽到插槽
- [x] 拖入后自动启动应用
- [x] 点击插槽卡带弹出拔出确认
- [x] 拔出后卡带返回"我的应用"
- [x] 鼠标滚轮水平滚动卡带列表
- [x] 悬停卡带显示名称在信息栏

#### 1.3 样式系统
- [x] CSS变量驱动主题
- [x] 深色模式完整样式
- [x] 浅色模式完整样式
- [x] 拖拽状态高亮效果

#### 1.4 音效系统
- [x] 9个Switch风格音效集成
- [x] 点击、切换、入仓、确认、返回音效

### 2. 项目架构

#### 2.1 目录结构
```
huntunLite/
├── huntun-lite-prototype.html    ✅ 视觉原型
├── sounds/                       ✅ 音效资源 (9个)
├── src/
│   ├── main/                     ✅ Electron主进程
│   │   ├── index.js
│   │   └── preload.js
│   ├── renderer/                 ✅ Vue3渲染进程
│   │   ├── App.vue
│   │   ├── main.js
│   │   ├── index.html
│   │   ├── assets/styles/main.css
│   │   ├── components/
│   │   │   ├── CartridgeCard.vue
│   │   │   └── PluginModal.vue
│   │   ├── stores/
│   │   │   ├── theme.js
│   │   │   └── plugin.js
│   │   ├── router/index.js
│   │   └── utils/audio.js
│   └── shared/
│       └── plugin-loader.js      ✅ 插件加载器
├── plugins/                      ✅ 示例插件
│   ├── timer-manager/
│   └── command-executor/
└── 文档文件
    ├── README.md
    ├── QUICKSTART.md
    ├── PLUGIN_DEVELOPMENT.md
    └── DEVELOPMENT_REPORT.md
```

---

## 🚧 待完成任务

### Phase 2: Electron集成 (优先级: 高)

- [ ] 安装项目依赖 (`npm install`)
- [ ] 配置 electron-vite
- [ ] 实现真正的窗口无边框
- [ ] 实现窗口拖拽移动
- [ ] 测试深色/浅色模式在Electron中的效果

### Phase 3: 插件系统 (优先级: 高)

- [ ] 实现动态插件加载
- [ ] 插件沙箱隔离
- [ ] 插件通信机制
- [ ] 插件生命周期管理
- [ ] 插件配置持久化

### Phase 4: 功能插件 (优先级: 中)

- [ ] 定时任务管理器 (完整功能)
- [ ] 命令执行器 (完整功能)
- [ ] 极客记事本
- [ ] 剪贴板管理器
- [ ] 系统监控
- [ ] 快捷启动器

### Phase 5: 高级特性 (优先级: 低)

- [ ] 插件市场
- [ ] 用户账户系统
- [ ] 云同步
- [ ] 国际化支持
- [ ] 自动更新

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
--bg-primary: #f0f0f0
--bg-secondary: #e0e0e0
--accent-primary: #00aa55
--accent-secondary: #cc0066
--accent-tertiary: #0099cc
```

### 字体规范
- **像素字体**: Press Start 2P (标题、标签)
- **正文字体**: Noto Sans SC (描述、内容)

### 卡带规格
- **尺寸**: 128px × 192px (1:1.5比例)
- **图标区域**: 72px × 72px
- **顶部色条**: 10px
- **底部标签区**: 30% (深色模式) / 21% (浅色模式)

---

## 🔧 技术决策

### 已确定
1. **固定窗口尺寸**: 800×600，不可调整
2. **无边框窗口**: 自定义标题栏
3. **插件架构**: 动态加载，manifest.json规范
4. **音效系统**: 预加载 + 按需播放

### 待定
1. 插件沙箱方案 (iframe vs Web Worker)
2. 插件通信机制 (postMessage vs SharedArrayBuffer)
3. 数据持久化方案 (localStorage vs SQLite)

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

### 分支规范
- `main`: 生产分支
- `dev`: 开发分支
- `feature/*`: 功能分支
- `fix/*`: 修复分支

---

## 🐛 已知问题

### 已修复
- ✅ 浅色模式卡带样式丢失
- ✅ 浅色模式拖拽插槽显示黑色
- ✅ 悬浮提示框被遮挡
- ✅ 浅色模式底部标签区过长

### 待修复
- [ ] Electron中音效可能无法播放 (自动播放策略)
- [ ] 大量卡带时性能优化

---

## 📚 参考资料

### Switch卡带规格
- 高度: 31mm (1.2 in)
- 宽度: 21mm (0.83 in)
- 厚度: 3mm (0.12 in)
- 比例: 约 1.48:1

### 音效文件
```
sounds/
├── bengbeng.mp3    # 卡带入仓
├── change.mp3      # 切换主题
├── click.mp3       # 点击反馈
├── error.mp3       # 错误提示
├── exit.mp3        # 返回操作
├── home.mp3        # 主页
├── loading.mp3     # 加载中
├── OK.mp3          # 确认
└── setting.mp3     # 设置
```

---

## 🎯 下一步行动

### 立即执行
1. 运行 `npm install` 安装依赖
2. 运行 `npm run dev` 测试Electron集成
3. 验证原型在Electron中的显示效果

### 本周目标
1. 完成Electron基础配置
2. 实现真正的窗口控制
3. 开始插件系统开发

---

## 📞 联系方式

如有问题，请查看以下文档：
- `README.md` - 项目概述
- `QUICKSTART.md` - 快速开始
- `PLUGIN_DEVELOPMENT.md` - 插件开发指南

---

**项目状态**: 🟢 原型完成，准备进入开发阶段
