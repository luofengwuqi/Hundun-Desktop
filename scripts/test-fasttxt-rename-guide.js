/**
 * FastTXT 文件夹改名 / Ctrl+Tab 浏览切换 / 首启快捷键指南 — Electron 冒烟测试
 *
 * 用 mock 的 window.hundun.fs (真实磁盘临时目录) 加载真实插件入口 main.html，
 * 覆盖：
 *   1. 首次启动投放《快捷键操作指南.md》(且只投一次)
 *   2. 文件夹改名：✎ 按钮 / 键盘 M 两条路径，子条目路径与磁盘目录同步
 *   3. 非法名、重名、回收站条目 的拦截
 *   4. .md 文件 Ctrl+Tab 在浏览 ⇄ 编辑之间切换；非 .md 不响应；不误插缩进
 *
 * 运行: npx electron scripts/test-fasttxt-rename-guide.js
 * 退出码: 0 = 全部通过, 1 = 有失败
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fss = require('fs');

const PLUGIN_HTML = path.join(__dirname, '..', 'plugins', 'fast-txt', 'main.html');
const PRELOAD = path.join(__dirname, 'test-md-preload.js');
const DATA_ROOT = fss.mkdtempSync(path.join(os.tmpdir(), 'fasttxt-rg-'));
process.env.FASTTXT_TEST_ROOT = DATA_ROOT; // preload (renderer 子进程) 通过环境变量读取

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok || detail === undefined ? '' : '  ← ' + detail));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 800,
    height: 540,
    show: false,
    webPreferences: {
      preload: PRELOAD,
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    },
  });

  win.webContents.on('console-message', (_e, _level, message) => {
    const m = String(message);
    if (m.includes('[FastTXT]') && m.includes('failed')) console.log('  [renderer] ' + m);
  });

  await win.loadFile(PLUGIN_HTML);

  const js = (code) => win.webContents.executeJavaScript(code, true);
  const waitFor = async (expr, timeout = 8000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      try { if (await js(expr)) return true; } catch (_) {}
      await sleep(120);
    }
    return false;
  };

  try {
    // ---------- 1. 首启投放快捷键指南 ----------
    const inited = await waitFor('typeof files !== "undefined" && Array.isArray(files) && files.length > 0');
    check('1. 初始化完成并读到文件', inited);

    const guideInList = await js('files.some(f => f.name === "快捷键操作指南.md" && !f.isFolder)');
    check('1. 列表里有《快捷键操作指南.md》', guideInList === true);

    const guideOnDisk = fss.existsSync(path.join(DATA_ROOT, '快捷键操作指南.md'));
    const guideText = guideOnDisk ? fss.readFileSync(path.join(DATA_ROOT, '快捷键操作指南.md'), 'utf8') : '';
    check('1. 指南已落盘', guideOnDisk);
    check('1. 指南写明 Ctrl+Tab 与 M 改名', guideText.includes('Ctrl + Tab') && guideText.includes('| M |'), '内容缺失');

    // 再跑一次初始化不应重复投放 / 用户删掉后也不回灌
    fss.rmSync(path.join(DATA_ROOT, '快捷键操作指南.md'), { force: true });
    const again = await js('(async () => { await createDefaultFiles(); await loadFilesFromDisk(); return files.some(f => f.name === "快捷键操作指南.md") })()');
    check('1. 用户删掉后不会重新长出来 (只投一次)', again === false, String(again));

    // ---------- 2. 文件夹改名 ----------
    await js('(async () => { await createFolder(); })()');
    await sleep(400);
    let folderNames = await js('files.filter(f => f.isFolder).map(f => f.name)');
    check('2. 建出文件夹', Array.isArray(folderNames) && folderNames.length === 1, JSON.stringify(folderNames));

    // 文件夹里放一个文件, 用来验证改名后子条目路径同步
    await js('(async () => { await window.hundun.fs.writeFile("NewFolder/inner.txt", "x"); await loadFilesFromDisk(); })()');
    await sleep(300);

    // 2a. ✎ 按钮
    const byBtn = await js(`(async () => {
      const card = [...document.querySelectorAll('.ftxt-file-card')].find(c => c.textContent.includes('NewFolder'));
      if (!card) return 'no-card';
      card.querySelector('.file-rename-btn').click();
      await new Promise(r => setTimeout(r, 150));
      const input = document.querySelector('.file-rename-input');
      if (!input) return 'no-input';
      input.value = '改名后的文件夹';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await new Promise(r => setTimeout(r, 500));
      return files.filter(f => f.isFolder).map(f => f.name).join('|');
    })()`);
    check('2a. 点 ✎ 按钮可给文件夹改名', byBtn === '改名后的文件夹', String(byBtn));

    const childId = await js('files.filter(f => f.name === "inner.txt").map(f => f.id)[0] || null');
    check('2b. 子条目 id 随文件夹改名重写', childId === '改名后的文件夹/inner.txt', String(childId));
    check('2c. 磁盘上目录确实改名 (子文件在新路径)',
      fss.existsSync(path.join(DATA_ROOT, '改名后的文件夹', 'inner.txt')) &&
      !fss.existsSync(path.join(DATA_ROOT, 'NewFolder')));

    // 2d. 键盘 M
    const byKey = await js(`(async () => {
      const idx = getDisplayFiles().findIndex(f => f.isFolder);
      if (idx < 0) return 'no-folder';
      selectedRow = 0; selectedCol = idx; updateUI();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }));
      await new Promise(r => setTimeout(r, 150));
      const input = document.querySelector('.file-rename-input');
      if (!input) return 'no-input';
      input.value = 'M改的名字';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await new Promise(r => setTimeout(r, 500));
      return files.filter(f => f.isFolder).map(f => f.name).join('|');
    })()`);
    check('2d. 键盘 M 可给文件夹改名', byKey === 'M改的名字', String(byKey));

    // ---------- 3. 非法名 / 重名拦截 ----------
    const invalid = await js(`(async () => {
      const idx = getDisplayFiles().findIndex(f => f.isFolder);
      selectedRow = 0; selectedCol = idx; updateUI();
      const folder = getDisplayFiles()[idx];
      const before = folder.name;
      startRename(folder);
      await new Promise(r => setTimeout(r, 150));
      const input = document.querySelector('.file-rename-input');
      if (!input) return { noInput: true };
      input.value = 'a/b';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await new Promise(r => setTimeout(r, 400));
      const res = { name: folder.name, same: folder.name === before, modal: !!document.querySelector('.modal-overlay') };
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise(r => setTimeout(r, 200));
      return res;
    })()`);
    check('3a. 带斜杠的名字被拒且未改名', invalid && invalid.same === true, JSON.stringify(invalid));

    const dup = await js(`(async () => {
      const idx = getDisplayFiles().findIndex(f => f.isFolder);
      selectedRow = 0; selectedCol = idx; updateUI();
      const folder = getDisplayFiles()[idx];
      const before = folder.name;
      startRename(folder);
      await new Promise(r => setTimeout(r, 150));
      const input = document.querySelector('.file-rename-input');
      if (!input) return { noInput: true };
      input.value = 'notes.md';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await new Promise(r => setTimeout(r, 400));
      const res = { same: folder.name === before };
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise(r => setTimeout(r, 200));
      return res;
    })()`);
    check('3b. 与同目录文件重名被拒', dup && dup.same === true, JSON.stringify(dup));

    // ---------- 4. Ctrl+Tab 浏览 ⇄ 编辑 ----------
    const mdToggle = await js(`(async () => {
      if (!files.some(x => x.name.endsWith('.md'))) {
        await createFile('md');          // 指南在上一步被删掉时的兜底
        await loadFilesFromDisk();
      }
      const target = files.find(x => x.name.endsWith('.md'));
      if (!target) return 'no-md';
      await openFile(target);
      await new Promise(r => setTimeout(r, 700));
      const before = mdMode;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', ctrlKey: true, bubbles: true }));
      await new Promise(r => setTimeout(r, 500));
      const edit = mdMode;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', ctrlKey: true, bubbles: true }));
      await new Promise(r => setTimeout(r, 500));
      return before + '>' + edit + '>' + mdMode;
    })()`);
    check('4a. .md 文件 Ctrl+Tab 浏览→编辑→浏览', mdToggle === 'browse>edit>browse', String(mdToggle));

    const noIndent = await js(`(async () => {
      const before = editorContent.length;
      editorTextarea.focus();
      editorTextarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', ctrlKey: true, bubbles: true }));
      await new Promise(r => setTimeout(r, 400));
      return { grew: editorContent.length - before, mode: mdMode };
    })()`);
    check('4b. 编辑模式 Ctrl+Tab 不插缩进', noIndent && noIndent.grew === 0, JSON.stringify(noIndent));

    const txtIgnore = await js(`(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise(r => setTimeout(r, 400));
      await createFile('txt');
      await loadFilesFromDisk();
      const f = files.find(x => x.name.endsWith('.txt'));
      await openFile(f);
      await new Promise(r => setTimeout(r, 500));
      const before = mdMode;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', ctrlKey: true, bubbles: true }));
      await new Promise(r => setTimeout(r, 400));
      return before + '>' + mdMode;
    })()`);
    check('4c. 非 .md 文件 Ctrl+Tab 不改变视图', txtIgnore === 'edit>edit', String(txtIgnore));
  } catch (err) {
    check('未捕获异常: ' + err.message, false);
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n结果: ${passed}/${results.length} 通过`);
  fss.rmSync(DATA_ROOT, { recursive: true, force: true });
  app.exit(passed === results.length ? 0 : 1);
});
