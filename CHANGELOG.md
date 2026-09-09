# Hundun Lite - 更新日志

> 最后更新: 2026-09-09

---

## 2026-09-09

### 母程序设置页面优化
- [x] 选中状态改为"使用中"标签 (移除边框高亮)
- [x] 声音设置: 音效开关旁显示"使用中"标签
- [x] 主题设置: 选中主题下方显示"使用中"标签
- [x] 语言设置: 将 ✓ 符号改为"使用中"标签
- [x] 插件设置: 运行中的插件显示"使用中"标签
- [x] 键盘Enter键实现: 左侧栏Enter进入右侧栏，右侧栏Enter执行选中项
- [x] 移除所有hover效果
- [x] 移除focus黄色边框 (浏览器默认焦点样式)
- [x] 新增 i18n 翻译: `settings.inUse` (使用中 / IN USE)

---

## 2026-09-08

### FastTXT UI 优化
- [x] 底部按钮键盘导航修复 (ArrowDown 可从空文件列表跳转到底部)
- [x] 修复 `clampSelection` 在文件列表为空时错误重置 `selectedCol` 的问题
- [x] 底部文字字号放大: 7px → 14px
- [x] 字体策略优化: 仅标题保留像素字体 (Press Start 2P)
- [x] 所有内容文本改用普通字体 (Noto Sans SC / Microsoft YaHei)
- [x] 涉及 9 个 CSS 文件共 21 处字体修改

### 多语言支持 (i18n)
- [x] 轻量级 i18n 模块 (无第三方依赖)
- [x] 中文/英文双语支持
- [x] Pinia 响应式 store (`useI18nStore`)
- [x] 支持嵌套键翻译: `t('settings.sound')`
- [x] 支持参数替换: `t('cartridge.alreadyRunningMsg', { name: 'FastTXT' })`
- [x] 自动检测浏览器语言
- [x] 设置持久化到 localStorage
- [x] 设置页面新增语言选择器 (🌐 语言/LANGUAGE 标签)
- [x] App.vue 所有 UI 文本已接入 i18n
- [x] FastTXT 插件双语支持 (68 个翻译字符串)
- [x] FastTXT 独立 i18n 模块 (`plugins/fast-txt/js/i18n.js`)
- [x] FastTXT 所有 JS 文件已接入 i18n (render, file-actions, modes, app-state)
- [x] FastTXT 静态 HTML 文本已接入 i18n

### 母程序设置页面
- [x] 全新设置页面 (复古掌机风格)
- [x] 四个设置分类: 声音、主题、插件、关于
- [x] 声音设置: 开关、音量滑块、测试按钮
- [x] 主题设置: 深色/浅色模式切换 (可视化预览)
- [x] 插件列表: 显示已安装插件及状态
- [x] 关于页面: 版本信息、技术栈
- [x] 键盘导航: 左右箭头切换标签页，ESC返回
- [x] 设置持久化: localStorage 存储

### FastTXT 编辑器快捷键
- [x] Ctrl+X: 剪切当前行 (有选中文本时仅剪切选中部分)
- [x] Ctrl+D: 复制当前行并粘贴到下一行 (有选中文本时复制选中部分)
- [x] Ctrl+Z: 撤销 (最多100步)
- [x] Ctrl+Y: 重做
- [x] 修复: Ctrl+D 在文件末尾时重复文本被粘贴到同一行而非下一行

### FastTXT 主题切换功能
- [x] 添加物理拨动开关切换深色/浅色模式 (模仿母程序样式)
- [x] 主视图和编辑器视图均显示主题切换开关
- [x] 主题选择持久化到localStorage (`fasttxt-theme`)
- [x] 本地无设置时自动同步母程序主题

### FastTXT 书签/断点功能
- [x] 行号点击添加/移除书签 (浅红色圆球标记, 模仿编译器断点)
- [x] 书签持久化存储 (`.bookmarks.json`, 按文件路径分组)
- [x] 打开文件时自动跳转到第一个书签位置
- [x] 打开文件时强制重建行号DOM + 清除缓存行高, 确保书签状态正确渲染
- [x] 修复: `BOOKMARKS_FILE` 常量缺失导致保存/加载静默失败
- [x] 修复: `focus()` 滚动到光标末尾覆盖书签跳转, 改为 focus 后再 scrollTop

---

## 2026-09-07

### FastTXT 删除/恢复逻辑简化
- [x] 回收站改为**平铺方案**: 删除文件一律移入 `.trash/`, 不再保留原文件夹归属/路径
- [x] 删除文件夹 → 不再整目录入回收站: 遍历内部所有文件(含子目录, 递归)逐个平铺入 `.trash/`, 搬空后删除文件夹树; 空文件夹直接物理删除
- [x] 恢复 → 一律回到 `file/` 根目录 (不再还原到原文件夹)
- [x] 防重名规则统一: `file → file1 → file11 → file111...` (删入回收站 & 恢复到根目录均适用, 绝不覆盖现有文件)
- [x] 级联删除文件夹前二次核对无残留文件, 避免确认期间新文件被误删
- [x] 磁盘改名类操作串行队列 runFsOp (快速连按 Delete 也不并发改名)
- [x] 公共收尾 finalizeFsChange (读盘→保存排序→音效→刷新) 统一删除/恢复/粉碎
- [x] 移除回收站清单 `.trash.json` 全部读写逻辑 (旧清单文件保留但自动忽略; 旧文件夹型回收项兼容: 仍可整体恢复到根目录)

### FastTXT 可靠性修复
- [x] 回收站改用**清单方案**: `.trash/.trash.json` 记录每个删除项的原路径/原名/类型
- [x] 删除文件保留**文件夹归属**: 恢复时移回原位置 (不再一律回根目录)
- [x] 回收站磁盘名**唯一化**: 同名文件再删除自动追加序号 (xxx → xxx1 → xxx2)
- [x] 文件夹删除语义: 空文件夹直接删; 非空弹警告 → 确认后整体级联入回收站, 恢复时整体还原子内容
- [x] 删除操作改为完整 await + 删除后重新读盘 (修复内存与磁盘脱节)
- [x] 新建重名检测改为**循环检测** (getUniqueName 遇 xxx1 已存在继续 xxx2...)
- [x] 行号渲染优化: **增量增删** DOM 节点, 打字不重建; 行高变化(缩放)才全量更新
- [x] 状态栏字数统计**防抖** (200ms), 避免大文件每次击键全量 split
- [x] openFolder fallback 兼容 main.html 入口
- [x] 修复逻辑通过内存文件系统冒烟测试 (删除/恢复/重名/级联/粉碎 全流程)
- [x] 存储文档更新: STORAGE.md 记录 .trash/.trash.json 结构与旧数据兼容说明

### FastTXT 架构拆分
- [x] 将单文件 index.html (3160行) 拆分为多文件架构，便于维护
- [x] 入口改为 main.html，manifest.json entry 同步更新
- [x] CSS 拆分为 11 个文件 (css/ 目录)，按功能模块划分
- [x] JS 拆分为 15 个文件 (js/ 目录)，严格保持原执行顺序
- [x] 保留原 index.html 作为备份（新入口已切换为 main.html）

### FastTXT Bug修复
- [x] 修复行号列可被鼠标滚轮单独滚动导致与编辑器错位的bug (wheel事件拦截 + 转发至textarea)

---

## 2026-09-06

### FastTXT 优化
- [x] 拖入文件导入后自动删除原始文件 (通过 Electron file.path + Node.js fs.unlinkSync)
- [x] 插件音效修复 — 插件直接用绝对路径 `new Audio('file:///...')` 播放音效，不依赖主窗口 IPC 转发

---

## 2026-09-03

### FastTXT 优化
- [x] 文件重命名 UI — M 键 + 卡片选中时显示 ✎ 按钮
- [x] 重命名交互：像素风 input 覆盖文件名 / Enter 确认 / Esc 取消 / Tab 下一个
- [x] 重名检测 + 空名保护 + 文件夹暂不支持重命名
- [x] 编辑器默认字号 13px → 16px
- [x] 数据持久化修复 — beforeunload 同步保存 (fasttxt:writeFileSync IPC)
- [x] openFile 始终从磁盘读取最新内容 + 立即写入 textarea (修复异步时序导致空内容覆盖)

---

## 2026-09-02

### FastTXT 优化
- [x] 搜索框聚焦时文件列表取消高亮 (isSearchFocused 条件判断)
- [x] 拖拽排序后强制重建DOM，修复排序后显示错位
- [x] 行号与编辑器行高对齐 (line-height 统一为 23.4px 绝对值)
- [x] Ctrl+滚轮缩放字体 (范围 8px~32px，行号行高同步)
- [x] 编辑器 X轴 overflow:hidden / Y轴 overflow:auto
- [x] 行号跟随textarea滚动同步 (scroll事件监听)
- [x] 文件夹按钮改为打开系统文件资源管理器 (openFolder)
- [x] 新建文件/文件夹重名检测 (自动拼接 "1" 后缀)
- [x] 编辑器标题显示实际文件名 + 文件类型图标

---

## 2026-08-28

### 插件架构迁移
- [x] 重构为 BrowserWindow 独立进程架构
- [x] plugin-preload.js 兼容 contextIsolation: false
- [x] App.vue 改用 IPC 启动插件 (移除硬编码 Vue 组件)
- [x] themeRequestSender 路由修复 (theme:get → 正确窗口)
- [x] playSound 路由 (plugin → 主进程 → 主窗口)
- [x] transition.html 跨窗口加载蒙版

### Calculator 计算器插件
- [x] 1:1 移植 CalculatorApp.vue → plugins/calculator/index.html
- [x] manifest.json 配置
- [x] BrowserWindow 独立运行验证

### FastTXT 文本管理器插件
- [x] 1:1 移植 FastTXTApp.vue → plugins/fast-txt/index.html
- [x] 布局修复 (#view-main, #view-editor 填充 flex 容器)
- [x] BrowserWindow 独立运行验证
- [x] 文件存储改造: localStorage → 真实磁盘文件
- [x] 数据目录: `plugins/fast-txt/file/` (随安装位置动态变化，不硬编码)
- [x] 隐藏文件: `.order.json` (排序), `.trash/` (回收站)
- [x] 文件夹图标: 📁文件夹 / 📝.md / 📄.txt
- [x] 文件夹模式: 点击文件夹进入内部视图，面包屑导航 + 返回按钮
- [x] 文件夹模式与垃圾桶模式互斥切换
- [x] 文件夹内创建/导入/删除文件使用完整子路径
- [x] 磁盘操作: loadFilesFromDisk 递归读取文件夹内容，parentPath 记录归属
- [x] 存储文档: `plugins/fast-txt/STORAGE.md`
- [x] UI: 去除 hover 效果，点击选中再点击打开交互

### 插件开发规范
- [x] PLUGIN_SPEC.md v2.0 (781行完整规范)
- [x] Architecture / 生命周期 / 通信 / Manifest / SDK 文档

---

## 2026-08-25

### 计算器子程序
- [x] 复古掌机风格像素计算器
- [x] 显示屏: 表达式行 + 大号霓虹发光结果 + POCKET CALC 品牌 + READY/ERROR 状态灯
- [x] 20键网格: AC/⌫/%/运算符/±/=，像素硬阴影 + 按下物理下沉效果
- [x] 数字滚动过渡动画 (Transition + key)
- [x] 按键 staggered 入场动画
- [x] 等号键实心霓虹填充 (深色: 绿 / 浅色: 朱红)
- [x] 深浅色主题自动适配 (CSS 变量)
- [x] CRT 扫描线 + 装饰螺丝
- [x] 标准四则运算 (连续运算、等号)
- [x] 百分比、正负号、退格、AC 清空
- [x] 键盘支持 (数字键、`+-*/`.`、Enter/Backspace、C)
- [x] 统一 click 音效 (所有按键)
- [x] 错误处理 (除零 → ERROR + 红色闪烁 + error 音效)
- [x] 精度处理 (10位有效数字、浮点误差修剪、超长科学计数法)

### FastTXT 文本文件管理器
- [x] 复古掌机风格文本文件管理器
- [x] 三列网格文件列表 (水平卡片布局: 图标 + 文件名)
- [x] 搜索框 (浮动右上角，像素字体输入框)
- [x] 底部按钮栏: +新建 / 🗑️回收站 / 📁文件夹 / ⚙粉碎机 (条件显示)
- [x] CRT 扫描线 + 装饰螺丝
- [x] 新建菜单弹窗: .txt文件 / .md文件 / 文件夹
- [x] 拖放导入 (.txt/.md 文件从外部拖入)
- [x] 文件拖拽排序 + 拖到垃圾桶删除
- [x] 回收站系统 (软删除 → 列表显示已删除文件)
- [x] 粉碎机系统 (物理删除回收站中所有文件)
- [x] 恢复文件 (回收站中点击恢复)
- [x] 全屏文本编辑器 (行号显示 + 行高亮)
- [x] 自动保存 (编辑后返回自动保存到 localStorage)
- [x] Esc 退出编辑器 (stopImmediatePropagation 阻止父组件捕获)
- [x] 键盘导航 (模仿主页面)
- [x] localStorage 持久化 (文件列表、排序)
- [x] 默认文件 (readme.txt, notes.md, draft.txt)

---

## 2026-08-16

### UI交互优化
- [x] 弹窗支持两种尺寸：normal / large
- [x] 按钮支持键盘导航 (WASD/方向键选中，空格/回车执行)
- [x] 按钮支持鼠标操作 (第一次点击选中，第二次点击执行)
- [x] 按钮字体增大 (18px)
- [x] 按钮padding优化 (10px 18px)
- [x] 弹窗高度扩大 (large模式)
- [x] 按钮顺序调整：继续使用 → 拔出卡带 → 取消
- [x] "继续使用"按钮功能实现：切换到运行中的子程序视图
- [x] Esc键逻辑完善
- [x] 窗口切换动画优化
- [x] 修复 `contextIsolation: false` 时 `window.electronAPI` 不可用的问题
- [x] 改用 `require('electron').ipcRenderer` 直接通信
- [x] 子程序模式下 `.console` 自适应窗口大小 (child-mode)
- [x] 子程序模式下去掉圆角边框
- [x] LoadingMask 支持 childMode 参数适配无圆角
- [x] 窗口大小渐变动画 (时间戳驱动 easeInOut 缓动，约400ms)
- [x] Loading动画时间翻倍 (entering/exit: 900ms, visible: 1200ms)
- [x] 窗口缩放改为**中心基准** (四边对称缩放，非左上角)
- [x] 时间戳驱动动画 (消除 setTimeout 延迟漂移)
- [x] 防重入 token 机制 (快速切换不冲突)

---

## 2026-08-06

### 前端视觉原型
- [x] 深色/浅色模式切换 (物理拨动开关)
- [x] Switch风格卡带 (128px × 192px)
- [x] 卡带信息栏 (显示选中项名称)
- [x] 卡带插槽 (单卡带，等比例缩放)
- [x] 装饰螺丝 + CRT扫描线效果
- [x] 底部按钮组 (+添加、⚙设置)
- [x] 卡带拖拽到插槽
- [x] 拖入后自动启动应用
- [x] 点击插槽弹窗显示运行中应用
- [x] 拔出后卡带返回列表
- [x] 鼠标滚轮水平滚动卡带列表
- [x] 鼠标点击选中卡带/按钮
- [x] 键盘WASD/方向键操控
- [x] 键盘Enter/空格执行操作
- [x] CSS变量驱动主题
- [x] 深色模式完整样式
- [x] 浅色模式完整样式 (#FFF8E8暖色调)
- [x] 选中态高亮效果
- [x] 9个Switch风格音效集成
