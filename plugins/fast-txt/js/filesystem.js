    // ========== File System Helpers ==========
    const fsAPI = () => window.hundun && window.hundun.fs ? window.hundun.fs : null;

    const getFileInfoFromName = (name) => {
      const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
      return {
        isText: ext === '.txt' || ext === '.md',
        isMarkdown: ext === '.md'
      };
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

      // 处理回收站文件
      for (const entry of trashEntries) {
        if (entry.name.startsWith('.')) continue;
        const id = entry.name;
        const order = orderMap[id] !== undefined ? orderMap[id] : maxOrder++;
        if (order >= maxOrder) maxOrder = order + 1;

        if (entry.isDirectory) {
          newFiles.push({
            id: id,
            name: id,
            content: '',
            deleted: true,
            order: order,
            isFolder: true
          });
        } else {
          newFiles.push({
            id: id,
            name: id,
            content: null,
            deleted: true,
            order: order,
            isFolder: false
          });
        }
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

    const saveFiles = async () => {
      await saveOrderToDisk();
    };
