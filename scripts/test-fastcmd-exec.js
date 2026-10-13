/**
 * FastCmd 脚本真实执行 — Electron 冒烟测试
 *
 * 用 mock 的 window.hundun.fs (真实磁盘临时目录) 加载真实插件入口 main.html,
 * 驱动 "创建脚本 → 运行(断言真实执行+退出码) → 中文/空格路径 → 刷新按钮" 全链路并断言。
 *
 * 运行: npx electron scripts/test-fastcmd-exec.js
 * 退出码: 0 = 全部通过, 1 = 有失败
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fss = require('fs');

const PLUGIN_HTML = path.join(__dirname, '..', 'plugins', 'fast-cmd', 'main.html');
const PRELOAD = path.join(__dirname, 'test-fastcmd-preload.js');
const DATA_ROOT = fss.mkdtempSync(path.join(os.tmpdir(), 'fastcmd-test-'));
process.env.FASTCMD_TEST_ROOT = DATA_ROOT;
// 本用例回归的是 Windows 执行链 (.bat/.ps1 + cmd.exe) — 在 Linux 上运行时
// 覆盖平台标识为 win32 (否则插件按系统只收 .sh, 断言全偏), 见 js/platform.js
process.env.FASTCMD_PLATFORM = 'win32';

const MARKER = path.join(DATA_ROOT, 'marker.txt');
const CN_MARK = path.join(DATA_ROOT, 'cn_marker.txt');
const PS1_MARK = path.join(DATA_ROOT, 'ps1_marker.txt');
const EXT_MARK = path.join(DATA_ROOT, 'ext_marker.txt');

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok || detail === undefined ? '' : '  <- ' + detail));
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
    if (m.includes('[FastCmd]') || m.includes('Error') || m.includes('error')) {
      console.log('  [renderer] ' + m);
    }
  });

  await win.loadFile(PLUGIN_HTML);

  const js = (code) => win.webContents.executeJavaScript(code, true);
  const waitFor = async (expr, timeout = 8000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      try { if (await js(expr)) return true; } catch (_) {}
      await sleep(150);
    }
    return false;
  };
  const toastText = () => js(`(document.getElementById('toastContainer')||{textContent:''}).textContent || ''`);

  try {
    // ---------- 1. 初始化 ----------
    console.log('== 1. init ==');
    check('init 完成 (默认脚本加载)', await waitFor(`typeof files !== 'undefined' && files.length >= 2`));
    const names = await js(`files.filter(f => !f.deleted).map(f => f.name)`);
    check('包含 hello.bat', Array.isArray(names) && names.includes('hello.bat'), JSON.stringify(names));
    check('底部按钮 = 4 个 (含刷新)', await js(`getFooterButtons().length`) === 4);

    // ---------- 2. 真实执行 .bat (exit 0) ----------
    console.log('== 2. execute .bat ==');
    const okBatContent = '@echo off\r\nchcp 65001 >nul\r\necho ran> "' + MARKER + '"\r\nexit /b 0\r\n';
    await js(`fsAPI().writeFile('ok.bat', ${JSON.stringify(okBatContent)}).then(() => loadFilesFromDisk())`);
    await waitFor(`files.some(f => f.name === 'ok.bat')`);
    await js(`runScript(files.find(f => f.name === 'ok.bat')); true`);
    check('spawn 成功 toast 出现', (await waitFor(`(document.getElementById('toastContainer')||{textContent:''}).textContent.includes('ok.bat')`, 6000)), await toastText());
    check('脚本真实执行 (marker 落盘)', await waitFor(`require('fs').existsSync(${JSON.stringify(MARKER)})`, 8000), 'marker missing');
    check('marker 内容正确', (() => {
      try { return fss.readFileSync(MARKER, 'utf8').includes('ran'); } catch (_) { return false; }
    })());
    await sleep(1200);
    check('exit 0 无错误 toast', !(await toastText()).includes('退出码'), await toastText());

    // ---------- 3. 退出码非 0 ----------
    console.log('== 3. exit code ==');
    await js(`(async () => {
      await fsAPI().writeFile('fail.bat', '@echo off\\r\\nexit /b 7\\r\\n');
      await loadFilesFromDisk(); return true;
    })()`);
    await waitFor(`files.some(f => f.name === 'fail.bat')`);
    await js(`runScript(files.find(f => f.name === 'fail.bat')); true`);
    check('退出码 7 toast 出现', await waitFor(`(document.getElementById('toastContainer')||{textContent:''}).textContent.includes('7')`, 8000), await toastText());
    check('退出码文案含脚本名', (await toastText()).includes('fail.bat'), await toastText());

    // ---------- 4. 中文 + 空格文件名 (单级目录: 脚本直接放根目录) ----------
    console.log('== 4. chinese+space path ==');
    const cnBatContent = '@echo off\r\nchcp 65001 >nul\r\necho cn> "' + CN_MARK + '"\r\nexit /b 0\r\n';
    await js(`fsAPI().writeFile('中文 脚本.bat', ${JSON.stringify(cnBatContent)}).then(() => loadFilesFromDisk())`);
    await waitFor(`files.some(f => f.id === '中文 脚本.bat')`);
    await js(`runScript(files.find(f => f.id === '中文 脚本.bat')); true`);
    check('中文+空格 .bat 真实执行', await waitFor(`require('fs').existsSync(${JSON.stringify(CN_MARK)})`, 8000), 'cn marker missing');

    // ---------- 5. .ps1 执行 ----------
    console.log('== 5. execute .ps1 ==');
    const ps1Content = 'Set-Content -Path "' + PS1_MARK + '" -Value "ps1ok"\nexit 0\n';
    await js(`fsAPI().writeFile('t.ps1', ${JSON.stringify(ps1Content)}).then(() => loadFilesFromDisk())`);
    await waitFor(`files.some(f => f.name === 't.ps1')`);
    await js(`runScript(files.find(f => f.name === 't.ps1')); true`);
    check('.ps1 真实执行 (marker 落盘)', await waitFor(`require('fs').existsSync(${JSON.stringify(PS1_MARK)})`, 10000), 'ps1 marker missing');
    check('纯 ASCII .ps1 不被补 BOM', (() => {
      const b = fss.readFileSync(path.join(DATA_ROOT, 't.ps1'));
      return !(b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf);
    })());

    // ---------- 5b. UTF-8 无 BOM 中文 .ps1 (PowerShell 5.1 按 GBK 读 → 乱码/解析错) ----------
    console.log('== 5b. ps1 utf-8 no-bom ==');
    const PS1_CN_MARK = path.join(DATA_ROOT, 'ps1_cn_marker.txt');
    const ps1CnContent =
      'Write-Host "    ✅ 中文：测试完成" -ForegroundColor Green\n' +
      '[IO.File]::WriteAllText("' + PS1_CN_MARK + '", "中文OK", [Text.Encoding]::UTF8)\n' +
      'exit 0\n';
    await js(`fsAPI().writeFile('cn.ps1', ${JSON.stringify(ps1CnContent)}).then(() => loadFilesFromDisk())`);
    await waitFor(`files.some(f => f.name === 'cn.ps1')`);
    check('补 BOM 前无 BOM', (() => {
      const b = fss.readFileSync(path.join(DATA_ROOT, 'cn.ps1'));
      return !(b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf);
    })());
    await js(`runScript(files.find(f => f.name === 'cn.ps1')); true`);
    check('中文 .ps1 真实执行 (marker 落盘)', await waitFor(`require('fs').existsSync(${JSON.stringify(PS1_CN_MARK)})`, 10000), 'cn ps1 marker missing (解析失败或未执行)');
    check('中文未乱码 (PS 按 UTF-8 读取)', (() => {
      try { return fss.readFileSync(PS1_CN_MARK, 'utf8').includes('中文OK'); } catch (_) { return false; }
    })());
    check('执行后已补 UTF-8 BOM', (() => {
      const b = fss.readFileSync(path.join(DATA_ROOT, 'cn.ps1'));
      return b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf;
    })());

    // ---------- 6. 不存在的脚本 → 报错 ----------
    console.log('== 6. missing script ==');
    await js(`
      files.push({ id: 'ghost.bat', name: 'ghost.bat', content: null, deleted: false, order: 999, isFolder: false });
      runScript(files.find(f => f.name === 'ghost.bat')); true
    `);
    check('缺失文件 toast 报错', await waitFor(`(document.getElementById('toastContainer')||{textContent:''}).textContent.includes('ghost.bat')`, 6000), await toastText());

    // ---------- 7. 刷新按钮真实生效 ----------
    console.log('== 7. refresh button ==');
    // 外部 (模拟资源管理器) 写入文件
    fss.writeFileSync(path.join(DATA_ROOT, 'external.bat'), '@echo off\r\nexit /b 0\r\n', 'utf8');
    check('刷新前列表不含 external.bat', !(await js(`files.some(f => f.name === 'external.bat')`)));
    await js(`refreshFilesFromDisk(); true`);
    check('刷新后列表包含 external.bat', await waitFor(`files.some(f => f.name === 'external.bat')`, 6000));

    // ---------- 8. 单级目录: 文件夹/子目录脚本不进列表 ----------
    console.log('== 8. flat (no folders) ==');
    await js(`(async () => {
      const api = fsAPI();
      await api.mkdir('subfolder');
      await api.writeFile('subfolder/nested.bat', '@echo off\\r\\nexit /b 0\\r\\n');
      await loadFilesFromDisk();
      return true;
    })()`);
    check('根目录文件夹不出现在列表', !(await js(`files.some(f => f.name === 'subfolder')`)));
    check('子目录脚本不出现 (仅一级目录)', !(await js(`files.some(f => f.name === 'nested.bat')`)));
    check('createFolder 已移除', await js(`typeof createFolder === 'undefined'`));
    check('文件夹入口已移除 (breadcrumb DOM 不存在)', await js(`!document.getElementById('folderBreadcrumb')`));

    // ---------- 9. 点击脚本即运行 (操作弹窗已移除, 结果走 toast) ----------
    console.log('== 9. click to run ==');
    check('showScriptActionModal 已移除', await js(`typeof showScriptActionModal === 'undefined'`));
    check('openInSystemEditor 已移除 (编辑功能移除)', await js(`typeof openInSystemEditor === 'undefined'`));
    try { fss.unlinkSync(MARKER); } catch (_) {}
    await js(`handleFileClick(files.find(f => f.name === 'ok.bat')); true`);
    check('运行 toast 含脚本名', await waitFor(`(document.getElementById('toastContainer')||{textContent:''}).textContent.includes('ok.bat')`, 6000), await toastText());
    check('点击脚本自动运行 (marker 重新落盘)', await waitFor(`require('fs').existsSync(${JSON.stringify(MARKER)})`, 8000), 'marker missing');
    check('未弹出操作弹窗', await js(`document.getElementById('modalOverlay').style.display`) === 'none');
    await sleep(1000);
  } catch (e) {
    check('测试执行未抛异常', false, e.message);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  app.exit(failed.length === 0 ? 0 : 1);
});
