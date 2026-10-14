/**
 * TASK i18n - 轻量级多语言模块 (与 FastCmd 同构, 无第三方依赖)
 */
const TaskI18n = (() => {
  const zh = {
    theme: { dark: '深色', light: '浅色' },
    header: { back: '返回母程序', pin: '窗口置顶' },
    empty: {
      title: '还没有任务',
      hint: '点击下方 + 创建第一个任务',
    },
    status: {
      pending: '未完成',
      expired: '已过期',
      completed: '已完成',
    },
    card: {
      edit: '编辑任务',
      toggle: '切换完成状态',
      due: '截止 {time}',
      reminders: '⏰ ×{n}',
    },
    footer: {
      create: '新建任务',
      clean: '清理已完成',
      count: '{n} 个任务',
      done: '· {n} 已完成',
    },
    form: {
      createTitle: '新建任务',
      editTitle: '编辑任务',
      name: '任务名',
      namePlaceholder: '留空自动命名为 task+数字',
      reminders: '提醒时间 (可多个)',
      add: '＋ 添加提醒',
      remove: '移除此提醒',
      method: '提醒方式',
      methodPopup: '弹窗提醒',
      deadline: '截止时间',
      deadlineClear: '清除截止时间',
      deadlineHint: '到期后自动标记为已过期',
      save: '保存',
      cancel: '取消',
      delete: '删除',
    },
    modal: {
      ok: '确定',
      cancel: '取消',
      deleteTitle: 'DELETE',
      deleteMsg: '确定删除「{name}」？',
      deleteBtn: '🗑 删除',
      cleanTitle: 'CLEAN',
      cleanMsg: '删除全部 {n} 个已完成任务？',
      cleanBtn: '🧹 清理',
      discardTitle: 'DISCARD',
      discardMsg: '当前修改尚未保存，确定放弃？',
      discardBtn: '放弃',
    },
    toast: {
      created: '✅ 已创建: {name}',
      updated: '✅ 已保存: {name}',
      deleted: '🗑 已删除: {name}',
      completed: '✅ 已完成: {name}',
      uncompleted: '↩ 已恢复未完成: {name}',
      cleaned: '🧹 已清理 {n} 个已完成任务',
      cleanedNone: '没有已完成的任务',
      invalidTime: '⚠️ 时间格式无效',
    },
    reminder: {
      title: '提醒',
      msg: '{name}\n提醒时间 {time}',
      ok: '知道了',
      notifTitle: '⏰ TASK 任务提醒',
      notifBody: '{name} · {time}',
    },
  };

  const en = {
    theme: { dark: 'Dark', light: 'Light' },
    header: { back: 'Back to main', pin: 'Pin window' },
    empty: {
      title: 'No tasks yet',
      hint: 'Click + below to create your first task',
    },
    status: {
      pending: 'PENDING',
      expired: 'EXPIRED',
      completed: 'DONE',
    },
    card: {
      edit: 'Edit task',
      toggle: 'Toggle completion',
      due: 'Due {time}',
      reminders: '⏰ ×{n}',
    },
    footer: {
      create: 'New task',
      clean: 'Clear completed',
      count: '{n} tasks',
      done: '· {n} done',
    },
    form: {
      createTitle: 'NEW TASK',
      editTitle: 'EDIT TASK',
      name: 'Task name',
      namePlaceholder: 'Leave empty to auto-name task+number',
      reminders: 'Reminder time (multiple)',
      add: '＋ Add reminder',
      remove: 'Remove reminder',
      method: 'Reminder method',
      methodPopup: 'Popup',
      deadline: 'Deadline',
      deadlineClear: 'Clear deadline',
      deadlineHint: 'Auto-marked as expired when due',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
    },
    modal: {
      ok: 'OK',
      cancel: 'Cancel',
      deleteTitle: 'DELETE',
      deleteMsg: 'Delete "{name}"?',
      deleteBtn: '🗑 Delete',
      cleanTitle: 'CLEAN',
      cleanMsg: 'Delete all {n} completed task(s)?',
      cleanBtn: '🧹 Clear',
      discardTitle: 'DISCARD',
      discardMsg: 'Changes are not saved. Discard them?',
      discardBtn: 'Discard',
    },
    toast: {
      created: '✅ Created: {name}',
      updated: '✅ Saved: {name}',
      deleted: '🗑 Deleted: {name}',
      completed: '✅ Done: {name}',
      uncompleted: '↩ Back to pending: {name}',
      cleaned: '🧹 Cleared {n} completed task(s)',
      cleanedNone: 'No completed tasks',
      invalidTime: '⚠️ Invalid time',
    },
    reminder: {
      title: 'Reminder',
      msg: '{name}\nReminder at {time}',
      ok: 'Got it',
      notifTitle: '⏰ TASK Reminder',
      notifBody: '{name} · {time}',
    },
  };

  const locales = { zh, en };
  let currentLocale = 'zh';

  function init() {
    const saved = localStorage.getItem('task-locale');
    if (saved && locales[saved]) { currentLocale = saved; return; }
    try {
      const parentLocale = localStorage.getItem('huntun-lite-locale');
      if (parentLocale && locales[parentLocale]) { currentLocale = parentLocale; return; }
    } catch (e) {}
    const lang = navigator.language || navigator.userLanguage || '';
    currentLocale = lang.startsWith('en') ? 'en' : 'zh';
  }

  function getLocale() { return currentLocale; }
  function setLocale(locale) {
    if (locales[locale]) { currentLocale = locale; localStorage.setItem('task-locale', locale); }
  }

  function t(key, params = {}) {
    const keys = key.split('.');
    let value = locales[currentLocale];
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) { value = value[k]; }
      else {
        value = locales['zh'];
        for (const fk of keys) {
          if (value && typeof value === 'object' && fk in value) { value = value[fk]; }
          else { return key; }
        }
        break;
      }
    }
    if (typeof value !== 'string') return key;
    return value.replace(/\{(\w+)\}/g, (match, name) => {
      return params[name] !== undefined ? params[name] : match;
    });
  }

  return { init, getLocale, setLocale, t, locales: Object.keys(locales) };
})();

TaskI18n.init();
