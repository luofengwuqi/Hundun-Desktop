/**
 * FastTXT Markdown 浏览模式 — Electron 冒烟测试
 *
 * 用 mock 的 window.hundun.fs (真实磁盘临时目录) 加载真实插件入口 main.html,
 * 驱动 "打开 md → 浏览模式渲染 → 点击块编辑 → 实时渲染 → 模式滑块切换 →
 *       撤销 → 关闭保存" 全链路并断言。
 *
 * 运行: npx electron scripts/test-md-preview.js
 * 退出码: 0 = 全部通过, 1 = 有失败
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fss = require('fs');

const PLUGIN_HTML = path.join(__dirname, '..', 'plugins', 'fast-txt', 'main.html');
const PRELOAD = path.join(__dirname, 'test-md-preload.js');
const DATA_ROOT = fss.mkdtempSync(path.join(os.tmpdir(), 'fasttxt-mdtest-'));
process.env.FASTTXT_TEST_ROOT = DATA_ROOT; // preload (renderer 子进程) 通过环境变量读取

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok || detail === undefined ? '' : '  ← ' + detail));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 800,
    height: 540,
    show: false,
    webPreferences: {
      preload: PRELOAD, // 注入 mock window.hundun (等价真实 plugin-preload.js)
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    },
  });

  win.webContents.on('console-message', (_e, _level, message) => {
    if (String(message).includes('[FastTXT]') || String(message).includes('Error')) {
      console.log('  [renderer] ' + message);
    }
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
    // ---------- 1. 初始化: 默认文件落盘并加载 ----------
    console.log('== 1. init ==');
    check('init 完成 (3 个默认文件)', await waitFor(`typeof files !== 'undefined' && files.length >= 3`));
    const names = await js(`files.filter(f => !f.deleted).map(f => f.name).sort()`);
    check('包含 notes.md', Array.isArray(names) && names.includes('notes.md'), JSON.stringify(names));
    check('主视图显示', await js(`currentView === 'main' && viewMain.style.display !== 'none'`));

    // ---------- 2. 打开 notes.md → 默认浏览模式 + 实时渲染 ----------
    console.log('== 2. open md (browse) ==');
    await js(`openFile(files.find(f => f.name === 'notes.md')); true`);
    check('进入编辑器视图', await waitFor(`currentView === 'editor'`));
    check('默认模式为浏览', await js(`mdMode === 'browse' && isMdBrowse()`));
    check('滑块可见', await js(`mdModeSwitch.style.display !== 'none'`));
    check('滑块"浏览"选中', await js(`document.getElementById('mdModeBrowse').classList.contains('active')`));
    check('主 textarea 隐藏', await js(`getComputedStyle(editorTextarea).display === 'none'`));
    check('行号隐藏', await js(`getComputedStyle(lineNumbers).display === 'none'`));
    check('预览区可见', await js(`getComputedStyle(mdPreview).display !== 'none'`));
    const html2 = await js(`mdPreview.innerHTML`);
    check('h1 已渲染为标题', String(html2).includes('<h1>Notes</h1>'), String(html2).slice(0, 160));
    check('h2 已渲染', String(html2).includes('<h2>TODO</h2>'));
    check('原始 # 号不再显示', !String(html2).includes('# Notes'));
    const blockCount = await js(`mdPreview.querySelectorAll('.md-block').length`);
    check('分块数 = 3 (h1/h2/list)', blockCount === 3, 'got ' + blockCount);

    // ---------- 3. 点击块 → 源码编辑 ----------
    console.log('== 3. activate block ==');
    await js(`activateMdBlock(0, 2, 0, 0); true`);
    check('活动块含源码 textarea', await js(`mdPreview.querySelector('.md-block.is-active') && mdPreview.querySelector('.md-block.is-active').contains(mdTa)`));
    // 块区间 [0,2) 吸收了其后的空行 → 源码为 "# Notes" + 换行
    check('源码内容 = "# Notes\\n"', (await js(`mdTa.value`)) === '# Notes\n', JSON.stringify(await js(`mdTa.value`)));

    // ---------- 4. 输入 # 标题 → 离开块后实时渲染 ----------
    console.log('== 4. live typing ==');
    await js(`mdTa.value = '# 标题 Hello\\n'; mdTa.dispatchEvent(new Event('input')); true`);
    await sleep(250);
    check('editorContent 已回写', await js(`editorContent.startsWith('# 标题 Hello')`), await js(`editorContent.slice(0, 30)`));
    check('输入中活动块显示源码', (await js(`mdTa.value`)) === '# 标题 Hello\n', JSON.stringify(await js(`mdTa.value`)));
    const linesAfterType = await js(`editorContent.split('\\n').length`);
    check('行数未丢失', linesAfterType === 6, 'got ' + linesAfterType);
    // 激活下一块 → 原块渲染为标题 (Typora 式)
    await js(`activateMdBlock(2, 3, 0, 0); true`);
    await sleep(200);
    const html4 = await js(`mdPreview.innerHTML`);
    check('"# 标题 Hello" 被识别为 <h1>', String(html4).includes('<h1>标题 Hello</h1>'), String(html4).slice(0, 200));
    check('活动块切换为 ## TODO 源码', (await js(`mdTa.value`)) === '## TODO');

    // ---------- 5. 滑块: 浏览 → 编辑 → 浏览 ----------
    console.log('== 5. mode switch ==');
    await js(`setMdMode('edit'); true`);
    await sleep(80);
    check('编辑模式: textarea 可见', await js(`getComputedStyle(editorTextarea).display !== 'none'`));
    check('编辑模式: 行号可见', await js(`getComputedStyle(lineNumbers).display !== 'none'`));
    check('编辑模式: 预览隐藏', await js(`getComputedStyle(mdPreview).display === 'none'`));
    check('编辑模式: 滑块"编辑"选中', await js(`document.getElementById('mdModeEdit').classList.contains('active')`));
    check('textarea 与 editorContent 同步', await js(`editorTextarea.value === editorContent`));
    const caretLine = await js(`editorTextarea.value.slice(0, editorTextarea.selectionStart).split('\\n').length - 1`);
    check('光标从活动块映射回源码行 2', caretLine === 2, 'got ' + caretLine);

    await js(`setMdMode('browse'); true`);
    await sleep(200);
    check('切回浏览: 预览可见', await js(`getComputedStyle(mdPreview).display !== 'none'`));
    check('切回浏览: 活动块跟随光标', await js(`!!mdActive && mdActive.start === 2`), JSON.stringify(await js(`mdActive`)));

    // ---------- 6. 编辑模式改内容 → 切浏览渲染新结构 ----------
    console.log('== 6. edit then browse ==');
    await js(`setMdMode('edit'); true`);
    await sleep(80);
    await js(`
      editorTextarea.value = editorContent + '\\n\\n## 新标题';
      editorTextarea.setSelectionRange(editorTextarea.value.length, editorTextarea.value.length);
      editorTextarea.dispatchEvent(new Event('input'));
      true`);
    await js(`setMdMode('browse'); true`);
    await sleep(250);
    const html6 = await js(`mdPreview.innerHTML`);
    check('旧标题仍渲染', String(html6).includes('<h1>标题 Hello</h1>'), String(html6).slice(0, 300));
    check('新增行进入活动块源码', String(await js(`mdTa.value`)).includes('## 新标题'), await js(`mdTa.value`));
    await js(`activateMdBlock(0, 2, 0, 0); true`);
    await sleep(200);
    check('离开后"## 新标题"渲染为 h2', String(await js(`mdPreview.innerHTML`)).includes('<h2>新标题</h2>'));

    // ---------- 7. 浏览模式下撤销 ----------
    console.log('== 7. undo in browse ==');
    await js(`activateMdBlock(0, 2, 0, 0); true`);
    const beforeUndo = await js(`editorContent`);
    await js(`mdTa.value = '# A1'; mdTa.dispatchEvent(new Event('input')); true`);
    await sleep(150);
    const midUndo = await js(`editorContent`);
    await js(`mdTa.value = '# A1B'; mdTa.dispatchEvent(new Event('input')); true`);
    await sleep(150);
    await js(`undo(); true`);
    await sleep(200);
    check('undo 恢复上一步内容', (await js(`editorContent`)) === midUndo,
      JSON.stringify((await js(`editorContent`)).slice(0, 40)));
    check('undo 后预览不崩溃', typeof (await js(`typeof mdPreview`)) === 'string');
    check('内容确实不同于输入前', midUndo !== beforeUndo);
    // redo: 恢复被撤销的最新状态
    const afterUndo = await js(`editorContent`);
    await js(`redo(); true`);
    await sleep(200);
    check('redo 恢复被撤销内容', (await js(`editorContent`)) !== afterUndo
      && String(await js(`editorContent`)).includes('# A1B'),
      JSON.stringify((await js(`editorContent`)).slice(0, 40)));
    // 再撤销回 "# A1", 后续保存断言依赖此状态
    await js(`undo(); true`);
    await sleep(200);
    check('再次 undo 回到 # A1', (await js(`editorContent`)) === midUndo);

    // ---------- 8. 关闭编辑器 → 保存落盘 + 视图复位 ----------
    console.log('== 8. close & save ==');
    await js(`closeEditor(); true`);
    await sleep(400);
    check('回到主视图', await js(`currentView === 'main'`));
    check('滑块已隐藏', await js(`mdModeSwitch.style.display === 'none'`));
    check('预览已隐藏', await js(`mdPreview.style.display === 'none'`));
    check('textarea 已恢复可见', await js(`getComputedStyle(editorTextarea).display !== 'none'`));
    const saved = fss.readFileSync(path.join(DATA_ROOT, 'notes.md'), 'utf8');
    check('磁盘文件包含撤销后的内容 # A1', saved.includes('# A1'), JSON.stringify(saved.slice(0, 60)));
    check('磁盘文件包含新标题', saved.includes('## 新标题'));

    // ---------- 9. 打开 .txt → 不显示滑块 ----------
    console.log('== 9. txt file ==');
    await js(`openFile(files.find(f => f.name === 'readme.txt')); true`);
    check('txt 进入编辑器', await waitFor(`currentView === 'editor'`));
    await sleep(150);
    check('txt 无滑块', await js(`mdModeSwitch.style.display === 'none'`));
    check('txt 标准视图 (textarea 可见)', await js(`getComputedStyle(editorTextarea).display !== 'none'`));
    check('txt 非浏览模式', await js(`!isMdBrowse()`));
    await js(`closeEditor(); true`);
    await sleep(300);
    check('txt 关闭正常', await js(`currentView === 'main'`));
  } catch (err) {
    check('测试执行未抛异常', false, err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : String(err));
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n========== 结果: ' + (results.length - failed.length) + '/' + results.length + ' 通过 ==========');
  try { fss.rmSync(DATA_ROOT, { recursive: true, force: true }); } catch (_) {}
  app.exit(failed.length === 0 ? 0 : 1);
});

// 60s 兜底超时
setTimeout(() => { console.log('TIMEOUT'); app.exit(1); }, 60000);
