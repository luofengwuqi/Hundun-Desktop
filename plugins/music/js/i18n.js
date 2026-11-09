/**
 * Music i18n - 轻量级多语言模块
 */
const MusicI18n = (() => {
  const zh = {
    theme: { dark: '深色', light: '浅色' },
    header: { back: '返回', minimize: '最小化', pin: '窗口置顶' },
    player: {
      prev: '上一首',
      next: '下一首',
      playPause: '播放 / 暂停',
      modeSequence: '顺序播放',
      modeShuffle: '随机播放',
      emptyTitle: '还没有音乐',
      emptyHint: '打开下方音乐库导入歌曲',
    },
    library: {
      title: '音乐库',
      searchPlaceholder: '搜索音乐...',
      newGroup: '新建分组',
      groupAll: '全部音乐',
      empty: '还没有歌曲',
      emptyHint: '点下方 + 导入, 或直接把音频文件拖进来',
      emptyFiltered: '没有匹配的歌曲',
      play: '点播',
      del: '删除',
      addGroup: '添加分组',
      import: '导入音乐 (选文件或文件夹)',
      folder: '在文件管理器中打开',
      refresh: '刷新 (检查新增与删除)',
      count: '{count} 首',
    },
    groups: {
      newPrompt: '新建分组',
      newTitle: '分组名称',
      nameRequired: '请输入分组名称',
      nameExists: '已存在同名分组',
      deleteTitle: '删除分组',
      deleteConfirm: '删除分组 "{name}"？歌曲不会被删除。',
      unremovable: '「全部音乐」不能移除',
    },
    import: {
      menuTitle: '导入音乐',
      menuFile: '选择文件',
      menuFolder: '选择文件夹',
      dropHere: '松手导入音乐 (源文件将被移入)',
      imported: '已导入 {count} 首',
      skipped: '跳过 {count} 个非音频文件',
      failed: '{count} 个导入失败',
      none: '没有可导入的音频文件',
      cancelled: '已取消',
    },
    refresh: {
      added: '新增 {count} 首',
      removed: '移除 {count} 首 (分组与队列记录已清理)',
      upToDate: '没有变化',
    },
    queue: {
      title: '队列',
      empty: '队列为空, 点播歌曲后会出现在这里',
      hint: '拖动排序 · Shift+↑/↓ 移动 · ✕ 移除',
      remove: '移除',
    },
    modal: {
      ok: '确定',
      cancel: '取消',
      deleteTitle: '删除歌曲',
      deleteConfirm: '确定删除 "{name}"？\n文件将从磁盘移除, 且不可恢复。',
    },
    toast: {
      importError: '导入失败: {name}',
    },
  };

  const en = {
    theme: { dark: 'Dark', light: 'Light' },
    header: { back: 'Back', minimize: 'Minimize', pin: 'Pin window' },
    player: {
      prev: 'Previous',
      next: 'Next',
      playPause: 'Play / Pause',
      modeSequence: 'Sequential',
      modeShuffle: 'Shuffle',
      emptyTitle: 'No music yet',
      emptyHint: 'Open the library below to import songs',
    },
    library: {
      title: 'Library',
      searchPlaceholder: 'Search music...',
      newGroup: 'New group',
      groupAll: 'All music',
      empty: 'No songs yet',
      emptyHint: 'Click + below to import, or drag audio files here',
      emptyFiltered: 'No matching songs',
      play: 'Play',
      del: 'Delete',
      addGroup: 'Add to group',
      import: 'Import music (files or folder)',
      folder: 'Open in file manager',
      refresh: 'Refresh (detect added/removed)',
      count: '{count} songs',
    },
    groups: {
      newPrompt: 'New group',
      newTitle: 'Group name',
      nameRequired: 'Group name is required',
      nameExists: 'A group with this name already exists',
      deleteTitle: 'Delete group',
      deleteConfirm: 'Delete group "{name}"? Songs will be kept.',
      unremovable: '"All music" cannot be removed',
    },
    import: {
      menuTitle: 'Import music',
      menuFile: 'Choose files',
      menuFolder: 'Choose folder',
      dropHere: 'Drop to import (source files will be moved in)',
      imported: 'Imported {count} songs',
      skipped: 'Skipped {count} non-audio files',
      failed: '{count} imports failed',
      none: 'No audio files to import',
      cancelled: 'Cancelled',
    },
    refresh: {
      added: '{count} new songs',
      removed: 'Removed {count} songs (group & queue records cleaned)',
      upToDate: 'Up to date',
    },
    queue: {
      title: 'Queue',
      empty: 'Queue is empty. Played songs will show up here.',
      hint: 'Drag to reorder · Shift+↑/↓ to move · ✕ to remove',
      remove: 'Remove',
    },
    modal: {
      ok: 'OK',
      cancel: 'Cancel',
      deleteTitle: 'Delete song',
      deleteConfirm: 'Delete "{name}"?\nThe file will be removed from disk permanently.',
    },
    toast: {
      importError: 'Import failed: {name}',
    },
  };

  const detect = () => {
    try {
      const nav = (navigator.language || 'zh').toLowerCase();
      return nav.startsWith('zh') ? 'zh' : 'en';
    } catch (e) {
      return 'zh';
    }
  };

  let lang = detect();
  const table = () => (lang === 'en' ? en : zh);

  const get = (key) => {
    const parts = key.split('.');
    let node = table();
    for (const p of parts) {
      if (node == null || typeof node !== 'object') return undefined;
      node = node[p];
    }
    return node;
  };

  const t = (key, params) => {
    let s = get(key);
    if (typeof s !== 'string') return key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        s = s.split('{' + k + '}').join(String(v));
      }
    }
    return s;
  };

  return { t, get, setLang: (l) => { if (l === 'zh' || l === 'en') lang = l; }, getLang: () => lang };
})();
