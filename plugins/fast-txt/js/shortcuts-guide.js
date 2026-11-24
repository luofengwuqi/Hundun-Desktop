/**
 * FastTXT 首次启动时投放的《快捷键操作指南》
 *
 * ⚠️ 内容必须与 keyboard.js / md-preview.js / file-actions.js 的真实按键一致 ——
 * 以后改快捷键（或加新快捷键）时，记得同步改这里，这是用户唯一能翻到的说明。
 */

const SHORTCUT_GUIDE_ZH = `# 快捷键操作指南

> 这份文件由 FastTXT 第一次启动时放进来，随时可以删改。
> 想不起按键就打开它看看。

## 文件列表

| 按键 | 作用 |
| --- | --- |
| W A S D / 方向键 | 移动选中项 |
| 在第一行按 ↑ | 跳到搜索框 |
| 空格 / Enter | 打开文件、进入文件夹、执行底部按钮 |
| Esc | 退出文件夹 → 退出回收站 → 返回母程序 |
| M | 重命名（文件和文件夹都可以） |
| Delete / Backspace | 移到回收站（文件夹非空会先问一句） |

搜索框里：↑ 进入搜索，↓ 回到列表，Esc 清空并退出搜索。

底部四个按钮：＋ 新建（TXT / Markdown / 文件夹）、🗑️ 回收站、📁 在资源管理器打开、刷新。

鼠标操作：双击文件名改名，把文件拖进窗口就是导入，拖到粉碎机是永久删除。

## 编辑器

| 快捷键 | 作用 |
| --- | --- |
| Ctrl + S | 保存 |
| Ctrl + F | 查找 |
| Ctrl + H | 替换 |
| Ctrl + X | 剪切当前行 |
| Ctrl + D | 复制当前行 |
| Ctrl + Z | 撤销 |
| Ctrl + Y | 重做 |
| Tab | 插入两个空格 |
| Esc | 关闭编辑器 |

查找栏里：Enter 下一个、Shift + Enter 上一个、Esc 关闭。

## Markdown 的浏览与编辑

打开 .md 文件默认进**浏览模式**（Typora 式实时渲染，不是纯文本）。

- 点任意一段 → 直接改那一段的源码，其余部分照常渲染
- 右下角「浏览 / 编辑」滑块切换整体视图
- **Ctrl + Tab** 在浏览和编辑之间来回切

## 窗口

- 顶部 📌 图钉：窗口置顶
- 顶部深色 / 浅色开关：切换主题（没手动切过时跟随母程序）
- 顶部 ✕：关闭子程序回到母程序
`;

const SHORTCUT_GUIDE_EN = `# Shortcut Guide

> Created by FastTXT on first launch. Feel free to edit or delete it.

## File list

| Key | Action |
| --- | --- |
| W A S D / arrows | Move selection |
| Up on the first row | Jump to the search box |
| Space / Enter | Open a file, enter a folder, press a footer button |
| Esc | Leave folder → leave trash → back to the host app |
| M | Rename (files and folders) |
| Delete / Backspace | Move to trash (folders ask first if not empty) |

Search box: Up to enter, Down back to the list, Esc clears and leaves.

Footer: + New (TXT / Markdown / Folder), trash, open in file manager, refresh.

Mouse: double-click a file name to rename, drop files into the window to import,
drop into the shredder to delete permanently.

## Editor

| Shortcut | Action |
| --- | --- |
| Ctrl + S | Save |
| Ctrl + F | Find |
| Ctrl + H | Replace |
| Ctrl + X | Cut current line |
| Ctrl + D | Duplicate current line |
| Ctrl + Z | Undo |
| Ctrl + Y | Redo |
| Tab | Insert two spaces |
| Esc | Close the editor |

Find bar: Enter next, Shift + Enter previous, Esc close.

## Markdown view modes

.md files open in **browse mode** (Typora-style live rendering).

- Click any block to edit that block's source, everything else stays rendered
- The 浏览 / 编辑 switch at the bottom right toggles the whole view
- **Ctrl + Tab** flips between browse and edit

## Window

- 📌 pin: keep the window on top
- Theme switch in the header (follows the host app until you toggle it)
- ✕ closes the plugin and returns to the host app
`;

// 按当前语言挑选指南文件名与内容
const getShortcutGuide = () => {
  const isEn = typeof FastTXTI18n !== 'undefined' && FastTXTI18n.getLocale() === 'en';
  return isEn
    ? { name: 'Shortcut Guide.md', content: SHORTCUT_GUIDE_EN }
    : { name: '快捷键操作指南.md', content: SHORTCUT_GUIDE_ZH };
};
