<template>
  <div class="repo-view" :class="{ 'light-mode': !isDarkMode }">
    <!-- Header: 与设置页同构 (左主题开关 / 中标题 / 右关闭) -->
    <header class="repo-header">
      <div class="toggle-container">
        <span class="toggle-label">{{ t('settings.dark') }}</span>
        <div class="toggle-switch" :class="{ active: !isDarkMode }" @click="toggleTheme">
          <div class="toggle-knob"></div>
        </div>
        <span class="toggle-label">{{ t('settings.light') }}</span>
      </div>
      <div class="repo-logo">
        <span class="logo-icon">🗄</span>
        <span class="logo-text">{{ t('repo.title') }}</span>
      </div>
      <button class="repo-close-btn" :title="t('repo.close')" @click="$emit('close')">✕</button>
    </header>

    <main class="repo-body">
      <!-- ===== 左栏 (占 1/3): 四个动作 ===== -->
      <aside class="repo-rail">
        <button
          v-for="a in actions"
          :key="a.key"
          class="rail-btn"
          :class="{
            danger: a.danger,
            armed: armed === a.key,
            working: busy && busyKind === a.key
          }"
          :disabled="!canAct || busy"
          @click="run(a)"
        >
          <span class="rail-icon" v-html="armed === a.key ? WARN_SVG : a.svg"></span>
          <span class="rail-text">
            <span class="rail-title">
              {{ busy && busyKind === a.key ? t('repo.syncing') : (armed === a.key ? t('repo.confirmAgain') : t(a.title)) }}
            </span>
            <span class="rail-desc">{{ armed === a.key ? t('repo.confirmHint', { what: t(a.title) }) : t(a.desc) }}</span>
          </span>
        </button>
      </aside>

      <!-- ===== 右栏 ===== -->
      <section class="repo-panel">
        <!-- 上栏 (扁): Gitee 访问令牌 -->
        <div class="panel-top">
          <label class="pt-label">{{ t('repo.tokenLabel') }}</label>
          <button
            class="pt-help"
            type="button"
            :title="t('repo.tokenHelp')"
            :aria-label="t('repo.tokenHelp')"
            @click="openHelp('gitee-token')"
          >?</button>
          <input
            v-model="tokenInput"
            class="pt-input"
            type="password"
            autocomplete="off"
            spellcheck="false"
            :placeholder="hasToken ? t('repo.tokenPhSaved') : t('repo.tokenPh')"
          />
          <button class="pt-btn" :disabled="busy" @click="saveToken">{{ t('repo.tokenSave') }}</button>
          <span class="pt-hint" :class="{ warn: config.tokenStorage === 'plain' }">{{ tokenHint }}</span>
        </div>

        <!-- 下栏: 未关联 → 接入；已关联 → 已装的子程序 -->
        <div class="panel-main">
          <template v-if="!config.remoteUrl">
            <div class="hint-row">
              <p class="panel-hint">{{ t('repo.notLinkedHint') }}</p>
              <button
                class="pt-help"
                type="button"
                :title="t('repo.tokenHelp')"
                :aria-label="t('repo.tokenHelp')"
                @click="openHelp('gitee-token')"
              >?</button>
            </div>

            <div class="setup-block">
              <div class="setup-title">{{ t('repo.autoTitle') }}</div>
              <p class="setup-hint">{{ t('repo.autoHint') }}</p>
              <div class="field-row">
                <input v-model="giteeName" class="pt-input wide" type="text" spellcheck="false" :placeholder="t('repo.autoName')" />
                <button
                  class="pt-btn primary"
                  :disabled="busy || (!tokenInput.trim() && !hasToken)"
                  :title="tokenInput.trim() ? '' : t('repo.useSavedToken')"
                  @click="createOnGitee"
                >
                  {{ t('repo.autoCreate') }}
                </button>
              </div>
            </div>

            <div class="setup-block">
              <div class="setup-title">{{ t('repo.manualTitle') }}</div>
              <p class="setup-hint">{{ t('repo.manualHint') }}</p>
              <input v-model="manualUrl" class="pt-input wide" type="text" autocomplete="off" spellcheck="false" :placeholder="t('repo.remoteUrl')" />
              <div class="field-row">
                <input v-model="manualUser" class="pt-input" type="text" autocomplete="off" spellcheck="false" :placeholder="t('repo.username')" />
                <button class="pt-btn" :disabled="busy || !manualUrl.trim()" @click="linkExisting">{{ t('repo.link') }}</button>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="linked-bar">
              <span class="linked-url" :title="config.remoteUrl">{{ config.remoteUrl }}</span>
              <span class="linked-meta">{{ t('repo.lastSync') }} {{ lastSyncText }}</span>
              <span class="linked-meta">{{ pendingText }}</span>
            </div>

            <div class="scope-title">{{ t('repo.installedTitle') }}</div>
            <div class="scope-list">
              <label class="scope-item">
                <input type="checkbox" :checked="config.scopes.settings" @change="toggleScope('settings', $event.target.checked)" />
                <span class="scope-name">{{ t('repo.scopeSettings') }}</span>
              </label>
              <label class="scope-item">
                <input type="checkbox" :checked="config.scopes.installedPlugins" @change="toggleScope('installedPlugins', $event.target.checked)" />
                <span class="scope-name">{{ t('repo.scopeInstalled') }}</span>
              </label>
              <label v-for="p in plugins" :key="p.id" class="scope-item" :class="{ dim: !p.syncable }">
                <input
                  type="checkbox"
                  :checked="p.syncable && included(p.id)"
                  :disabled="!p.syncable"
                  @change="togglePlugin(p.id, $event.target.checked)"
                />
                <span class="scope-name">{{ p.name }}</span>
                <span class="scope-id">{{ p.id }}</span>
                <span v-if="!p.syncable" class="scope-tag">{{ t('repo.notSyncable') }}</span>
              </label>
            </div>
            <p class="panel-hint">{{ t('repo.scopeHint') }}</p>

            <!-- 冲突 -->
            <div v-if="conflicts.length" class="conflict-box">
              <div class="conflict-title">{{ t('repo.conflictTitle') }}</div>
              <p class="setup-hint">{{ t('repo.conflictHint') }}</p>
              <ul class="conflict-list">
                <li v-for="c in conflicts" :key="c.path">{{ c.path }}</li>
              </ul>
              <div class="field-row">
                <button class="pt-btn primary" :disabled="busy" @click="resolve('local')">{{ t('repo.keepLocal') }}</button>
                <button class="pt-btn" :disabled="busy" @click="resolve('cloud')">{{ t('repo.keepCloud') }}</button>
              </div>
            </div>
          </template>
        </div>

        <!-- 结果条 -->
        <div v-if="resultLines.length" class="panel-result" :class="{ error: resultIsError }">
          <div v-for="(line, i) in resultLines" :key="i" class="res-line">{{ line }}</div>
        </div>
      </section>
    </main>

    <footer class="repo-footer">
      <span class="footer-status" :class="{ bad: !gitAvailable }">
        <span class="footer-dot"></span>
        {{ gitAvailable ? t('repo.gitReady', { version: gitVersion }) : t('repo.gitMissing') }}
        <button v-if="!gitAvailable" class="footer-mini" :disabled="busy" @click="refreshGit">{{ t('repo.retry') }}</button>
      </span>
      <span class="footer-hint">{{ t('keys.escToExit') }}</span>
    </footer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useThemeStore } from '../stores/theme'
import { useI18nStore } from '../stores/i18n'
import { playSound } from '../utils/audio'
import { useHelp } from '../composables/useHelp.js'

defineEmits(['close'])

// 问号 → 全局帮助页 (主机在 App.vue)
const { openHelp } = useHelp()

const themeStore = useThemeStore()
const i18nStore = useI18nStore()
const t = (key, params = {}) => i18nStore.t(key, params)

const isDarkMode = computed(() => themeStore.isDarkMode)
const toggleTheme = () => {
  playSound('change')
  themeStore.toggleTheme()
}

const api = () => (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.sync) || null

const gitAvailable = ref(true)
const gitVersion = ref('')
const busy = ref(false)
const busyKind = ref('')
const config = reactive({
  enabled: false,
  remoteUrl: '',
  branch: 'main',
  scopes: { settings: true, installedPlugins: true, plugins: [] },
  tokenStorage: null,
  lastSyncAt: null
})
const plugins = ref([])
const pendingChanges = ref(0)
const resultLines = ref([])
const resultIsError = ref(false)
const conflicts = ref([])

const tokenInput = ref('')
// 真实的令牌状态（token.bin 是否有内容）—— 只看 config.tokenStorage 会撒谎：
// 解密失败/换机器后 config 里还是 'safeStorage'，但其实读不出令牌
const hasToken = ref(false)
const giteeName = ref('hundun-data')
const manualUrl = ref('')
const manualUser = ref('')

// 二次确认: 破坏性动作要点两次，5 秒内不点就撤回
const armed = ref('')
let armTimer = null
const arm = (key) => {
  armed.value = key
  if (armTimer) clearTimeout(armTimer)
  armTimer = setTimeout(() => { armed.value = '' }, 5000)
}
const disarm = () => {
  armed.value = ''
  if (armTimer) clearTimeout(armTimer)
  armTimer = null
}

// 图标与母程序底部按钮同一套线条语言 (stroke 2.4 / round)
const svgArrow = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`

const WARN_SVG = svgArrow('<path d="M12 4.5 21 20H3z"/><path d="M12 10v4"/><path d="M12 17.2v.2"/>')

const actions = [
  {
    key: 'pull',
    kind: 'pull',
    title: 'repo.actPullTitle',
    desc: 'repo.actPullDesc',
    danger: false,
    svg: svgArrow('<path d="M12 4v11"/><path d="M6.5 10.5 12 16l5.5-5.5"/><path d="M4.5 20h15"/>')
  },
  {
    key: 'push',
    kind: 'push',
    title: 'repo.actPushTitle',
    desc: 'repo.actPushDesc',
    danger: false,
    svg: svgArrow('<path d="M12 20V9"/><path d="M6.5 13.5 12 8l5.5 5.5"/><path d="M4.5 4h15"/>')
  },
  {
    key: 'overwriteLocal',
    kind: 'overwriteLocal',
    title: 'repo.actPullOverTitle',
    desc: 'repo.actPullOverDesc',
    danger: true,
    svg: svgArrow('<path d="M8 4v8M17 4v8"/><path d="M4 10l4 4 4-4"/><path d="M13 10l4 4 4-4"/>')
  },
  {
    key: 'overwriteRemote',
    kind: 'overwriteRemote',
    title: 'repo.actPushOverTitle',
    desc: 'repo.actPushOverDesc',
    danger: true,
    svg: svgArrow('<path d="M8 20v-8M17 20v-8"/><path d="M4 14l4-4 4 4"/><path d="M13 14l4-4 4 4"/>')
  }
]

const canAct = computed(() => !!config.remoteUrl && config.enabled && gitAvailable.value)
const included = (id) => (config.scopes.plugins || []).includes(id)

const lastSyncText = computed(() => {
  if (!config.lastSyncAt) return t('repo.neverSynced')
  try {
    const d = new Date(config.lastSyncAt)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch (_) {
    return t('repo.neverSynced')
  }
})

const pendingText = computed(() => t('repo.pendingCount', { count: pendingChanges.value }))

const tokenHint = computed(() => {
  if (!hasToken.value) return t('repo.noToken')
  return config.tokenStorage === 'plain' ? t('repo.tokenPlain') : t('repo.tokenSaved')
})

const setBusy = (kind) => {
  busy.value = !!kind
  busyKind.value = kind || ''
}

const applyConfig = (cfg) => {
  if (!cfg) return
  config.enabled = !!cfg.enabled
  config.remoteUrl = cfg.remoteUrl || ''
  config.branch = cfg.branch || 'main'
  config.tokenStorage = cfg.tokenStorage || null
  config.lastSyncAt = cfg.lastSyncAt || null
  config.scopes = {
    settings: cfg.scopes ? cfg.scopes.settings !== false : true,
    installedPlugins: cfg.scopes ? cfg.scopes.installedPlugins !== false : true,
    plugins: Array.isArray(cfg.scopes && cfg.scopes.plugins) ? [...cfg.scopes.plugins] : []
  }
}

const showResult = (lines, isError = false) => {
  resultLines.value = (Array.isArray(lines) ? lines : [lines]).filter(Boolean)
  resultIsError.value = isError
}

const errorLines = (res) => {
  const msg = (res && (res.message || res.code)) || t('repo.failed')
  return [`${t('repo.failed')}: ${msg}`]
}

const refreshGit = async () => {
  const bridge = api()
  if (!bridge) return
  const res = await bridge.detectGit(true)
  gitAvailable.value = !!res.gitAvailable
  gitVersion.value = res.gitVersion || ''
}

const loadStatus = async () => {
  const bridge = api()
  if (!bridge) return
  setBusy('status')
  try {
    const res = await bridge.status()
    if (res && res.ok) {
      applyConfig(res.config)
      hasToken.value = !!res.hasToken
      plugins.value = Array.isArray(res.plugins) ? res.plugins : []
      gitAvailable.value = !!res.gitAvailable
      gitVersion.value = res.gitVersion || ''
      pendingChanges.value = res.pendingChanges || 0
    } else {
      showResult(errorLines(res), true)
    }
  } catch (error) {
    showResult([`${t('repo.failed')}: ${error.message}`], true)
  } finally {
    setBusy('')
  }
}

// ========== 令牌 ==========

const saveToken = async () => {
  const bridge = api()
  if (!bridge || busy.value) return
  playSound('click')
  setBusy('token')
  try {
    const res = await bridge.updateConfig({ token: tokenInput.value.trim() })
    if (res && res.ok) {
      applyConfig(res.config)
      // 空串 = 清除令牌；非空 = 保存。hasToken 跟着令牌文件的真实状态走
      hasToken.value = !!tokenInput.value.trim()
      tokenInput.value = ''
      showResult(hasToken.value ? t('repo.tokenSavedOk') : t('repo.tokenCleared'))
    } else {
      showResult(errorLines(res), true)
    }
  } catch (error) {
    showResult([`${t('repo.failed')}: ${error.message}`], true)
  } finally {
    setBusy('')
  }
}

// ========== 接入 ==========

const createOnGitee = async () => {
  const bridge = api()
  if (!bridge || busy.value) return
  playSound('click')
  setBusy('gitee')
  conflicts.value = []
  try {
    const res = await bridge.createGiteeRepo({
      // 输入框留空 = 用已保存的令牌（主进程会 fallback 到 readToken()）
      token: tokenInput.value.trim() || undefined,
      name: giteeName.value.trim() || 'hundun-data',
      private: true
    })
    if (res && res.ok) {
      tokenInput.value = ''
      hasToken.value = true
      await loadStatus()
      showResult(t('repo.linkedOk'))
    } else {
      showResult(errorLines(res), true)
    }
  } catch (error) {
    showResult([`${t('repo.failed')}: ${error.message}`], true)
  } finally {
    setBusy('')
  }
}

const linkExisting = async () => {
  const bridge = api()
  if (!bridge || busy.value) return
  playSound('click')
  setBusy('link')
  conflicts.value = []
  try {
    const res = await bridge.link({
      remoteUrl: manualUrl.value.trim(),
      username: manualUser.value.trim(),
      // 输入框留空 = 用已保存的令牌（主进程会 fallback 到 readToken()）
      token: tokenInput.value.trim() || undefined,
      branch: 'main'
    })
    if (res && res.ok) {
      tokenInput.value = ''
      hasToken.value = true
      await loadStatus()
      if (res.code === 'CONFLICT' && Array.isArray(res.conflicts) && res.conflicts.length) {
        conflicts.value = res.conflicts
        showResult([t('repo.conflictTitle')], false)
      } else {
        showResult(t('repo.linkedOk'))
      }
    } else {
      showResult(errorLines(res), true)
    }
  } catch (error) {
    showResult([`${t('repo.failed')}: ${error.message}`], true)
  } finally {
    setBusy('')
  }
}

// ========== 范围 ==========

const persistScopes = async (next) => {
  const bridge = api()
  if (!bridge) return
  const res = await bridge.updateConfig({ scopes: next })
  if (res && res.ok) applyConfig(res.config)
  else showResult(errorLines(res), true)
}

const toggleScope = (key, value) => {
  playSound('click')
  const next = { ...config.scopes, [key]: !!value }
  config.scopes = next
  persistScopes(next)
}

const togglePlugin = (id, checked) => {
  playSound('click')
  const set = new Set(config.scopes.plugins || [])
  if (checked) set.add(id)
  else set.delete(id)
  const next = { ...config.scopes, plugins: [...set] }
  config.scopes = next
  persistScopes(next)
}

// ========== 四个动作 ==========

const describeAction = (action, res) => {
  const lines = []
  if (action.key === 'pull') {
    if (res.code === 'EMPTY_REMOTE') lines.push(t('repo.emptyRemote'))
    else if (res.updated) lines.push(t('repo.resultPulled', { n: res.changed || 0 }))
    else lines.push(t('repo.resultPulledNothing'))
  } else if (action.key === 'push') {
    if (res.committed) lines.push(t('repo.resultPushed', { n: res.pushed || 0 }))
    else lines.push(t('repo.resultPushedNothing'))
  } else if (action.key === 'overwriteLocal') {
    lines.push(t('repo.resultOverwriteLocal'))
    if (res.backup) lines.push(t('repo.resultBackup', { tag: res.backup }))
  } else {
    lines.push(t('repo.resultOverwriteRemote'))
    if (res.backup) lines.push(t('repo.resultBackup', { tag: res.backup }))
  }
  if (res.untracked && res.untracked.length) lines.push(t('repo.resultUntracked', { count: res.untracked.length }))
  if (res.skipped && res.skipped.length) lines.push(t('repo.resultSkipped', { count: res.skipped.length }))
  return lines
}

const run = async (action) => {
  const bridge = api()
  if (!bridge || busy.value || !canAct.value) return
  // 破坏性动作: 第一次点击只是"上膛"
  if (action.danger && armed.value !== action.key) {
    playSound('error')
    arm(action.key)
    return
  }
  disarm()
  playSound('click')
  setBusy(action.key)
  conflicts.value = []
  try {
    let res
    if (action.key === 'pull') res = await bridge.pull()
    else if (action.key === 'push') res = await bridge.push()
    else if (action.key === 'overwriteLocal') res = await bridge.overwriteLocal()
    else res = await bridge.overwriteRemote()

    if (res && res.ok) {
      await loadStatus()
      showResult(describeAction(action, res))
    } else if (res && res.code === 'CONFLICT') {
      conflicts.value = Array.isArray(res.conflicts) ? res.conflicts : []
      await loadStatus()
      showResult([t('repo.conflictTitle')], false)
    } else if (res && res.code === 'REJECTED') {
      showResult([res.message || t('repo.needPull')], true)
    } else if (res && res.code === 'EMPTY_REMOTE') {
      showResult([res.message || t('repo.emptyRemote')], true)
    } else {
      showResult(errorLines(res), true)
    }
  } catch (error) {
    showResult([`${t('repo.failed')}: ${error.message}`], true)
  } finally {
    setBusy('')
  }
}

const resolve = async (strategy) => {
  const bridge = api()
  if (!bridge || busy.value) return
  playSound('click')
  setBusy('resolve')
  try {
    const res = await bridge.resolve(strategy)
    if (res && res.ok) {
      conflicts.value = []
      await loadStatus()
      showResult([t('repo.resultOk', { count: Array.isArray(res.resolved) ? res.resolved.length : 0 })])
    } else if (res && res.code === 'CONFLICT') {
      conflicts.value = Array.isArray(res.conflicts) ? res.conflicts : conflicts.value
      showResult([t('repo.conflictTitle')], true)
    } else {
      showResult(errorLines(res), true)
    }
  } catch (error) {
    showResult([`${t('repo.failed')}: ${error.message}`], true)
  } finally {
    setBusy('')
  }
}

onMounted(loadStatus)
onUnmounted(() => { if (armTimer) clearTimeout(armTimer) })
</script>

<style scoped>
/* ============================================================
   仓库页 —— 与「设置」页同壳同语言 (决策67)
   外壳/头部/卡片/按钮尺寸全部对齐 Settings.vue，保证切换页面不"跳风格"
   ============================================================ */

.repo-view {
  position: absolute;
  inset: 0;
  /* 与设置页同层 (设置页 1002, 仓库页也要盖住设置页) */
  z-index: 1002;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-radius: 50px;
  border: 3px solid var(--border-color);
  font-family: 'Noto Sans SC', system-ui, sans-serif;
  overflow: hidden;
  animation: repoSlideIn 0.3s ease;
}

@keyframes repoSlideIn {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* ===== Header (50px / 与设置页一致) ===== */
.repo-header {
  height: 50px;
  flex: 0 0 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 2px solid var(--border-color);
  background: var(--bg-secondary);
}

/* 主题开关直接用 main.css 的全局 .toggle-* 样式 —— 与母程序顶部完全一致 */

.repo-logo { display: flex; align-items: center; gap: 8px; }
.logo-icon { font-size: 20px; }
.logo-text {
  font-family: 'Press Start 2P', 'Noto Sans SC', cursive;
  font-size: 14px;
  color: var(--accent-primary);
  letter-spacing: 1px;
}

.repo-close-btn {
  width: 28px; height: 28px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--accent-primary);
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}
.repo-close-btn:hover { background: var(--bg-card); }

/* ===== Body: 左 1/3 + 右 2/3 ===== */
.repo-body {
  flex: 1;
  display: flex;
  min-height: 0;
}

/* ---------- 左栏: 四个动作 (卡带脊造型) ---------- */
.repo-rail {
  flex: 0 0 33.33%;
  max-width: 33.33%;
  background: var(--bg-primary);
  border-right: 2px solid var(--border-color);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

.rail-btn {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px 6px 16px;
  border: 2px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  overflow: hidden;
  transition: border-color 0.16s ease, transform 0.1s ease, box-shadow 0.16s ease;
  min-height: 0;
}

/* 左侧色条: 呼应货架卡带的顶色标 */
.rail-btn::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 4px;
  background: var(--accent-primary);
  opacity: 0;
  transition: opacity 0.16s ease;
}

.rail-btn:hover:not(:disabled) {
  border-color: var(--accent-primary);
  /* 决策51: 体积感/辉光一律用 inset，圆角外不做绘制 */
  box-shadow: inset 0 0 0 1px var(--accent-primary), inset 0 0 18px rgba(0, 255, 136, 0.12);
}
.rail-btn:hover:not(:disabled)::before { opacity: 1; }
.rail-btn:active:not(:disabled) { transform: translateY(1px); }

.rail-btn:disabled { opacity: 0.38; cursor: not-allowed; }
.rail-btn.working {
  border-color: var(--accent-primary);
  box-shadow: inset 0 0 18px rgba(0, 255, 136, 0.18);
}

/* 危险动作: 用 secondary (品红) 与普通动作区分 */
.rail-btn.danger::before { background: var(--accent-secondary); }
.rail-btn.danger:hover:not(:disabled) {
  border-color: var(--accent-secondary);
  box-shadow: inset 0 0 0 1px var(--accent-secondary), inset 0 0 18px rgba(255, 0, 128, 0.14);
}
.rail-btn.danger:hover:not(:disabled)::before { opacity: 1; }

/* 已上膛: 整块转为危险色，等待第二次点击 */
.rail-btn.armed {
  border-color: var(--accent-secondary);
  animation: armedPulse 1.1s ease-in-out infinite;
}
.rail-btn.armed::before { opacity: 1; }
@keyframes armedPulse {
  0%, 100% { box-shadow: inset 0 0 0 1px var(--accent-secondary), inset 0 0 10px rgba(255, 0, 128, 0.2); }
  50% { box-shadow: inset 0 0 0 2px var(--accent-secondary), inset 0 0 26px rgba(255, 0, 128, 0.45); }
}

.rail-icon {
  flex: 0 0 26px;
  width: 26px; height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-primary);
}
.rail-icon :deep(svg) { width: 22px; height: 22px; display: block; }
.rail-btn.danger .rail-icon { color: var(--accent-secondary); }
.rail-btn.armed .rail-icon { color: var(--accent-secondary); }
.rail-btn:disabled .rail-icon { color: var(--text-muted); }

.rail-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.rail-title {
  font-size: 12px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: 0.2px;
}
.rail-desc { font-size: 10px; color: var(--text-secondary); line-height: 1.4; }
.rail-btn.armed .rail-title { color: var(--accent-secondary); }
.rail-btn.armed .rail-desc { color: var(--accent-secondary); opacity: 0.85; }

/* ---------- 右栏 ---------- */
.repo-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

/* 上栏 (扁): Gitee 访问令牌 */
.panel-top {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 2px solid var(--border-color);
  background: var(--bg-secondary);
}
.pt-label {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  letter-spacing: 0.3px;
}

.pt-input {
  padding: 6px 10px;
  font-size: 12px;
  font-family: inherit;
  background: var(--bg-slot);
  color: var(--text-primary);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  outline: none;
  min-width: 0;
  flex: 1;
  transition: border-color 0.16s ease;
}
.pt-input::placeholder { color: var(--text-muted); }
.pt-input:focus { border-color: var(--accent-primary); }
.pt-input.wide { flex: 1 1 auto; }

/* 按钮: 掌机感 (2px 边框 + inset 底影) */
.pt-btn {
  padding: 6px 14px;
  font-size: 11px;
  font-family: inherit;
  font-weight: 600;
  border-radius: 8px;
  border: 2px solid var(--border-color);
  background: var(--bg-card);
  color: var(--text-primary);
  cursor: pointer;
  white-space: nowrap;
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.28);
  transition: all 0.14s ease;
}
.pt-btn:hover:not(:disabled) {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.28), inset 0 0 14px rgba(0, 255, 136, 0.12);
}
.pt-btn:active:not(:disabled) { transform: translateY(1px); box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.3); }
.pt-btn.primary { border-color: var(--accent-primary); color: var(--accent-primary); }
.pt-btn.primary:hover:not(:disabled) { background: var(--accent-primary); color: var(--bg-primary); }
.pt-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.pt-hint { font-size: 10px; color: var(--text-muted); white-space: nowrap; }
.pt-hint.warn { color: var(--accent-secondary); }

/* 圆形问号 → 帮助页。与 .pt-btn 同一套 2px 边框语言，只做小 */
.pt-help {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  padding: 0;
  border-radius: 50%;
  border: 2px solid var(--border-color);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.14s ease, color 0.14s ease;
}
.pt-help:hover,
.pt-help:focus-visible { border-color: var(--accent-primary); color: var(--accent-primary); }
.hint-row { display: flex; align-items: flex-start; gap: 6px; }
.hint-row .panel-hint { flex: 0 1 auto; }
.hint-row .pt-help { margin-top: 0; }

.panel-main {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.panel-hint { margin: 0; font-size: 10px; color: var(--text-secondary); line-height: 1.55; }

/* 滚动条: 统一成暗色细条 —— 原生白条带箭头在深色壳里极刺眼 */
.panel-main::-webkit-scrollbar,
.conflict-list::-webkit-scrollbar { width: 8px; }
.panel-main::-webkit-scrollbar-track,
.conflict-list::-webkit-scrollbar-track { background: transparent; }
.panel-main::-webkit-scrollbar-thumb,
.conflict-list::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
  /* 视觉 4px 宽: 2px 透明边距 + padding-box 裁切 */
  border: 2px solid transparent;
  background-clip: padding-box;
}
.panel-main::-webkit-scrollbar-thumb:hover,
.conflict-list::-webkit-scrollbar-thumb:hover {
  background: var(--accent-primary);
  background-clip: padding-box;
}

/* 未关联: 接入块 (与设置页 setting-group 同规格 12px/2px) */
.setup-block {
  border: 2px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-card);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.setup-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent-primary);
  letter-spacing: 0.3px;
}
.setup-hint { margin: 0; font-size: 10px; color: var(--text-secondary); line-height: 1.55; }
.field-row { display: flex; gap: 8px; align-items: center; }
.field-row .pt-input { flex: 1; }

/* 已关联: 摘要条 */
.linked-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border: 2px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-card);
  font-size: 11px;
  min-width: 0;
}
.linked-url { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--accent-primary); }
.linked-meta { color: var(--text-muted); white-space: nowrap; }

.scope-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  letter-spacing: 0.5px;
}

/* 已装的子程序 */
.scope-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  border: 2px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-card);
  padding: 8px 12px;
  /* 不再自带滚动: 列表随内容展开, 由 .panel-main 统一滚动,
     避免"外层 + 内层"双滚动条, 也不会把最后一项切成半行 */
}
.scope-item {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 12px;
  padding: 4px 2px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.12s ease;
}
.scope-item:hover { background: var(--bg-slot); }
.scope-item.dim { opacity: 0.42; cursor: default; }
.scope-item.dim:hover { background: transparent; }
.scope-item input {
  accent-color: var(--accent-primary);
  width: 13px; height: 13px;
  cursor: pointer;
}
.scope-item.dim input { cursor: default; }
.scope-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scope-id { font-size: 10px; color: var(--text-muted); }
.scope-tag {
  font-size: 9px;
  color: var(--text-muted);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  padding: 0 4px;
  white-space: nowrap;
}

/* 冲突 */
.conflict-box {
  border: 2px solid var(--accent-secondary);
  border-radius: 12px;
  background: var(--bg-card);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.conflict-title { font-size: 12px; font-weight: 700; color: var(--accent-secondary); }
.conflict-list {
  margin: 0;
  padding-left: 16px;
  font-size: 11px;
  color: var(--text-secondary);
  max-height: 76px;
  overflow-y: auto;
}

/* 结果条 */
.panel-result {
  flex: 0 0 auto;
  border-top: 2px solid var(--border-color);
  background: var(--bg-card);
  padding: 7px 16px;
  max-height: 64px;
  overflow-y: auto;
}
.res-line { font-size: 11px; line-height: 1.55; color: var(--text-primary); }
.res-line:first-child { color: var(--accent-primary); }
.panel-result.error .res-line { color: var(--accent-secondary); }

/* ===== Footer ===== */
.repo-footer {
  flex: 0 0 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-top: 2px solid var(--border-color);
  background: var(--bg-primary);
  font-size: 10px;
  color: var(--text-secondary);
}
.footer-status { display: flex; align-items: center; gap: 7px; }
.footer-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--accent-primary);
  box-shadow: 0 0 6px var(--accent-primary);
}
.footer-status.bad .footer-dot { background: var(--accent-secondary); box-shadow: 0 0 6px var(--accent-secondary); }
.footer-status.bad { color: var(--accent-secondary); }
.footer-mini {
  padding: 2px 7px;
  font-size: 10px;
  font-family: inherit;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
}
.footer-hint {
  color: var(--text-muted);
  font-family: 'Press Start 2P', 'Noto Sans SC', cursive;
  font-size: 8px;
  letter-spacing: 0.5px;
}
</style>
