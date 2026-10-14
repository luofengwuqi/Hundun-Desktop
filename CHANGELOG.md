# Hundun Lite - 更新日志

> 最后更新: 2026-10-14

---

## 2026-10-14

### TASK 子程序: timer-manager 全量重构为任务清单 (旧进度不保留, 程序名更改为 TASK)
- [x] **需求**: 原 Timer 定时任务占位插件整体废弃重写 → `plugins/task/` (id `task`, 显示名 `TASK`); 帮助用户记录任务内容/完成情况并提供必要提醒
- [x] **外观 (复古掌机风格, 与 fast-cmd 同构)**:
  - 纵向矩形窗口 400×520 (`manifest.windowSize`, 启动时居中为 420×540); 共享 header: 深/浅拨动开关 + 📋 **TASK** 高亮像素标题 (Press Start 2P + 辉光, 仿 FastCmd logo) + 📌 置顶 + ✕
  - 中部任务卡片**纵向排列、一行一任务**, y 轴溢出时主体滚动 (细滚动条); 底部按钮群 `+` (新建) / `🧹` (清理已完成) + 计数 (`N 个任务 · M 已完成`)
  - 卡片: 任务名左 / **状态徽章右 (未完成·已过期·已完成)** / ✎ 编辑键; 次行 meta 显示截止时间与提醒数; 已完成名称删除线弱化, 已过期徽章脉冲动画; 名称超长省略号
- [x] **功能**:
  - 2.0 深色/浅色互换 (localStorage `task-theme` + 母程序主题跟随) + 键盘控制 (WASD/方向键导航列表与按钮行, Enter 切换完成/执行按钮, E 编辑, Delete 删除, Esc 返回; 表单内不劫持输入, Esc 取消, 输入框回车保存; 弹窗内方向键+Enter 走 fast-cmd 同款导航)
  - 2.1 底部 `+` → **创建表单视图 (与子程序等大, 同窗口切换)**: 任务名 (空 → 自动 `task+最小未占用数字`)、提醒时间 (可多个, 增删行)、提醒方式 (提醒时间非空才可填, 默认"弹窗提醒", 其他方式待补充)、截止时间 (可空, **到期自动变已过期**); 保存/取消, 改后取消有放弃确认
  - 2.2 卡片 ✎ → 同款表单预填编辑 + **删除** (确认弹窗); 状态徽章点击切换 未完成↔已完成; `🧹` 批量清理已完成 (确认弹窗)
  - 排序: **未完成且截止近的优先 > 未完成 > 已过期 > 已完成** (无截止的未完成排该组末尾; 过期按最近过期在前; 完成按最近完成在前)
  - 提醒引擎: 1s tick; 窗口可见 → 应用内弹窗 + bengbeng 音效, 隐藏 → HTML5 Notification 系统通知; `fired[]` 持久化防重启重弹, 到点 >2min 视为错过静默补记, 已完成任务的提醒抑制
- [x] **架构 — 持久化审核: SQLite 不合适, 采用 `hundun.storage` JSON (决策43)**: ①`build.files` 排除 node_modules → 原生模块无法随包分发; ②决策8 规避原生编译 (electron-rebuild/ABI); ③插件层无 DB 通道, 新增主进程依赖违背零第三方依赖原则; ④百行级单写入数据 JSON 原子写 (tmp+rename/防抖/退出 flush) 已覆盖 SQLite 收益。单键 `tasks={version,tasks:[...]}` → `userData/huntun-lite-data/task.json`, localStorage 镜像兜底; 状态/排序语义见决策44; 附带修复 `__PLUGIN_ID__` 注入竞态 (did-finish-load 晚于 DOMContentLoaded → init 从入口路径解析兜底, 避免写 null.json)
- [x] **表单排版优化 (2026-10-14 二次迭代)**: 纵向堆叠标签/输入改为**行式面板排版** — 左列「像素序号章 01/02/03 (Press Start 2P) + 标签」, 右列控件, 行间虚线分隔, 提醒方式以 `└` 子行附着于提醒时间 (无分隔线); 聚焦任一控件整行序号点亮; 添加提醒改左对齐虚线空槽按钮, 提醒方式改紧凑宽度 (非通栏); 清除/移除钮与输入等高贴合; 输入启用 tabular-nums (时间不跳字) + accent caret + accent 选区; header 标题旁新增 NEW/EDIT 像素徽章; 底部新增像素键帽提示 `Esc 取消 · Enter 保存` (i18n); 行入场 40ms 阶梯微动画; 标签列 96px 防中英文截断
- [x] **配套**: 母程序 `stores/plugin.js` DEFAULT_PLUGINS 的 timer-manager 条目替换为 task (400×520); README / QUICKSTART / PLUGIN_DEVELOPMENT 引用同步
- [x] **测试**:
  - 新增 `scripts/test-task-preload.js` (mock hundun.storage 落盘 + Notification 打桩 + document.hidden 强制隐藏) 与 `scripts/test-task.js` (Electron 冒烟): 空态/自动命名/状态计算/排序/徽章切换/编辑预填与保存/表单内删除/提醒触发与错过静默补记/提醒方式门槛/放弃确认/表单等大/持久化重载存活/全套键盘导航 → **64/64 通过** (连跑两次稳定)
  - `scripts/test-window-lifecycle.js` 新增 I 节 (真实 plugin-preload + 真实 storage IPC 启动 task, 窗口尺寸 420×540, `task.json` 落盘): **32/32 通过**; 测试 userData 改为临时目录隔离
  - 回归: `npm run build` 通过, `test-platform-support` 21/21

---

## 2026-10-13

### FastCmd 平台感知: 打开前检查系统状态 (Windows / Linux) + 不支持的脚本文件不显示
- [x] **需求**: 用户系统各异, FastCmd 被打开前要主动检查系统状态 (先支持 Windows 与 Linux); 当前系统不支持的脚本文件不显示
- [x] **主进程层 — 打开前拦截** (母程序弹提示, 窗口不创建):
  - `manifest.json` 新增可选字段 `"platforms": ["win32", "linux"]`; 新建 `src/main/platform-support.js` (零依赖): `checkPlatformSupport()` 打开前校验 + `validatePlatformsField()` 安装器校验 + `describePlatform()` 系统名映射; 字段缺失/非法 = 不限制 (兼容历史插件, 从宽)
  - `plugin-manager.js startPlugin()` 在创建 BrowserWindow **之前**抛出友好错误 → `launchPluginWithTransition` 转 `{success:false,error}` → App.vue 母程序弹「不支持当前系统」提示; 拦截发生在藏母窗口之前, 母程序保持可见
  - `plugin-installer.js validateManifest()` 校验 `platforms` 格式 (非空字符串数组, 仅允许 win32/darwin/linux); `electron.vite.config.js` copyMainModules 补复制 `platform-support.js`
- [x] **插件层 — 平台感知与过滤** (`js/platform.js` 新模块, app-state 之前加载):
  - 后缀随系统而定: **win32 = .bat .cmd .ps1 / linux = .sh / 其余系统 = 不支持**; 支持 `FASTCMD_PLATFORM` 环境变量覆盖 (测试在 Linux 上回归 Windows 链路)
  - **不支持的脚本文件不显示**: `loadFilesFromDisk` 根目录与回收站均按 `isScriptFile` 过滤; 拖拽导入同过滤; 支持后缀为空数组时列表全空
  - 默认脚本按平台生成 (Windows: hello.bat+hello.ps1 / Linux: hello.sh); CREATE NEW 菜单改为按平台**动态渲染** (Linux 只有 .sh 项, `createFile('bat')` 被平台守卫拒绝, 静态 HTML 按钮移除); 文件图标经 `iconFor()` (.sh → 🖥️); 空态提示的拖拽后缀列表 i18n 参数化
  - **插件内二次检查**: 不支持的系统 (如 macOS) 显示「当前系统不受支持」空态, 底部按钮/投放区全隐藏 (`getFooterButtons` 返回 [])
- [x] **Linux 真实执行 .sh** (`executor.js` 按平台分发 `executeScript`):
  - Windows 分支保持原链路 (cmd wrapper + `start /wait` 可见控制台 + 退出码文件 + ensurePs1Bom) 不变
  - Linux 分支: 每次运行生成独立 POSIX sh wrapper (路径内联规避终端 CLI 引号差异; cd 脚本目录; 有执行位直接执行尊重 shebang, 否则 sh 执行; 退出码写文件); **优先探测终端模拟器** (gnome-terminal --wait / konsole / xfce4-terminal / tilix / kitty / alacritty / terminator / xterm / urxvt / x-terminal-emulator) 开可见窗口跑脚本并轮询退出码文件 (300ms, 30 分钟 running 兜底); 无终端/终端启动失败/终端退出无退出码 → 回退后台直跑 wrapper 取子进程退出码 (输出不可见, 与 Windows stdio:ignore 语义对齐)
- [x] **附带修复**: `renderFileList` 空列表分支原本走 `sameSet` 快路径导致**初始空列表不渲染空态** (卡片 0 === 列表 0 视为"没变") → 空列表一律重建, 顺带修复回收站↔根目录空态文案不随模式切换更新
- [x] **测试**:
  - 新增 `scripts/test-platform-support.js` (plain node): **21/21 通过** (拦截/放行/从宽/字段校验/fast-cmd manifest 实测)
  - 新增 `scripts/test-fastcmd-platform.js` (Electron 冒烟, Linux 模式 + 切 darwin 重载): **32/32 通过** — 默认 hello.sh / .bat .txt 不显示 / 新建菜单仅 .sh / createFile 守卫 / .sh 真实执行 marker 落盘 / 退出码 7 toast / darwin 空态「当前系统不受支持」
  - `scripts/test-window-lifecycle.js` 新增 H 节 (篡改 manifest.platforms=['sunos'] → launch 拦截): **23/23 通过**
  - `scripts/test-fastcmd-exec.js` 顶部固定 `FASTCMD_PLATFORM=win32` (Windows 链路回归语义不变): Linux 冒烟 **19/28**, 与改动前基线一致 (9 个失败均为需 Windows cmd.exe 的执行类)
  - 回归: `npm run build` 通过, `out/main/platform-support.js` 复制落盘可加载

---

## 2026-10-12

### FastCmd 交互简化: 点击脚本即运行 / 移除编辑功能 / 移除文件夹 (单级目录)
- [x] **需求**: ①移除编辑功能; ②移除点击脚本后的操作弹窗, 点击脚本直接运行并以 toast 反馈成功/失败; ③移除添加文件夹功能, 脚本只存在一级目录
- [x] **点击即运行** (`file-actions.js handleFileClick`):
  - 点击脚本卡 → 选中高亮 + **立即 `runScript()`** (不再有"先选中再点击执行"两段式, 也不再弹操作弹窗)
  - 结果反馈: 启动 toast「🚀 已启动」→ 脚本结束后替换为「✅ 运行成功」/「⚠️ 退出码 N」/「❌ 启动失败」(新增 i18n `toast.scriptSuccess` 中英文)
  - 回收站条目保持两段式 (再次点击已选中项才恢复); 非脚本扩展名文件 (外部放入的杂项) 点击不执行 (`isScriptFile` 守卫)
  - 键盘 Enter 同步改为直接 `runScript()` (原 `showScriptActionModal`)
  - **移除双击重命名**: 双击会先触发两次"点击即运行" (脚本被执行两遍再进重命名), 重命名入口保留 ✎ 按钮与 M 键
- [x] **移除编辑功能**:
  - 删除 `showScriptActionModal` / `editScript` / `openInSystemEditor` / `getScriptInfo`; i18n 清理 `file.run/edit`、`modal.run/edit/runConfirm/editConfirm`、`toast.editorOpen`
- [x] **移除文件夹 (单级目录)**:
  - CREATE NEW 菜单移除「Folder」项 (只剩 .bat / .ps1), `createFolder` 删除
  - 磁盘扫描 (`loadFilesFromDisk`) 跳过目录: 根目录与回收站均只收文件, 子目录内容不进列表; 移除 `parentPath` / `isFolderMode` / `currentFolderPath` / 面包屑导航 (DOM + 样式 + i18n 全清)
  - 删除 `enterFolder` / `exitFolderMode` / `deleteFolderToTrash` / `collectFolderFiles` / `performFolderDelete`; 路径一律根目录 (`getRelPath` 删除, 直接用 `file.name`)
  - 底部 📁 按钮保留 (语义是"在文件管理器中打开", 非"新建文件夹")
  - i18n 清理 `breadcrumb.*`、`empty.folder`、`footer.inFolder`、`create.folder`、`modal.deleteFolder*` / `deleteFailed` / `deleteCannotFolder` / `deleteIncomplete*`
- [x] **测试** (`scripts/test-fastcmd-exec.js`): 用例 4 中文+空格路径改根目录 `中文 脚本.bat` (原子目录路径不再列出); 用例 8 改为"单级目录"断言 (根目录文件夹/子目录脚本均不出现在列表, `createFolder` 已移除, 面包屑 DOM 不存在); 用例 9 改为"点击即运行"断言 (`showScriptActionModal` / `openInSystemEditor` 已移除, 点击后 toast 含脚本名 + marker 重新落盘 + 不弹操作弹窗)
- [x] 回归: 本机 (Linux, 无 cmd.exe) 冒烟 **19/28 通过** — 全部非执行类断言通过; 9 个失败均为"脚本真实执行"类断言 (需 Windows `cmd.exe`, 与改动前基线一致, 基线 HEAD 为 15/23 同因失败); `npm run build` 通过; **执行类断言需在 Windows 上复跑确认**

---

## 2026-10-07

### FastCmd 执行 .ps1 报"表达式或语句中包含意外的标记" (中文脚本编码)
- [x] **用户报告 Bug**: 运行中文 .ps1 (如 `修复 - opencode - 一类 npm 包损坏.ps1`) 报一串 `表达式或语句中包含意外的标记 ")"` / `"{"` 解析错误, 脚本内容显示为乱码 (`鋍？${pkgName}：鏈◆...`)
- [x] **根因**: 脚本文件是 **UTF-8 无 BOM**, 而 Windows PowerShell 5.1 `-File` 在无 BOM 时按系统 ANSI(GBK) 解码 — UTF-8 中文字节被按 GBK 解释 → 乱码 + 引号配对被破坏 → 解析错误 (路径与启动链均正常, 纯编码问题; GBK 文件与纯 ASCII 文件不受影响)
- [x] **修复 — `executor.js` 新增 `ensurePs1Bom(absPath)`** (`executeScript` 入口调用):
  - 无 BOM + 含非 ASCII + 严格 UTF-8 校验通过 → **就地补 3 字节 UTF-8 BOM** (字符内容不变, 一次性, 编辑器后续保存带 BOM 不会重复处理)
  - 纯 ASCII (两种编码等价) / 已有 UTF-8·UTF-16 BOM / 非 UTF-8 (GBK 文件 PS 按 ANSI 读本就正确) → 不动
  - 选**就地补 BOM** 而非临时副本: 保留 `$PSScriptRoot` / `$MyInvocation` / 自引用路径语义; 写入失败 (只读/被占用) best effort, 不阻断执行
- [x] **测试**: `scripts/test-fastcmd-exec.js` 新增 5b 用例 → **23/23 通过**: 中文+emoji 无 BOM ps1 真实执行 / marker 中文未乱码 (证明 PS 按 UTF-8 读) / 执行后已补 BOM / 纯 ASCII ps1 不被补 BOM
- [x] 回归: `npm run build` 通过

---

## 2026-10-04

### FastCmd 脚本执行 Bug: 脚本从未被真实执行
- [x] **用户报告 Bug**: FastCmd 点"运行"弹「🚀 脚本已启动」但脚本实际从未执行
- [x] **根因**: `runScript()` 把**相对路径**传给 `executeScript()` —— `spawn('cmd.exe', ['/c', relPath], { cwd: dirname(relPath) })` 中 `dirname('a.bat')` = `'.'`, cwd 变成渲染进程目录 (项目根/exe 根), 脚本不在那里 → `cmd.exe` 秒退 (exit 1); 且 `spawn` 的失败是**异步 error 事件**, `try/catch` 抓不到 → 照样 `return true` → 假成功 toast
- [x] **连带同源 Bug**: `getScriptInfo()` 相对路径 `statSync` 恒 null (弹窗不显示 Size); `openInSystemEditor()` 相对路径 `shell.openPath` 失败; 且 `openPath` 对 `.bat` 是 open 动词 = **直接运行**而非编辑
- [x] **修复 — 绝对路径**: 新增 `resolveScriptAbsPath(relPath)` 经 `window.hundun.fs.getBasePath()` 拼数据目录绝对路径, `runScript` / `editScript` / `showScriptActionModal` 全部改走绝对路径, 执行前 `fs.existsSync` 预检
- [x] **修复 — 真实执行 + 可见控制台窗口** (`executor.js` 重写):
  - 启动链 `cmd /c start "" /wait cmd /c <wrapper> <script> <exitfile>` — `start /wait` 新开控制台窗口, **`pause` 可交互阻塞、输出可见** (直接 spawn + `stdio:ignore` 时 pause 不阻塞、窗口不可用, 经 7 轮 Electron 实验确认)
  - 自研 wrapper (纯 ASCII, 脚本路径走参数 → 规避中文/空格路径编码与引号问题): `.ps1` 分发 powershell / `.bat .cmd` 走 `call`, 并用**延迟展开** `!errorlevel!` 写退出码文件 (cmd 缺陷: `echo %errorlevel%>file` 展开为空)
  - `start /wait` 外层退出码恒 0 不传播 → 真实退出码从退出码文件读取, 用完即删; 外层 spawn 成功 (`spawn` 事件) 即弹「已启动」, 脚本退出后非 0 再弹「退出码 N」
- [x] **修复 — 编辑按钮**: `openInSystemEditor` 改 PowerShell `Start-Process -Verb Edit` (edit 动词, 打开编辑器不执行脚本), 经 `FASTCMD_EDIT_TARGET` 环境变量传路径避免引号问题
- [x] **测试**: 新增 `scripts/test-fastcmd-exec.js` (真实 main.html + mock fs 落临时盘) **18/18 通过**: 真实执行 marker 落盘 / exit 0 不报错 / 退出码 7 toast / 中文+空格路径 / .ps1 / 缺失文件报错 / 刷新按钮 / 外部删文件夹自动退出模式 / 弹窗 Size
- [x] 回归: `npm run build` 通过

### FastCmd 移植 FastTxt 通用功能: 底部刷新按钮
- [x] 底部栏新增 🔄 刷新按钮 (顺序: +新建 / 🗑️回收站 / 📁文件夹 / 🔄刷新), 复用 FastTxt 09-24 方案
- [x] `refreshFilesFromDisk()`: 重新读盘同步列表; 刷新后当前文件夹若已被外部删除, 自动退出文件夹模式回根目录
- [x] SVG 刷新图标 (`stroke: currentColor` 自适应主题) + 深色模式加号/刷新图标纯白、浅色保持朱红 (FastTxt 09-26 样式)
- [x] i18n: `buttons.refresh` 中英文 + `toast.scriptExitCode` 中英文

### FastCmd 旧数据目录迁移
- [x] `plugins/fast-cmd/file/` (含 start-opencode.bat, 原被 git 跟踪) 迁移合并到 `user-data/plugins/fast-cmd/file/`, 两份 `.order.json` 合并 (并修复其中的编码损坏)
- [x] 删除 `plugins/fast-cmd/file/` + `git rm --cached`; `.gitignore` 补 `plugins/fast-cmd/file/` (与 fast-txt 09-29 处理一致)

---

## 2026-10-03

### 音效 Bug: 进入子程序后声音特别大 (含主窗口 preload 长期失效的连带修复)
- [x] **用户报告 Bug**: 进入子程序 (FastTXT / FastCMD) 后音效"莫名其妙变得特别大"
- [x] **根因 1 — 插件直放无视音效设置**: `plugins/fast-txt/js/sdk.js`、`plugins/fast-cmd/js/sdk.js` 直放音效硬编码 `audio.volume = 0.5`，完全不读母程序的音量滑块与静音开关；用户调低音量 (或静音) 后母程序安静、子程序仍按 50% 播放 → 听感"突然变大"，静音被绕过 (2026-09-25 的修复只覆盖了 preload 转发路径，直放路径从未修)
- [x] **根因 2 — 主窗口 preload 整段加载失败 (排查中发现, 影响更大)**: `src/main/preload.js` 在 `contextIsolation: false` 下调用 `contextBridge.exposeInMainWorld` 直接抛错 `contextBridge API can only be used when contextIsolation is enabled` → **preload 从未成功加载**, `window.electronAPI` 一直是 undefined:
  - `play-sound` 监听从未注册 → 插件经 IPC 转发的音效 (Calculator、FastTXT 兜底) 一直**无声**
  - `stores/plugin.js` `scanDiskPlugins()` 恒返回 null → 插件磁盘扫描从未生效, "本地安装 .zip → 货架出现新卡带"的上架链路实际不通 (仅主进程冒烟测试通过)
  - dev 分支 preload 路径 `out/main/preload.js` 本就不存在 (electron-vite 输出 `out/preload/preload.js`)
- [x] **修复 — 单一音量真相 (主进程镜像)**:
  - 新增 `src/main/sound-settings.js`: 音效设置的主进程运行期镜像 — `sound:sync` (renderer 推送) / `sound:get-sync` (同步读取) / `sound:get` / `sound:settings-changed` (广播所有窗口); 持久化仍由 localStorage 负责
  - `src/renderer/utils/sound-settings.js`: 保存与启动时推送镜像; `audio.js` 模块加载即同步
  - `plugin-preload.js` 新增 `hundun.sound` API: `getSettings()` (sendSync 初值) + `onSettingsChanged(cb)` (广播订阅)
  - 插件 sdk 音量 = 设置值 (0~100 → 0~1)，静音不创建不播放; 音效文件缺失时兜底 IPC (音量同样按设置); 设置变更即时生效
- [x] **修复 — preload**:
  - `contextBridge` → 直接 `window.electronAPI = {...}` (与 plugin-preload.js 一致, 兼容 `contextIsolation: false`)
  - 删除 preload 内的第二套音效播放器 (`_audioCache` / `_soundFiles` / `_getSoundVolume`); 插件转发音效改由 `App.vue` 的 `onPlaySound` → `audio.js` 单一播放器播放 (复用其 readyState 排队 / 错误恢复逻辑), 死代码 `onPlaySound` 正式启用
  - `index.js` preload 路径改为 `resolvePreloadPath()` 候选解析 (`out/preload/preload.js` 优先, 兼容旧布局)
  - `electron.vite.config.js` copyMainModules 增补 `sound-settings.js` (rollup 未打包该文件, 不复制则生产包启动即崩)
- [x] **测试**: 新增 `scripts/test-sound-settings.js` (主窗口真 preload + 插件窗口真 plugin-preload + fast-txt 真 sdk) **9/9 通过**: 镜像同步 / 插件读取初值 / 直放音量=设置值 (不再 0.5) / 静音不创建不播 / 变更广播生效 / 播放失败 IPC 兜底 / host.playSound 转发
- [x] **回归**: `test-md-preview.js` 48/48、`test-md-scroll.js` 12/12、`npm run build` 通过; 端到端探针确认 renderer 启动即同步设置、`play-sound` → audio.js 真实发声 (paused=false)、`electronAPI` 恢复可用
- [x] 附带效果: Calculator 等 IPC 链路音效由"无声"恢复; 插件磁盘扫描 / 本地安装插件上架链路恢复

### 母程序/子程序窗口互斥 — 修复"子程序启动时母程序意外出现"
- [x] **用户报告 Bug**: 子程序启动时母程序窗口意外出现，母程序与子程序同时运行
- [x] **根因** (脚本化生命周期测试 + CDP 实机复现确认): 主窗口的显示路径**完全没有互斥保护**
  - `index.js` 的 `ready-to-show` / `did-finish-load` 无条件 `mainWindow.show()` —— **页面任何重载都会重新显示母窗口**（dev 下 Vite HMR 全量刷新即触发此路径；与"启动子程序"时机重叠时表现为母子同屏）
  - `returnToParent` 只隐藏**活动**插件窗口，其余插件窗口仍可见 → 母程序 show 后母子同屏
  - `startPlugin` existing-window / `resumePlugin` 路径先显示插件、后隐藏母程序（瞬时重叠），且 `plugin-manager:start` 直启路径完全不隐藏母程序
  - 反向漏洞: 插件窗口被 X 关闭 / `suspendPlugin` 后**没有任何窗口可见**（应用"消失"），用户重新唤起应用时更易撞见异常窗口状态
- [x] **修复 (互斥不变式: 任意时刻有且仅有一个窗口可见)**:
  - `plugin-manager.js` 新增 `getVisiblePluginWindows()` / `hasVisiblePluginWindow()` / `_hideMainForPlugin()` / `_hideAllPluginWindows()` / `_recoverMainWindowIfIdle()`
  - **中央防护**: 构造时给主窗口挂 `show` 监听 —— 有可见插件窗口时立即重新隐藏（覆盖所有 show 路径: 页面重载、second-instance、focus 等）
  - `startPlugin`(existing) / `resumePlugin`: **先藏母再显子**，消除瞬时重叠
  - `launchPluginWithTransition`: 显示新插件前先隐藏**其他**插件窗口（同一时间只允许一个子程序）
  - `returnToParent`: 隐藏**所有**插件窗口（历史只隐藏活动插件）
  - 插件窗口 `closed` / `suspendPlugin` → `_recoverMainWindowIfIdle()` 恢复母程序（置顶状态一并恢复）
  - `index.js`: `ready-to-show` / `did-finish-load` 改走 `maybeShowMainWindow()`（有可见插件则跳过）；`second-instance` 聚焦策略改为"有可见子程序聚焦子程序，否则恢复母程序"
- [x] **测试**: 新增 `scripts/test-window-lifecycle.js` **19/19 通过** (launch 直启 / 意外 show 拦截 / 插件切换 / 返回 / existing-window 直启 / X 关闭恢复 / 挂起恢复，每步断言互斥+至少一个可见)
- [x] **真实应用端到端验证** (CDP 驱动 dev 实例): 子程序运行期间 `location.reload()` 母程序页面 → **确认页面确实重载 (did-finish-load 触发) 且母窗口保持隐藏**；子程序关闭 → 母窗口恢复，**5/5 通过**
- [x] 回归: 音效测试 9/9、md 测试 48/48 + 12/12、`npm run build` 通过

---

## 2026-10-02

### FastTXT Markdown 浏览模式 — 点击/聚焦后视口跳回文档顶部
- [x] **Bug**: 浏览模式下滚动到文档中部后，鼠标点击任意块（或触发一次重渲染），视口立即弹回文档顶部
- [x] **根因** (`plugins/fast-txt/js/md-preview.js` `renderMdPreview()`): `const st = mdPreviewEl.scrollTop` 写在 fragment 构建**之后**；而构建时 `pool.pop()` / `frag.appendChild(el)` 会把旧块元素从预览容器搬进游离 fragment → 容器被搬空 → Chromium 立即把 `scrollTop` 钳为 0 → 保存到的"原位置"本身就是 0，回填后自然回到顶部
- [x] **修复**:
  - `scrollTop` 与容器位置改在**移动任何 DOM 之前**捕获
  - 新增**锚点补偿**: 以目标活动块（被点击/光标所在块）重建前的顶边位置为锚，重建后按位移差 `delta` 修正 `scrollTop`，抵消活动块"渲染态 ↔ 源码态"互换引起的上方块高度变化 → **点哪里，那一块就保持在原视觉位置（位移 0px）**
- [x] **回归测试**: 新增 `scripts/test-md-scroll.js`（12 项断言：滚动保持 / 锚点位移 0 / 多次切换 / 真实鼠标输入 / 点击活动块 / 输入重渲染 / 模式往返），`npx electron scripts/test-md-scroll.js` **12/12 通过**
- [x] 既有冒烟测试 `npx electron scripts/test-md-preview.js` **48/48 通过**；`npm run build` 构建通过

---

## 2026-10-01

### FastTXT Markdown 浏览模式 — 单个换行直接渲染为换行
- [x] **需求**: 浏览模式下段落内单个换行（单回车）直接渲染为换行，不再要求行尾两个空格（或反斜杠）才换行
- [x] **实现** (`plugins/fast-txt/js/md-preview.js`): markdown-it 实例开启官方选项 `breaks: true`（GitHub 风格软换行）
  - 仅作用于内联渲染层（softbreak token → `<br>`），**不改变块级解析** → 分块算法 / 活动块定位 / 点击映射均不受影响
  - 行尾双空格硬换行仍然有效（两者兼容）；空行分段、代码块内换行行为不变
  - 编辑模式为纯源码视图，不受影响
- [x] **验证**: `npx electron scripts/test-md-preview.js` **48/48 通过**；专项用例确认单换行→`<br>`、空行→两个 `<p>`、代码块换行保留、列表正常

---

## 2026-09-30

### FastTXT Markdown 实时渲染 — 浏览/编辑模式 (Typora 式)
- [x] **方案选型**: 调研原生 HTML/CSS/JS 渲染方案 (marked / markdown-it / showdown / remark) 后选定 **markdown-it**
  - 100% CommonMark、默认 `html:false` 原始 HTML 转义 (插件窗口 nodeIntegration: true, 必须防注入)、单文件 UMD 离线可用
  - vendor 本地化: `plugins/fast-txt/js/vendor/markdown-it.min.js` (123KB, 经 `npm pack markdown-it@14.1.0` 提取), 运行时零 CDN 依赖
- [x] **浏览模式 (默认, Typora 式实时渲染)**: `editorContent` 仍是唯一事实源
  - `md-preview.js` 用 markdown-it token 的 `map` 把文档切成连续行区间 (块), 归一化保证全行覆盖
  - 光标所在块内嵌持久 textarea 显示源码, 其余块渲染为 HTML; 输入 → 回写 `editorContent` → 80ms 防抖重解析 → 按光标行重新定位活动块
  - 输入 `# 标题` 后光标离开块 (点击别处/回车分块) 即渲染为标题; 块切分/合并时光标映射保持
  - 输入法组合期跳过重渲染 (`compositionstart/end`), 组合结束立即渲染; 重渲染保留焦点与选区
  - 块 DOM 按 source 复用 (同内容不重建, 图片不闪烁); 渲染 HTML 缓存 (上限 300)
  - 点击渲染块 → 坐标估算 (行高/等宽字符宽) 定位源码光标并激活; 点击 a 链接 → `app:openExternal` 系统浏览器打开 (仅 http/https)
  - 预览区 Ctrl+滚轮缩放源码字号 (与主编辑器 8~32px 联动)
- [x] **编辑模式 (普通文件格式)**: 原有纯源码视图 (行号/书签/查找替换/拖拽全量可用), 与之前行为完全一致
- [x] **右下角滑块**: `.md-mode-switch` 两档 (浏览/编辑), 仅 `.md` 文件显示, 点击切换, i18n 中英文 (`mdMode.*`)
  - 浏览→编辑: 活动块光标映射回主 textarea 对应行列
  - 编辑→浏览: 主 textarea 光标行映射为活动块, 编辑不中断
- [x] **快捷键协作**: 浏览模式下 Ctrl+F/H/X/D 自动先切编辑模式再执行 (光标已映射); 纯浏览 (无活动块) 时 Ctrl+X/D 只切模式不执行破坏性操作; Ctrl+S/Z/Y 两模式通用
- [x] **周边接入**: 打开 md 默认浏览 (书签跳转改为滚动到对应渲染块)、关闭编辑器完全复位、undo/redo 后立即同步渲染、5 秒自动保存/beforeunload 不变 (走 `editorContent`)
- [x] **新增文件**: `css/md-preview.css` (12 个样式) / `js/md-preview.js` (18 个脚本) / `js/vendor/markdown-it.min.js` / `scripts/test-md-preview.js` + `scripts/test-md-preload.js`
- [x] **接入点**: `main.html` (markup + 脚本序 vendor→md-preview→init)、`file-actions.js` (openFile/undo/redo/closeEditor)、`keyboard.js` (编辑模式快捷键分支)、`i18n.js` / `i18n-html.js`

### 同步修复: 撤销/重做差一 Bug (既有)
- [x] **Bug**: `undo()` 先 `pop()` 再读新栈顶 → 一次撤销跳过两个历史状态 (从 S_n 直接回 S_{n-2}); `redo()` 对称错乱
- [x] **修复** (`file-actions.js`): 改为标准语义 — undo: 当前进重做栈 → pop 历史状态直接恢复; redo: 当前压回撤销栈 → pop 重做状态; 边界条件改为 `length === 0` (首个状态也可撤销)
- [x] 影响主编辑器与浏览模式两处 (共用同一撤销栈), CHANGELOG 此前未记录该问题

### 验证
- [x] 分块算法 Node 单测: 10+ 场景 (标题/列表/引用/代码块/表格/hr/setext/深层嵌套/前导空行/空文档/HTML 注入转义/引用式链接) 全覆盖无空隙
- [x] `scripts/test-md-preview.js` Electron 冒烟测试 (preload 注入 mock `window.hundun.fs` 驱动真实 `main.html`): **48/48 通过**
  - 覆盖: 初始化默认文件 → 打开 md 默认浏览+渲染 → 点块编辑 → 实时渲染 → 模式滑块往返 (光标映射) → 编辑改内容切回渲染 → undo/redo → 关闭落盘 → txt 无滑块
  - 运行: `npx electron scripts/test-md-preview.js` (退出码 0 = 全过)
- [x] `npm run build` 构建通过

---

## 2026-09-29

### FastTXT 存储文档与实际代码对齐 `plugins/fast-txt/STORAGE.md`
- [x] **修正数据目录**：文档原写 `plugins/fast-txt/file/`（插件目录），实际为 `userData/plugins/fast-txt/file/`
  - 开发: `项目根\user-data\plugins\fast-txt\file\`；打包: `<exe目录>\user-data\plugins\fast-txt\file\`
  - 路径来自 `index.js` 的 `getFastTXTBasePath()`（配合 `app.setPath('userData', appRoot/user-data)`），2026-09-23 迁移后插件目录下的 `file/` 已不再被读取
- [x] **修正路径获取方式**：删除"通过 `pluginManager.plugins.get(pluginId).path` 动态获取"的过时描述；改为"插件端只传相对路径，主进程统一拼接"，并贴出真实代码
- [x] **修正文件清单**：`js/` 15 个 → 17 个（补全 17 个文件职责与 `main.html` 加载顺序）；补 `assets/`（2 个 SVG）、`STORAGE.md` 自身
- [x] **补隐藏文件**：新增 `.bookmarks.json` 条目（`{文件路径: [行号]}`，无路径用 `__default__`），并给出 `.order.json` 的 `{ids:[...]}` 结构
- [x] **重写过时的 Setup 章节**：改为当前打包实际情况（数据随 `user-data/` 落在 exe 同级，不受 asar 只读限制）+ 旧数据迁移方法
- [x] **补全遗漏内容**：`window.hundun.fs` 10 个方法与 `fasttxt:*` IPC 通道表（`writeFile` 原子写 / `writeFileSync` 非原子）、保存时机表（关闭 / 5 秒自动 / Ctrl+S / beforeunload 双保险）、三处删除入口、两套防重名规则（`pickFreeName` 的 `file→file1→file11` vs `getUniqueName` 的 `new_file→new_file1`）
- [x] **标注实际限制**：文件夹仅支持一层（`enterFolder` 只存文件夹名 + 读盘只递归一层）；拖拽导入同名直接覆盖（不防重名）；默认文件内容硬编码英文（`i18n.js` 的 `defaults.*` 未被调用）
- [x] 新增 localStorage 偏好表（`fasttxt-theme` / `fasttxt-locale`，回退母程序 `huntun-lite-locale`）

### 同步修复
- [x] `src/main/plugin-preload.js`：`fs.getBasePath()` 的 JSDoc 示例路径 `E:\code2\huntunLite\plugins\fast-txt` 已过时 → 改为 `user-data\plugins\<pluginId>\file`（开发/打包两种形态），并修正缩进
- [x] 删除迁移前旧数据目录 `plugins/fast-txt/file/`（该路径本就在 `.gitignore` 中，非用户真实数据）；真实数据 `user-data/plugins/fast-txt/file/` 已确认完好（`.order.json` / `.trash/` / 用户文件）
- [x] 删除 `plugins/fast-txt/index.html`（97KB 旧版单文件备份）：`manifest.json` entry 已是 `main.html`，全仓库无引用（仅 `plugin-manager` 在 entry 缺失时的通用兜底字符串），随包分发造成冗余
  - 恢复方式: `git checkout -- plugins/fast-txt/index.html`
- [x] `AGENTS.md`：同步 fast-txt 结构树（补 `STORAGE.md` / `assets/` / 入口与文件数 / 数据目录位置提示），更新"最后更新"与当前阶段

---

## 2026-09-28

### 母程序弹窗字体 — 英文改用普通字体
- [x] `Modal.vue` 弹窗标题 `.modal-title` 与按钮 `.modal-btn` 字体由像素字体 `Press Start 2P` 改为普通字体 `'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif` (与 `body` 一致)
- [x] 中英文均生效：英文不再是像素风，中文由像素栈的 `cursive` 回退改为与正文一致的 Noto Sans SC
- [x] `.modal-message` 原本就继承 `body` 普通字体，无需改动
- [x] 影响范围：母程序全部弹窗（确认/取消、拔出卡带、启动失败、安装成功/失败、ADD 菜单、社区提示等，均复用同一 `Modal.vue`）
- [x] `npm run build` 构建通过

### ADD 菜单弹窗精简
- [x] 移除标题下方的说明小字 (`addApp.msg`，中英文均已删除，`Modal.vue` 消息区加 `v-if` 避免空占位)
- [x] 标题「添加插件 / ADD PLUGIN」字号 20px → 30px 并加粗
- [x] `Modal.vue` 新增可选 prop `titleSize` (`normal`/`large`)，`App.vue` 的 `showModal()` 增加第 6 个参数；其他弹窗标题保持 20px 不变
- [x] `npm run build` 构建通过

---

## 2026-09-27

### 母程序 ADD 按钮 — 添加插件菜单
- [x] ADD 按钮点击后弹出菜单，样式复用"弹出并切换卡带"弹窗（左右两侧布局，`Modal.vue` large 尺寸）
- [x] 左侧为标题区，**不可被选中**，显示"添加插件 / ADD PLUGIN"
- [x] 右侧两个按钮支持上下键 / 鼠标悬停选中，Enter 或再次点击执行
- [x] 第一项 **本地安装 (.zip)**：打开系统文件资源管理器（`dialog.showOpenDialog`，过滤 `*.zip`）
- [x] 第二项 **逛逛社区**：`shell.openExternal` 打开系统默认浏览器（官网未完成，先跳转 `https://gitee.com/luofengwuqi`）

### 本地插件安装器 `src/main/plugin-installer.js`
- [x] 零第三方依赖的 ZIP 解析（Node 内置 zlib）：中央目录 + 本地文件头 + store/deflate + CRC32 校验
  - 生产包 `files` 不含 `node_modules`，运行时 require 不到第三方包，故不引入 adm-zip/yauzl
- [x] 插件架构审核（对齐 `PLUGIN_SPEC.md` 第三章）:
  - `manifest.json` 必需字段 `id` / `name` / `version`
  - `id` 规则：小写字母、数字、连字符，开头为字母或数字，最长 64 字符
  - `version` 必须为语义化版本 `x.y.z`
  - `entry` 默认 `index.html`，必须真实存在且为 `.html` / `.js`
  - 可选字段类型校验：`description`/`icon`/`author`/`color`(hex)/`permissions`(数组)/`windowSize`(200~4000)/`minAppVersion`
- [x] 兼容两种打包方式：压缩包根含 `manifest.json`，或唯一一层子目录内含 `manifest.json`
- [x] 安全防护：zip slip 路径穿越、绝对路径/盘符路径、加密包、ZIP64、解压炸弹（条目数 / 单文件 / 总体积上限）、CRC 不匹配
- [x] 编码兼容：UTF-8 BOM / UTF-16 LE·BE / GBK 的 `manifest.json` 均可解析（记事本另存为常见结果）
- [x] 落盘目录：开发态 `项目根/plugins`，打包态 `exe目录/plugins`（asar 只读，不写内置目录）
- [x] 冲突策略：内置插件 ID 不可覆盖；经本安装器装过的 ID 允许覆盖升级（记录于 `userData/installed-plugins.json`）

### 多插件目录扫描
- [x] `paths.js` 新增 `resolveAppRoot()` / `resolvePluginsDirs()` / `resolveInstallPluginsDir()`
- [x] `plugin-loader.js` 支持传入目录数组，按优先级扫描并按 `id` 去重；单个 manifest 损坏不再中断整体扫描
- [x] `plugin-manager.js` 改用 `resolvePluginsDirs()`（内置 + 用户安装目录）
- [x] `electron.vite.config.js` copyMainModules 增补 `plugin-installer.js`、`paths.js`

### 安装后同步母程序各页面
- [x] `stores/plugin.js` 抽出 `scanDiskPlugins()`，新增 `refreshFromDisk()`（保留 enabled / customSettings 本地配置）
- [x] `App.vue` 新增 `syncShelfWithStore()`：按 store 重建卡带货架（排除插槽占用项），初始化与安装后复用
- [x] 安装成功 → 刷新 store → 卡带货架出现新卡带；设置页"插件"列表同步显示；信息栏/选中导航自动夹取索引
- [x] 结果反馈弹窗：成功显示插件名 + 版本；失败显示审核错误原因（经 HTML 转义后渲染）
- [x] i18n：`addApp.*` 中英文案（标题/按钮/成功/失败/取消）

### 验证
- [x] `npm run build` 通过，out/main 复制产物与 src 时间戳一致
- [x] 安装器冒烟测试 15/15 通过：合法包、覆盖升级、内置 ID 冲突、缺 manifest、非法 id/版本、缺入口、zip slip、非 zip、扫描发现
- [x] 真实 `Compress-Archive` deflate 包 + BOM manifest 安装成功并可被扫描器发现

---

## 2026-09-26

### FastTXT 底部栏图标配色优化
- [x] 底部 **➕新建** 与 **🔄刷新** 按钮图标改为纯白 `#fff` (深色模式)
- [x] **浅色模式保持朱红** `--text-primary` (#C3272B): 按钮背景为近白 (#FFFEFB)，强制白色会看不见
- [x] 刷新为 SVG `stroke="currentColor"`，只需改 `color` 即自动变色，无需改 SVG 本体
- [x] 仅命中 `.footer-btn.add-btn` / `.footer-btn.refresh-btn`，🗑️回收站、📁文件夹按钮不受影响
- [x] 改动文件: `plugins/fast-txt/css/footer.css`

---

## 2026-09-25

### 母程序音效音量启动 Bug 修复
- [x] **Bug**: 刚进入程序时音效为满格音量 (100%)，只有打开设置页面后才读取已保存的音量
- [x] **根因**: `utils/audio.js` 初始化 `masterVolume = 1`，且从不读取 localStorage；`Settings.vue` 的 `loadSettings()` 仅在设置页挂载时才调用 `setGlobalVolume()`
- [x] 新增 `utils/sound-settings.js`: 音效设置的统一读写模块 (key `huntun-lite-settings`、默认值 `{soundEnabled:true, volume:50}`、数值校验/越界 clamp)
- [x] `audio.js` 模块加载时执行 `applySavedVolume()`: 启动即读取一次保存的音效开关+音量并应用到所有预加载音效 (顺序: `initSounds()` → `applySavedVolume()`)
- [x] 无历史设置时默认 50% (与设置页滑块默认值一致，不再满格)
- [x] `Settings.vue` 改用 `sound-settings.js` 读写 (单一数据源，移除重复的 key/默认值逻辑)
- [x] `preload.js` 插件音效转发路径修复: 原固定 `volume = 0.5` 忽略用户设置 → 改为读取同一份设置 (支持静音开关与自定义音量)

### 弃用文件清理
- [x] 删除 `src/renderer/components/CalculatorApp.vue` (已迁移至 `plugins/calculator/`)
- [x] 删除 `src/renderer/components/FastTXTApp.vue` (已迁移至 `plugins/fast-txt/`)
- [x] 删除 `src/renderer/components/TestApp.vue`
- [x] 确认全仓库无引用后删除，`npm run build` 构建通过

### 音效"时有时无 / 刚启动无声"修复
- [x] **Bug**: 部分音效时有时无，刚启动时前几下点击无声，且中招的音效重启前永久无声
- [x] **根因**: `playSound()` 只依赖 `soundLoaded[name]` 标记决定是否直接播放；该标记被 `error` 事件置为 `false` 后 (加载中断/HMR 重载)，若文件实际已加载完 (readyState≥2)，`canplaythrough` 事件不会再触发 → 旧逻辑死等一个永远不会来的事件 → 该音效永久无声
- [x] **修复** (`utils/audio.js`):
  - 改以 `audio.readyState >= 2` (有可播数据) 为直接播放依据，不再单凭标记
  - 未就绪时排队等待，同时监听 `canplay` / `canplaythrough` / `loadeddata` 三种就绪事件，任一触发即播放
  - 排队增加 `error` 兜底监听，加载失败自动清理监听器 (不再泄漏)
  - `audio.error` 存在时自动 `load()` 重载恢复
  - 同一音效排队去重，快速连点不再叠加监听器
- [x] 验证 (独立 Electron 实例)：9 个音效强制标记为"未加载"后逐个播放 → 9/9 立即出声；正常/排队/连点场景全部通过
- [x] 新增调试句柄 `window.__huntunAudio` (sounds / soundLoaded / getMasterVolume / playSound / setGlobalVolume)

---

## 2026-09-24

### FastTXT 底部栏"刷新"按钮
- [x] 底部按钮栏新增 🔄 刷新按钮 (顺序: +新建 / 🗑️回收站 / 📁文件夹 / 🔄刷新)
- [x] 点击后调用 `loadFilesFromDisk()` 重新读取磁盘真实文件 (根目录、文件夹、回收站、排序) 并同步到程序
- [x] 边界处理: 刷新后当前文件夹若已被外部删除，自动退出文件夹模式回到根目录
- [x] 刷新动作函数 `refreshFilesFromDisk()` 实现于 `js/filesystem.js`
- [x] i18n: `buttons.refresh` 中文"刷新" / 英文"Refresh"
- [x] 图标从 emoji 🔄 替换为内嵌 SVG (背景透明, `stroke: currentColor` 自适应深浅主题)
- [x] 新增 `assets/refresh.svg` (现代风) 与 `assets/refresh-pixel.svg` (像素风) 备用图标源文件
- [x] `css/footer.css` 新增 `.btn-icon .btn-svg` 样式 (18×18, pointer-events: none)

---

## 2026-09-23

### 构建架构修复 — 生产构建可用
- [x] 修复 `externalizeDepsPlugin` 不打包本地模块导致 `Cannot find module './plugin-manager'` 的问题
- [x] 新增 `copyMainModules()` Vite 插件: 构建后自动复制未被 rollup 打包的主进程文件到 `out/main/`
- [x] 简化 `package.json` build 脚本: 移除手动 copy 步骤, 由 Vite 插件自动完成
- [x] 修复 `src/main/index.js` 路径逻辑: 使用 `app.isPackaged` 区分开发/打包模式
  - GPU 缓存路径: 开发时 `项目根目录/user-data`, 打包后 `exe所在目录/user-data`
  - Preload 路径: 开发时 `out/main/preload.js`, 打包后 `out/preload/preload.js`
- [x] 修复 FastTXT 数据目录: 从插件目录(打包后只读)迁移到 `userData/plugins/` (可写)
- [x] `src/main/plugin-loader.js` 动态 require 兼容: 自动检测 `plugin-loader.js` 所在位置
- [x] `package.json` main 字段修正: `src/main/index.js` → `out/main/index.js`
- [x] `package.json` electron-builder 配置优化: asar 启用、NSIS 快捷方式、正确的 files 列表

---

## 2026-09-22

### FastTXT 自动保存功能
- [x] 添加每5秒自动保存定时器 (编辑文档时自动保存)
- [x] 添加 beforeunload 事件处理 (窗口关闭前保存文档)
- [x] 防止程序意外关闭导致文档丢失

---

## 2026-09-20

### 母程序首页插件同步
- [x] 更新 plugin.js DEFAULT_PLUGINS 数组，添加所有已有子程序
- [x] 新增 timer-manager (Timer) 定时任务管理器
- [x] 新增 fast-cmd (FastCmd) 脚本管理器
- [x] 母程序首页现在显示全部4个子程序卡带

---

## 2026-09-12

### 窗口置顶功能
- [x] 母程序添加图钉按钮 (关闭按钮左侧)
- [x] Calculator 插件添加图钉按钮
- [x] FastTXT 插件添加图钉按钮 (主视图 + 编辑器视图)
- [x] Timer Manager 插件添加完整标题栏 + 图钉按钮
- [x] IPC 通信层: 新增 `window-pin` 和 `plugin:setAlwaysOnTop` 通道
- [x] Preload API: 主窗口和插件窗口均暴露 `setAlwaysOnTop` 方法
- [x] Plugin Manager: 新增 `setAlwaysOnTop` 方法
- [x] 图钉按钮样式: 选中态逆时针旋转45度 + 发光效果
- [x] 过渡动画: 统一0.3s平滑过渡

### 架构修改
- [x] 母程序 App.vue: 图钉按钮和关闭按钮包装在 `.header-buttons` 容器
- [x] Timer Manager: 重构为完整标题栏布局 (与 Calculator/FastTXT 一致)
- [x] CSS 变量系统: Timer Manager 添加完整 CSS 变量

---

## 2026-09-10

### FastTXT 垃圾桶页面优化
- [x] 移除底部碎纸机按钮 (保留 `showShredConfirm` 函数)
- [x] 新增"清空垃圾桶"按钮 (位于碎纸机上方，调用原删除函数)
- [x] 碎纸机标签文字放大100% (6px → 12px)
- [x] 更新 `getFooterButtons()` 移除碎纸机按钮项
- [x] 新增 `emptyTrashBtn` DOM 引用及显示/隐藏逻辑
- [x] 新增 `.ftxt-empty-trash-btn` 样式 (类似碎纸机布局)

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
