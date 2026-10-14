/**
 * TASK 子程序 (任务清单) — Electron 冒烟测试
 *
 * 覆盖: 空态 / 创建(自动命名 taskN) / 状态计算(未完成·已过期·已完成) /
 *       排序(未完成截止近优先 > 未完成 > 已过期 > 已完成) / 状态徽章点击切换 /
 *       编辑(预填·保存) / 编辑表单内删除(确认弹窗) / 提醒触发(系统通知打桩) /
 *       错过提醒静默补记 / 提醒方式门槛(提醒时间空则禁用) / 未保存放弃确认 /
 *       表单视图与窗口等大 / hundun.storage 持久化(重载存活) /
 *       键盘导航(WASD/方向/Enter/E/Esc/returnToParent)
 *
 * 运行: npx electron scripts/test-task.js
 * 退出码: 0 = 全部通过, 1 = 有失败
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fss = require('fs');

const PLUGIN_HTML = path.join(__dirname, '..', 'plugins', 'task', 'main.html');
const PRELOAD = path.join(__dirname, 'test-task-preload.js');
const DATA_ROOT = fss.mkdtempSync(path.join(os.tmpdir(), 'task-test-'));
process.env.TASK_TEST_ROOT = DATA_ROOT;
// 隔离 userData: localStorage 镜像 (task-data) 不污染/不继承真实用户数据
app.setPath('userData', path.join(DATA_ROOT, 'app-userdata'));

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok || detail === undefined ? '' : '  <- ' + detail));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 400,
    height: 520,
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
    if (m.includes('[Task]') || m.includes('Error') || m.includes('error')) {
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
  const cardNames = () => js(`Array.from(document.querySelectorAll('.task-card .task-name')).map(e => e.textContent)`);
  const statusTexts = () => js(`Array.from(document.querySelectorAll('.task-card .task-status')).map(e => e.textContent)`);
  const listText = () => js(`(document.getElementById('taskList') || { textContent: '' }).textContent || ''`);
  const toastText = () => js(`(document.getElementById('toastContainer') || { textContent: '' }).textContent || ''`);
  const fireKey = (key) => js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true })); true`);

  try {
    // ---------- 1. 初始化 / 空态 ----------
    console.log('== 1. init & empty state ==');
    check('init 完成 (TaskStore 就绪)', await waitFor(`typeof TaskStore !== 'undefined' && typeof _lastListSig !== 'undefined' && _lastListSig !== null`));
    check('空态显示', (await listText()).includes(await js(`TaskI18n.t('empty.title')`)), await listText());
    check('头部 logo 为 TASK', (await js(`document.getElementById('headerTitle').textContent`)).includes('TASK'));
    check('底部按钮 = 2 个 (+ / 清理)', (await js(`document.querySelectorAll('.footer-btn').length`)) === 2);
    check('计数为 0', (await js(`document.getElementById('taskCount').textContent`)).includes(await js(`TaskI18n.t('footer.count', { n: 0 })`)), await js(`document.getElementById('taskCount').textContent`));
    check('插件 id = task', await js(`window.__PLUGIN_ID__`) === 'task');

    // ---------- 2. 创建: 空名自动命名 task1 ----------
    console.log('== 2. create with auto name ==');
    await js(`openCreateForm(); true`);
    check('表单视图打开', await js(`currentView`) === 'form');
    check('表单标题 = 创建标题', (await js(`document.getElementById('headerTitle').textContent`)).includes(await js(`TaskI18n.t('form.createTitle')`)));
    await js(`fName.value = ''; saveForm(); true`);
    check('保存后回到主视图', await waitFor(`currentView === 'main'`));
    check('自动命名 task1', JSON.stringify(await cardNames()) === '["task1"]', JSON.stringify(await cardNames()));
    check('创建 toast 含 task1', (await waitFor(`(document.getElementById('toastContainer')||{textContent:''}).textContent.includes('task1')`)) , await toastText());

    // ---------- 3. 种子任务 + 状态计算 + 排序 ----------
    console.log('== 3. status & sort ==');
    await js(`(() => {
      const now = Date.now();
      TaskStore.addTask({ name: 'A-soon', deadline: now + 3600000, reminders: [], remindMethod: 'popup' });
      TaskStore.addTask({ name: 'B-noDeadline', deadline: null, reminders: [], remindMethod: 'popup' });
      TaskStore.addTask({ name: 'C-expired', deadline: now - 1000, reminders: [], remindMethod: 'popup' });
      TaskStore.addTask({ name: 'D-far', deadline: now + 86400000 * 30, reminders: [], remindMethod: 'popup' });
      updateUI();
      return true;
    })()`);
    await waitFor(`document.querySelectorAll('.task-card').length === 5`);
    const names3 = await cardNames();
    check('排序: 未完成(截止近) > 未完成(无截止) > 已过期',
      JSON.stringify(names3) === JSON.stringify(['A-soon', 'D-far', 'task1', 'B-noDeadline', 'C-expired']),
      JSON.stringify(names3));
    const stats3 = await statusTexts();
    const pendingText = await js(`TaskI18n.t('status.pending')`);
    const expiredText = await js(`TaskI18n.t('status.expired')`);
    const completedText = await js(`TaskI18n.t('status.completed')`);
    check('状态: 前4未完成, 末1已过期',
      stats3.slice(0, 4).every((s) => s === pendingText) && stats3[4] === expiredText,
      JSON.stringify(stats3));
    check('过期卡片带 status-expired 类', await js(`document.querySelectorAll('.task-card.status-expired').length`) === 1);
    check('截止 meta 显示在卡片上', (await listText()).includes(await js(`TaskStore.formatShort(TaskStore.getSorted()[0].deadline)`)), await listText());

    // ---------- 4. 状态徽章点击切换完成 ----------
    console.log('== 4. status badge toggle ==');
    await js(`document.querySelector('.task-card .task-status').click(); true`);
    await waitFor(`TaskStore.getSorted()[TaskStore.getSorted().length - 1].name === 'A-soon'`);
    let names4 = await cardNames();
    check('点击徽章 → 已完成并排到最后', names4[names4.length - 1] === 'A-soon', JSON.stringify(names4));
    check('徽章文本变为已完成', (await statusTexts())[4] === completedText, JSON.stringify(await statusTexts()));
    check('已完成卡片线弱化样式', await js(`document.querySelectorAll('.task-card.status-completed').length`) === 1);
    await js(`document.querySelectorAll('.task-card .task-status')[4].click(); true`);
    await waitFor(`TaskStore.getSorted()[0].name === 'A-soon'`);
    names4 = await cardNames();
    check('再次点击 → 恢复未完成并回到首位', names4[0] === 'A-soon', JSON.stringify(names4));

    // ---------- 5. 编辑表单 ----------
    console.log('== 5. edit form ==');
    const aId = await js(`TaskStore.getSorted().find(t => t.name === 'A-soon').id`);
    await js(`openEditForm(TaskStore.getById(${JSON.stringify(aId)})); true`);
    check('编辑视图打开', await js(`currentView`) === 'form' && await js(`formMode`) === 'edit');
    check('名称预填', await js(`fName.value`) === 'A-soon', await js(`fName.value`));
    check('截止时间预填', (await js(`fDeadline.value`)).length > 0, await js(`fDeadline.value`));
    check('编辑标题显示', (await js(`document.getElementById('headerTitle').textContent`)).includes(await js(`TaskI18n.t('form.editTitle')`)));
    check('编辑模式显示删除按钮', await js(`deleteBtn.style.display`) !== 'none');
    await js(`fName.value = 'A-renamed'; saveForm(); true`);
    check('保存后回到主视图', await waitFor(`currentView === 'main'`));
    check('卡片名称已更新', (await cardNames()).includes('A-renamed'), JSON.stringify(await cardNames()));
    check('保存 toast', (await waitFor(`(document.getElementById('toastContainer')||{textContent:''}).textContent.includes('A-renamed')`)), await toastText());

    // ---------- 6. 编辑表单内删除 (确认弹窗) ----------
    console.log('== 6. delete via edit form ==');
    const dId = await js(`TaskStore.getSorted().find(t => t.name === 'D-far').id`);
    await js(`openEditForm(TaskStore.getById(${JSON.stringify(dId)})); true`);
    await js(`confirmDeleteTask(${JSON.stringify(dId)}); true`);
    check('删除确认弹窗打开', await js(`modalVisible`) === true);
    check('弹窗含任务名', (await js(`document.getElementById('modalMessage').textContent`)).includes('D-far'));
    await js(`document.querySelector('#modalButtons .modal-btn.danger').click(); true`);
    check('确认后任务删除', await waitFor(`!TaskStore.getById(${JSON.stringify(dId)})`));
    check('删除后回主视图', await js(`currentView`) === 'main');
    check('卡片已消失', !(await cardNames()).includes('D-far'), JSON.stringify(await cardNames()));

    // ---------- 7. 提醒: 触发系统通知 + 错过静默补记 ----------
    console.log('== 7. reminders ==');
    const remindAt = await js(`(() => { const t = TaskStore.addTask({ name: 'RMD', reminders: [Date.now() + 1500], deadline: null, remindMethod: 'popup' }); updateUI(); return t.reminders[0]; })()`);
    const notifCountBefore = await js(`window.__notifications.length`);
    check('提醒任务已创建', await js(`TaskStore.getSorted().some(t => t.name === 'RMD')`));
    check('提醒触发 → 系统通知发出', await waitFor(`window.__notifications.length > ${notifCountBefore}`, 6000), `count=${await js(`window.__notifications.length`)}`);
    const lastNotif = await js(`window.__notifications[window.__notifications.length - 1]`);
    check('通知内容含任务名 RMD', lastNotif && String(lastNotif.body).includes('RMD'), JSON.stringify(lastNotif));
    check('提醒已记入 fired (持久化)', await waitFor(`TaskStore.getSorted().find(t => t.name === 'RMD').fired.length === 1`, 5000));

    const notifBeforeMissed = await js(`window.__notifications.length`);
    const missedId = await js(`(() => { const t = TaskStore.addTask({ name: 'MISSED', reminders: [Date.now() - 600000], deadline: null, remindMethod: 'popup' }); updateUI(); return t.id; })()`);
    check('过期10分钟的提醒被静默补记', await waitFor(`TaskStore.getById(${JSON.stringify(missedId)}).fired.length === 1`, 4000));
    await sleep(1300);
    check('错过提醒不弹通知', await js(`window.__notifications.length`) === notifBeforeMissed, `before=${notifBeforeMissed} after=${await js(`window.__notifications.length`)}`);

    // ---------- 8. 表单: 等大 / 提醒方式门槛 / 放弃确认 ----------
    console.log('== 8. form view rules ==');
    const countBefore = await js(`TaskStore.getAll().length`);
    await js(`openCreateForm(); true`);
    const geo = await js(`(() => { const r = viewForm.getBoundingClientRect(); return { w: r.width, h: r.height, iw: window.innerWidth, ih: window.innerHeight }; })()`);
    check('表单视图与子程序等大', Math.abs(geo.w - geo.iw) <= 1 && Math.abs(geo.h - (geo.ih - 48)) <= 1, JSON.stringify(geo));
    check('提醒时间为空 → 提醒方式禁用', await js(`fMethod.disabled`) === true);
    check('提醒方式默认弹窗提醒', await js(`fMethod.value`) === 'popup');
    await js(`(() => {
      const input = document.querySelector('.reminder-input');
      input.value = TaskStore.toLocalInput(Date.now() + 3600000);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    check('提醒时间非空 → 提醒方式解锁', await js(`fMethod.disabled`) === false);
    await js(`(() => {
      const input = document.querySelector('.reminder-input');
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    check('清空提醒时间 → 提醒方式重新禁用', await js(`fMethod.disabled`) === true);

    await js(`cancelForm(); true`);
    check('未修改时取消直接返回', await js(`currentView`) === 'main');

    await js(`openCreateForm(); fName.value = 'dirty-test'; cancelForm(); true`);
    check('有修改时取消 → 放弃确认弹窗', await js(`modalVisible`) === true);
    await js(`document.querySelector('#modalButtons .modal-btn.danger').click(); true`);
    check('放弃后回主视图且未创建', await waitFor(`currentView === 'main'`) && (await js(`TaskStore.getAll().length`)) === countBefore, `count=${await js(`TaskStore.getAll().length`)} vs ${countBefore}`);

    // ---------- 9. 持久化: storage 落盘 + 重载存活 ----------
    console.log('== 9. persistence ==');
    const storeFile = path.join(DATA_ROOT, 'store.json');
    check('store.json 已落盘', fss.existsSync(storeFile));
    let persisted = null;
    try { persisted = JSON.parse(fss.readFileSync(storeFile, 'utf8')); } catch (e) { /* ignore */ }
    // storage 以 key='tasks' 存 {version, tasks:[...]}
    const payload = persisted && persisted.tasks;
    check('store.json 含 tasks 数组', payload && Array.isArray(payload.tasks) && payload.tasks.length >= 5, payload ? String(payload.tasks && payload.tasks.length) : 'unparsable');

    await win.loadFile(PLUGIN_HTML);
    check('重载后 init 完成', await waitFor(`typeof TaskStore !== 'undefined' && typeof _lastListSig !== 'undefined' && _lastListSig !== null`));
    const names9 = await cardNames();
    check('重载后任务存活 (task1)', names9.includes('task1'), JSON.stringify(names9));
    check('重载后编辑结果存活 (A-renamed)', names9.includes('A-renamed'), JSON.stringify(names9));
    check('重载后删除生效 (D-far 不复活)', !names9.includes('D-far'), JSON.stringify(names9));

    // ---------- 10. 键盘控制 ----------
    console.log('== 10. keyboard ==');
    check('初始选中列表第1项', (await js(`selectedRow + ':' + selectedCol`)) === '0:0', await js(`selectedRow + ':' + selectedCol`));
    await fireKey('ArrowDown');
    check('↓ 移到第2项', (await js(`selectedRow + ':' + selectedCol`)) === '0:1', await js(`selectedRow + ':' + selectedCol`));
    const kbTarget = (await cardNames())[1];
    await fireKey('Enter');
    check('Enter 切换完成状态', await js(`TaskStore.getAll().find(t => t.name === ${JSON.stringify(kbTarget)}).completed`) === true, kbTarget);
    for (let i = 0; i < 12 && (await js(`selectedRow`)) === 0; i++) await fireKey('ArrowDown');
    check('↓ 从列表进入底部按钮行', (await js(`selectedRow`)) === 1, await js(`selectedRow + ':' + selectedCol`));
    check('进入底部时按钮选中未越界', (await js(`selectedCol`)) >= 0 && (await js(`selectedCol`)) <= 1, await js(`selectedCol`));
    await fireKey('ArrowLeft');
    check('← 底部按钮左移', (await js(`selectedCol`)) === 0, await js(`selectedRow + ':' + selectedCol`));
    await fireKey('ArrowRight');
    check('→ 底部按钮右移', (await js(`selectedCol`)) === 1, await js(`selectedRow + ':' + selectedCol`));
    await fireKey('ArrowUp');
    check('↑ 返回列表行', (await js(`selectedRow`)) === 0, await js(`selectedRow + ':' + selectedCol`));
    await fireKey('e');
    check('E 打开编辑表单', await waitFor(`currentView === 'form' && formMode === 'edit'`));
    await fireKey('Escape');
    check('Esc (未修改) 返回主视图', await js(`currentView`) === 'main', await js(`currentView`));
    const rpcBefore = await js(`window.__returnToParentCalls || 0`);
    await fireKey('Escape');
    check('主视图 Esc 返回母程序', await waitFor(`(window.__returnToParentCalls || 0) > ${rpcBefore}`), await js(`window.__returnToParentCalls || 0`));

    // ---------- 11. 自动命名第二个空名任务 ----------
    console.log('== 11. auto name sequence ==');
    await js(`openCreateForm(); fName.value = ''; saveForm(); true`);
    await waitFor(`currentView === 'main'`);
    const createdAuto = (await cardNames()).filter((n) => /^task\d+$/.test(n));
    check('空名创建 taskN 递增且不重复', new Set(createdAuto).size === createdAuto.length && createdAuto.length >= 1, JSON.stringify(createdAuto));
  } catch (e) {
    check('测试执行未抛异常', false, e && e.message);
    console.error(e);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  app.exit(failed.length === 0 ? 0 : 1);
});
