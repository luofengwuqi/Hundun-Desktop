// 令牌保存链路的渲染层回归（决策67 修复: 保存后「创建并关联」被输入框清空锁住）
// 场景: 已保存令牌 / 首次保存 / 未保存 —— 按钮禁用状态与 hint/placeholder 必须跟真实令牌走
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('path')

const PRELOAD = `
const HAS_TOKEN = process.env.HAS_TOKEN !== '0'
const settingsData = { theme: 'hun-tun-black', locale: 'zh', sound: { soundEnabled: false, volume: 0 },
  plugins: { order: ['fast-txt'], removed: [], orderVersion: 2 } }
const readPath = (d) => (d ? d.split('.').reduce((a, k) => (a == null ? undefined : a[k]), settingsData) : undefined)
const settingsMock = {
  get: (k, fb) => { const v = readPath(k); return v === undefined ? fb : v },
  has: (k) => readPath(k) !== undefined,
  all: () => JSON.parse(JSON.stringify(settingsData)),
  set: async () => ({ ok: true }), setMany: async () => ({ ok: true }), remove: async () => ({ ok: true }),
  filePath: () => '/tmp/x', onChanged: () => () => {}
}
let tokenStorage = HAS_TOKEN ? 'safeStorage' : null
let hasToken = HAS_TOKEN
const cfg = () => ({ enabled: true, provider: 'gitee', remoteUrl: '', username: '', branch: 'main',
  scopes: { settings: true, installedPlugins: true, plugins: [] },
  tokenStorage, lastSyncAt: null, lastResult: null })
const syncMock = {
  status: async () => ({ ok: true, config: cfg(), hasToken, gitAvailable: true, gitVersion: '2.53.0',
    initialized: false, pendingChanges: 0, plugins: [] }),
  detectGit: async () => ({ ok: true, gitAvailable: true, gitVersion: '2.53.0' }),
  preview: async () => ({ ok: true, count: 0, skipped: [] }),
  updateConfig: async (patch) => {
    if (patch && patch.token !== undefined) {
      const v = String(patch.token || '').trim()
      hasToken = !!v
      tokenStorage = v ? 'safeStorage' : null
    }
    return { ok: true, config: cfg() }
  },
  link: async () => ({ ok: true }), createGiteeRepo: async () => ({ ok: true }),
  pull: async () => ({ ok: true }), push: async () => ({ ok: true }),
  overwriteLocal: async () => ({ ok: true }), overwriteRemote: async () => ({ ok: true }),
  resolve: async () => ({ ok: true, resolved: [] })
}
window.electronAPI = new Proxy({}, {
  get(_t, key) {
    const name = String(key)
    if (name === 'settings') return settingsMock
    if (name === 'sync') return syncMock
    if (name === 'openExternal') return async () => true
    if (name.startsWith('on')) return () => () => {}
    if (name === 'getAppVersion') return async () => '2026.4.2'
    return async () => ({})
  }
})
`

// 关掉最后一个窗口会让 Electron 默认退出 (window-all-closed -> quit)，
// 多用例脚本必须拦住，否则后面的用例根本没机会跑
app.on('window-all-closed', () => {})

let pass = 0, fail = 0
const check = (label, cond, detail) => {
  if (cond) { pass++; console.log('  PASS  ' + label) }
  else { fail++; console.log('  FAIL  ' + label + (detail ? '  <- ' + detail : '')) }
}

const runCase = async (hasTokenEnv) => {
  const preloadPath = path.join(os.tmpdir(), 'token-save-preload-' + (hasTokenEnv ? '1' : '0') + '.js')
  fs.writeFileSync(preloadPath, PRELOAD)
  const win = new BrowserWindow({
    width: 800, height: 540, show: true, backgroundColor: '#141414',
    webPreferences: { preload: preloadPath, nodeIntegration: false, contextIsolation: false, sandbox: false, webSecurity: false }
  })
  const js = (c) => win.webContents.executeJavaScript(c)
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  process.env.HAS_TOKEN = hasTokenEnv ? '1' : '0'
  await win.loadFile(path.join(__dirname, '..', 'out', 'renderer', 'index.html'))
  await wait(1400)
  await js(`document.querySelector('.repo-btn-icon').click()`)
  await wait(220)
  await js(`document.querySelector('.repo-btn-icon').click()`)
  await wait(750)

  const before = JSON.parse(await js(`JSON.stringify({
    hint: document.querySelector('.pt-hint').textContent.trim(),
    ph: document.querySelector('.panel-top .pt-input').placeholder,
    createDisabled: !!document.querySelector('.setup-block .pt-btn.primary').disabled
  })`))
  const tag = hasTokenEnv ? '[已保存令牌]' : '[首次]'
  check(tag + ' 初始按钮状态正确', before.createDisabled === !hasTokenEnv,
    'hint=' + before.hint + ' disabled=' + before.createDisabled)

  // 输入令牌 -> 点保存
  await js(`(() => {
    const input = document.querySelector('.panel-top .pt-input')
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'fake-token-abc123')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  await wait(280)
  await js(`document.querySelector('.panel-top .pt-btn').click()`)
  await wait(850)

  const after = JSON.parse(await js(`JSON.stringify({
    inputValue: document.querySelector('.panel-top .pt-input').value,
    hint: document.querySelector('.pt-hint').textContent.trim(),
    ph: document.querySelector('.panel-top .pt-input').placeholder,
    result: (document.querySelector('.res-line') || {}).textContent || '',
    createDisabled: !!document.querySelector('.setup-block .pt-btn.primary').disabled
  })`))
  check(tag + ' 保存后输入框清空', after.inputValue === '')
  check(tag + ' 保存后按钮可点 (核心回归)', after.createDisabled === false,
    'disabled=' + after.createDisabled + ' hint=' + after.hint)
  check(tag + ' hint 反映已保存', /已加密保存|明文保存/.test(after.hint), after.hint)
  check(tag + ' 结果条给出可继续的提示', after.result.includes('创建并关联'), after.result)

  win.destroy()
  await wait(200)
  fs.rmSync(preloadPath, { force: true })
}

app.whenReady().then(async () => {
  try {
    await runCase(true)
    await runCase(false)
  } catch (error) {
    fail++
    console.log('  FAIL  用例抛异常: ' + (error && error.message))
  }
  console.log('结果: ' + pass + '/' + (pass + fail) + ' 通过')
  app.exit(fail ? 1 : 0)
})
