    // ========== Library: 存储 / 扫描 / 分组 ==========
    const STORAGE_KEY = 'music-library';
    const SETTINGS_KEY = 'music-settings';

    const storageApi = () => (window.hundun && window.hundun.storage) || null;
    const fsApi = () => (window.hundun && window.hundun.fs) || null;

    const genId = () => 'g-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);

    // ---------- 数据目录 ----------
    const getBasePath = async () => {
      if (_audioBasePath) return _audioBasePath;
      const api = fsApi();
      if (api && api.getBasePath) {
        _audioBasePath = await api.getBasePath();
      }
      return _audioBasePath;
    };

    const readLibraryFiles = async () => {
      const api = fsApi();
      if (!api || !api.readDir) return [];
      try {
        const entries = await api.readDir('');
        return entries
          .filter(e => !e.isDirectory && isAudioFile(e.name))
          .map(e => e.name)
          .sort((a, b) => a.localeCompare(b));
      } catch (e) {
        return [];
      }
    };

    // ---------- 持久化 ----------
    const loadGroups = async () => {
      const api = storageApi();
      if (!api) return;
      try {
        const data = await api.get(STORAGE_KEY, null);
        if (data && Array.isArray(data.groups)) {
          groups = data.groups
            .filter(g => g && typeof g.id === 'string' && typeof g.name === 'string' && Array.isArray(g.tracks))
            .map(g => ({ id: g.id, name: g.name, tracks: g.tracks.filter(t => typeof t === 'string') }));
        }
      } catch (e) {
        groups = [];
      }
    };

    const saveGroups = async () => {
      const api = storageApi();
      if (!api) return;
      try { await api.set(STORAGE_KEY, { groups }); } catch (e) { /* ignore */ }
    };

    const loadSettings = async () => {
      const api = storageApi();
      if (!api) return;
      try {
        const s = await api.get(SETTINGS_KEY, null);
        if (s && (s.mode === 'sequence' || s.mode === 'shuffle')) playMode = s.mode;
      } catch (e) { /* ignore */ }
    };

    const saveSettings = async () => {
      const api = storageApi();
      if (!api) return;
      try { await api.set(SETTINGS_KEY, { mode: playMode }); } catch (e) { /* ignore */ }
    };

    // ---------- 刷新 (检查新增 / 删除, 清理分组与队列记录) ----------
    const refreshLibrary = async (silent = false) => {
      const files = await readLibraryFiles();
      const prev = new Set(libraryFiles);
      const next = new Set(files);
      const added = files.filter(f => !prev.has(f));
      const removed = libraryFiles.filter(f => !next.has(f));

      libraryFiles = files;

      let groupsDirty = false;
      if (removed.length) {
        for (const g of groups) {
          const before = g.tracks.length;
          g.tracks = g.tracks.filter(f => next.has(f));
          if (g.tracks.length !== before) groupsDirty = true;
        }
        await removeTracksFromQueue(removed); // 队列记录清理 (播放接替逻辑在 player.js)
      }
      if (groupsDirty) await saveGroups();
      if (added.length === 0 && removed.length === 0 && !prev.size && next.size) {
        // 首次扫描不算"新增", 静默处理
      }

      renderAll();

      if (silent) return;
      if (added.length && removed.length) {
        showToast(MusicI18n.t('refresh.added', { count: added.length }) + ' · ' +
                  MusicI18n.t('refresh.removed', { count: removed.length }), 'info');
      } else if (added.length) {
        showToast(MusicI18n.t('refresh.added', { count: added.length }), 'success');
      } else if (removed.length) {
        showToast(MusicI18n.t('refresh.removed', { count: removed.length }), 'info');
      } else {
        showToast(MusicI18n.t('refresh.upToDate'), 'info');
      }
    };

    // ---------- 删除歌曲 (磁盘 + 分组 + 队列) ----------
    const deleteTrack = async (file) => {
      const ok = await showModal({
        icon: '🗑️',
        title: MusicI18n.t('modal.deleteTitle'),
        message: MusicI18n.t('modal.deleteConfirm', { name: file }),
        danger: true
      });
      if (!ok) return;
      playSound('click');
      const api = fsApi();
      if (api && api.deleteFile) {
        try { await api.deleteFile(file); } catch (e) { /* 继续, 刷新会发现 */ }
      }
      await refreshLibrary(true);
      showToast(MusicI18n.t('refresh.removed', { count: 1 }), 'info');
    };

    // ---------- 分组 CRUD ----------
    const createGroup = async (name, opts = {}) => {
      name = String(name == null ? '' : name).trim();
      if (!name) { showToast(MusicI18n.t('groups.nameRequired'), 'error'); return null; }
      if (groups.some(g => g.name === name)) { showToast(MusicI18n.t('groups.nameExists'), 'error'); return null; }
      const g = { id: genId(), name, tracks: Array.isArray(opts.trackFiles) ? [...opts.trackFiles] : [] };
      groups.push(g);
      await saveGroups();
      renderAll();
      return g;
    };

    const deleteGroup = async (gid) => {
      const g = groups.find(x => x.id === gid);
      if (!g) return;
      if (gid === 'all') { showToast(MusicI18n.t('groups.unremovable'), 'error'); return; }
      const ok = await showModal({
        icon: '🗑️',
        title: MusicI18n.t('groups.deleteTitle'),
        message: MusicI18n.t('groups.deleteConfirm', { name: g.name }),
        danger: true
      });
      if (!ok) return;
      playSound('click');
      groups = groups.filter(x => x.id !== gid);
      if (currentGroupId === gid) currentGroupId = 'all';
      libSelectedIdx = -1;
      await saveGroups();
      renderAll();
    };

    // 返回 true = 加入分组, false = 移出分组
    const toggleTrackInGroup = async (gid, file) => {
      const g = groups.find(x => x.id === gid);
      if (!g) return false;
      const i = g.tracks.indexOf(file);
      let added;
      if (i >= 0) { g.tracks.splice(i, 1); added = false; }
      else { g.tracks.push(file); added = true; }
      await saveGroups();
      renderAll();
      return added;
    };
