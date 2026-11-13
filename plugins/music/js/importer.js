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

    // ---------- 拖入导入 (支持文件与文件夹) ----------
    // 取拖入 File 的真实磁盘路径。
    // Electron: 优先 webUtils.getPathForFile (新版无 File.path), 退回 f.path (≤31 有)。
    const filePathOf = (f) => {
      if (!f) return null;
      try {
        const w = require('electron').webUtils;
        if (w && typeof w.getPathForFile === 'function') {
          const p = w.getPathForFile(f);
          if (p) return p;
        }
      } catch (_) { /* Electron 旧版无 webUtils */ }
      return (typeof f.path === 'string' && f.path) ? f.path : null;
    };

    const isDirPath = (p) => {
      try { return require('fs').statSync(p).isDirectory(); } catch (_) { return false; }
    };

    // Linux 文件管理器(XDND/Wayland)有时只给文本目标 text/uri-list 等, Chromium
    // 未必转成 dataTransfer.files; 且这类数据在 dragenter/dragover 阶段受保护模式
    // 限制读不到, 只能在 drop 处理里当场解析。
    const uriToPath = (u) => {
      try {
        const s = String(u || '').trim();
        if (!s) return null;
        if (s.startsWith('file://')) {
          const rest = s.slice(7);
          const slash = rest.indexOf('/');
          return decodeURIComponent(slash >= 0 ? rest.slice(slash) : '/' + rest);
        }
        return s.startsWith('/') ? s : null;
      } catch (_) { return null; }
    };

    const pathsFromText = (dt) => {
      const out = [];
      for (const type of ['text/uri-list', 'text/x-moz-url', 'text/plain']) {
        let text = '';
        try { text = dt.getData(type) || ''; } catch (_) { continue; }
        for (const line of String(text).split(/\r?\n/)) {
          const p = uriToPath(line);
          if (p) out.push(p);
        }
      }
      return out;
    };

    // 文件系统 Entry 遍历 (仅作为拿不到路径时的兜底)
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

    // 同步快照: drop 处理函数返回后 DataTransfer 立即失效, 必须当场取完
    // 关键修复: 直接读 dataTransfer.files (Electron 原生对象带真实路径);
    // 旧实现走 webkitGetAsEntry().file(), 拿到的 File 没有 path → 导入列表为空 → "拖入无反应"
    const snapshotDrop = (dt) => {
      const paths = [];
      const dirs = [];
      const entries = [];
      const seen = new Set();
      const add = (p) => {
        if (!p || seen.has(p)) return;
        seen.add(p);
        if (isDirPath(p)) dirs.push(p);
        else {
          try { if (require('fs').statSync(p).isFile()) paths.push(p); } catch (_) { /* 不存在的路径忽略 */ }
        }
      };
      for (const f of dt.files || []) add(filePathOf(f));
      // 兜底: files 为空但拖放数据里带 file:// URI / 绝对路径 (Linux 常见)
      for (const p of pathsFromText(dt)) add(p);
      if (dt.items && dt.items.length) {
        for (const item of dt.items) {
          if (item.kind !== 'file') continue;
          const entry = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null;
          if (!entry) continue;
          if (entry.isDirectory) entries.push(entry);
        }
      }
      return { paths, dirs, entries };
    };

    // 文件夹 → 主进程递归扫音频 (与导入菜单同一实现, 过滤逻辑单一来源)
    const expandDirs = async (dirs, entries) => {
      const api = musicApi();
      const out = [];
      if (!api) return out;
      for (const d of dirs || []) {
        const found = await api.scanFolder(d);
        if (found && found.length) out.push(...found);
      }
      // files 里没带目录信息时的兜底: 展开 entry
      for (const entry of entries || []) {
        const files = [];
        await _walkEntry(entry, files, 0);
        for (const f of files) { const p = filePathOf(f); if (p) out.push(p); }
      }
      return out;
    };

    const setupDragImport = () => {
      const hint = document.getElementById('dropHint');
      let dragDepth = 0;

      // Linux 文件管理器除 'Files' 外还可能只声明 text/uri-list / text/x-moz-url,
      // 只认 'Files' 会漏掉拖入 (dragover 不 preventDefault → Chromium 直接导航到 file://)。
      const hasFiles = (e) => {
        const dt = e.dataTransfer;
        if (!dt) return false;
        return [...(dt.types || [])].some(t => t === 'Files' || /uri-list|x-moz-url/i.test(t));
      };
      const showHint = (on) => { if (hint) hint.style.display = on ? 'flex' : 'none'; };

      // 捕获阶段挂在 document 上: 不受子元素 stopPropagation 影响, 且必然早于默认导航
      const onDragEnter = (e) => {
        // 无条件拦默认导航: 拖入文件时 Chromium 会尝试导航到 file:// 把页面替换掉
        e.preventDefault();
        if (!hasFiles(e)) return;
        dragDepth++;
        showHint(true);
      };
      const onDragOver = (e) => {
        e.preventDefault();
        if (!hasFiles(e)) return; // 内部队列拖拽不干预, 保留其 effectAllowed='move'
        // Linux XDND 的 effectAllowed 常只有 'copy', 必须声明 copy; 写成 move 会让
        // Chromium 判定不兼容并取消放置 → drop 事件根本不派发。
        try { e.dataTransfer.dropEffect = 'copy'; } catch (_) {}
        showHint(true);
      };
      const onDragLeave = (e) => {
        dragDepth = Math.max(0, dragDepth - 1);
        // 拖出窗口边界时 force 收掉 (子元素间移动的 dragleave 不算离开)
        const out = e.clientX <= 0 || e.clientY <= 0 ||
          e.clientX >= window.innerWidth || e.clientY >= window.innerHeight;
        if (dragDepth === 0 || out) { dragDepth = 0; showHint(false); }
      };
      const onDrop = async (e) => {
        // 无论带不带 Files 都拦住默认行为 (否则窗口会被导航到 file://, 页面直接被替换)
        e.preventDefault();
        e.stopPropagation();
        dragDepth = 0;
        showHint(false);

        const dt = e.dataTransfer;
        if (!dt) return;
        const snap = snapshotDrop(dt);   // 同步取完
        if (!snap.paths.length && !snap.dirs.length && !snap.entries.length) {
          showToast(MusicI18n.t('import.none'), 'info');
          return;
        }

        const fromDirs = await expandDirs(snap.dirs, snap.entries);
        const candidates = [...snap.paths, ...fromDirs];
        const audio = [];
        const seen = new Set();
        for (const p of candidates) {
          if (!isAudioFile(p) || seen.has(p)) continue;
          seen.add(p);
          audio.push(p);
        }
        const skipped = candidates.length - audio.length;

        if (!audio.length) {
          showToast(MusicI18n.t('import.none'), 'info');
          return;
        }
        playSound('OK');
        await importPaths(audio);
        if (skipped > 0) showToast(MusicI18n.t('import.skipped', { count: skipped }), 'info');
      };

      document.addEventListener('dragenter', onDragEnter, true);
      document.addEventListener('dragover', onDragOver, true);
      document.addEventListener('dragleave', onDragLeave, true);
      document.addEventListener('drop', onDrop, true);
      // 部分环境 dragleave 不触发: 拖到窗口外松手时兜底收掉蒙层
      window.addEventListener('blur', () => { dragDepth = 0; showHint(false); });
    };
