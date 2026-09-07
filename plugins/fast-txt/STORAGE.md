# FastTXT 存储说明

## 文件存放位置

FastTXT 的用户文件存放在 **插件目录下的 `file/` 子目录**。

```
plugins/
└── fast-txt/
    ├── manifest.json      ← 插件配置
    ├── main.html          ← 插件界面入口 (引用 css/ 与 js/)
    ├── css/               ← 样式文件夹 (11 个文件)
    ├── js/                ← 脚本文件夹 (15 个文件)
    ├── STORAGE.md         ← 本文档
    ├── file/              ← 用户数据目录
    │   ├── readme.txt
    │   ├── notes.md
    │   ├── NewFolder/     ← 用户创建的文件夹
    │   │   └── nested.md
    │   ├── .order.json    ← 排序信息（隐藏文件）
    │   └── .trash/        ← 回收站（隐藏文件夹，平铺存放被删文件）
    │       ├── old_file.txt
    │       └── another.txt1 ← 重名时自动改名（见下文）
    └── ...
```

## 回收站 (.trash/) — 平铺简化方案

回收站 **只存文件，不存文件夹、不保留任何原路径信息**，删除/恢复语义非常简单：

- **删除文件**（无论在根目录还是文件夹内）：直接移入 `.trash/`，**恢复时一律回到 `file/` 根目录**，不再还原到原文件夹。
- **删除文件夹**：不把文件夹整体放入回收站。弹警告确认后，遍历该文件夹内**所有文件**（含子目录，递归）逐个平铺移入 `.trash/`，然后删除已搬空的文件夹。恢复时每个文件同样直接回到根目录。
- **空文件夹删除**：不经过回收站，直接物理删除。
- **恢复**：把 `.trash/` 里的文件移回根目录。
- **粉碎**：把 `.trash/` 里的文件永久删除。

> 文件夹结构在删除后不再保留，这是刻意简化 —— 删除即"拆平"，避免维护路径归属的复杂逻辑。

### 防重名规则

删除文件进入 `.trash/` 时，如果目标目录（回收站）已存在同名条目，则自动改名，规则为**逐个追加 "1"**：

```
file.txt 已存在 → 尝试 file1.txt
file1.txt 也存在 → 尝试 file11.txt
file11.txt 也存在 → 尝试 file111.txt ...
```

恢复文件回到 `file/` 根目录时，如果根目录已有同名条目，同样按上述规则改名，**绝不覆盖任何现有文件**。

### 兼容性

- 早期版本曾把 **整个文件夹** 移入 `.trash/`（并配合 `.trash/.trash.json` 清单记录原路径）。
- 本次简化后不再生成文件夹型回收项，也不再读写 `.trash/.trash.json`（残留的旧清单文件是隐藏文件，自动被忽略）。
- 旧版本残留在 `.trash/` 里的**文件夹**仍会被列出并允许**整体恢复到根目录**（兼容处理），不会丢失数据。

## 路径是动态的

**这个路径不是固定的**，会随应用安装位置变化。所有应用数据统一放在项目/安装根目录下。

例如：
- 开发环境: `E:\code2\huntunLite\plugins\fast-txt\file\`
- 安装到 `D:\Apps\HundunLite`: `D:\Apps\HundunLite\plugins\fast-txt\file\`

**路径通过 `pluginManager.plugins.get(pluginId).path` 动态获取**，不要硬编码。

## 文件夹模式

FastTXT 支持文件夹浏览，类似垃圾桶模式：

- **进入文件夹**: 点击文件夹卡片 → 进入内部视图，显示 `parentPath` 匹配的文件
- **返回根目录**: 点击面包屑 `← Back` 按钮 或 底部 `📁` 按钮
- **模式互斥**: 文件夹模式和垃圾桶模式不能同时激活，切换时自动退出另一种
- **创建文件**: 在文件夹内创建的文件自动归属当前文件夹 (`parentPath = 当前路径`)

### 文件对象的 parentPath 字段

```javascript
{
  id: 'NewFolder/nested.md',  // id = parentPath/name
  name: 'nested.md',
  parentPath: 'NewFolder',    // 所属文件夹名，根目录为空字符串 ''
  isFolder: false,
  content: null,              // 延迟加载
  ...
}
```

- 根目录文件: `parentPath = ''`
- 文件夹内文件: `parentPath = '文件夹名'`
- 嵌套文件夹内文件: `parentPath = '文件夹名/子文件夹名'`（目前仅支持一层嵌套读取）

## 应用数据目录结构

所有运行时数据都放在项目根目录的 `user-data/` 下：

```
E:\code2\huntunLite\
├── src/
├── plugins/
├── user-data/              ← 运行时数据（.gitignore 已排除）
│   ├── gpu-cache/          ← Electron GPU 缓存
│   ├── huntun-lite-data/   ← 插件通用存储 (database.js)
│   └── ...
└── ...
```

## 路径解析逻辑（代码）

```javascript
// index.js 中的 getFastTXTBasePath()
function getFastTXTBasePath(pluginId) {
  let pluginPath = null

  // 1. 优先从插件管理器获取
  if (fasttxtPluginManager) {
    const plugin = fasttxtPluginManager.plugins.get(pluginId)
    if (plugin && plugin.path) pluginPath = plugin.path
  }

  // 2. fallback: 扫描器路径
  if (!pluginPath && fasttxtPluginManager?.loader) {
    pluginPath = path.join(fasttxtPluginManager.loader.pluginsDir, pluginId)
  }

  // 3. 最终 fallback
  if (!pluginPath) {
    pluginPath = path.join(__dirname, '../../plugins', pluginId)
  }

  // 数据目录 = 插件目录/file/
  return path.join(pluginPath, 'file')
}
```

## Setup 安装程序注意事项

打包/安装时需要确保 `plugins/fast-txt/file/` 目录可以被写入。

1. **不要把 `file/` 目录打包进安装包** — 它应该在首次运行时自动创建
2. **确保安装目录有写入权限** — 或者改用 `app.getPath('userData')` 存储
3. **默认文件在首次启动时创建** — `readme.txt`, `notes.md`, `draft.txt`

## 隐藏文件

以下文件/目录以 `.` 开头，不会在 FastTXT 界面中显示：

| 文件 | 用途 |
|------|------|
| `.order.json` | 记录文件排序顺序 |
| `.trash/` | 回收站，平铺存放被删文件（重名自动按 `base` → `base1` → `base11` 改名） |
| `.trash/.trash.json` | 旧版回收站清单残留（已不再使用，自动忽略） |
