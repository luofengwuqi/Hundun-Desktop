    // ========== Importer: 外部文件拖入导入 (决策58, 对齐 Music 导入规范) ==========
    // 语义: 移动 —— 主进程复制原始字节到插件数据目录后删除源文件 (跨盘安全, 保留 BOM / 原编码)。
    // 渲染层只负责「取路径 → 过滤 → 批量回报」, 所有磁盘写入一律走 window.hundun.imports,
    // 不再用 FileReader 读文本重写盘、不再在渲染层直接 unlinkSync 删源文件。

    const importsApi = () => (window.hundun && window.hundun.imports) || null;

    // 导入目标: 文件夹视图下落进当前文件夹 (FastCmd 是单级目录, 恒为根)
    const importTargetDir = () => (isFolderMode ? (currentFolderPath || '') : '');

    const importBaseName = (p) => String(p || '').split(/[\\/]/).pop() || '';

    // 过滤逻辑与 filesystem.js 的 getFileInfoFromName 同源 (主进程再做一次白名单终审)
    const isImportable = (p) => {
      try { return getFileInfoFromName(importBaseName(p)).isText; } catch (_) { return false; }
    };

    // 批量导入绝对路径: 逐个回报成功/失败, 刷新列表并 toast 计数 (与 Music 同构)
    const importPaths = async (paths) => {
      const api = importsApi();
      if (!api || !Array.isArray(paths) || paths.length === 0) return { ok: 0, fail: 0 };
      let ok = 0, fail = 0;
      for (const p of paths) {
        const res = await api.importFile(p, importTargetDir());
        if (res && res.ok) ok++;
        else fail++;
      }
      // 磁盘变更统一收尾: 重新读盘 → 保存排序 → 音效 → 刷新界面
      await finalizeFsChange(ok > 0 ? 'OK' : 'error');
      if (ok > 0) showToast('✅', FastTXTI18n.t('import.imported', { count: ok }));
      if (fail > 0) showToast('❌', FastTXTI18n.t('import.failed', { count: fail }));
      return { ok, fail };
    };

    // ---------- 取拖入文件的真实磁盘路径 ----------
    // Electron ≥32 用 webUtils.getPathForFile, ≤31 用 File.path (本项目 28.3.3)。
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

    const isFilePath = (p) => {
      try { return require('fs').statSync(p).isFile(); } catch (_) { return false; }
    };

    // Linux XDND / Wayland 有时只给文本目标 text/uri-list; 且这类数据在 dragenter/dragover
    // 阶段受保护模式读不到, 只能在 drop 处理里当场解析 (决策58 沿用 Music 的修复)。
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

    // 文件系统 Entry 遍历 (拿不到真实路径时的兜底, 主要是拖入文件夹)
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
    const snapshotDrop = (dt) => {
      const paths = [];
      const dirs = [];
      const entries = [];
      const seen = new Set();
      const add = (p) => {
        if (!p || seen.has(p)) return;
        seen.add(p);
        if (isDirPath(p)) dirs.push(p);
        else if (isFilePath(p)) paths.push(p);
      };
      for (const f of dt.files || []) add(filePathOf(f));
      for (const p of pathsFromText(dt)) add(p);
      if (dt.items && dt.items.length) {
        for (const item of dt.items) {
          if (item.kind !== 'file') continue;
          const entry = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null;
          if (entry && entry.isDirectory) entries.push(entry);
        }
      }
      return { paths, dirs, entries };
    };

    // 文件夹 → 主进程递归扫描 (与拖入单文件共用同一白名单)
    const expandDirs = async (dirs, entries) => {
      const api = importsApi();
      const out = [];
      if (!api) return out;
      for (const d of dirs || []) {
        const found = await api.scanFolder(d);
        if (found && found.length) out.push(...found);
      }
      for (const entry of entries || []) {
        const found = [];
        await _walkEntry(entry, found, 0);
        for (const f of found) { const p = filePathOf(f); if (p) out.push(p); }
      }
      return out;
    };

    const setupDragImport = () => {
      let dragDepth = 0;
      let hint = null;

      // 动态蒙层 (不侵入现有布局/CSS): 用主题变量自动适配深浅色, pointer-events:none 不拦拖放
      const showHint = (on) => {
        if (!hint) {
          hint = document.createElement('div');
          hint.id = 'importDropHint';
          hint.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;' +
            'z-index:900;pointer-events:none;background:var(--bg-card);color:var(--text-primary);' +
            'border:3px dashed var(--accent-primary);opacity:.93;font-size:14px;letter-spacing:1px;' +
            "font-family:'Noto Sans SC','Microsoft YaHei',sans-serif;";
          hint.textContent = FastTXTI18n.t('import.dropHint');
          document.body.appendChild(hint);
        }
        hint.style.display = on ? 'flex' : 'none';
      };

      // Linux 文件管理器除 'Files' 外还可能只声明 text/uri-list / text/x-moz-url
      const hasFiles = (e) => {
        const dt = e.dataTransfer;
        if (!dt) return false;
        return [...(dt.types || [])].some(t => t === 'Files' || /uri-list|x-moz-url/i.test(t));
      };

      // 捕获阶段挂在 document 上: 不受子元素 stopPropagation 影响, 必然早于默认导航
      const onDragEnter = (e) => {
        e.preventDefault(); // 无条件拦默认导航 (否则 Chromium 会导航到 file:// 替换页面)
        if (!hasFiles(e)) return;
        dragDepth++;
        showHint(true);
      };
      const onDragOver = (e) => {
        e.preventDefault();
        if (!hasFiles(e)) return; // 内部排序拖拽不干预, 保留其 effectAllowed='move'
        // Linux XDND 的 effectAllowed 常只有 'copy'; 写成 'move' 会让 Chromium 取消放置,
        // drop 事件根本不派发 (决策58: 上一轮排查出的根因)。
        try { e.dataTransfer.dropEffect = 'copy'; } catch (_) {}
        showHint(true);
      };
      const onDragLeave = (e) => {
        dragDepth = Math.max(0, dragDepth - 1);
        const out = e.clientX <= 0 || e.clientY <= 0 ||
          e.clientX >= window.innerWidth || e.clientY >= window.innerHeight;
        if (dragDepth === 0 || out) { dragDepth = 0; showHint(false); }
      };
      const onDrop = async (e) => {
        // 内部拖拽排序 / 回收站 / 碎纸机: 交回各自原有的 drop 处理器
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.stopPropagation();
        dragDepth = 0;
        showHint(false);

        const dt = e.dataTransfer;
        if (!dt) return;
        const snap = snapshotDrop(dt);
        if (!snap.paths.length && !snap.dirs.length && !snap.entries.length) {
          showToast('ℹ️', FastTXTI18n.t('import.none'));
          return;
        }

        const fromDirs = await expandDirs(snap.dirs, snap.entries);
        const candidates = [...snap.paths, ...fromDirs];
        const list = [];
        const seen = new Set();
        for (const p of candidates) {
          if (!isImportable(p) || seen.has(p)) continue;
          seen.add(p);
          list.push(p);
        }
        const skipped = candidates.length - list.length;

        if (!list.length) {
          showToast('ℹ️', FastTXTI18n.t('import.none'));
          return;
        }
        await importPaths(list);
        if (skipped > 0) showToast('⚠️', FastTXTI18n.t('import.skipped', { count: skipped }));
      };

      document.addEventListener('dragenter', onDragEnter, true);
      document.addEventListener('dragover', onDragOver, true);
      document.addEventListener('dragleave', onDragLeave, true);
      document.addEventListener('drop', onDrop, true);
      // 部分环境 dragleave 不触发: 拖到窗口外松手时兜底收掉蒙层
      window.addEventListener('blur', () => { dragDepth = 0; showHint(false); });
    };
