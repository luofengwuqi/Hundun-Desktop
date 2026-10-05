    // ========== File System Helpers ==========
    const fsAPI = () => window.hundun && window.hundun.fs ? window.hundun.fs : null;

    const getRelPath = (file) => (file.parentPath ? `${file.parentPath}/${file.name}` : file.name);

    // ========== 回收站唯一命名 ==========
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
    let _fsOpChain = Promise.resolve();
    const runFsOp = (fn) => {
      const run = _fsOpChain.then(fn);
      _fsOpChain = run.then(() => {}, () => {});
      return run;
    };

    // ========== File Management (Disk-based) ==========
    const createDefaultFiles = async () => {
      const api = fsAPI();
      if (!api) return;
      const existing = await api.readDir('');
      if (existing.length > 0) return;
      await api.writeFile('hello.bat', FastCmdI18n.t('defaults.bat'));
      await api.writeFile('hello.ps1', FastCmdI18n.t('defaults.ps1'));
    };

    const loadFilesFromDisk = async () => {
      if (currentView === 'editor') return;
      const api = fsAPI();
      if (!api) { files = []; return; }

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

      const activeEntries = await api.readDir('');
      const trashEntries = await api.readDir(TRASH_DIR);
      const newFiles = [];
      let maxOrder = 0;

      for (const entry of activeEntries) {
        if (entry.name === ORDER_FILE || entry.name === TRASH_DIR) continue;
        if (entry.name.startsWith('.')) continue;
        const id = entry.name;
        const order = orderMap[id] !== undefined ? orderMap[id] : maxOrder++;
        if (order >= maxOrder) maxOrder = order + 1;

        if (entry.isDirectory) {
          newFiles.push({ id, name: id, content: '', deleted: false, order, isFolder: true, parentPath: '' });
          try {
            const subEntries = await api.readDir(id);
            for (const sub of subEntries) {
              if (sub.name.startsWith('.')) continue;
              const subId = `${id}/${sub.name}`;
              const subOrder = orderMap[subId] !== undefined ? orderMap[subId] : maxOrder++;
              if (subOrder >= maxOrder) maxOrder = subOrder + 1;
              newFiles.push({ id: subId, name: sub.name, content: null, deleted: false, order: subOrder, isFolder: sub.isDirectory, parentPath: id });
            }
          } catch (_) {}
        } else {
          newFiles.push({ id, name: id, content: null, deleted: false, order, isFolder: false, parentPath: '' });
        }
      }

      for (const entry of trashEntries) {
        if (entry.name.startsWith('.')) continue;
        const diskName = entry.name;
        const order = orderMap[diskName] !== undefined ? orderMap[diskName] : maxOrder++;
        if (order >= maxOrder) maxOrder = order + 1;
        newFiles.push({ id: diskName, name: diskName, parentPath: '', content: entry.isDirectory ? '' : null, deleted: true, order, isFolder: !!entry.isDirectory, diskName });
      }

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

    const saveFiles = async () => { await saveOrderToDisk(); };

    // ========== 手动刷新: 读取磁盘真实文件并同步到程序 ==========
    // 用于外部修改文件目录后 (资源管理器增删文件) 手动同步列表
    const refreshFilesFromDisk = async () => {
      playSound('click');
      await loadFilesFromDisk();

      // 刷新后当前文件夹可能已被外部删除 → 自动退出文件夹模式
      if (isFolderMode && currentFolderPath) {
        const folderStillExists = files.some(f => f.isFolder && !f.deleted && f.id === currentFolderPath);
        if (!folderStillExists) {
          isFolderMode = false;
          currentFolderPath = '';
          selectedRow = 0;
          selectedCol = 0;
        }
      }

      updateUI();
    };

    const finalizeFsChange = async (soundName) => {
      await loadFilesFromDisk();
      saveFiles();
      playSound(soundName || 'exit');
      updateUI();
    };
