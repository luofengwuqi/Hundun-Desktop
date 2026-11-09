    // ========== App State ==========
    // 磁盘是曲目的事实来源 (user-data/plugins/music/file/), 分组归属持久化在 hundun.storage;
    // 播放队列仅内存态 (需求: 关闭子程序时清空)。
    const MUSIC_AUDIO_EXTS = ['mp3', 'mp4', 'm4a', 'm4v', 'aac', 'flac', 'wav', 'ogg', 'oga', 'opus', 'webm'];

    const isAudioFile = (name) => {
      const dot = String(name || '').lastIndexOf('.');
      if (dot < 0) return false;
      const ext = name.slice(dot + 1).toLowerCase();
      return MUSIC_AUDIO_EXTS.includes(ext);
    };

    const displayStem = (fileName) => {
      const dot = String(fileName || '').lastIndexOf('.');
      return dot > 0 ? fileName.slice(0, dot) : fileName;
    };

    const fileExt = (fileName) => {
      const dot = String(fileName || '').lastIndexOf('.');
      return dot > 0 ? fileName.slice(dot + 1) : '';
    };

    // 文件名 → 展示用曲名: 完整文件名去掉扩展名, 只压缩多余空白。
    // 不拆「歌手 - 歌名」, 不截断 —— 换行交给布局 (标题向上长, 不推挤下方控件)。
    const trackTitle = (fileName) => displayStem(fileName).replace(/\s+/g, ' ').trim();

    let libraryFiles = [];        // 曲目文件名数组 (磁盘事实)
    let groups = [];              // [{id, name, tracks:[fileName]}] — 'all' 虚拟分组不在此列
    let currentGroupId = 'all';   // 当前选中分组 ('all' | groupId)
    let searchQuery = '';

    let queue = [];               // 播放队列 [fileName]
    let queueIndex = -1;          // 当前播放位置
    let isPlaying = false;
    let playMode = 'sequence';    // 'sequence' | 'shuffle' | 'loop'

    let drawer1Open = false;      // 音乐库抽屉
    let drawer2Open = false;      // 播放队列抽屉

    let libSelectedIdx = -1;      // 库列表键盘选中行
    let queueSelectedIdx = -1;    // 队列键盘选中行

    let draggingQueueIdx = -1;    // 队列拖拽排序中
    let _audioBasePath = null;    // 数据目录绝对路径缓存

    // 当前播放的文件名 (无则 null)
    const currentTrack = () => (queueIndex >= 0 && queueIndex < queue.length ? queue[queueIndex] : null);

    // 当前分组可见曲目 (全部 → 全库; 分组 → 组内; 再叠搜索过滤)
    const getVisibleTracks = () => {
      let list = libraryFiles;
      if (currentGroupId !== 'all') {
        const g = groups.find(g => g.id === currentGroupId);
        list = g ? g.tracks.filter(f => libraryFiles.includes(f)) : [];
      }
      const q = searchQuery.trim().toLowerCase();
      if (!q) return list;
      // 模糊匹配: 全部子串命中 (字符级, 支持乱序模糊)
      return list.filter(f => {
        const name = displayStem(f).toLowerCase();
        let pos = 0;
        for (const ch of q) {
          pos = name.indexOf(ch, pos);
          if (pos < 0) return false;
          pos += 1;
        }
        return true;
      });
    };

    const getAllGroupTrackSet = () => {
      const set = new Set();
      for (const g of groups) for (const f of g.tracks) set.add(f);
      return set;
    };
