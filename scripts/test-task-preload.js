/**
 * TASK 冒烟测试专用 preload — 注入 mock 的 window.hundun (等价真实 plugin-preload.js)
 *
 * - storage: 落盘 TASK_TEST_ROOT/store.json (页面 reload 后仍在, 可测持久化)
 * - Notification: 打桩记录到 window.__notifications (不弹真实系统通知)
 * - document.hidden: 强制为 true → 提醒必走"窗口隐藏 → 系统通知"分支 (确定性)
 * - sound: 音量 0 → playSound 直接返回, 不碰音频文件
 * contextIsolation: false, 直接挂 window (与真实 preload 一致)。
 */
const path = require('path');
const fss = require('fs');

const ROOT = process.env.TASK_TEST_ROOT;
if (!ROOT) throw new Error('TASK_TEST_ROOT not set');
fss.mkdirSync(ROOT, { recursive: true });
const STORE_FILE = path.join(ROOT, 'store.json');

const readStore = () => {
  try { return JSON.parse(fss.readFileSync(STORE_FILE, 'utf8')); } catch (e) { return {}; }
};
const writeStore = (obj) => { fss.writeFileSync(STORE_FILE, JSON.stringify(obj), 'utf8'); };

window.__PLUGIN_ID__ = 'task';

window.hundun = {
  storage: {
    get: async (key, defaultValue = null) => {
      const s = readStore();
      return key in s ? s[key] : defaultValue;
    },
    set: async (key, value) => {
      const s = readStore();
      s[key] = value;
      writeStore(s);
      return true;
    },
    remove: async (key) => {
      const s = readStore();
      delete s[key];
      writeStore(s);
      return true;
    },
    getAll: async () => readStore(),
  },
  host: {
    returnToParent: async () => { window.__returnToParentCalls = (window.__returnToParentCalls || 0) + 1; },
    getTheme: async () => 'dark',
    onThemeChange: () => {},
    playSound: async () => {},
    notify: () => {},
  },
  window: {
    minimize: async () => {},
    maximize: async () => {},
    close: async () => {},
    setAlwaysOnTop: async () => {},
    setTitle: () => {},
  },
  sound: {
    getSettings: () => ({ soundEnabled: true, volume: 0 }), // 音量 0 → 不放音频
    onSettingsChanged: () => {},
  },
};

// Notification 打桩 (permission 恒为 granted, 不弹真实通知)
class RecordingNotification {
  constructor(title, options) {
    RecordingNotification.calls.push({ title, body: (options && options.body) || '' });
  }
  static get permission() { return 'granted'; }
  static requestPermission() { return Promise.resolve('granted'); }
}
RecordingNotification.calls = [];
window.Notification = RecordingNotification;
window.__notifications = RecordingNotification.calls;

// 强制 document.hidden = true → fireReminder 恒走系统通知分支 (窗口 show:false 时通常已如此)
try {
  Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
  Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
} catch (e) { /* ignore */ }
