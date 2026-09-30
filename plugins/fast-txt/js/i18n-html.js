/**
 * FastTXT i18n HTML - 将翻译应用到静态 HTML 元素
 */
(() => {
  const t = FastTXTI18n.t

  // ========== 主视图 ==========
  // 主题切换
  const mainThemeLabels = document.querySelectorAll('#view-main .toggle-label')
  if (mainThemeLabels.length >= 2) {
    mainThemeLabels[0].textContent = t('theme.dark')
    mainThemeLabels[1].textContent = t('theme.light')
  }

  // 关闭按钮
  const closeBtn = document.getElementById('closeBtn')
  if (closeBtn) closeBtn.title = t('header.back')

  // 搜索框
  const searchInput = document.getElementById('searchInput')
  if (searchInput) searchInput.placeholder = t('search.placeholder')

  // 面包屑返回
  const breadcrumbBack = document.getElementById('breadcrumbBack')
  if (breadcrumbBack) breadcrumbBack.textContent = t('breadcrumb.back')

  // 碎纸机标签
  const shredderLabel = document.querySelector('.shredder-label')
  if (shredderLabel) shredderLabel.textContent = t('shredder.label')

  // ========== 编辑器视图 ==========
  // 编辑器主题切换
  const editorThemeLabels = document.querySelectorAll('#view-editor .toggle-label')
  if (editorThemeLabels.length >= 2) {
    editorThemeLabels[0].textContent = t('theme.dark')
    editorThemeLabels[1].textContent = t('theme.light')
  }

  // 编辑器标题
  const editorTitle = document.getElementById('editorTitle')
  if (editorTitle) editorTitle.textContent = t('editor.untitled')

  // 编辑器关闭按钮
  const editorCloseBtn = document.getElementById('editorCloseBtn')
  if (editorCloseBtn) editorCloseBtn.title = t('header.saveBack')

  // 查找替换
  const findInput = document.getElementById('findInput')
  if (findInput) findInput.placeholder = t('editor.find')

  const findPrevBtn = document.getElementById('findPrevBtn')
  if (findPrevBtn) findPrevBtn.title = t('editor.findPrev')

  const findNextBtn = document.getElementById('findNextBtn')
  if (findNextBtn) findNextBtn.title = t('editor.findNext')

  const findCloseBtn = document.getElementById('findCloseBtn')
  if (findCloseBtn) findCloseBtn.title = t('editor.findClose')

  const replaceInput = document.getElementById('replaceInput')
  if (replaceInput) replaceInput.placeholder = t('editor.replace')

  const replaceOneBtn = document.getElementById('replaceOneBtn')
  if (replaceOneBtn) replaceOneBtn.title = t('editor.replaceOne')

  const replaceAllBtn = document.getElementById('replaceAllBtn')
  if (replaceAllBtn) replaceAllBtn.title = t('editor.replaceAll')

  // 文本区域
  const editorTextarea = document.getElementById('editorTextarea')
  if (editorTextarea) editorTextarea.placeholder = t('editor.placeholder')

  // 状态栏
  const statusLines = document.getElementById('statusLines')
  if (statusLines) statusLines.textContent = t('status.lines', { n: 1 })

  const statusChars = document.getElementById('statusChars')
  if (statusChars) statusChars.textContent = t('status.chars', { n: 0 })

  const statusWords = document.getElementById('statusWords')
  if (statusWords) statusWords.textContent = t('status.words', { n: 0 })

  const statusType = document.getElementById('statusType')
  if (statusType) statusType.textContent = t('status.plainText')

  // 保存指示器
  const autoSaveIndicator = document.getElementById('autoSaveIndicator')
  if (autoSaveIndicator) autoSaveIndicator.textContent = t('status.saved')

  // 快捷键提示
  const shortcutHint = document.querySelector('.shortcut-hint')
  if (shortcutHint) shortcutHint.textContent = t('status.shortcuts')

  // Markdown 浏览/编辑滑块
  const mdModeBrowse = document.getElementById('mdModeBrowse')
  if (mdModeBrowse) mdModeBrowse.textContent = t('mdMode.browse')

  const mdModeEdit = document.getElementById('mdModeEdit')
  if (mdModeEdit) mdModeEdit.textContent = t('mdMode.edit')

  // ========== 创建菜单 ==========
  const createMenuTitle = document.querySelector('#createMenuOverlay .modal-title')
  if (createMenuTitle) createMenuTitle.textContent = t('create.title')

  const createOptions = document.querySelectorAll('.create-option .create-label')
  if (createOptions.length >= 3) {
    createOptions[0].textContent = t('create.txtFile')
    createOptions[1].textContent = t('create.mdFile')
    createOptions[2].textContent = t('create.folder')
  }

  const createMenuCancel = document.getElementById('createMenuCancel')
  if (createMenuCancel) createMenuCancel.textContent = t('create.cancel')
})()
