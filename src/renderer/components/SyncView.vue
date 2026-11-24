<template>
  <div class="repo-view" :class="{ 'light-mode': !isDarkMode }">
    <!-- Header -->
    <header class="repo-header">
      <div class="repo-logo">
        <span class="repo-icon">🗄</span>
        <span class="repo-text">{{ t('repo.title') }}</span>
      </div>
      <button class="repo-close-btn" :title="t('repo.close')" @click="$emit('close')">✕</button>
    </header>

    <main class="repo-content">
      <p class="repo-sub">{{ t('repo.subtitle') }}</p>

      <!-- git 状态 -->
      <div class="repo-status" :class="{ bad: !gitAvailable }">
        <span class="repo-dot"></span>
        <span v-if="gitAvailable" class="repo-status-text">{{ t('repo.gitReady', { version: gitVersion }) }}</span>
        <span v-else class="repo-status-text">{{ t('repo.gitMissing') }}</span>
        <button v-if="!gitAvailable" class="repo-mini-btn" :disabled="busy" @click="refreshGit">
          {{ t('repo.retry') }}
        </button>
      </div>

      <!-- 已关联摘要 -->
      <div v-if="config.remoteUrl" class="repo-linked">
        <div class="repo-linked-row">
          <span class="repo-label">{{ t('repo.linkedTo') }}</span>
          <span class="repo-value" :title="config.remoteUrl">{{ config.remoteUrl }}</span>
        </div>
        <div class="repo-linked-row">
          <span class="repo-label">{{ t('repo.lastSync') }}</span>
          <span class="repo-value">{{ lastSyncText }}</span>
          <span class="repo-token-hint">{{ tokenHint }}</span>
        </div>
      </div>

      <!-- ========== 未关联: 两种接入方式 ========== -->
      <template v-if="!config.remoteUrl">
        <h3 class="repo-section-title">{{ t('repo.setupTitle') }}</h3>

        <section class="repo-card">
          <h4 class="repo-card-title">{{ t('repo.autoTitle') }}</h4>
          <p class="repo-card-hint">{{ t('repo.autoHint') }}</p>
          <div class="repo-field">
            <label class="repo-label">{{ t('repo.token') }}</label>
            <input v-model="giteeToken" class="repo-input" type="password" autocomplete="off" spellcheck="false" placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
          </div>
          <div class="repo-field">
            <label class="repo-label">{{ t('repo.autoName') }}</label>
            <input v-model="giteeName" class="repo-input" type="text" spellcheck="false" placeholder="hundun-data" />
          </div>
          <button class="repo-btn primary" :disabled="busy || !giteeToken.trim()" @click="createOnGitee">
            {{ busy && busyKind === 'gitee' ? t('repo.syncing') : t('repo.autoCreate') }}
          </button>
        </section>

        <section class="repo-card">
          <h4 class="repo-card-title">{{ t('repo.manualTitle') }}</h4>
          <p class="repo-card-hint">{{ t('repo.manualHint') }}</p>
          <div class="repo-field">
            <label class="repo-label">{{ t('repo.remoteUrl') }}</label>
            <input v-model="manualUrl" class="repo-input" type="text" autocomplete="off" spellcheck="false" placeholder="https://gitee.com/you/hundun-data.git" />
          </div>
          <div class="repo-field">
            <label class="repo-label">{{ t('repo.username') }}</label>
            <input v-model="manualUser" class="repo-input" type="text" autocomplete="off" spellcheck="false" />
          </div>
          <div class="repo-field">
            <label class="repo-label">{{ t('repo.token') }}</label>
            <input v-model="manualToken" class="repo-input" type="password" autocomplete="off" spellcheck="false" />
          </div>
          <button class="repo-btn" :disabled="busy || !manualUrl.trim()" @click="linkExisting">
            {{ busy && busyKind === 'link' ? t('repo.syncing') : t('repo.link') }}
          </button>
        </section>
      </template>

      <!-- ========== 已关联: 范围 + 同步 ========== -->
      <template v-else>
        <h3 class="repo-section-title">{{ t('repo.scopeTitle') }}</h3>
        <section class="repo-card">
          <label class="repo-check">
            <input type="checkbox" :checked="config.scopes.settings" @change="toggleScope('settings', $event.target.checked)" />
            <span>{{ t('repo.scopeSettings') }}</span>
          </label>
          <label class="repo-check">
            <input type="checkbox" :checked="config.scopes.installedPlugins" @change="toggleScope('installedPlugins', $event.target.checked)" />
            <span>{{ t('repo.scopeInstalled') }}</span>
          </label>

          <div class="repo-plugins">
            <div class="repo-plugins-title">{{ t('repo.scopePlugins') }}</div>
            <p v-if="!syncablePlugins.length" class="repo-card-hint">{{ t('repo.scopeEmpty') }}</p>
            <label v-for="p in syncablePlugins" :key="p.id" class="repo-check">
              <input type="checkbox" :checked="included(p.id)" @change="togglePlugin(p.id, $event.target.checked)" />
              <span>{{ p.name }} <em class="repo-plugin-id">#{{ p.id }}</em></span>
            </label>
          </div>

          <p class="repo-card-hint">{{ t('repo.scopeHint') }}</p>

          <div class="repo-actions">
            <button class="repo-btn primary" :disabled="busy || !gitAvailable" @click="doSync">
              {{ busy && busyKind === 'sync' ? t('repo.syncing') : t('repo.syncNow') }}
            </button>
            <button class="repo-btn" :disabled="busy || !gitAvailable" @click="doPreview">
              {{ busy && busyKind === 'preview' ? t('repo.previewing') : t('repo.preview') }}
            </button>
          </div>
        </section>
      </template>

      <!-- 结果 -->
      <section v-if="resultLines.length" class="repo-result" :class="{ error: resultIsError }">
        <div v-for="(line, i) in resultLines" :key="i" class="repo-result-line">{{ line }}</div>
      </section>

      <!-- 冲突 -->
      <section v-if="conflicts.length" class="repo-conflict">
        <h4 class="repo-card-title">{{ t('repo.conflictTitle') }}</h4>
        <p class="repo-card-hint">{{ t('repo.conflictHint') }}</p>
        <ul class="repo-conflict-list">
          <li v-for="c in conflicts" :key="c.path">{{ c.path }}</li>
        </ul>
        <div class="repo-actions">
          <button class="repo-btn primary" :disabled="busy" @click="resolve('local')">{{ t('repo.keepLocal') }}</button>
          <button class="repo-btn" :disabled="busy" @click="resolve('cloud')">{{ t('repo.keepCloud') }}</button>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useThemeStore } from '../stores/theme'
import { useI18nStore } from '../stores/i18n'
import { playSound } from '../utils/audio'

defineEmits(['close'])

const themeStore = useThemeStore()
const i18nStore = useI18nStore()
const t = (key, params = {}) => i18nStore.t(key, params)

const isDarkMode = computed(() => themeStore.isDarkMode)

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
const resultLines = ref([])
const resultIsError = ref(false)
const conflicts = ref([])

const giteeToken = ref('')
const giteeName = ref('hundun-data')
const manualUrl = ref('')
const manualUser = ref('')
const manualToken = ref('')

const syncablePlugins = computed(() => plugins.value.filter(p => p.syncable))
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

const tokenHint = computed(() => {
  if (config.tokenStorage === 'safeStorage') return t('repo.tokenSaved')
  if (config.tokenStorage === 'plain') return t('repo.tokenPlain')
  return t('repo.noToken')
})

const setBusy = (kind) => { busy.value = !!kind; busyKind.value = kind || '' }

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
      plugins.value = Array.isArray(res.plugins) ? res.plugins : []
      gitAvailable.value = !!res.gitAvailable
      gitVersion.value = res.gitVersion || ''
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
      token: giteeToken.value.trim(),
      name: giteeName.value.trim() || 'hundun-data',
      private: true
    })
    if (res && res.ok) {
      giteeToken.value = ''
      manualToken.value = ''
      await loadStatus()
      showResult(t('repo.resultOk', { count: countFromLink(res) }))
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
      token: manualToken.value.trim(),
      branch: 'main'
    })
    if (res && res.ok) {
      manualToken.value = ''
      await loadStatus()
      showResult(t('repo.resultOk', { count: countFromLink(res) }))
    } else {
      showResult(errorLines(res), true)
    }
  } catch (error) {
    showResult([`${t('repo.failed')}: ${error.message}`], true)
  } finally {
    setBusy('')
  }
}

const countFromLink = (res) => {
  const entries = res && res.state && Array.isArray(res.state.pendingChanges) ? res.state.pendingChanges : 0
  return typeof entries === 'number' ? entries : 0
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

// ========== 同步 ==========

const describeSync = (res) => {
  const lines = []
  if (res && res.ok) {
    const committed = res.committed
    lines.push(committed ? t('repo.resultOk', { count: 1 }).replace('{count}', '1') : t('repo.resultNothing'))
    if (res.untracked && res.untracked.length) lines.push(t('repo.resultUntracked', { count: res.untracked.length }))
    if (res.skipped && res.skipped.length) lines.push(t('repo.resultSkipped', { count: res.skipped.length }))
  }
  return lines
}

const doSync = async () => {
  const bridge = api()
  if (!bridge || busy.value) return
  playSound('click')
  setBusy('sync')
  conflicts.value = []
  try {
    const res = await bridge.run()
    if (res && res.ok) {
      await loadStatus()
      showResult(describeSync(res))
    } else if (res && res.code === 'CONFLICT') {
      conflicts.value = Array.isArray(res.conflicts) ? res.conflicts : []
      showResult([t('repo.conflictTitle')], false)
    } else {
      showResult(errorLines(res), true)
    }
  } catch (error) {
    showResult([`${t('repo.failed')}: ${error.message}`], true)
  } finally {
    setBusy('')
  }
}

const doPreview = async () => {
  const bridge = api()
  if (!bridge || busy.value) return
  playSound('click')
  setBusy('preview')
  try {
    const res = await bridge.preview()
    if (res && res.ok) {
      const lines = [res.count ? t('repo.resultPreview', { count: res.count }) : t('repo.resultPreviewEmpty')]
      if (res.skipped && res.skipped.length) lines.push(t('repo.resultSkipped', { count: res.skipped.length }))
      showResult(lines)
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
</script>

<style scoped>
.repo-view {
  position: absolute;
  inset: 0;
  /* 与设置页同层同壳 (决策51: 圆角外的绘制一律交给 .console 的内阴影) */
  z-index: 1001;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-radius: 50px;
  border: 3px solid var(--border-color);
  font-family: 'Noto Sans SC', system-ui, sans-serif;
  overflow: hidden;
  animation: repoSlideIn 0.28s ease;
}

@keyframes repoSlideIn {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.repo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.repo-logo { display: flex; align-items: center; gap: 8px; }
.repo-icon { font-size: 16px; }
.repo-text { font-size: 15px; font-weight: 700; letter-spacing: 1px; }

.repo-close-btn {
  width: 28px; height: 28px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
}
.repo-close-btn:hover { border-color: var(--accent-primary); color: var(--accent-primary); }

.repo-content {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.repo-sub { margin: 0 0 2px; font-size: 12px; color: var(--text-secondary); line-height: 1.5; }

.repo-status {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 12px;
  background: var(--bg-card);
}
.repo-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent-primary); }
.repo-status.bad .repo-dot { background: var(--accent-secondary); }
.repo-status.bad .repo-status-text { color: var(--accent-secondary); }
.repo-status-text { flex: 1; }

.repo-linked {
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-card);
  padding: 8px 10px;
  display: flex; flex-direction: column; gap: 4px;
}
.repo-linked-row { display: flex; align-items: center; gap: 8px; font-size: 12px; min-width: 0; }
.repo-label { color: var(--text-secondary); white-space: nowrap; font-size: 12px; }
.repo-value { color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.repo-token-hint { margin-left: auto; color: var(--text-muted); font-size: 11px; white-space: nowrap; }

.repo-section-title { margin: 4px 0 0; font-size: 12px; color: var(--text-secondary); font-weight: 600; }

.repo-card {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-card);
  padding: 10px 12px;
  display: flex; flex-direction: column; gap: 8px;
}
.repo-card-title { margin: 0; font-size: 13px; font-weight: 700; }
.repo-card-hint { margin: 0; font-size: 11px; color: var(--text-secondary); line-height: 1.5; }

.repo-field { display: flex; flex-direction: column; gap: 4px; }
.repo-input {
  padding: 6px 8px;
  font-size: 12px;
  background: var(--bg-slot);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  outline: none;
  font-family: inherit;
}
.repo-input:focus { border-color: var(--accent-primary); }

.repo-check { display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; }
.repo-check input { accent-color: var(--accent-primary); }
.repo-plugin-id { font-style: normal; color: var(--text-muted); font-size: 11px; }
.repo-plugins { display: flex; flex-direction: column; gap: 6px; padding-top: 4px; border-top: 1px dashed var(--border-color); }
.repo-plugins-title { font-size: 12px; color: var(--text-secondary); }

.repo-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.repo-btn {
  padding: 7px 14px;
  font-size: 12px;
  font-family: inherit;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
}
.repo-btn:hover:not(:disabled) { border-color: var(--accent-primary); color: var(--accent-primary); }
.repo-btn.primary { border-color: var(--accent-primary); color: var(--accent-primary); }
.repo-btn.primary:hover:not(:disabled) { background: var(--accent-primary); color: var(--bg-primary); }
.repo-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.repo-mini-btn {
  padding: 3px 8px; font-size: 11px; font-family: inherit;
  border: 1px solid var(--border-color); border-radius: 3px;
  background: transparent; color: var(--text-primary); cursor: pointer;
}

.repo-result {
  border: 1px solid var(--accent-primary);
  border-radius: 4px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-primary);
  background: var(--bg-card);
}
.repo-result.error { border-color: var(--accent-secondary); }
.repo-result.error .repo-result-line { color: var(--accent-secondary); }

.repo-conflict {
  border: 1px solid var(--accent-secondary);
  border-radius: 6px;
  padding: 10px 12px;
  display: flex; flex-direction: column; gap: 8px;
  background: var(--bg-card);
}
.repo-conflict-list { margin: 0; padding-left: 18px; font-size: 12px; color: var(--text-secondary); max-height: 90px; overflow-y: auto; }
</style>
