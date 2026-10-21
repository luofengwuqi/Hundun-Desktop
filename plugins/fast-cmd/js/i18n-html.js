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

  const minBtn = document.getElementById('minBtn');
  if (minBtn) minBtn.title = t('header.minimize');

  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.placeholder = t('search.placeholder');

  const shredderLabel = document.querySelector('.shredder-label');
  if (shredderLabel) shredderLabel.textContent = t('shredder.label');

  // 创建菜单 (选项按钮由 renderCreateMenu 按平台动态生成, 这里只翻静态的标题/取消)
  const createMenuTitle = document.querySelector('#createMenuOverlay .modal-title');
  if (createMenuTitle) createMenuTitle.textContent = t('create.title');

  const createMenuCancel = document.getElementById('createMenuCancel');
  if (createMenuCancel) createMenuCancel.textContent = t('create.cancel');
})();
