<template>
  <div class="settings-view" :class="{ 'light-mode': !isDarkMode }">
    <!-- Header -->
    <header class="settings-header">
      <div class="toggle-container">
        <span class="toggle-label">{{ t('settings.dark') }}</span>
        <div 
          class="toggle-switch" 
          :class="{ active: !isDarkMode }"
          @click="toggleTheme"
        >
          <div class="toggle-knob"></div>
        </div>
        <span class="toggle-label">{{ t('settings.light') }}</span>
      </div>
      <div class="settings-logo">
        <span class="logo-icon">⚙️</span>
        <span class="logo-text">{{ t('settings.title') }}</span>
      </div>
      <button class="settings-close-btn" @click="closeSettings" :title="t('settings.back')">✕</button>
    </header>

    <!-- Content -->
    <main class="settings-content">
      <!-- Navigation Tabs -->
      <div class="settings-nav">
        <button 
          v-for="(tab, idx) in tabs" 
          :key="tab.id"
          class="nav-tab"
          :class="{ selected: selectedTab === idx }"
          @click="selectTab(idx)"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </div>

      <!-- Tab Content -->
      <div class="settings-panel">
        <!-- Sound Settings -->
        <div v-if="selectedTab === 0" class="tab-content">
          <div class="setting-group">
            <div class="setting-row">
              <span class="setting-label">{{ t('settings.soundEffects') }}</span>
              <div 
                class="toggle-switch small"
                :class="{ active: settings.soundEnabled }"
                @click="toggleSoundEnabled"
              >
                <div class="toggle-knob"></div>
              </div>
            </div>
            <div class="setting-row" :class="{ disabled: !settings.soundEnabled }">
              <span class="setting-label">{{ t('settings.volume') }}</span>
              <div class="volume-control">
                <span class="volume-icon">🔊</span>
                <input 
                  type="range" 
                  class="volume-slider"
                  min="0" 
                  max="100" 
                  :value="settings.volume"
                  :disabled="!settings.soundEnabled"
                  @input="updateVolume"
                />
                <span class="volume-value">{{ settings.volume }}%</span>
              </div>
            </div>
            <button 
              class="test-sound-btn"
              :disabled="!settings.soundEnabled"
              @click="testSound"
            >
              <span class="btn-icon">▶</span>
              <span class="btn-text">{{ t('settings.testSound') }}</span>
            </button>
          </div>
        </div>

        <!-- Theme Settings -->
        <div v-if="selectedTab === 1" class="tab-content">
          <div class="setting-group">
            <div class="theme-options">
              <button 
                class="theme-option"
                :class="{ active: !isDarkMode }"
                @click="setTheme('light')"
              >
                <div class="theme-preview light">
                  <div class="preview-header"></div>
                  <div class="preview-body"></div>
                </div>
                <span class="theme-name">{{ t('settings.light') }}</span>
              </button>
              <button 
                class="theme-option"
                :class="{ active: isDarkMode }"
                @click="setTheme('dark')"
              >
                <div class="theme-preview dark">
                  <div class="preview-header"></div>
                  <div class="preview-body"></div>
                </div>
                <span class="theme-name">{{ t('settings.dark') }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Language Settings -->
        <div v-if="selectedTab === 2" class="tab-content">
          <div class="setting-group">
            <div class="language-options">
              <button 
                v-for="option in languageOptions"
                :key="option.id"
                class="language-option"
                :class="{ active: currentLocale === option.id }"
                @click="setLanguage(option.id)"
              >
                <span class="lang-flag">{{ option.flag }}</span>
                <div class="lang-info">
                  <span class="lang-name">{{ option.name }}</span>
                  <span class="lang-native">{{ option.id === 'zh' ? '中文' : 'English' }}</span>
                </div>
                <span v-if="currentLocale === option.id" class="lang-check">✓</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Plugin Settings -->
        <div v-if="selectedTab === 3" class="tab-content">
          <div class="setting-group">
            <div class="plugin-list">
              <div 
                v-for="plugin in plugins" 
                :key="plugin.id"
                class="plugin-item"
              >
                <span class="plugin-icon">{{ plugin.icon }}</span>
                <div class="plugin-info">
                  <span class="plugin-name">{{ plugin.name }}</span>
                  <span class="plugin-version">v{{ plugin.version }}</span>
                </div>
                <span class="plugin-status" :class="plugin.state">
                  {{ plugin.state === 'running' ? t('plugin.running') : t('plugin.idle') }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- About -->
        <div v-if="selectedTab === 4" class="tab-content">
          <div class="setting-group about-section">
            <div class="about-logo">🎮</div>
            <div class="about-title">HUNDUN LITE</div>
            <div class="about-version">v1.0.0-alpha</div>
            <div class="about-desc">
              {{ t('settings.desc') }}
            </div>
            <div class="about-links">
              <div class="about-link">
                <span class="link-label">{{ t('settings.engine') }}</span>
                <span class="link-value">Electron + Vue3</span>
              </div>
              <div class="about-link">
                <span class="link-label">{{ t('settings.platform') }}</span>
                <span class="link-value">{{ platform }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="settings-footer">
      <span class="footer-hint">{{ t('keys.escToExit') }}</span>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import { useThemeStore } from '../stores/theme'
import { usePluginStore } from '../stores/plugin'
import { useI18nStore } from '../stores/i18n'
import { playSound } from '../utils/audio'
import { localeOptions } from '../i18n/index.js'

const emit = defineEmits(['close'])

const themeStore = useThemeStore()
const pluginStore = usePluginStore()
const i18nStore = useI18nStore()

// State
const isDarkMode = computed(() => themeStore.isDarkMode)
const plugins = computed(() => pluginStore.plugins)
const selectedTab = ref(0)
const platform = ref('Unknown')
const currentLocale = computed(() => i18nStore.locale)
const languageOptions = localeOptions

// i18n
const t = (key, params = {}) => i18nStore.t(key, params)

// Settings
const settings = reactive({
  soundEnabled: true,
  volume: 50
})

// Tabs
const tabs = computed(() => [
  { id: 'sound', icon: '🔊', label: t('settings.sound') },
  { id: 'theme', icon: '🎨', label: t('settings.theme') },
  { id: 'language', icon: '🌐', label: t('settings.language') },
  { id: 'plugins', icon: '📦', label: t('settings.plugins') },
  { id: 'about', icon: 'ℹ️', label: t('settings.about') }
])

// Methods
const selectTab = (idx) => {
  selectedTab.value = idx
  playSound('click')
}

const toggleTheme = () => {
  playSound('change')
  themeStore.toggleTheme()
}

const setTheme = (theme) => {
  playSound('click')
  themeStore.setTheme(theme)
}

const setLanguage = (lang) => {
  playSound('click')
  i18nStore.setLocale(lang)
}

const toggleSoundEnabled = () => {
  settings.soundEnabled = !settings.soundEnabled
  playSound('click')
  saveSettings()
}

const updateVolume = (e) => {
  settings.volume = parseInt(e.target.value)
  saveSettings()
}

const testSound = () => {
  playSound('OK')
}

const closeSettings = () => {
  playSound('exit')
  emit('close')
}

const saveSettings = () => {
  localStorage.setItem('huntun-lite-settings', JSON.stringify({
    soundEnabled: settings.soundEnabled,
    volume: settings.volume
  }))
}

const loadSettings = () => {
  try {
    const saved = localStorage.getItem('huntun-lite-settings')
    if (saved) {
      const data = JSON.parse(saved)
      settings.soundEnabled = data.soundEnabled !== false
      settings.volume = data.volume ?? 50
    }
  } catch (e) {
    console.error('[Settings] Failed to load settings:', e)
  }
}

// Keyboard navigation
const handleKeydown = (e) => {
  if (e.key === 'Escape') {
    closeSettings()
    return
  }
  
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    e.preventDefault()
    selectedTab.value = Math.max(0, selectedTab.value - 1)
    playSound('click')
  }
  
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    e.preventDefault()
    selectedTab.value = Math.min(tabs.value.length - 1, selectedTab.value + 1)
    playSound('click')
  }
}

// Lifecycle
onMounted(() => {
  loadSettings()
  document.addEventListener('keydown', handleKeydown)
  
  // Get platform info
  if (window.nodeInfo) {
    platform.value = window.nodeInfo.platform
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.settings-view {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--bg-secondary);
  border-radius: 50px;
  border: 3px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 1002;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Header */
.settings-header {
  height: 50px;
  background: var(--bg-secondary);
  border-bottom: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.settings-logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-icon {
  font-size: 20px;
}

.logo-text {
  font-family: 'Press Start 2P', cursive;
  font-size: 14px;
  color: var(--accent-primary);
}

.settings-close-btn {
  width: 28px;
  height: 28px;
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

.settings-close-btn:hover {
  color: var(--accent-secondary, #ff0080);
  transform: scale(1.1);
}

/* Content */
.settings-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* Navigation */
.settings-nav {
  width: 120px;
  background: var(--bg-primary);
  border-right: 2px solid var(--border-color);
  padding: 16px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.nav-tab:hover {
  background: var(--bg-card);
  color: var(--text-primary);
}

.nav-tab.selected {
  background: var(--bg-card);
  color: var(--accent-primary);
  border-left: 3px solid var(--accent-primary);
}

.tab-icon {
  font-size: 16px;
}

.tab-label {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 11px;
}

/* Panel */
.settings-panel {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.tab-content {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Setting Groups */
.setting-group {
  background: var(--bg-card);
  border-radius: 12px;
  border: 2px solid var(--border-color);
  padding: 20px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
}

.setting-row:last-child {
  border-bottom: none;
}

.setting-row.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.setting-label {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 13px;
  color: var(--text-primary);
}

/* Toggle Switch (small) */
.toggle-switch.small {
  width: 40px;
  height: 20px;
}

.toggle-switch.small .toggle-knob {
  width: 14px;
  height: 14px;
}

.toggle-switch.small.active .toggle-knob {
  left: 22px;
}

/* Volume Control */
.volume-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.volume-icon {
  font-size: 16px;
}

.volume-slider {
  width: 120px;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--toggle-bg);
  border-radius: 3px;
  outline: none;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: var(--accent-primary);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 8px var(--shadow-color);
}

.volume-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: var(--accent-primary);
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: 0 0 8px var(--shadow-color);
}

.volume-value {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 11px;
  color: var(--text-secondary);
  min-width: 35px;
  text-align: right;
}

/* Test Sound Button */
.test-sound-btn {
  margin-top: 16px;
  padding: 10px 20px;
  background: var(--bg-slot);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  color: var(--accent-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
}

.test-sound-btn:hover:not(:disabled) {
  border-color: var(--accent-primary);
  box-shadow: 0 0 12px var(--shadow-color);
}

.test-sound-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  font-size: 12px;
}

.btn-text {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 11px;
}

/* Theme Options */
.theme-options {
  display: flex;
  gap: 16px;
}

.theme-option {
  flex: 1;
  padding: 16px;
  background: var(--bg-slot);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.theme-option:hover {
  border-color: var(--accent-primary);
}

.theme-option.active {
  border-color: var(--accent-primary);
  box-shadow: 0 0 15px var(--shadow-color);
}

.theme-preview {
  width: 80px;
  height: 60px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid var(--border-color);
}

.theme-preview.light {
  background: #FFF8E8;
}

.theme-preview.light .preview-header {
  height: 12px;
  background: #FFF3D6;
  border-bottom: 1px solid #E8DCC8;
}

.theme-preview.light .preview-body {
  height: 48px;
  background: #FFFEFB;
}

.theme-preview.dark {
  background: #0a0a0a;
}

.theme-preview.dark .preview-header {
  height: 12px;
  background: #141414;
  border-bottom: 1px solid #333;
}

.theme-preview.dark .preview-body {
  height: 48px;
  background: #1a1a1a;
}

.theme-name {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 11px;
  color: var(--text-primary);
}

/* Language Options */
.language-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.language-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--bg-slot);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.language-option:hover {
  border-color: var(--accent-primary);
}

.language-option.active {
  border-color: var(--accent-primary);
  box-shadow: 0 0 15px var(--shadow-color);
}

.lang-flag {
  font-size: 24px;
}

.lang-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.lang-name {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 13px;
  color: var(--text-primary);
}

.lang-native {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 14px;
  color: var(--text-secondary);
}

.lang-check {
  font-size: 16px;
  color: var(--accent-primary);
  font-weight: bold;
}

/* Plugin List */
.plugin-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.plugin-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-slot);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.plugin-icon {
  font-size: 24px;
}

.plugin-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.plugin-name {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 13px;
  color: var(--text-primary);
}

.plugin-version {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 10px;
  color: var(--text-muted);
}

.plugin-status {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 10px;
}

.plugin-status.running {
  color: var(--accent-primary);
}

.plugin-status.idle,
.plugin-status.unloaded {
  color: var(--text-muted);
}

/* About Section */
.about-section {
  text-align: center;
  padding: 32px 20px;
}

.about-logo {
  font-size: 48px;
  margin-bottom: 16px;
}

.about-title {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 20px;
  color: var(--accent-primary);
  margin-bottom: 8px;
  text-shadow: 0 0 10px var(--accent-primary);
}

.about-version {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.about-desc {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: 24px;
  line-height: 1.6;
}

.about-links {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.about-link {
  display: flex;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--bg-slot);
  border-radius: 6px;
}

.link-label {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 11px;
  color: var(--text-muted);
}

.link-value {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 11px;
  color: var(--text-primary);
}

/* Footer */
.settings-footer {
  height: 36px;
  background: var(--bg-secondary);
  border-top: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

.footer-hint {
  font-family: 'Noto Sans SC', 'Press Start 2P', cursive;
  font-size: 11px;
  color: var(--text-muted);
}

/* Light mode overrides */
.light-mode .settings-view {
  background: var(--bg-secondary);
  border-color: var(--border-color);
}

.light-mode .settings-nav {
  background: var(--bg-primary);
  border-color: var(--border-color);
}

.light-mode .nav-tab:hover {
  background: var(--bg-card);
}

.light-mode .nav-tab.selected {
  background: var(--bg-card);
  border-left-color: var(--accent-primary);
}

.light-mode .theme-preview.light {
  border-color: #E8DCC8;
}

.light-mode .theme-preview.dark {
  border-color: #333;
}
</style>
