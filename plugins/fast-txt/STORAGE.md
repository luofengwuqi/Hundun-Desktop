# FastTXT 存储说明

> 最后更新: 2026-09-30
> 对齐代码: `manifest.json` entry = `main.html`；`css/` 12 个文件；`js/` 18 个文件 (+ `js/vendor/` 离线第三方)
> 主进程: `src/main/index.js` → `registerFastTXTIPC()` / `getFastTXTBasePath()`
> 插件侧 API: `src/main/plugin-preload.js` → `window.hundun.fs`

---

## 1. 一句话结论

**用户文件不在插件目录里**，而在 `userData/plugins/fast-txt/file/`。
由于 `userData` 被覆盖到「项目根 / 安装根」旁边的 `user-data/`，实际路径为：

| 运行环境 | FastTXT 数据目录 |
|----------|------------------|
| 开发 (dev) | `E:\code2\hundunDesktop\user-data\plugins\fast-txt\file\` |
| 打包 (packaged) | `<exe所在目录>\user-data\plugins\fast-txt\file\` |

> ⚠️ 2026-09-23 起数据目录已从插件目录迁出（见 AGENTS.md 决策 #22）。
> 旧位置 `plugins/fast-txt/file/` **程序已不再读取**，迁移前的历史残留已于 2026-09-29 手动删除（该路径本就在 `.gitignore` 中）。

---

## 2. 路径解析逻辑（真实代码）

### 2.1 userData 被覆盖到可写目录（`src/main/index.js` 顶部）

```javascript
const appRoot = app.isPackaged
  ? path.dirname(process.execPath)   // 打包后: exe 所在目录
  : path.join(__dirname, '../..')    // 开发时: 项目根目录
const userDataDir = path.join(appRoot, 'user-data')

// 覆盖 Electron 默认 userData 路径到项目/安装目录
app.setPath('userData', userDataDir)
```

### 2.2 数据根目录（`src/main/index.js`）

```javascript
// 辅助：获取 FastTXT 数据目录（存储在 userData 下，不写 asar）
function getFastTXTBasePath(pluginId) {
  const dataPath = path.join(app.getPath('userData'), 'plugins', pluginId || 'fast-txt', 'file')
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true })
  }
  return dataPath
}
```

每次调用都会确保目录存在，插件首次启动无需手动建目录。

### 2.3 插件端不拼绝对路径

插件内所有 `window.hundun.fs.*` 调用只传**相对路径**（如 `'NewFolder/nested.md'`、`'.trash'`），
由主进程统一 `path.join(getFastTXTBasePath(pluginId), 相对路径)` 拼接。
`pluginId` 来自 `window.__PLUGIN_ID__`（`plugin-manager.js` 在 `did-finish-load` 后注入）。

**不要在插件代码里硬编码绝对路径。** 确需绝对路径时用 `window.hundun.fs.getBasePath()`。

---

## 3. 插件文件结构（代码部分）

```
plugins/fast-txt/
├── manifest.json         # entry: "main.html"，windowSize 800×540，permissions: []
├── main.html             # ✅ 入口页面（引用 css/ 与 js/，脚本按序加载）
├── STORAGE.md            # 本文档
├── assets/
│   ├── refresh.svg       # 刷新按钮图标源文件（现代风，备用）
│   └── refresh-pixel.svg # 刷新按钮图标源文件（像素风，备用）
├── css/                  # 12 个文件
│   ├── base.css          # 全局样式 / CSS 变量 / 深浅主题
│   ├── deco-screws.css   # 装饰螺丝
│   ├── header.css        # 头部（标题/版本徽章一律用默认字体, 不用像素字体）
│   ├── content.css       # 主内容区
│   ├── file-list.css     # 文件卡片网格（3 列）
│   ├── drop-zones.css    # 垃圾桶 / 碎纸机 / 清空按钮区域
│   ├── footer.css        # 底部按钮栏（普通字体）
│   ├── editor.css        # 编辑器（普通字体）
│   ├── overlays.css      # 弹窗 / 新建菜单
│   ├── find-bar.css      # 查找替换栏
│   ├── status.css        # 编辑器状态栏
│   └── md-preview.css    # Markdown 浏览模式（预览排版 + 右下角浏览/编辑滑块）
└── js/                   # 18 个文件（main.html 中按下列顺序加载）
    ├── sdk.js            # playSound (绝对路径直放) / returnToParent
    ├── i18n.js           # 多语言核心（zh/en 各 70 条翻译）
    ├── i18n-html.js      # 静态 HTML 文本套用翻译
    ├── app-state.js      # DOM 引用 + 全局状态 + 常量 + 计算函数
    ├── filesystem.js     # 读盘/写排序/书签持久化/刷新/收尾
    ├── render.js         # 文件列表、页脚、行号、状态栏渲染
    ├── file-actions.js   # 打开/重命名/删除/恢复/剪切/复制/撤销/导入
    ├── reorder.js        # 拖拽排序
    ├── modes.js          # 垃圾桶 / 文件夹 / 碎纸机 / 打开资源管理器
    ├── create.js         # 新建文件/文件夹 + 新建重名检测
    ├── find-replace.js   # 查找替换
    ├── autosave.js       # 5 秒自动保存 + 关闭前保存
    ├── modal.js          # 通用弹窗
    ├── keyboard.js       # 主视图/编辑器/弹窗键盘导航
    ├── events.js         # 事件绑定 + Ctrl+滚轮字号缩放
    ├── theme-sync.js     # 主题切换 + beforeunload 同步写盘
    ├── vendor/
    │   └── markdown-it.min.js  # markdown-it 14.1.0 UMD (123KB, 离线 vendor)
    ├── md-preview.js     # Markdown 浏览/编辑模式（分块渲染/活动块源码编辑/滑块）
    └── init.js           # 启动入口（init，加载列表最后一项）
```

### JS 加载顺序（`main.html` 末尾）

`sdk → i18n → i18n-html → app-state → filesystem → render → file-actions → reorder →
modes → create → find-replace → autosave → modal → keyboard → events → theme-sync →
vendor/markdown-it → md-preview → init`

所有 JS 均为无模块的全局脚本（共享 `app-state.js` 里的全局变量），改动加载顺序会直接导致
`ReferenceError`，新增文件必须显式加进 `main.html`。

---

## 4. 数据目录结构（运行时真实结构）

```
<userData>/plugins/fast-txt/file/        ← 数据根目录 = getFastTXTBasePath()
├── readme.txt                            ← 默认文件（目录为空时才创建）
├── notes.md                              ← 同上
├── draft.txt                             ← 同上
├── LITE1.txt                             ← 用户文件
├── NewFolder/                            ← 用户创建的文件夹（一层）
│   └── nested.md
├── .order.json                           ← 排序信息（隐藏文件）
├── .bookmarks.json                       ← 行号书签（隐藏文件）
└── .trash/                               ← 回收站（隐藏文件夹，平铺存放被删文件）
    ├── old_file.txt
    └── another.txt1                      ← 重名时自动改名（见第 7 节）
```

### 启动时的初始化（`js/init.js`）

1. `mkdir('.trash')` — 确保回收站目录存在
2. `createDefaultFiles()` — **仅当根目录为空**时写入默认文件
3. `loadFilesFromDisk()` — 读取 `.order.json` + 根目录 + 一级文件夹 + `.trash/`
4. `loadTheme()` / `setupPinButton()` / `updateUI()` / `startAutoSaveTimer()`

---

## 5. IPC 与插件侧 API

### 5.1 插件可用的 `window.hundun.fs`（`plugin-preload.js`）

| 方法 | 说明 |
|------|------|
| `getBasePath()` | 返回数据根目录绝对路径 |
| `readDir(dirPath)` | 列目录，返回 `[{name, isDirectory, mtime, size}]`；**主进程已过滤 `.` 开头的条目**；排序为目录优先 + 名称升序 |
| `readFile(path)` | 读文本，不存在返回 `null` |
| `writeFile(path, content)` | 写文本，**原子写入**（先写 `.tmp` 再 `rename`），自动建父目录 |
| `deleteFile(path)` | 删除文件或目录（目录递归 `rmSync`） |
| `mkdir(path)` | 递归建目录 |
| `rename(old, new)` | 重命名/移动，自动建目标父目录 |
| `exists(path)` | 是否存在 |
| `stat(path)` | `{size, mtime, isDirectory}` |
| `openInExplorer()` | 用系统资源管理器打开数据根目录 |

### 5.2 主进程通道（`fasttxt:*`）

`getBasePath` / `readDir` / `readFile` / `writeFile` / `deleteFile` / `mkdir` /
`rename` / `exists` / `stat` / `openInExplorer` 为 `ipcMain.handle`（invoke）；
`fasttxt:writeFileSync` 为 `ipcMain.on`（send，同步写，**非原子**），供 `beforeunload` 使用。

---

## 6. 隐藏文件

以下以 `.` 开头的文件/目录**不会在 FastTXT 界面中显示**（主进程 `readDir` 直接过滤）：

| 文件 | 用途 | 格式 |
|------|------|------|
| `.order.json` | 记录文件排序顺序 | `{ "ids": ["文件id", ...] }`，活动项在前、回收站项在后 |
| `.bookmarks.json` | 每个文件的行号书签 | `{ "<文件相对路径>": [行号, ...] }`；无路径时用 `__default__` 作 key |
| `.trash/` | 回收站，平铺存放被删文件 | 重名自动按 `file` → `file1` → `file11` 改名 |
| `.trash/.trash.json` | 旧版回收站清单残留 | **已不再使用**，自动忽略（隐藏项不会被读入） |

- 排序：`saveOrderToDisk()` 每次磁盘变更后写入 `[...活动项, ...回收站项]` 的 id 数组。
- 书签：点击行号 `toggleBookmark()` 后写入；`openFile()` 时按文件路径读取并跳到第一个书签。
- 读盘时按 `.order.json` 恢复顺序；**新条目**（不在清单里）按 `readDir` 返回顺序（目录优先、名称升序）追加到末尾。

---

## 7. 回收站 (.trash/) — 平铺简化方案

回收站 **只存文件，不存文件夹、不保留任何原路径信息**，删除/恢复语义非常简单：

- **删除文件**（无论在根目录还是文件夹内）：直接移入 `.trash/`，**恢复时一律回到 `file/` 根目录**，不还原到原文件夹。
- **删除文件夹**：不把文件夹整体放入回收站。弹警告确认后，遍历该文件夹内**所有文件**（含子目录，递归）逐个平铺移入 `.trash/`，然后删除已搬空的文件夹树；恢复时每个文件同样直接回到根目录。
- **空文件夹删除**：不经过回收站，直接物理删除（`deleteFile` → `rmSync` 递归）。
- **恢复**：把 `.trash/` 里的文件移回根目录。
- **粉碎**：把 `.trash/` 里的文件永久删除。

> 文件夹结构在删除后不再保留，这是刻意简化 —— 删除即「拆平」，避免维护路径归属的复杂逻辑。

### 删除入口（三处，逻辑同源）

| 触发 | 函数 |
|------|------|
| 键盘 `Delete` / `Backspace` | `deleteFileToTrash()` / `deleteFolderToTrash()` |
| 拖入垃圾桶区域 | `handleTrashDrop()` → 同上 |
| 回收站内拖入碎纸机 | `handleShredderDrop()` → 单个永久删除 |

### 回收站界面

- 底部 🗑️ 按钮切换垃圾桶模式；进入前先 `loadFilesFromDisk()` 读取最新回收站内容。
- 垃圾桶模式下右侧显示**碎纸机区域**（拖入单个已删除项 = 永久删除）与**「清空垃圾桶」按钮**（`showShredConfirm()` → 二次确认 → `shredAll()` 永久删除全部）。
- 垃圾桶模式与文件夹模式**互斥**，切换时自动退出另一种并清空搜索。

### 防重名规则（两套，注意区别）

**① 删除 / 恢复 —— `pickFreeName()`（`filesystem.js`）**：以磁盘 `exists` 为准，
每次在**扩展名前追加一个 `1`**，逐个尝试直到磁盘上确实不存在：

```
file.txt 已存在 → file1.txt → file11.txt → file111.txt ...
无扩展名: name → name1 → name11 ...
```

> Windows 的 `fs.rename` 会**覆盖**已存在的目标，所以必须先确认目标不存在再改名。

**② 新建文件 / 文件夹 —— `getUniqueName()`（`create.js`）**：按目录内现有名字**递增数字后缀**：

```
new_file.txt → new_file1.txt → new_file2.txt ...
NewFolder    → NewFolder1    → NewFolder2 ...
```

### 级联删除的安全收尾

`performFolderDelete()` 只有在「全部文件搬移成功 **且** 文件夹内二次核对无残留文件」时才删除文件夹树，
避免确认弹窗期间新产生的文件被误删；任一步失败会弹「删除未完成」提示，文件夹保留。

---

## 8. 文件夹模式

- **进入文件夹**：点击文件夹卡片 → `enterFolder()`，`currentFolderPath = 文件夹名`，
  列表显示 `parentPath === currentFolderPath` 的文件。
- **返回根目录**：面包屑 `← Back`、底部 📁 按钮、或 `Esc`。
- **模式互斥**：文件夹模式与垃圾桶模式不能同时激活，切换时自动退出另一种。
- **创建文件**：在文件夹内创建的文件自动归属当前文件夹（`parentPath = 当前路径`）。
- **删除文件夹**：见第 7 节（拆平入回收站）。

### 文件对象的 parentPath 字段

```javascript
{
  id: 'NewFolder/nested.md',  // id = parentPath/name
  name: 'nested.md',
  parentPath: 'NewFolder',    // 所属文件夹名，根目录为空字符串 ''
  isFolder: false,
  content: null,              // 延迟加载，openFile 时才从磁盘读
  order: 12,                  // 排序权重（来自 .order.json）
  deleted: false
}
```

- 根目录文件/文件夹：`parentPath = ''`
- 一级文件夹内文件：`parentPath = '文件夹名'`
- 二级文件夹内文件：`parentPath = '文件夹名/子文件夹名'`

### ⚠️ 目前只支持一层（已知限制）

`loadFilesFromDisk()` 只遍历「根目录 + 每个一级文件夹的一层内容」，不会递归读更深层；
且 `enterFolder()` 只把**文件夹名**（而非 `parentPath/name`）写进 `currentFolderPath`，
所以二级文件夹会显示在列表里，但点进去列表为空。实际可用层级 = **一层**。

（`collectFolderFiles()` 删除时是**任意深度**递归的，与读取范围不同。）

---

## 9. 内容保存时机

| 时机 | 行为 | 代码 |
|------|------|------|
| 关闭编辑器（✕ / `Esc`） | `writeFile` 写盘 + `saveFiles()` 写排序 | `closeEditor()` |
| 每 5 秒自动保存 | 仅在编辑器视图内，写盘 + 显示 `✓ Saved` 1.5s | `startAutoSaveTimer()` |
| `Ctrl+S` | 立即保存 + 显示指示器 | `saveEditorContent()` |
| 窗口关闭 `beforeunload` | **双保险**：① 异步 `writeFile`；② 同步 `fasttxt:writeFileSync` | `autosave.js` + `theme-sync.js` |
| 各类磁盘操作（删除/恢复/新建/重命名/导入/排序） | `loadFilesFromDisk()` → `saveFiles()` → 音效 → `updateUI()` | `finalizeFsChange()` |

写盘是**全量覆盖**（编辑器内容整体写入），没有增量补丁或版本历史；
撤销栈只在内存里（`MAX_UNDO = 100`），关闭编辑器即丢失。

---

## 10. 拖拽导入

- 只接受 `.txt` / `.md`，读入后写入**当前视图目录**（根目录或当前文件夹）。
- 写盘成功后会 **`fs.unlinkSync` 删除磁盘上的原文件**（移动语义，需要 `nodeIntegration: true`）。
- ⚠️ 导入**不做防重名**，同名文件会被直接覆盖（与新建/恢复不同）。

---

## 11. 默认文件

`createDefaultFiles()` 仅在 `readDir('')` 返回空（目录为空）时创建三个文件：

| 文件 | 说明 |
|------|------|
| `readme.txt` | 欢迎与功能简介 |
| `notes.md` | 待办示例 |
| `draft.txt` | 可自由编辑的草稿 |

> 内容在 `filesystem.js` 中**硬编码为英文**，`i18n.js` 的 `defaults.*` 翻译目前并未被调用，
> 所以切换中英文不会改变已生成/将生成的默认文件内容。

---

## 12. 本地偏好（localStorage，非磁盘文件）

| Key | 取值 | 作用 |
|-----|------|------|
| `fasttxt-theme` | `dark` / `light` | 深浅主题；**无值时**才跟随母程序主题（`hundun.host.getTheme` / `onThemeChange`） |
| `fasttxt-locale` | `zh` / `en` | 界面语言；无值时回退读母程序的 `hundundesktop-locale`，再回退 `navigator.language` |

（母程序自身设置存在 `hundundesktop-settings`，与插件无关。）

---

## 13. 打包 / 安装注意事项

1. 插件目录下**不再有 `file/`** — 用户数据统一由 `getFastTXTBasePath()` 在首次调用时创建于 `user-data/`，
   无需也不会往插件目录写任何东西。
2. **写入位置是 `user-data/`**，与 exe 同级（开发时与项目根同级），不受 asar 只读限制，无需额外授权。
3. **默认文件首次启动自动创建**，前提是数据目录为空。
4. 迁移前的旧数据 `plugins/fast-txt/file/` 已于 2026-09-29 删除；若手头还有旧备份，
   拷到 `user-data/plugins/fast-txt/file/` 即可继续使用
   （隐藏文件一并拷贝：`.order.json`、`.trash/`、`.bookmarks.json`）。
5. 旧版单文件入口 `plugins/fast-txt/index.html`（97KB 备份）已于 2026-09-29 删除，
   入口以 `manifest.json` 的 `main.html` 为准；如需找回：`git checkout -- plugins/fast-txt/index.html`。

---

## 14. 相关文档

- 本文档：`plugins/fast-txt/STORAGE.md`
- 插件规范：`PLUGIN_SPEC.md` / `PLUGIN_DEVELOPMENT.md`（项目根）
- 项目进度与技术决策：`AGENTS.md`（项目根）
- 变更历史：`CHANGELOG.md`（项目根，2026-09-07 删除逻辑简化、2026-09-23 数据目录迁移、2026-09-24 刷新按钮、2026-09-29 本文档对齐）
