/**
 * FastCmd i18n HTML - 将翻译应用到静态 HTML 元素
 */
(() => {
  const t = FastCmdI18n.t;

  // 主视图
  const mainThemeLabels = document.querySelectorAll('#view-main .toggle-label');
  if (mainThemeLabels.length >= 2) {
    mainThemeLabels[0].textContent = t('theme.dark');
    mainThemeLabels[1].textContent = t('theme.light');
  }

  const closeBtn = document.getElementById('closeBtn');
  if (closeBtn) closeBtn.title = t('header.back');

  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.placeholder = t('search.placeholder');

  const breadcrumbBack = document.getElementById('breadcrumbBack');
  if (breadcrumbBack) breadcrumbBack.textContent = t('breadcrumb.back');

  const shredderLabel = document.querySelector('.shredder-label');
  if (shredderLabel) shredderLabel.textContent = t('shredder.label');

  // 创建菜单
  const createMenuTitle = document.querySelector('#createMenuOverlay .modal-title');
  if (createMenuTitle) createMenuTitle.textContent = t('create.title');

  const createOpts = document.querySelectorAll('.create-option .create-label');
  if (createOpts.length >= 3) {
    createOpts[0].textContent = t('create.batFile');
    createOpts[1].textContent = t('create.ps1File');
    createOpts[2].textContent = t('create.folder');
  }

  const createMenuCancel = document.getElementById('createMenuCancel');
  if (createMenuCancel) createMenuCancel.textContent = t('create.cancel');
})();
