/**
 * 插件卸载测试 (决策46)
 *
 * 运行: npx electron --no-sandbox scripts/test-plugin-uninstall.js  (退出码 0 = 全过)
 *
 * 覆盖:
 *   A. 安装插件 (registry 有记录): 真卸载 — 删安装目录 + 删记录 + 删 userdata (removeData)
 *   B. 安装插件 + keepData: 删目录/记录, userdata 保留
 *   C. 内置插件 (无记录): 不删插件目录, 返回 builtin=true (渲染层走"已移除名单"隐藏)
 *   D. 内置插件 + removeData: 目录保留, userdata 删除
 *   E. 非法 id (含路径穿越) 拒绝
 *
 * 隔离: userData = 临时目录 (registry / userdata 全部落临时区);
 *       伪安装插件 plugins/zz-test-uninstall 在 finally 清理 (含 exit 兜底)
 */
const { app } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

// 隔离 userData: installed-plugins.json 与 userdata 不写用户真实数据
const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'uninstall-'))
app.setPath('userData', tmpUserData)

const { uninstallPlugin } = require('../src/main/plugin-installer')

const FAKE_ID = 'zz-test-uninstall'
const projectRoot = path.join(__dirname, '..')
const fakeDir = path.join(projectRoot, 'plugins', FAKE_ID)
const registryPath = path.join(tmpUserData, 'installed-plugins.json')
const dataDir = path.join(tmpUserData, 'plugins', FAKE_ID)
const jsonPath = path.join(tmpUserData, 'huntun-lite-data', `${FAKE_ID}.json`)
const calcDataDir = path.join(tmpUserData, 'plugins', 'calculator')
const calcJsonPath = path.join(tmpUserData, 'huntun-lite-data', 'calculator.json')

const results = []
const check = (name, cond, detail = '') => {
  results.push({ name, pass: !!cond })
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
}

// 伪安装插件落盘 + registry 记录 + userdata 样本数据
function seedInstalled () {
  fs.mkdirSync(path.join(fakeDir), { recursive: true })
  fs.writeFileSync(path.join(fakeDir, 'manifest.json'), JSON.stringify({ id: FAKE_ID, name: 'ZZ', version: '1.0.0', entry: 'index.html' }))
  fs.writeFileSync(path.join(fakeDir, 'index.html'), '<html></html>')
  fs.writeFileSync(registryPath, JSON.stringify({ [FAKE_ID]: { name: 'ZZ', version: '1.0.0', installedAt: new Date().toISOString() } }))
  fs.mkdirSync(path.join(dataDir, 'file'), { recursive: true })
  fs.writeFileSync(path.join(dataDir, 'file', 'doc.txt'), 'hello')
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true })
  fs.writeFileSync(jsonPath, JSON.stringify({ k: 1 }))
}

function seedBuiltinData () {
  fs.mkdirSync(path.join(calcDataDir, 'file'), { recursive: true })
  fs.writeFileSync(path.join(calcDataDir, 'file', 'x.txt'), 'y')
  fs.mkdirSync(path.dirname(calcJsonPath), { recursive: true })
  fs.writeFileSync(calcJsonPath, JSON.stringify({ k: 2 }))
}

function readRegistry () {
  try { return JSON.parse(fs.readFileSync(registryPath, 'utf-8')) } catch (_) { return {} }
}

// 兜底清理伪插件目录 (断言失败/异常退出也不留仓库垃圾)
process.on('exit', () => {
  try { if (fs.existsSync(fakeDir)) fs.rmSync(fakeDir, { recursive: true, force: true }) } catch (_) {}
})

app.whenReady().then(async () => {
  try {
    // ---------- A. 安装插件真卸载 + 删数据 ----------
    seedInstalled()
    const ra = uninstallPlugin(FAKE_ID, { removeData: true })
    check('A. 卸载成功', ra && ra.success === true, JSON.stringify(ra))
    check('A. removedDir=true / builtin=false', ra && ra.removedDir === true && ra.builtin === false)
    check('A. removedData=true', ra && ra.removedData === true)
    check('A. 安装目录已删', !fs.existsSync(fakeDir), fakeDir)
    check('A. registry 记录已删', !readRegistry()[FAKE_ID], JSON.stringify(readRegistry()))
    check('A. userdata 文件目录已删', !fs.existsSync(dataDir), dataDir)
    check('A. userdata JSON 已删', !fs.existsSync(jsonPath), jsonPath)

    // ---------- B. 安装插件 + keepData ----------
    seedInstalled()
    const rb = uninstallPlugin(FAKE_ID, { removeData: false })
    check('B. 卸载成功', rb && rb.success === true, JSON.stringify(rb))
    check('B. 安装目录已删', !fs.existsSync(fakeDir))
    check('B. registry 记录已删', !readRegistry()[FAKE_ID])
    check('B. userdata 文件目录保留', fs.existsSync(path.join(dataDir, 'file', 'doc.txt')))
    check('B. userdata JSON 保留', fs.existsSync(jsonPath))

    // ---------- C. 内置插件: 不删目录 ----------
    const builtinDir = path.join(projectRoot, 'plugins', 'calculator')
    const rc = uninstallPlugin('calculator', { removeData: false })
    check('C. 卸载成功 (builtin)', rc && rc.success === true, JSON.stringify(rc))
    check('C. builtin=true / removedDir=false', rc && rc.builtin === true && rc.removedDir === false)
    check('C. 内置插件目录原样保留', fs.existsSync(builtinDir) && fs.existsSync(path.join(builtinDir, 'manifest.json')), builtinDir)

    // ---------- D. 内置插件 + removeData: 目录保留, 数据删 ----------
    seedBuiltinData()
    const rd = uninstallPlugin('calculator', { removeData: true })
    check('D. 卸载成功 (builtin+data)', rd && rd.success === true, JSON.stringify(rd))
    check('D. builtin=true, 目录仍在', rd && rd.builtin === true && fs.existsSync(builtinDir))
    check('D. 内置 userdata 文件目录已删', !fs.existsSync(calcDataDir))
    check('D. 内置 userdata JSON 已删', !fs.existsSync(calcJsonPath))

    // ---------- E. 非法 id ----------
    const re1 = uninstallPlugin('../evil', { removeData: false })
    check('E. 路径穿越 id 被拒', re1 && re1.success === false, JSON.stringify(re1))
    const re2 = uninstallPlugin('Bad_ID', { removeData: false })
    check('E. 大写/下划线 id 被拒', re2 && re2.success === false, JSON.stringify(re2))
    const re3 = uninstallPlugin('', { removeData: false })
    check('E. 空 id 被拒', re3 && re3.success === false, JSON.stringify(re3))
  } finally {
    // 清理伪插件目录
    try { if (fs.existsSync(fakeDir)) fs.rmSync(fakeDir, { recursive: true, force: true }) } catch (_) {}
  }

  const failed = results.filter(r => !r.pass)
  console.log(`\n结果: ${results.length - failed.length}/${results.length} 通过`)
  app.exit(failed.length ? 1 : 0)
}).catch(e => {
  console.error(e)
  try { if (fs.existsSync(fakeDir)) fs.rmSync(fakeDir, { recursive: true, force: true }) } catch (_) {}
  app.exit(1)
})
