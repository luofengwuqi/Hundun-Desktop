    // ========== DOM Refs ==========
    const appEl = document.getElementById('app');
    const viewMain = document.getElementById('view-main');
    const viewForm = document.getElementById('view-form');
    const headerTitle = document.getElementById('headerTitle');
    const closeBtn = document.getElementById('closeBtn');
    const pinBtn = document.getElementById('pinBtn');
    const themeToggle = document.getElementById('themeToggle');
    const taskList = document.getElementById('taskList');
    const footerButtons = document.getElementById('footerButtons');
    const taskCountEl = document.getElementById('taskCount');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalIcon = document.getElementById('modalIcon');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalButtons = document.getElementById('modalButtons');
    const fName = document.getElementById('fName');
    const reminderRows = document.getElementById('reminderRows');
    const addReminderBtn = document.getElementById('addReminderBtn');
    const methodGroup = document.getElementById('methodGroup');
    const fMethod = document.getElementById('fMethod');
    const fDeadline = document.getElementById('fDeadline');
    const clearDeadlineBtn = document.getElementById('clearDeadlineBtn');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const deleteBtn = document.getElementById('deleteBtn');

    // ========== State ==========
    let currentView = 'main';          // 'main' | 'form'
    let formMode = null;               // 'create' | 'edit'
    let editingTaskId = null;
    let isPinned = false;

    let selectedRow = 0;               // 0=任务列表, 1=底部按钮群
    let selectedCol = 0;

    let modalVisible = false;
    let modalIconText = '';
    let modalTitleText = '';
    let modalMessageText = '';
    let modalButtonDefs = [];
    let modalSelectedBtnIdx = 0;

    let footerBuilt = false;           // 底部按钮只构建一次 (数量固定)

    // ========== 工具 ==========
    const escapeHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // ========== 图钉按钮 ==========
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
