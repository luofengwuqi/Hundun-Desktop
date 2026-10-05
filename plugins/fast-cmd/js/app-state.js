    // ========== DOM Refs ==========
    const appEl = document.getElementById('app');
    const viewMain = document.getElementById('view-main');
    const closeBtn = document.getElementById('closeBtn');
    const pinBtn = document.getElementById('pinBtn');
    const searchInput = document.getElementById('searchInput');
    const fileList = document.getElementById('fileList');
    const trashZone = document.getElementById('trashZone');
    const shredderZone = document.getElementById('shredderZone');
    const emptyTrashBtn = document.getElementById('emptyTrashBtn');
    const footerButtons = document.getElementById('footerButtons');
    const fileCountEl = document.getElementById('fileCount');
    const trashCountEl = document.getElementById('trashCount');
    const folderBreadcrumb = document.getElementById('folderBreadcrumb');
    const breadcrumbBack = document.getElementById('breadcrumbBack');
    const breadcrumbPath = document.getElementById('breadcrumbPath');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalIcon = document.getElementById('modalIcon');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalButtons = document.getElementById('modalButtons');
    const createMenuOverlay = document.getElementById('createMenuOverlay');
    const createOptions = document.getElementById('createOptions');
    const createMenuCancel = document.getElementById('createMenuCancel');

    // ========== State ==========
    let currentView = 'main';
    let searchQuery = '';
    let isTrashMode = false;
    let isFolderMode = false;
    let currentFolderPath = '';
    let isTrashDragOver = false;
    let isShredderDragOver = false;
    let dragFileId = null;
    let isPinned = false;

    let selectedRow = 0;
    let selectedCol = 0;
    let isSearchFocused = false;

    // 重命名状态
    let isRenaming = false;
    let renamingFileId = null;

    let files = [];

    let modalVisible = false;
    let modalIconText = '';
    let modalTitleText = '';
    let modalMessageText = '';
    let modalButtonDefs = [];
    let modalSelectedBtnIdx = 0;

    let showCreateMenuVisible = false;
    let createMenuSelectedIdx = 0;

    const SCRIPTS_DIR = 'scripts';
    const TRASH_DIR = '.trash';
    const ORDER_FILE = '.order.json';
    const GRID_COLS = 3;

    // 支持的脚本后缀
    const SCRIPT_EXTENSIONS = ['.bat', '.cmd', '.ps1'];

    // ========== Computed ==========
    const getActiveFiles = () => files.filter(f => !f.deleted).sort((a, b) => a.order - b.order);
    const getRootFiles = () => files.filter(f => !f.deleted && !f.parentPath).sort((a, b) => a.order - b.order);
    const getDeletedFiles = () => files.filter(f => f.deleted);

    const getGridRow = (col) => Math.floor(col / GRID_COLS);
    const getGridRowCount = (total) => Math.ceil(total / GRID_COLS);
    const getFirstInRow = (row) => row * GRID_COLS;
    const getLastInRow = (row, total) => Math.min((row + 1) * GRID_COLS - 1, total - 1);
    const isInFirstRow = (col) => col < GRID_COLS;
    const isInLastRow = (col, total) => col >= (getGridRowCount(total) - 1) * GRID_COLS;

    const getFilesInCurrentFolder = () => {
      return getActiveFiles().filter(f => (f.parentPath || '') === currentFolderPath);
    };

    const getDisplayFiles = () => {
      let base;
      if (isTrashMode) { base = getDeletedFiles(); }
      else if (isFolderMode) { base = getFilesInCurrentFolder(); }
      else { base = getRootFiles(); }
      if (!searchQuery) return base;
      const q = searchQuery.toLowerCase();
      return base.filter(f => f.name.toLowerCase().includes(q));
    };

    const isScriptFile = (name) => {
      const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
      return SCRIPT_EXTENSIONS.includes(ext);
    };

    const getScriptType = (name) => {
      const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
      if (ext === '.ps1') return 'powershell';
      return 'cmd';
    };

    const getFooterButtons = () => {
      const btns = [
        { id: 'add', icon: '+', action: showCreateMenu, title: FastCmdI18n.t('buttons.create') },
        { id: 'trash', icon: '🗑️', action: toggleTrashMode, title: isTrashMode ? FastCmdI18n.t('buttons.backToFiles') : FastCmdI18n.t('buttons.showDeleted') },
        { id: 'folder', icon: '📁', action: openFolder, title: FastCmdI18n.t('buttons.openInExplorer') },
        { id: 'refresh', icon: '<svg class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="21 4 21 10 15 10"/><polyline points="3 20 3 14 9 14"/><path d="M4.2 9a8.5 8.5 0 0 1 14-3.2L21 10"/><path d="M19.8 15a8.5 8.5 0 0 1-14 3.2L3 14"/></svg>', action: refreshFilesFromDisk, title: FastCmdI18n.t('buttons.refresh') },
      ];
      return btns;
    };

    // ========== 图钉按钮设置 ==========
    const setupPinButton = () => {
      const togglePin = async () => {
        isPinned = !isPinned;
        pinBtn.classList.toggle('pinned', isPinned);
        if (window.hundun && window.hundun.window && window.hundun.window.setAlwaysOnTop) {
          await window.hundun.window.setAlwaysOnTop(isPinned);
        }
      };
      pinBtn.addEventListener('click', togglePin);
    };
