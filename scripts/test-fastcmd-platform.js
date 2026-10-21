/**
 * FastCmd 平台感知 — Electron 冒烟测试 (决策42)
 *
 * 用 mock 的 window.hundun.fs (真实磁盘临时目录) 加载真实插件入口 main.html:
 *  - Linux 模式: 只显示/新建 .sh, .bat/.txt 等不支持的文件不显示; .sh 真实执行 + 退出码回报
 *  - macOS (不支持) 模式: 无脚本无底部按钮, 显示"当前系统不受支持"
 *
 * 平台标识经 process.env.FASTCMD_PLATFORM 注入 (主进程设 → 渲染进程继承;
 * 切换模式在渲染进程内改 env 后重载页面, 见 js/platform.js detectPlatform)。
 *
 * 运行: npx electron scripts/test-fastcmd-platform.js
 * 退出码: 0 = 全部通过, 1 = 有失败
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fss = require('fs');

const PLUGIN_HTML = path.join(__dirname, '..', 'plugins', 'fast-cmd', 'main.html');
const PRELOAD = path.join(__dirname, 'test-fastcmd-preload.js');
const DATA_ROOT = fss.mkdtempSync(path.join(os.tmpdir(), 'fastcmd-plat-'));
process.env.FASTCMD_TEST_ROOT = DATA_ROOT;
process.env.FASTCMD_PLATFORM = 'linux';

const SH_MARK = path.join(DATA_ROOT, 'sh_marker.txt');
const SH_FAIL_MARK = path.join(DATA_ROOT, 'sh_fail_marker.txt');

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
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
    if (m.includes('[FastCmd]') || m.includes('Error') || m.includes('error') || m.includes('回退')) {
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
  const listText = () => js(`(document.getElementById('fileList')||{textContent:''}).textContent || ''`);

  try {
    // ---------- 1. Linux 模式 init ----------
    console.log('== 1. linux mode init ==');
    check('init 完成 (默认脚本加载)', await waitFor(`typeof files !== 'undefined' && files.length >= 1`));
    check('平台识别为 linux', await js(`FastCmdPlatform.platform`) === 'linux');
    check('linux 判定为受支持', await js(`FastCmdPlatform.isSupported`) === true);
    const names = await js(`files.filter(f => !f.deleted).map(f => f.name)`);
    check('默认脚本为 hello.sh', Array.isArray(names) && names.includes('hello.sh'), JSON.stringify(names));
    check('不生成 Windows 默认脚本', !names.includes('hello.bat') && !names.includes('hello.ps1'), JSON.stringify(names));
    check('底部按钮 = 4 个', (await js(`getFooterButtons().length`)) === 4);
    check('支持的后缀 = [.sh]', JSON.stringify(await js(`FastCmdPlatform.extensions`)) === '[".sh"]');

    // ---------- 2. 不支持的脚本文件不显示 ----------
    console.log('== 2. unsupported files hidden ==');
    await js(`(async () => {
      const api = fsAPI();
      await api.writeFile('win.bat', '@echo off\\r\\nexit /b 0\\r\\n');
      await api.writeFile('notes.txt', 'not a script');
      await loadFilesFromDisk();
      return true;
    })()`);
    check('.bat 已写入磁盘', fss.existsSync(path.join(DATA_ROOT, 'win.bat')));
    await waitFor(`files.some(f => f.name === 'notes.txt') === false`);
    check('.bat 不进列表', !(await js(`files.some(f => f.name === 'win.bat')`)));
    check('.txt 不进列表', !(await js(`files.some(f => f.name === 'notes.txt')`)));
    check('isScriptFile(.sh) = true', await js(`isScriptFile('a.sh')`) === true);
    check('isScriptFile(.bat) = false (linux)', await js(`isScriptFile('a.bat')`) === false);
    check('isScriptFile(.txt) = false', await js(`isScriptFile('a.txt')`) === false);

    // ---------- 3. 新建菜单只含 .sh ----------
    console.log('== 3. create menu ==');
    await js(`showCreateMenu(); true`);
    check('创建菜单仅 1 项', (await js(`document.querySelectorAll('#createOptions .create-option').length`)) === 1);
    check('选项是 .sh', ((await js(`(document.querySelector('#createOptions .create-label')||{}).textContent || ''`))).includes('.sh'));
    await js(`createFile('sh'); true`);
    check('createFile(sh) 生效', await waitFor(`files.some(f => f.name === 'new_script.sh')`), JSON.stringify(await js(`files.map(f => f.name)`)));
    await js(`createFile('bat'); true`);
    check('createFile(bat) 被平台守卫拒绝', !(await js(`files.some(f => f.name === 'new_script.bat')`)));

    // ---------- 4. .sh 真实执行 (exit 0) ----------
    console.log('== 4. execute .sh ==');
    const okSh = '#!/bin/sh\necho ran > "' + SH_MARK + '"\nexit 0\n';
    await js(`fsAPI().writeFile('ok.sh', ${JSON.stringify(okSh)}).then(() => loadFilesFromDisk())`);
    await waitFor(`files.some(f => f.name === 'ok.sh')`);
    await js(`runScript(files.find(f => f.name === 'ok.sh')); true`);
    check('spawn 成功 toast 出现', await waitFor(`(document.getElementById('toastContainer')||{textContent:''}).textContent.includes('ok.sh')`, 6000), await toastText());
    check('.sh 真实执行 (marker 落盘)', await waitFor(`require('fs').existsSync(${JSON.stringify(SH_MARK)})`, 10000), 'marker missing');
    check('marker 内容正确', (() => {
      try { return fss.readFileSync(SH_MARK, 'utf8').includes('ran'); } catch (_) { return false; }
    })());
    await sleep(1200);
    check('exit 0 无错误 toast', !(await toastText()).includes('退出码'), await toastText());

    // ---------- 5. .sh 退出码非 0 ----------
    console.log('== 5. .sh exit code ==');
    const failSh = '#!/bin/sh\necho fail > "' + SH_FAIL_MARK + '"\nexit 7\n';
    await js(`fsAPI().writeFile('fail.sh', ${JSON.stringify(failSh)}).then(() => loadFilesFromDisk())`);
    await waitFor(`files.some(f => f.name === 'fail.sh')`);
    await js(`runScript(files.find(f => f.name === 'fail.sh')); true`);
    check('退出码 7 toast 出现', await waitFor(`(document.getElementById('toastContainer')||{textContent:''}).textContent.includes('7')`, 10000), await toastText());
    check('退出码文案含脚本名', (await toastText()).includes('fail.sh'), await toastText());

    // ---------- 6. 切换到不支持的系统 (macOS) ----------
    console.log('== 6. unsupported platform (darwin) ==');
    check('切换渲染进程平台 env', await js(`process.env.FASTCMD_PLATFORM = 'darwin'; process.env.FASTCMD_PLATFORM`) === 'darwin');
    await win.loadFile(PLUGIN_HTML);
    check('重载后平台 = darwin', await waitFor(`typeof FastCmdPlatform !== 'undefined' && FastCmdPlatform.platform === 'darwin'`));
    check('darwin 判定为不受支持', await js(`FastCmdPlatform.isSupported`) === false);
    check('不支持时无可用后缀', (await js(`FastCmdPlatform.extensions.length`)) === 0);
    check('不支持时列表为空', await waitFor(`typeof files !== 'undefined' && files.length === 0`), JSON.stringify(await js(`files.map(f => f.name)`)));
    // 注: 子程序 UI 语言跟随系统语言 (navigator.language), 断言需同时接受中英文
    const hasUnsupportedText = await waitFor(
      "((document.getElementById('fileList')||{textContent:''}).textContent||'').indexOf('不受支持') >= 0 ||" +
      "((document.getElementById('fileList')||{textContent:''}).textContent||'').indexOf('Unsupported') >= 0"
    )
    check('显示"当前系统不受支持"', hasUnsupportedText, await listText());
    check('底部无按钮', (await js(`getFooterButtons().length`)) === 0);
    check('isScriptFile 全为 false', await js(`isScriptFile('a.sh')`) === false && await js(`isScriptFile('a.bat')`) === false);
    check('不支持时不生成默认脚本', !fss.existsSync(path.join(DATA_ROOT, 'darwin_hello.sh')));
    await sleep(300);
  } catch (e) {
    check('测试执行未抛异常', false, e.message);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  app.exit(failed.length === 0 ? 0 : 1);
});
