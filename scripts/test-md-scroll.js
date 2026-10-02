/**
 * FastTXT Markdown 浏览模式 — 滚动位置回归测试
 *
 * 覆盖 bug: 浏览模式下点击/聚焦后视口跳回文档顶部。
 * 根因: renderMdPreview() 构建 fragment 时会把旧块元素搬出预览容器,
 *       容器被搬空 → Chromium 立即把 scrollTop 钳为 0;
 *       旧代码在"构建之后"才读 scrollTop, 保存到的已是 0。
 * 修复: 移动 DOM 之前捕获 scrollTop, 并以目标活动块为锚点做位移补偿,
 *       保证 "点哪里, 那一块就保持在原视觉位置"。
 *
 * 运行: npx electron scripts/test-md-scroll.js
 * 退出码: 0 = 全部通过, 1 = 有失败
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fss = require('fs');

const PLUGIN_HTML = path.join(__dirname, '..', 'plugins', 'fast-txt', 'main.html');
const PRELOAD = path.join(__dirname, 'test-md-preload.js');
const DATA_ROOT = fss.mkdtempSync(path.join(os.tmpdir(), 'fasttxt-mdscroll-'));
process.env.FASTTXT_TEST_ROOT = DATA_ROOT;

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
    webPreferences: { preload: PRELOAD, nodeIntegration: true, contextIsolation: false, sandbox: false },
  });
  await win.loadFile(PLUGIN_HTML);
  const js = (code) => win.webContents.executeJavaScript(code, true);

  try {
    // ---------- 1. 构造多块长文档 ----------
    console.log('== 1. setup ==');
    await js(`openFile(files.find(f => f.name === 'notes.md')); true`);
    await sleep(300);
    await js([
      'var F = String.fromCharCode(96).repeat(3);',
      'editorContent = Array.from({length: 40}, function(_, i) {',
      '  if (i % 4 === 0) return "## 标题 " + i;',
      '  if (i % 4 === 1) return "段落内容 " + i + " " + "字".repeat(30);',
      '  if (i % 4 === 2) return "- 列表项 " + i + "\\n- 列表项 " + i + "b";',
      '  return F + "\\n代码行 " + i + "\\n" + F;',
      '}).join("\\n\\n");',
      'editorTextarea.value = editorContent;',
      'scheduleMdRender(true);',
      'true',
    ].join('\n'));
    await sleep(300);
    const doc = await js(`({ blocks: mdPreview.querySelectorAll('.md-block').length,
                            sh: mdPreview.scrollHeight, ch: mdPreview.clientHeight })`);
    check('文档可滚动且已分块', doc.blocks > 20 && doc.sh > doc.ch * 2, JSON.stringify(doc));

    // ---------- 2. 首次点击 → 产生活动块 ----------
    console.log('== 2. first click ==');
    const t1 = await js(`(() => {
      const b = mdPreview.querySelectorAll('.md-block')[1];
      const r = b.getBoundingClientRect();
      b.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true, clientX:r.left+20, clientY:r.top+6, view:window}));
      return { start: +b.dataset.start };
    })()`);
    await sleep(250);
    check('首次点击激活块', await js(`!!mdActive && mdActive.start === ` + t1.start), JSON.stringify(await js(`mdActive`)));

    // ---------- 3. 滚动后点击非活动块 → 滚动位置不跳顶 ----------
    console.log('== 3. click another block keeps scroll ==');
    await js(`mdPreview.scrollTop = 800; true`);
    await sleep(120);
    const t3 = await js(`(() => {
      const before = mdPreview.scrollTop;
      let target = null;
      for (const b of mdPreview.querySelectorAll('.md-block')) {
        const r = b.getBoundingClientRect();
        if (r.top > 40 && r.top < 300 && !b.classList.contains('is-active')) { target = b; break; }
      }
      if (!target) return { err: 'no target', before };
      const r = target.getBoundingClientRect();
      const topBefore = r.top;
      target.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true, clientX:r.left+20, clientY:r.top+6, view:window}));
      const act = mdPreview.querySelector('.md-block.is-active');
      return { before, after: mdPreview.scrollTop,
               shift: Math.round(act.getBoundingClientRect().top - topBefore),
               start: +target.dataset.start };
    })()`);
    await sleep(300);
    check('点击后滚动位置不回到顶部', t3.after > 600, JSON.stringify(t3));
    check('滚动位置变化 < 60px (锚点补偿)', Math.abs(t3.after - t3.before) < 60, JSON.stringify(t3));
    check('被点击块视觉位移 = 0px', t3.shift === 0, 'shift=' + t3.shift);
    check('活动块切换为被点击块', await js(`mdActive.start === ` + t3.start), JSON.stringify(await js(`mdActive`)));

    // ---------- 4. 连续切换块, 滚动持续保持 ----------
    console.log('== 4. repeated block switch ==');
    let repeated = true, detail = '';
    for (const st of [900, 500, 700]) {
      await js(`mdPreview.scrollTop = ` + st + `; true`);
      await sleep(120);
      const r = await js(`(() => {
        const before = mdPreview.scrollTop;
        let target = null;
        for (const b of mdPreview.querySelectorAll('.md-block')) {
          const rect = b.getBoundingClientRect();
          if (rect.top > 40 && rect.top < 300 && !b.classList.contains('is-active')) { target = b; break; }
        }
        if (!target) return { err: 'no target', before };
        const rect = target.getBoundingClientRect();
        target.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true, clientX:rect.left+20, clientY:rect.top+6, view:window}));
        return { before, after: mdPreview.scrollTop };
      })()`);
      await sleep(250);
      if (Math.abs(r.after - r.before) >= 60 || r.after < 100) { repeated = false; detail = JSON.stringify(r); }
    }
    check('多次切换块滚动均保持', repeated, detail);

    // ---------- 5. 真实鼠标输入 (含真实 focus 行为) ----------
    console.log('== 5. real mouse input ==');
    await js(`mdPreview.scrollTop = 700; true`);
    await sleep(150);
    const before5 = await js(`mdPreview.scrollTop`);
    const pt5 = await js(`(() => {
      for (const b of mdPreview.querySelectorAll('.md-block')) {
        const r = b.getBoundingClientRect();
        if (r.top > 60 && r.top < 320 && !b.classList.contains('is-active')) return { x: r.left + 30, y: r.top + 6 };
      }
      return null;
    })()`);
    if (pt5) {
      win.webContents.sendInputEvent({ type: 'mouseMove', x: pt5.x, y: pt5.y });
      await sleep(80);
      win.webContents.sendInputEvent({ type: 'mouseDown', x: pt5.x, y: pt5.y, clickCount: 1, button: 'left' });
      await sleep(80);
      win.webContents.sendInputEvent({ type: 'mouseUp', x: pt5.x, y: pt5.y, clickCount: 1, button: 'left' });
      await sleep(500);
      const after5 = await js(`mdPreview.scrollTop`);
      check('真实鼠标点击滚动保持', Math.abs(after5 - before5) < 60, before5 + ' -> ' + after5);
      check('焦点落在块内源码区', await js(`document.activeElement === mdTa`),
        await js(`document.activeElement && (document.activeElement.className || document.activeElement.tagName)`));
    } else {
      check('真实鼠标点击滚动保持', false, '未找到视口内非活动块');
    }

    // ---------- 6. 点击活动块源码区 / 输入重渲染 → 滚动保持 ----------
    console.log('== 6. active-block click & typing ==');
    await js(`mdPreview.scrollTop = 650; true`);
    await sleep(120);
    const before6 = await js(`mdPreview.scrollTop`);
    await js(`(() => { const r = mdTa.getBoundingClientRect();
      mdTa.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true, clientX:r.left+10, clientY:r.top+4, view:window})); return true; })()`);
    await sleep(250);
    check('点击活动块源码区滚动保持', (await js(`mdPreview.scrollTop`)) === before6,
      before6 + ' -> ' + await js(`mdPreview.scrollTop`));

    const before7 = await js(`mdPreview.scrollTop`);
    await js(`mdTa.value = mdTa.value + ' 追加文字'; mdTa.dispatchEvent(new Event('input')); true`);
    await sleep(400);
    check('输入触发防抖重渲染滚动保持', (await js(`mdPreview.scrollTop`)) === before7,
      before7 + ' -> ' + await js(`mdPreview.scrollTop`));

    // ---------- 7. 切编辑模式再切回 → 滚动不丢 ----------
    console.log('== 7. mode round-trip ==');
    await js(`mdPreview.scrollTop = 650; true`);
    await sleep(120);
    await js(`setMdMode('edit'); true`);
    await sleep(150);
    await js(`setMdMode('browse'); true`);
    await sleep(300);
    const after8 = await js(`mdPreview.scrollTop`);
    check('浏览→编辑→浏览 滚动保持', after8 > 100, 'scrollTop=' + after8);
  } catch (err) {
    check('测试执行未抛异常', false, err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : String(err));
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n========== 结果: ' + (results.length - failed.length) + '/' + results.length + ' 通过 ==========');
  try { fss.rmSync(DATA_ROOT, { recursive: true, force: true }); } catch (_) {}
  app.exit(failed.length === 0 ? 0 : 1);
});
setTimeout(() => { console.log('TIMEOUT'); app.exit(1); }, 60000);
