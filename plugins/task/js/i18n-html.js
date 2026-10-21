/**
 * TASK i18n HTML - 将翻译应用到静态 HTML 元素
 * (标题类动态文案在 render.js / form.js 里按视图切换时取 t())
 */
(() => {
  const t = TaskI18n.t;

  // 深浅色开关标签
  const darkLabel = document.getElementById('themeLabelDark');
  const lightLabel = document.getElementById('themeLabelLight');
  if (darkLabel) darkLabel.textContent = t('theme.dark');
  if (lightLabel) lightLabel.textContent = t('theme.light');

  // 头部按钮
  const closeBtn = document.getElementById('closeBtn');
  if (closeBtn) closeBtn.title = t('header.back');
  const pinBtn = document.getElementById('pinBtn');
  if (pinBtn) pinBtn.title = t('header.pin');
  const minBtn = document.getElementById('minBtn');
  if (minBtn) minBtn.title = t('header.minimize');

  // 表单静态文案
  const lblName = document.getElementById('lblName');
  if (lblName) lblName.textContent = t('form.name');
  const fName = document.getElementById('fName');
  if (fName) fName.placeholder = t('form.namePlaceholder');
  const lblReminders = document.getElementById('lblReminders');
  if (lblReminders) lblReminders.textContent = t('form.reminders');
  const addReminderBtn = document.getElementById('addReminderBtn');
  if (addReminderBtn) addReminderBtn.textContent = t('form.add');
  const lblMethod = document.getElementById('lblMethod');
  if (lblMethod) lblMethod.textContent = t('form.method');
  const optPopup = document.getElementById('optPopup');
  if (optPopup) optPopup.textContent = t('form.methodPopup');
  const lblDeadline = document.getElementById('lblDeadline');
  if (lblDeadline) lblDeadline.textContent = t('form.deadline');
  const clearDeadlineBtn = document.getElementById('clearDeadlineBtn');
  if (clearDeadlineBtn) clearDeadlineBtn.title = t('form.deadlineClear');
  const deadlineHint = document.getElementById('deadlineHint');
  if (deadlineHint) deadlineHint.textContent = t('form.deadlineHint');
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) saveBtn.textContent = t('form.save');
  const cancelBtn = document.getElementById('cancelBtn');
  if (cancelBtn) cancelBtn.textContent = t('form.cancel');
  const deleteBtn = document.getElementById('deleteBtn');
  if (deleteBtn) deleteBtn.textContent = t('form.delete');

  // 底部键位提示 (键帽文字为像素字体, 动作文案走翻译)
  const kbdCancel = document.getElementById('kbdCancel');
  if (kbdCancel) kbdCancel.textContent = t('form.cancel');
  const kbdSave = document.getElementById('kbdSave');
  if (kbdSave) kbdSave.textContent = t('form.save');
})();
