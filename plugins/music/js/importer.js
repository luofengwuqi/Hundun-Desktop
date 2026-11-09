    // ========== Importer: 拖入 / 选择导入 ==========
    // 导入语义 (需求): 移动 —— 复制到 user-data 后删除原文件 (主进程 music:importFile 实现, 跨盘安全)

    const musicApi = () => (window.hundun && window.hundun.music) || null;

    // 批量导入绝对路径
    const importPaths = async (paths) => {
      const api = musicApi();
      if (!api || !Array.isArray(paths) || paths.length === 0) return { ok: 0, fail: 0 };
      let ok = 0, fail = 0;
      for (const p of paths) {
        const res = await api.importFile(p);
        if (res && res.ok) ok++;
        else fail++;
      }
      await refreshLibrary(true);
      if (ok > 0) showToast(MusicI18n.t('import.imported', { count: ok }), 'success');
      if (fail > 0) showToast(MusicI18n.t('import.failed', { count: fail }), 'error');
      return { ok, fail };
    };

    // 弹出导入方式菜单 (文件 / 文件夹), 锚定在底部 + 按钮
    const showImportMenu = () => {
      const anchor = document.getElementById('importBtn');
      if (!anchor) return;
      showMenuPopover(anchor, [
        { label: '📂 ' + MusicI18n.t('import.menuFile'), action: () => importFromPicker('file') },
        { label: '📁 ' + MusicI18n.t('import.menuFolder'), action: () => importFromPicker('folder') },
      ]);
    };

    const importFromPicker = async (mode) => {
      const api = musicApi();
      if (!api) return;
      let paths = null;
      if (mode === 'folder') {
        const folder = await api.pickFolder();
        if (!folder) return;
        paths = await api.scanFolder(folder);
        if (!paths || !paths.length) { showToast(MusicI18n.t('import.none'), 'info'); return; }
      } else {
        paths = await api.pickAudio();
        if (!paths) return;
      }
      playSound('OK');
      await importPaths(paths);
    };

    // ---------- 拖入导入 (支持文件与文件夹, 递归遍历) ----------
    const _walkEntry = (entry, out, depth) => new Promise((resolve) => {
      if (!entry || depth > 4) { resolve(); return; }
      if (entry.isFile) {
        entry.file(f => { out.push(f); resolve(); }, () => resolve());
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const readBatch = () => reader.readEntries(async batch => {
          if (!batch || batch.length === 0) { resolve(); return; }
          for (const e of batch) await _walkEntry(e, out, depth + 1);
          readBatch();
        }, () => resolve());
        readBatch();
      } else {
        resolve();
      }
    });

    const collectDroppedFiles = async (dataTransfer) => {
      const out = [];
      // 优先 entries API (能展开文件夹)
      if (dataTransfer.items && dataTransfer.items.length &&
          typeof dataTransfer.items[0].webkitGetAsEntry === 'function') {
        const entries = [];
        for (const item of dataTransfer.items) {
          if (item.kind !== 'file') continue;
          const entry = item.webkitGetAsEntry();
          if (entry) entries.push(entry);
        }
        if (entries.length) {
          for (const entry of entries) await _walkEntry(entry, out, 0);
          return out;
        }
      }
      for (const f of dataTransfer.files || []) out.push(f);
      return out;
    };

    const setupDragImport = () => {
      const hint = document.getElementById('dropHint');
      let dragDepth = 0;

      const hasFiles = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');

      window.addEventListener('dragenter', (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        dragDepth++;
        if (hint) hint.style.display = '';
      });
      window.addEventListener('dragover', (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      });
      window.addEventListener('dragleave', (e) => {
        if (!e.dataTransfer) return;
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0 && hint) hint.style.display = 'none';
      });
      window.addEventListener('drop', async (e) => {
        if (!e.dataTransfer) return;
        e.preventDefault();
        dragDepth = 0;
        if (hint) hint.style.display = 'none';
        const files = await collectDroppedFiles(e.dataTransfer);
        // Electron: 拖入的 File 带 .path (绝对路径)
        const paths = files.map(f => (f && typeof f.path === 'string') ? f.path : null).filter(Boolean);
        if (!paths.length) {
          showToast(MusicI18n.t('import.none'), 'info');
          return;
        }
        const audio = paths.filter(p => isAudioFile(p));
        const skipped = paths.length - audio.length;
        playSound('OK');
        await importPaths(audio);
        if (skipped > 0) showToast(MusicI18n.t('import.skipped', { count: skipped }), 'info');
      });
    };
