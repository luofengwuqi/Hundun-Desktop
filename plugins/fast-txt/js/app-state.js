    // ========== DOM Refs ==========
    const appEl = document.getElementById('app');
    const viewMain = document.getElementById('view-main');
    const viewEditor = document.getElementById('view-editor');
    const closeBtn = document.getElementById('closeBtn');
    const searchInput = document.getElementById('searchInput');
    const fileList = document.getElementById('fileList');
    const trashZone = document.getElementById('trashZone');
    const shredderZone = document.getElementById('shredderZone');
    const footerButtons = document.getElementById('footerButtons');
    const fileCountEl = document.getElementById('fileCount');
    const trashCountEl = document.getElementById('trashCount');
    const folderBreadcrumb = document.getElementById('folderBreadcrumb');
    const breadcrumbBack = document.getElementById('breadcrumbBack');
    const breadcrumbPath = document.getElementById('breadcrumbPath');
    const editorIcon = document.getElementById('editorIcon');
    const editorTitle = document.getElementById('editorTitle');
    const editorCloseBtn = document.getElementById('editorCloseBtn');
    const lineNumbers = document.getElementById('lineNumbers');
    const editorTextarea = document.getElementById('editorTextarea');
    const statusLines = document.getElementById('statusLines');
    const statusChars = document.getElementById('statusChars');
    const statusType = document.getElementById('statusType');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalIcon = document.getElementById('modalIcon');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalButtons = document.getElementById('modalButtons');
    const createMenuOverlay = document.getElementById('createMenuOverlay');
    const createOptions = document.getElementById('createOptions');
    const createMenuCancel = document.getElementById('createMenuCancel');

    // Find & Replace
    const findBar = document.getElementById('findBar');
    const findInput = document.getElementById('findInput');
    const findCount = document.getElementById('findCount');
    const findPrevBtn = document.getElementById('findPrevBtn');
    const findNextBtn = document.getElementById('findNextBtn');
    const findCloseBtn = document.getElementById('findCloseBtn');
    const replaceRow = document.getElementById('replaceRow');
    const replaceInput = document.getElementById('replaceInput');
    const replaceOneBtn = document.getElementById('replaceOneBtn');
    const replaceAllBtn = document.getElementById('replaceAllBtn');
    const autoSaveIndicator = document.getElementById('autoSaveIndicator');
    const statusWords = document.getElementById('statusWords');

    // ========== State ==========
    let currentView = 'main';
    let searchQuery = '';
    let isTrashMode = false;
    let isFolderMode = false;
    let currentFolderPath = '';  // e.g. 'NewFolder' or 'NewFolder/SubFolder'
    let isTrashDragOver = false;
    let isShredderDragOver = false;
    let dragFileId = null;

    let selectedRow = 0;
    let selectedCol = 0;
    let isSearchFocused = false; // 搜索框聚焦状态

    // 重命名状态
    let isRenaming = false;
    let renamingFileId = null;

    // 书签状态 (line number -> true)
    let bookmarks = {};

    // 撤销/重做历史
    let undoStack = [];
    let redoStack = [];
    const MAX_UNDO = 100;

    let files = [];
    let editingFile = null;
    let editorContent = '';

    let modalVisible = false;
    let modalIconText = '';
    let modalTitleText = '';
    let modalMessageText = '';
    let modalButtonDefs = [];
    let modalSelectedBtnIdx = 0;

    let showCreateMenuVisible = false;
    let createMenuSelectedIdx = 0;

    // Find & Replace state
    let findBarVisible = false;
    let showReplaceMode = false;
    let findMatches = [];
    let findCurrentIdx = -1;
    let lastSearchQuery = '';

    const PROGRAM_FOLDER = 'FastTXT_Data';
    const TRASH_DIR = '.trash'; // 回收站: 平铺存放被删文件 (恢复时回到 file/ 根目录)
    const ORDER_FILE = '.order.json';
    const BOOKMARKS_FILE = '.bookmarks.json'; // 书签存储文件
    const GRID_COLS = 3; // 文件列表网格列数

    // ========== Computed ==========
    const getActiveFiles = () => files.filter(f => !f.deleted).sort((a, b) => a.order - b.order);
    const getRootFiles = () => files.filter(f => !f.deleted && !f.parentPath).sort((a, b) => a.order - b.order);
    const getDeletedFiles = () => files.filter(f => f.deleted);

    // Grid row helpers
    const getGridRow = (col) => Math.floor(col / GRID_COLS);
    const getGridRowCount = (total) => Math.ceil(total / GRID_COLS);
    const getFirstInRow = (row) => row * GRID_COLS;
    const getLastInRow = (row, total) => Math.min((row + 1) * GRID_COLS - 1, total - 1);
    const isInFirstRow = (col) => col < GRID_COLS;
    const isInLastRow = (col, total) => col >= (getGridRowCount(total) - 1) * GRID_COLS;

    // 获取当前目录下的文件
    const getFilesInCurrentFolder = () => {
      return getActiveFiles().filter(f => {
        const parent = f.parentPath || '';
        return parent === currentFolderPath;
      });
    };

    const getDisplayFiles = () => {
      let base;
      if (isTrashMode) {
        base = getDeletedFiles();
      } else if (isFolderMode) {
        base = getFilesInCurrentFolder();
      } else {
        // 根目录模式: 只显示根级文件和文件夹, 不显示文件夹内的文件
        base = getRootFiles();
      }
      if (!searchQuery) return base;
      const q = searchQuery.toLowerCase();
      return base.filter(f => f.name.toLowerCase().includes(q));
    };
    const getLineCount = () => editorContent.split('\n').length;

    const getFooterButtons = () => {
      const btns = [
        { id: 'add', icon: '+', action: showCreateMenu, title: FastTXTI18n.t('buttons.create') },
        { id: 'trash', icon: '🗑️', action: toggleTrashMode, title: isTrashMode ? FastTXTI18n.t('buttons.backToFiles') : FastTXTI18n.t('buttons.showDeleted') },
        { id: 'folder', icon: '📁', action: openFolder, title: FastTXTI18n.t('buttons.openInExplorer') },
      ];
      if (isTrashMode) {
        btns.push({ id: 'shredder', icon: '⚙️', action: showShredConfirm, title: FastTXTI18n.t('buttons.shredAll') });
      }
      return btns;
    };
