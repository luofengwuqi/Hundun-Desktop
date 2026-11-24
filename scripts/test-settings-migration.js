/**
 * 老设置迁移冒烟 (决策66) —— localStorage → settings.json「只补不覆盖」
 *
 * 运行: env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron --no-sandbox scripts/test-settings-migration.js
 *       (退出码 0 = 全过)
 *
 * 为什么要跑在 Electron 里: 迁移读的是真实 localStorage (老版本存这里),
 * 纯 Node 没有 window/localStorage。夹具页 (scripts/fixtures/settings-migration.html)
 * 用 <script type="module"> 直接 import 真实的 app-settings.js —— 测的就是线上那份代码。
 *
 * 覆盖:
 *   1. settings.json 没有该项时, 从 localStorage 老键补写一次
 *   2. settings.json **已有值时不覆盖** (用户在新版改过的值优先)
 *   3. 各键解码方式正确 (theme/locale 裸字符串, sound/plugins JSON, orderVersion 数字)
 *   4. 老键迁移后仍留在 localStorage (回滚/排查可捞回)
 *   5. 写一条 meta.localStorageMigratedAt 迁移痕迹
 */
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const os = require('os')
const fs = require('fs')
const { getSettingsStore } = require('../src/main/settings-store')

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'setmig-'))
app.setPath('userData', userDataDir)

const results = []
const check = (name, cond, detail = '') => {
  results.push(!!cond)
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
}

// 与 src/main/index.js 一致的接线
const settingsStore = getSettingsStore()
settingsStore.onChange = (snapshot) => {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win && !win.isDestroyed()) win.webContents.send('settings:changed', snapshot)
  }
}
ipcMain.on('settings:get-sync', (event) => { event.returnValue = settingsStore.snapshot() })
ipcMain.handle('settings:get', (event, dotted, fallback = null) => settingsStore.get(dotted, fallback))
ipcMain.handle('settings:set', (event, dotted, value) => settingsStore.set(dotted, value))
ipcMain.handle('settings:set-many', (event, patch) => settingsStore.setMany(patch))
ipcMain.handle('settings:file-path', () => settingsStore.filePath)
ipcMain.handle('settings:remove', (event, dotted) => settingsStore.remove(dotted))

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const openFixture = async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../src/main/preload.js'),
      contextIsolation: false,
      nodeIntegration: true,
      // file:// 下的 ESM import 需要放开同源限制 (仅测试夹具使用)
      webSecurity: false
    }
  })
  await win.loadFile(path.join(__dirname, 'fixtures/settings-migration.html'))
  for (let i = 0; i < 40 && !(await win.webContents.executeJavaScript('!!window.__ready')); i++) {
    await sleep(50)
  }
  return win
}

app.whenReady().then(async () => {
  const win = await openFixture()

  const loaded = await win.webContents.executeJavaScript(
    `JSON.stringify({ ready: !!window.__settings, keys: window.__settings ? Object.keys(window.__settings.SETTING_KEY) : [] })`
  )
  const info = JSON.parse(loaded)
  check('夹具成功加载真实的 app-settings.js', info.ready === true, loaded)
  check('SETTING_KEY 含 7 个键', info.keys.length === 7, info.keys.join(','))

  // ---------- 造老数据 (模拟 2026.4.2 及更早版本的 localStorage) ----------
  await win.webContents.executeJavaScript(`
    localStorage.clear()
    localStorage.setItem('hundundesktop-theme', 'contact-sheet')
    localStorage.setItem('hundundesktop-locale', 'en')
    localStorage.setItem('hundundesktop-settings', JSON.stringify({ soundEnabled: false, volume: 12 }))
    localStorage.setItem('hundundesktop-plugins', JSON.stringify([
      { id: 'fast-txt', enabled: true }, { id: 'music', enabled: false }
    ]))
    localStorage.setItem('hundundesktop-plugins-removed', JSON.stringify([
      { id: 'calculator', name: 'CALC', removedAt: '2026-11-01T00:00:00.000Z' }
    ]))
    localStorage.setItem('hundundesktop-plugin-order-version', '2')
    true
  `)

  check('迁移前 settings.json 不存在', !fs.existsSync(settingsStore.filePath))

  // ---------- 首次读取 → 补写 ----------
  const firstRead = await win.webContents.executeJavaScript(`
    JSON.stringify({
      theme: window.__settings.getSettingMigrating('theme', null),
      locale: window.__settings.getSettingMigrating('locale', null),
      sound: window.__settings.getSettingMigrating('sound', null),
      order: window.__settings.getSettingMigrating('plugins.order', null),
      removed: window.__settings.getSettingMigrating('plugins.removed', null),
      orderVersion: window.__settings.getSettingMigrating('plugins.orderVersion', 0)
    })
  `)
  const read = JSON.parse(firstRead)
  check('theme 从老键读出 (裸字符串)', read.theme === 'contact-sheet', String(read.theme))
  check('locale 从老键读出 (裸字符串)', read.locale === 'en', String(read.locale))
  check('sound 从老键读出 (JSON)', read.sound && read.sound.volume === 12 && read.sound.soundEnabled === false, JSON.stringify(read.sound))
  check('plugins.order 从老键读出 (JSON 数组)', Array.isArray(read.order) && read.order.length === 2, JSON.stringify(read.order))
  check('plugins.removed 从老键读出', Array.isArray(read.removed) && read.removed[0].id === 'calculator', JSON.stringify(read.removed))
  check('orderVersion 从老键读出 (数字)', read.orderVersion === 2, String(read.orderVersion))

  // 补写是异步 IPC, 等它落盘
  await sleep(500)
  const onDisk = JSON.parse(fs.readFileSync(settingsStore.filePath, 'utf8'))
  check('补写落盘: settings.json 已生成', fs.existsSync(settingsStore.filePath))
  check('补写落盘: theme/locale 正确', onDisk.theme === 'contact-sheet' && onDisk.locale === 'en', JSON.stringify({ theme: onDisk.theme, locale: onDisk.locale }))
  check('补写落盘: sound 节点正确', onDisk.sound && onDisk.sound.volume === 12, JSON.stringify(onDisk.sound))
  check('补写落盘: plugins.order 正确', Array.isArray(onDisk.plugins && onDisk.plugins.order) && onDisk.plugins.order.length === 2, JSON.stringify(onDisk.plugins))
  check('补写落盘: 写了迁移痕迹 meta', !!(onDisk.meta && onDisk.meta.localStorageMigratedAt), JSON.stringify(onDisk.meta))

  const legacyKept = await win.webContents.executeJavaScript(
    `JSON.stringify({ theme: localStorage.getItem('hundundesktop-theme'), sound: !!localStorage.getItem('hundundesktop-settings') })`
  )
  const kept = JSON.parse(legacyKept)
  check('老 localStorage 键迁移后保留 (可回滚)', kept.theme === 'contact-sheet' && kept.sound === true, legacyKept)

  // ---------- 只补不覆盖 ----------
  // 模拟: 用户在新版里把主题改成了 hun-tun-yellow, 但 localStorage 还留着旧的 contact-sheet
  const overwrite = await win.webContents.executeJavaScript(`
    window.__settings.setSetting('theme', 'hun-tun-yellow')
      .then(() => JSON.stringify({ value: window.__settings.getSettingMigrating('theme', null) }))
  `)
  const after = JSON.parse(overwrite)
  check('settings.json 已有值时不被老值覆盖', after.value === 'hun-tun-yellow', String(after.value))
  await sleep(300)
  check('落盘值仍是用户的新值', JSON.parse(fs.readFileSync(settingsStore.filePath, 'utf8')).theme === 'hun-tun-yellow')

  // ---------- 都没有时返回 fallback, 且不写默认值 ----------
  const missing = await win.webContents.executeJavaScript(`
    JSON.stringify({
      value: window.__settings.getSettingMigrating('plugins.notWhitelisted', 'FB'),
      hasBridge: window.__settings.hasSettingsBridge(),
      hasTheme: window.__settings.hasSetting('theme'),
      hasLocale: window.__settings.hasSetting('locale')
    })
  `)
  const miss = JSON.parse(missing)
  check('两边都没有 → 返回 fallback', miss.value === 'FB', String(miss.value))
  check('桥可用 (真实 preload)', miss.hasBridge === true)
  check('hasSetting 反映已落盘项', miss.hasTheme === true && miss.hasLocale === true)

  const pass = results.filter(Boolean).length
  console.log(`\n${pass}/${results.length} 项通过  (userData=${userDataDir})`)
  win.destroy()
  app.exit(pass === results.length ? 0 : 1)
}).catch(err => {
  console.error('冒烟失败:', err)
  app.exit(1)
})
