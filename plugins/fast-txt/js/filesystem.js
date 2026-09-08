    // ========== File System Helpers ==========
    const fsAPI = () => window.hundun && window.hundun.fs ? window.hundun.fs : null;

    const getFileInfoFromName = (name) => {
      const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
      return {
        isText: ext === '.txt' || ext === '.md',
        isMarkdown: ext === '.md'
      };
    };

    // 文件对象 → 相对 file 根的完整路径 (保留文件夹归属)
    const getRelPath = (file) => (file.parentPath ? `${file.parentPath}/${file.name}` : file.name);

    // ========== 回收站唯一命名 (防重名) ==========
    // 目标目录下若 name 已存在, 则按 file.txt → file1.txt → file11.txt → file111.txt ...
    // (每次在扩展名前追加一个 '1') 递增, 直到找到磁盘上确实不存在的名字。
    // 直接以磁盘 exists 为准, 避免"先读目录再改名"之间的误差 (Windows rename 会覆盖已存在目标!)
    const pickFreeName = async (rel, name) => {
      const api = fsAPI();
      const prefix = rel ? `${rel}/` : '';
      let candidate = name;
      let guard = 0;
      while (api && guard++ < 10000 && (await api.exists(prefix + candidate))) {
        const dotIdx = candidate.lastIndexOf('.');
        candidate = dotIdx > 0
          ? candidate.slice(0, dotIdx) + '1' + candidate.slice(dotIdx)
          : candidate + '1';
      }
      return candidate;
    };

    // ========== 文件系统操作串行队列 ==========
    // 删除/恢复/粉碎等需要先读目录再改名的操作按队列依次执行,
    // 防止快速连续触发时 (如按住 Delete) 并发读取同一目录导致重名/竞态
    let _fsOpChain = Promise.resolve();
    const runFsOp = (fn) => {
      const run = _fsOpChain.then(fn);
      // 队列自身吞掉错误继续推进; 抛错结果由 run 的调用方自行处理
      _fsOpChain = run.then(() => {}, () => {});
      return run;
    };

    // ========== File Management (Disk-based) ==========
    const createDefaultFiles = async () => {
      const api = fsAPI();
      if (!api) return;

      // 检查是否已有文件
      const existing = await api.readDir('');
      if (existing.length > 0) return; // 已有文件，不创建默认

      // 创建默认文件
      await api.writeFile('readme.txt', 'Welcome to FastTXT!\n\nA retro text file manager.\n\nFeatures:\n- Drag & drop import\n- File editing\n- Trash & shred');
      await api.writeFile('notes.md', '# Notes\n\n## TODO\n- [ ] Try dragging files\n- [ ] Create new files\n- [ ] Test the shredder');
      await api.writeFile('draft.txt', 'This is a draft file.\n\nYou can edit this text freely.');
    };

    const loadFilesFromDisk = async () => {
      // 编辑器打开时禁止重建 files[]，避免 editingFile 变成孤儿引用
      if (currentView === 'editor') return;

      const api = fsAPI();
      if (!api) { files = []; return; }

      // 读取排序信息
      let orderMap = {};
      try {
        const orderJson = await api.readFile(ORDER_FILE);
        if (orderJson) {
          const parsed = JSON.parse(orderJson);
          if (parsed && Array.isArray(parsed.ids)) {
            parsed.ids.forEach((id, idx) => { orderMap[id] = idx; });
          }
        }
      } catch (_) {}

      // 读取正常目录
      const activeEntries = await api.readDir('');
      // 读取回收站
      const trashEntries = await api.readDir(TRASH_DIR);

      const newFiles = [];
      let maxOrder = 0;

      // 处理正常文件（root + 每个文件夹内部）
      for (const entry of activeEntries) {
        if (entry.name === ORDER_FILE || entry.name === TRASH_DIR) continue;
        if (entry.name.startsWith('.')) continue;

        const id = entry.name;
        const order = orderMap[id] !== undefined ? orderMap[id] : maxOrder++;
        if (order >= maxOrder) maxOrder = order + 1;

        if (entry.isDirectory) {
          newFiles.push({
            id: id,
            name: id,
            content: '',
            deleted: false,
            order: order,
            isFolder: true,
            parentPath: ''  // 文件夹在根目录
          });
          // 读取文件夹内部的文件
          try {
            const subEntries = await api.readDir(id);
            for (const sub of subEntries) {
              if (sub.name.startsWith('.')) continue;
              const subId = `${id}/${sub.name}`;
              const subOrder = orderMap[subId] !== undefined ? orderMap[subId] : maxOrder++;
              if (subOrder >= maxOrder) maxOrder = subOrder + 1;
              newFiles.push({
                id: subId,
                name: sub.name,
                content: null,
                deleted: false,
                order: subOrder,
                isFolder: sub.isDirectory,
                parentPath: id
              });
            }
          } catch (_) {}
        } else {
          // 根目录文件
          newFiles.push({
            id: id,
            name: id,
            content: null,
            deleted: false,
            order: order,
            isFolder: false,
            parentPath: ''
          });
        }
      }

      // 处理回收站: 平铺结构, 每个条目直接以磁盘名展示 (新逻辑只回收文件, 不再保留文件夹/原路径)
      for (const entry of trashEntries) {
        if (entry.name.startsWith('.')) continue;
        const diskName = entry.name;
        const order = orderMap[diskName] !== undefined ? orderMap[diskName] : maxOrder++;
        if (order >= maxOrder) maxOrder = order + 1;
        // 注: 旧版本可能有"整文件夹入回收站"的残留 → 仍按 isFolder 展示并允许整体恢复到根目录; 新逻辑不会再产生
        newFiles.push({
          id: diskName,
          name: diskName,
          parentPath: '',
          content: entry.isDirectory ? '' : null,
          deleted: true,
          order: order,
          isFolder: !!entry.isDirectory,
          diskName: diskName
        });
      }

      // 按 orderMap 中不存在的排在最后
      newFiles.sort((a, b) => a.order - b.order);
      files = newFiles;
    };

    const saveOrderToDisk = async () => {
      const api = fsAPI();
      if (!api) return;
      const active = getActiveFiles();
      const deleted = getDeletedFiles();
      const allSorted = [...active, ...deleted];
      const ids = allSorted.map(f => f.id);
      await api.writeFile(ORDER_FILE, JSON.stringify({ ids }, null, 2));
    };

    // ========== 书签持久化 ==========
    const saveBookmarksToDisk = async (filePath) => {
      const api = fsAPI();
      if (!api) return;
      const key = filePath || '__default__';
      try {
        // 读取现有书签数据
        let allBookmarks = {};
        const existing = await api.readFile(BOOKMARKS_FILE);
        if (existing) {
          allBookmarks = JSON.parse(existing);
        }
        // 更新指定文件的书签
        const bookmarkArray = Object.keys(bookmarks).map(Number);
        allBookmarks[key] = bookmarkArray;
        await api.writeFile(BOOKMARKS_FILE, JSON.stringify(allBookmarks, null, 2));
      } catch (err) {
        console.warn('[FastTXT] saveBookmarks failed:', err);
      }
    };

    const loadBookmarksFromDisk = async (filePath) => {
      const api = fsAPI();
      bookmarks = {};
      if (!api) return;
      const key = filePath || '__default__';
      try {
        const data = await api.readFile(BOOKMARKS_FILE);
        if (data) {
          const allBookmarks = JSON.parse(data);
          if (allBookmarks[key] && Array.isArray(allBookmarks[key])) {
            allBookmarks[key].forEach(line => {
              bookmarks[Number(line)] = true;
            });
          }
        }
      } catch (err) {
        console.warn('[FastTXT] loadBookmarks failed:', err);
      }
    };

    const saveFiles = async () => {
      await saveOrderToDisk();
    };

    // 磁盘变更后的公共收尾: 重新读盘 → 保存排序 → 播放音效 → 刷新界面
    const finalizeFsChange = async (soundName) => {
      await loadFilesFromDisk();
      saveFiles();
      playSound(soundName || 'exit');
      updateUI();
    };
