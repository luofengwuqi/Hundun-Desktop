/**
 * FastCmd 冒烟测试专用 preload — 注入 mock 的 window.hundun (等价真实 plugin-preload.js)
 * 数据根目录通过环境变量 FASTCMD_TEST_ROOT 传入 (由 test-fastcmd-exec.js 设置)。
 * contextIsolation: false, 直接挂 window (与真实 preload 一致)。
 */
const path = require('path');
const fss = require('fs');

const ROOT = process.env.FASTCMD_TEST_ROOT;
if (!ROOT) throw new Error('FASTCMD_TEST_ROOT not set');

window.__PLUGIN_ID__ = 'fast-cmd';
const abs = (p) => path.join(ROOT, ...String(p || '').split('/').filter(Boolean));

const api = {
  getBasePath: async () => ROOT,
  readDir: async (p) => {
    const d = abs(p);
    if (!fss.existsSync(d)) return [];
    return fss
      .readdirSync(d, { withFileTypes: true })
      .filter((e) => !e.name.startsWith('.'))
      .map((e) => {
        const st = fss.statSync(path.join(d, e.name));
        return { name: e.name, isDirectory: e.isDirectory(), mtime: st.mtimeMs, size: st.size };
      })
      .sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name));
  },
  readFile: async (p) => {
    try { return fss.readFileSync(abs(p), 'utf8'); } catch (e) { return null; }
  },
  writeFile: async (p, c) => {
    fss.mkdirSync(path.dirname(abs(p)), { recursive: true });
    fss.writeFileSync(abs(p), c, 'utf8');
  },
  deleteFile: async (p) => { fss.rmSync(abs(p), { recursive: true, force: true }); },
  mkdir: async (p) => { fss.mkdirSync(abs(p), { recursive: true }); },
  rename: async (o, n) => {
    fss.mkdirSync(path.dirname(abs(n)) || abs('.'), { recursive: true });
    fss.renameSync(abs(o), abs(n));
  },
  exists: async (p) => fss.existsSync(abs(p)),
  stat: async (p) => {
    const st = fss.statSync(abs(p));
    return { size: st.size, mtime: st.mtimeMs, isDirectory: st.isDirectory() };
  },
  openInExplorer: async () => {},
};

window.hundun = {
  fs: api,
  host: {
    returnToParent: async () => {},
    getTheme: async () => 'dark',
    onThemeChange: () => {},
    playSound: async () => {},
    notify: async () => {},
  },
  window: {
    minimize: async () => {},
    maximize: async () => {},
    close: async () => {},
    setAlwaysOnTop: async () => {},
    setTitle: async () => {},
  },
};
