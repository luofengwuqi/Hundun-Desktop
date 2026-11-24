<template>
  <div class="help-view" :class="{ 'light-mode': !isDarkMode }">
    <header class="help-header">
      <button ref="backBtn" class="help-back" :title="t('help.esc')" @click="$emit('close')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
        <span>{{ t('help.back') }}</span>
      </button>
      <div class="help-logo">
        <span class="help-mark">?</span>
        <span class="help-title">{{ topic ? loc(topic.title) : t('help.unknown') }}</span>
      </div>
      <button class="help-close" :title="t('help.close')" @click="$emit('close')">✕</button>
    </header>

    <main v-if="topic" class="help-body">
      <p class="help-intro">{{ loc(topic.intro) }}</p>

      <ol class="help-steps">
        <li v-for="(s, i) in topic.steps" :key="i" class="help-step">
          <span class="step-index">{{ i + 1 }}</span>
          <div class="step-main">
            <p class="step-text">{{ loc(s.text) }}</p>
            <div v-if="s.image || getHelpArt(s.art)" class="help-art">
              <img v-if="s.image" :src="s.image" :alt="loc(s.text)" :style="imgStyle(s)" />
              <div v-else class="art-svg" v-html="getHelpArt(s.art)"></div>
            </div>
          </div>
        </li>
      </ol>

      <div v-if="(topic.notes || []).length" class="help-notes">
        <div class="notes-title">{{ t('help.notesTitle') }}</div>
        <p v-for="(n, i) in topic.notes" :key="i" class="note-line">{{ loc(n) }}</p>
      </div>

      <button v-if="topic.link" class="help-link" @click="openLink">
        <span class="link-icon" v-html="LINK_SVG"></span>
        <span class="link-label">{{ loc(topic.link.label) }}</span>
        <span class="link-url">{{ topic.link.url }}</span>
      </button>
    </main>

    <main v-else class="help-body help-empty">
      <p>{{ t('help.unknown') }}</p>
    </main>

    <footer class="help-footer">
      <span class="footer-hint">{{ t('help.esc') }}</span>
    </footer>
  </div>
</template>

<script setup>
import { computed, ref, nextTick, onMounted } from 'vue'
import { useThemeStore } from '../stores/theme'
import { useI18nStore } from '../stores/i18n'
import { getHelpTopic } from '../help/topics.js'
import { getHelpArt } from '../help/art.js'

const props = defineProps({ topicId: { type: String, required: true } })
defineEmits(['close'])

const themeStore = useThemeStore()
const i18nStore = useI18nStore()
const t = (key, params = {}) => i18nStore.t(key, params)
const isDarkMode = computed(() => themeStore.isDarkMode)
const topic = computed(() => getHelpTopic(props.topicId))

// 教程正文是 { zh, en } 结构，按当前语言取值；取不到就退回中文
const loc = (v) => {
  if (!v) return ''
  if (typeof v === 'string') return v
  return v[i18nStore.locale] || v.zh || v.en || ''
}

const backBtn = ref(null)
const LINK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 13v6H5V6h6"/></svg>'

// 真实截图可按步骤指定显示宽度（默认吃满卡片宽）
const imgStyle = (s) => (s && s.maxWidth ? { maxWidth: s.maxWidth + 'px' } : undefined)

const openLink = async () => {
  const url = topic.value && topic.value.link && topic.value.link.url
  if (!url) return
  try {
    const api = window.electronAPI
    if (api && typeof api.openExternal === 'function') await api.openExternal(url)
  } catch (e) {
    console.warn('[Help] openExternal failed:', e)
  }
}

// 打开即把焦点放到「返回」，纯键盘用户按 Enter 就能退出
onMounted(async () => {
  await nextTick()
  if (backBtn.value) backBtn.value.focus()
})
</script>

<style scoped>
/* 帮助页 —— 与设置页/仓库页同壳 (50px 头 / 圆角 50px / 2px 边框卡片)
   z-index 1003: 盖在仓库页 (1002) 之上，所以从仓库页点问号能直接压上去 */
.help-view {
  position: absolute;
  inset: 0;
  z-index: 1003;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-radius: 50px;
  border: 3px solid var(--border-color);
  font-family: 'Noto Sans SC', system-ui, sans-serif;
  overflow: hidden;
  animation: helpSlideIn 0.3s ease;
}
@keyframes helpSlideIn {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.help-header {
  height: 50px;
  flex: 0 0 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 20px;
  border-bottom: 2px solid var(--border-color);
}
.help-back {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
  flex: 0 0 auto;
}
.help-back svg { width: 13px; height: 13px; }
.help-back:hover,
.help-back:focus-visible { border-color: var(--accent-primary); color: var(--accent-primary); }
.help-logo { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
.help-mark {
  width: 20px; height: 20px;
  border-radius: 50%;
  border: 2px solid var(--accent-primary);
  color: var(--accent-primary);
  font-size: 12px;
  font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex: 0 0 auto;
}
.help-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.help-close {
  width: 28px; height: 28px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--accent-primary);
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex: 0 0 auto;
}
.help-close:hover { background: var(--bg-card); }

.help-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.help-empty { align-items: center; justify-content: center; color: var(--text-muted); }
.help-intro { margin: 0; font-size: 12px; line-height: 1.75; color: var(--text-secondary); }

.help-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.help-step {
  display: grid;
  grid-template-columns: 24px 1fr;
  gap: 12px;
  padding: 12px 14px;
  border: 2px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-card);
}
.step-index {
  width: 22px; height: 22px;
  border-radius: 50%;
  border: 2px solid var(--accent-primary);
  color: var(--accent-primary);
  font-size: 11px;
  font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  margin-top: 2px;
}
.step-main { min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.step-text { margin: 0; font-size: 12px; line-height: 1.7; color: var(--text-primary); }

.help-art {
  color: var(--text-muted);
  border: 2px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-slot);
  padding: 10px;
  /* 容器贴着图收边：否则全宽容器里放一张窄图，两侧一大片空底 */
  width: fit-content;
  max-width: 100%;
  margin: 0 auto;
}
.help-art img {
  width: 100%;
  max-width: 430px;
  display: block;
  margin: 0 auto;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}
/* 线稿限宽居中：否则 viewBox 被拉满整卡，中间大片空白、四步要滚很久 */
.art-svg { max-width: 340px; margin: 0 auto; }
.help-art :deep(svg) { width: 100%; height: auto; display: block; }
.help-art :deep(.ha-box) { stroke: var(--border-color); }
.help-art :deep(.ha-dim) { stroke: var(--text-muted); opacity: 0.6; }
.help-art :deep(.hl) { stroke: var(--accent-primary); }
.help-art :deep(.hl-box) { stroke: var(--accent-primary); }
.help-art :deep(.hl-dash) { stroke: var(--accent-primary); stroke-dasharray: 4 4; }

.help-notes {
  border: 2px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-card);
  padding: 12px 14px;
}
.notes-title { font-size: 11px; font-weight: 700; color: var(--text-secondary); letter-spacing: 0.5px; margin-bottom: 6px; }
.note-line { margin: 0 0 6px; font-size: 11px; line-height: 1.65; color: var(--text-secondary); }
.note-line::before { content: '· '; color: var(--accent-primary); }

.help-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 2px solid var(--accent-primary);
  border-radius: 12px;
  background: var(--bg-card);
  color: var(--accent-primary);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.help-link:hover { background: var(--bg-slot); }
.link-icon { display: flex; flex: 0 0 auto; }
.link-icon :deep(svg) { width: 16px; height: 16px; display: block; }
.link-label { flex: 0 0 auto; }
.link-url {
  font-size: 10px;
  font-weight: 400;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.help-footer {
  height: 32px;
  flex: 0 0 32px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 20px;
  border-top: 2px solid var(--border-color);
}
.footer-hint { font-size: 10px; color: var(--text-muted); }

/* 与仓库页一致的暗色细滚动条 */
.help-body::-webkit-scrollbar { width: 8px; }
.help-body::-webkit-scrollbar-track { background: transparent; }
.help-body::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.help-body::-webkit-scrollbar-thumb:hover { background: var(--accent-primary); background-clip: padding-box; }
</style>
