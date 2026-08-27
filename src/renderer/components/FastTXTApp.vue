<template>
  <div class="fasttxt-app" @dragover.prevent @drop.prevent="handleGlobalDrop">
    <!-- 装饰螺丝 -->
    <div class="deco-screw screw-tl"></div>
    <div class="deco-screw screw-tr"></div>
    <div class="deco-screw screw-bl"></div>
    <div class="deco-screw screw-br"></div>

    <!-- ===== 主页面 ===== -->
    <template v-if="currentView === 'main'">
      <!-- 头部 -->
      <header class="ftxt-header">
        <div class="ftxt-logo">
          <span class="logo-icon">📄</span>
          <span class="logo-text">FastTXT</span>
          <span class="logo-chip">v1.0</span>
        </div>
        <button class="ftxt-close-btn" @click="$emit('returnToParent')" title="Back">
          ✕
        </button>
      </header>

      <!-- 主体 -->
      <main class="ftxt-content">
        <!-- 搜索框 (悬浮右上) -->
        <div class="ftxt-search">
          <span class="search-icon">🔍</span>
          <input 
            v-model="searchQuery" 
            class="search-input" 
            placeholder="Search files..."
            @keydown.stop
          />
        </div>

        <!-- 文件列表区域 -->
        <div 
          class="ftxt-file-list" 
          ref="fileListRef"
          @dragover.prevent="handleListDragOver"
          @dragleave="handleListDragLeave"
          @drop="handleListDrop"
        >
          <!-- 空状态 -->
          <div v-if="displayFiles.length === 0" class="ftxt-empty">
            <div class="empty-icon">📁</div>
            <div class="empty-text">
              {{ isTrashMode ? 'Trash is empty' : 'No files yet' }}
            </div>
            <div class="empty-hint">
              {{ isTrashMode ? '' : 'Drag .txt or .md files here' }}
            </div>
          </div>

          <!-- 文件卡片 -->
          <div 
            v-for="(file, idx) in displayFiles" 
            :key="file.id"
            class="ftxt-file-card"
            :class="{ 
              selected: selectedRow === 0 && selectedCol === idx,
              'dragging': dragFileId === file.id,
              'is-deleted': file.deleted 
            }"
            :draggable="true"
            @dragstart="handleFileDragStart($event, file)"
            @dragend="handleFileDragEnd"
            @click="handleFileClick(file)"
            @dblclick="openFile(file)"
            :style="{ animationDelay: `${idx * 0.04}s` }"
          >
            <div class="file-icon">{{ file.name.endsWith('.md') ? '📝' : '📄' }}</div>
            <div class="file-info">
              <div class="file-name">{{ file.name }}</div>
            </div>
            <div v-if="file.deleted" class="file-deleted-badge">DELETED</div>
          </div>
        </div>

        <!-- 垃圾桶拖放区域 -->
        <div 
          v-if="!isTrashMode" 
          class="ftxt-trash-zone"
          :class="{ 'drag-over': isTrashDragOver }"
          @dragover.prevent="isTrashDragOver = true"
          @dragleave="isTrashDragOver = false"
          @drop="handleTrashDrop"
        >
          <span class="trash-icon-large">🗑️</span>
        </div>

        <!-- 粉碎机拖放区域 (仅回收站模式显示) -->
        <div 
          v-if="isTrashMode" 
          class="ftxt-shredder-zone"
          :class="{ 'drag-over': isShredderDragOver }"
          @dragover.prevent="isShredderDragOver = true"
          @dragleave="isShredderDragOver = false"
          @drop="handleShredderDrop"
        >
          <span class="shredder-icon">⚙️</span>
          <span class="shredder-label">SHREDDER</span>
        </div>
      </main>

      <!-- 底部按钮栏 -->
      <footer class="ftxt-footer">
        <div class="footer-buttons">
          <button 
            v-for="(btn, idx) in footerButtons" 
            :key="btn.id"
            class="footer-btn"
            :class="[{ 
              active: btn.id === 'trash' && isTrashMode,
              'btn-focused': selectedRow === 1 && selectedCol === idx
            }, btn.id + '-btn']"
            @click="selectedRow = 1; selectedCol = idx; btn.action()"
            :title="btn.title"
          >
            <span class="btn-icon">{{ btn.icon }}</span>
          </button>
        </div>
        
        <div class="footer-info">
          <span class="file-count">{{ activeFiles.length }} files</span>
          <span v-if="isTrashMode" class="trash-count"> · {{ deletedFiles.length }} deleted</span>
        </div>
      </footer>
    </template>

    <!-- ===== 文件编辑器 ===== -->
    <template v-if="currentView === 'editor'">
      <!-- 头部 -->
      <header class="ftxt-header editor-header">
        <div class="ftxt-logo">
          <span class="logo-icon">{{ editingFile?.name.endsWith('.md') ? '📝' : '📄' }}</span>
          <span class="logo-text editor-title">{{ editingFile?.name || 'Untitled' }}</span>
        </div>
        <button class="ftxt-close-btn" @click="closeEditor" title="Save & Back">
          ✕
        </button>
      </header>

      <!-- 编辑器主体 -->
      <main class="ftxt-editor">
        <div class="editor-line-numbers">
          <div v-for="n in lineCount" :key="n" class="line-num">{{ n }}</div>
        </div>
        <textarea 
          ref="editorRef"
          v-model="editorContent"
          class="editor-textarea"
          @keydown="handleEditorKeydown"
          spellcheck="false"
        ></textarea>
      </main>

      <!-- 编辑器底部 -->
      <footer class="ftxt-footer editor-footer">
        <div class="editor-status">
          <span class="status-item">Lines: {{ lineCount }}</span>
          <span class="status-item">Chars: {{ editorContent.length }}</span>
          <span class="status-item">{{ editingFile?.name.endsWith('.md') ? 'Markdown' : 'Plain Text' }}</span>
        </div>
        <div class="editor-hint">
          <span>ESC to save & exit</span>
        </div>
      </footer>
    </template>

    <!-- ===== 弹窗 ===== -->
    <div v-if="modalVisible" class="ftxt-modal-overlay" @click.self="closeModal">
      <div class="ftxt-modal">
        <div class="modal-icon">{{ modalIcon }}</div>
        <div class="modal-title">{{ modalTitle }}</div>
        <div class="modal-message">{{ modalMessage }}</div>
        <div class="modal-buttons">
          <button 
            v-for="(btn, idx) in modalButtons" 
            :key="idx"
            class="modal-btn"
            :class="[btn.class, { 'btn-selected': modalSelectedBtnIdx === idx }]"
            @click="btn.action"
          >
            {{ btn.text }}
          </button>
        </div>
      </div>
    </div>

    <!-- ===== 新建菜单 ===== -->
    <div v-if="showCreateMenuVisible" class="ftxt-modal-overlay" @click.self="closeCreateMenu">
      <div class="ftxt-modal create-menu">
        <div class="modal-icon">+</div>
        <div class="modal-title">CREATE NEW</div>
        <div class="create-options">
          <button class="create-option" :class="{ 'btn-selected': createMenuSelectedIdx === 0 }" @click="createFile('txt')">
            <span class="create-icon">📄</span>
            <span class="create-label">.txt File</span>
          </button>
          <button class="create-option" :class="{ 'btn-selected': createMenuSelectedIdx === 1 }" @click="createFile('md')">
            <span class="create-icon">📝</span>
            <span class="create-label">.md File</span>
          </button>
          <button class="create-option" :class="{ 'btn-selected': createMenuSelectedIdx === 2 }" @click="createFolder">
            <span class="create-icon">📁</span>
            <span class="create-label">Folder</span>
          </button>
        </div>
        <div class="modal-buttons">
          <button class="modal-btn secondary" :class="{ 'btn-selected': createMenuSelectedIdx === 3 }" @click="closeCreateMenu">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated, nextTick, watch } from 'vue'
import { playSound } from '../utils/audio'

defineEmits(['returnToParent'])

// ========== 状态 ==========
const currentView = ref('main') // 'main' | 'editor'
const searchQuery = ref('')
const isTrashMode = ref(false)
const isTrashDragOver = ref(false)
const isShredderDragOver = ref(false)
const dragFileId = ref(null)

// 键盘焦点导航（模仿主页面）
const selectedRow = ref(0)  // 0=文件区域, 1=按钮区域
const selectedCol = ref(0)  // 列索引

// 文件列表
const files = ref([])
const fileListRef = ref(null)

// 编辑器
const editingFile = ref(null)
const editorContent = ref('')
const editorRef = ref(null)

// 弹窗
const modalVisible = ref(false)
const modalIcon = ref('')
const modalTitle = ref('')
const modalMessage = ref('')
const modalButtons = ref([])
const modalSelectedBtnIdx = ref(0)

// 新建菜单
const showCreateMenuVisible = ref(false)
const createMenuSelectedIdx = ref(0)

// ========== 文件管理 ==========
// 程序文件夹路径 (Electron 环境下由主进程提供)
const PROGRAM_FOLDER = 'FastTXT_Data'

// 初始化示例文件
const initDefaultFiles = () => {
  const saved = localStorage.getItem('fasttxt-files')
  if (saved) {
    try {
      files.value = JSON.parse(saved)
    } catch (e) {
      files.value = createDefaultFiles()
    }
  } else {
    files.value = createDefaultFiles()
  }
}

const createDefaultFiles = () => [
  { id: '1', name: 'readme.txt', content: 'Welcome to FastTXT!\n\nA retro text file manager.\n\nFeatures:\n- Drag & drop import\n- File editing\n- Trash & shred', deleted: false, order: 0 },
  { id: '2', name: 'notes.md', content: '# Notes\n\n## TODO\n- [ ] Try dragging files\n- [ ] Create new files\n- [ ] Test the shredder', deleted: false, order: 1 },
  { id: '3', name: 'draft.txt', content: 'This is a draft file.\n\nYou can edit this text freely.', deleted: false, order: 2 },
]

const saveFiles = () => {
  localStorage.setItem('fasttxt-files', JSON.stringify(files.value))
}

// 计算属性
const activeFiles = computed(() => {
  return files.value.filter(f => !f.deleted).sort((a, b) => a.order - b.order)
})

const deletedFiles = computed(() => {
  return files.value.filter(f => f.deleted)
})

const displayFiles = computed(() => {
  const base = isTrashMode.value ? deletedFiles.value : activeFiles.value
  if (!searchQuery.value) return base
  const q = searchQuery.value.toLowerCase()
  return base.filter(f => f.name.toLowerCase().includes(q))
})

const lineCount = computed(() => {
  return editorContent.value.split('\n').length
})

// 底部按钮列表（根据模式动态变化）
const footerButtons = computed(() => {
  const btns = [
    { id: 'add', icon: '+', action: showCreateMenu, title: 'Create new' },
    { id: 'trash', icon: '🗑️', action: toggleTrashMode, title: isTrashMode.value ? 'Back to files' : 'Show deleted' },
    { id: 'folder', icon: '📁', action: openFolder, title: 'Open folder' },
  ]
  if (isTrashMode.value) {
    btns.push({ id: 'shredder', icon: '⚙️', action: showShredConfirm, title: 'Shred all' })
  }
  return btns
})

// selectedCol 钳位：文件列表变化时保证不越界
watch(displayFiles, (list) => {
  if (selectedCol.value >= list.length) {
    selectedCol.value = Math.max(0, list.length - 1)
  }
})

// ========== 文件操作 ==========
const handleFileClick = (file) => {
  playSound('click')
  selectedRow.value = 0
  const idx = displayFiles.value.findIndex(f => f.id === file.id)
  if (idx >= 0) selectedCol.value = idx
}

const openFile = (file) => {
  if (file.deleted) {
    // 回收站中点击 = 恢复
    restoreFile(file)
    return
  }
  playSound('OK')
  editingFile.value = file
  editorContent.value = file.content || ''
  currentView.value = 'editor'
  nextTick(() => {
    if (editorRef.value) editorRef.value.focus()
  })
}

const restoreFile = (file) => {
  playSound('click')
  file.deleted = false
  saveFiles()
}

const closeEditor = () => {
  if (editingFile.value) {
    // 自动保存
    editingFile.value.content = editorContent.value
    saveFiles()
  }
  playSound('exit')
  currentView.value = 'main'
  editingFile.value = null
}

// ========== 拖拽导入 ==========
const handleGlobalDrop = (e) => {
  // 处理从外部拖入的文件
  const droppedFiles = e.dataTransfer?.files
  if (!droppedFiles || droppedFiles.length === 0) return
  
  for (const file of droppedFiles) {
    const name = file.name.toLowerCase()
    if (name.endsWith('.txt') || name.endsWith('.md')) {
      importFile(file)
    }
  }
}

const importFile = (file) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target.result
    const newFile = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      name: file.name,
      content: content,
      deleted: false,
      order: files.value.length
    }
    files.value.push(newFile)
    saveFiles()
    playSound('OK')
  }
  reader.readAsText(file)
}

// ========== 文件拖拽排序 ==========
const handleFileDragStart = (e, file) => {
  dragFileId.value = file.id
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', file.id)
}

const handleFileDragEnd = () => {
  dragFileId.value = null
}

const handleListDragOver = (e) => {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
}

const handleListDragLeave = () => {
  // nothing
}

const handleListDrop = (e) => {
  e.preventDefault()
  const fileId = e.dataTransfer.getData('text/plain')
  if (!fileId) return
  
  const file = files.value.find(f => f.id === fileId)
  if (!file) return
  
  // 获取鼠标位置，计算新顺序
  const listEl = fileListRef.value
  if (!listEl) return
  
  const cards = listEl.querySelectorAll('.ftxt-file-card')
  let newOrder = 0
  
  for (let i = 0; i < cards.length; i++) {
    const rect = cards[i].getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    if (e.clientY > midY) {
      newOrder = i + 1
    }
  }
  
  // 重新排序
  const active = activeFiles.value.filter(f => f.id !== fileId)
  active.splice(newOrder, 0, file)
  active.forEach((f, i) => f.order = i)
  
  saveFiles()
  playSound('click')
}

// ========== 垃圾桶操作 ==========
const toggleTrashMode = () => {
  playSound('click')
  isTrashMode.value = !isTrashMode.value
  selectedRow.value = 0
  selectedCol.value = 0
  searchQuery.value = ''
}

const handleTrashDrop = (e) => {
  e.preventDefault()
  isTrashDragOver.value = false
  const fileId = e.dataTransfer.getData('text/plain')
  if (!fileId) return
  
  const file = files.value.find(f => f.id === fileId)
  if (file && !file.deleted) {
    file.deleted = true
    saveFiles()
    playSound('exit')
  }
}

const handleShredderDrop = (e) => {
  e.preventDefault()
  isShredderDragOver.value = false
  const fileId = e.dataTransfer.getData('text/plain')
  if (!fileId) return
  
  const file = files.value.find(f => f.id === fileId)
  if (file && file.deleted) {
    // 物理删除
    const idx = files.value.findIndex(f => f.id === fileId)
    if (idx !== -1) {
      files.value.splice(idx, 1)
      saveFiles()
      playSound('error')
    }
  }
}

// ========== 粉碎机操作 ==========
const showShredConfirm = () => {
  if (deletedFiles.value.length === 0) {
    showModal('📭', 'EMPTY TRASH', 'No files to shred', [
      { text: 'OK', class: 'primary', action: closeModal }
    ])
    return
  }
  
  showModal('⚙️', 'SHRED ALL?', `Permanently delete ${deletedFiles.value.length} file(s)?`, [
    { text: 'Cancel', class: 'secondary', action: closeModal },
    { text: '⚙️ Shred All', class: 'danger', action: shredAll }
  ])
}

const shredAll = () => {
  files.value = files.value.filter(f => !f.deleted)
  saveFiles()
  closeModal()
  playSound('error')
}

const openFolder = () => {
  playSound('click')
  showModal('📁', 'PROGRAM FOLDER', `Files are stored in:\n${PROGRAM_FOLDER}/\n\nDrag .txt or .md files anywhere to import.`, [
    { text: 'OK', class: 'primary', action: closeModal }
  ])
}

// ========== 新建文件/文件夹 ==========
const showCreateMenu = () => {
  playSound('click')
  createMenuSelectedIdx.value = 0
  showCreateMenuVisible.value = true
}

const closeCreateMenu = () => {
  showCreateMenuVisible.value = false
}

const createFile = (type) => {
  closeCreateMenu()
  const ext = type === 'txt' ? '.txt' : '.md'
  const id = Date.now().toString() + Math.random().toString(36).substr(2, 5)
  const newFile = {
    id: id,
    name: `new_file${ext}`,
    content: '',
    deleted: false,
    order: files.value.length
  }
  files.value.push(newFile)
  saveFiles()
  playSound('OK')
  // 自动打开编辑
  editingFile.value = newFile
  editorContent.value = ''
  currentView.value = 'editor'
  nextTick(() => {
    if (editorRef.value) editorRef.value.focus()
  })
}

const createFolder = () => {
  closeCreateMenu()
  showModal('📁', 'FOLDER NAME', '', [
    { text: 'Cancel', class: 'secondary', action: closeModal },
    { text: 'Create', class: 'primary', action: () => {
      closeModal()
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 5)
      const newFolder = {
        id: id,
        name: 'NewFolder',
        content: '',
        isFolder: true,
        deleted: false,
        order: files.value.length
      }
      files.value.push(newFolder)
      saveFiles()
      playSound('OK')
    }}
  ])
}

// ========== 弹窗 ==========
const showModal = (icon, title, message, buttons) => {
  modalIcon.value = icon
  modalTitle.value = title
  modalMessage.value = message
  modalButtons.value = buttons
  modalSelectedBtnIdx.value = 0
  modalVisible.value = true
}

const closeModal = () => {
  modalVisible.value = false
}

// ========== 键盘处理 ==========
const handleEditorKeydown = (e) => {
  // Tab 支持
  if (e.key === 'Tab') {
    e.preventDefault()
    const start = e.target.selectionStart
    const end = e.target.selectionEnd
    editorContent.value = editorContent.value.substring(0, start) + '  ' + editorContent.value.substring(end)
    nextTick(() => {
      e.target.selectionStart = e.target.selectionEnd = start + 2
    })
  }
}

const handleKeydown = (e) => {
  let key = e.key
  if (key === 'w' || key === 'W') key = 'ArrowUp'
  if (key === 's' || key === 'S') key = 'ArrowDown'
  if (key === 'a' || key === 'A') key = 'ArrowLeft'
  if (key === 'd' || key === 'D') key = 'ArrowRight'

  // 弹窗打开时
  if (modalVisible.value) {
    e.preventDefault()
    e.stopImmediatePropagation()
    if (key === 'Escape') {
      closeModal()
      playSound('click')
    } else if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      playSound('click')
      if (key === 'ArrowUp') {
        modalSelectedBtnIdx.value = modalButtons.value.length - 1
      } else if (key === 'ArrowDown') {
        modalSelectedBtnIdx.value = 0
      } else if (key === 'ArrowLeft') {
        modalSelectedBtnIdx.value = Math.max(0, modalSelectedBtnIdx.value - 1)
      } else if (key === 'ArrowRight') {
        modalSelectedBtnIdx.value = Math.min(modalButtons.value.length - 1, modalSelectedBtnIdx.value + 1)
      }
    } else if (key === 'Enter' || key === ' ') {
      playSound('click')
      const btn = modalButtons.value[modalSelectedBtnIdx.value]
      if (btn && btn.action) btn.action()
    }
    return
  }

  // 新建菜单打开时
  if (showCreateMenuVisible.value) {
    e.preventDefault()
    e.stopImmediatePropagation()
    const totalOpts = 4 // 3个创建选项 + Cancel
    if (key === 'Escape') {
      closeCreateMenu()
      playSound('click')
    } else if (key === 'ArrowUp' || key === 'ArrowDown') {
      playSound('click')
      if (key === 'ArrowUp') {
        createMenuSelectedIdx.value = (createMenuSelectedIdx.value + totalOpts - 1) % totalOpts
      } else {
        createMenuSelectedIdx.value = (createMenuSelectedIdx.value + 1) % totalOpts
      }
    } else if (key === 'Enter' || key === ' ') {
      playSound('click')
      if (createMenuSelectedIdx.value === 0) createFile('txt')
      else if (createMenuSelectedIdx.value === 1) createFile('md')
      else if (createMenuSelectedIdx.value === 2) createFolder()
      else closeCreateMenu()
    }
    return
  }
  
  // 编辑器模式
  if (currentView.value === 'editor') {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopImmediatePropagation()
      closeEditor()
    }
    return
  }
  
  // 主页面
  if (e.key === 'Escape') {
    if (isTrashMode.value) {
      e.stopImmediatePropagation()
      isTrashMode.value = false
      playSound('exit')
    } else {
      // 无弹窗、无编辑器、非trash → 返回母程序
      emit('returnToParent')
    }
    return
  }

  if (key === ' ') key = 'Enter'

  switch (key) {
    case 'ArrowUp':
      e.preventDefault()
      if (selectedRow.value === 1) {
        // 按钮行 → 文件行
        selectedRow.value = 0
        updateFileSelection()
      }
      playSound('click')
      break

    case 'ArrowDown':
      e.preventDefault()
      if (selectedRow.value === 0) {
        // 文件行 → 按钮行
        selectedRow.value = 1
        selectedCol.value = Math.min(selectedCol.value, footerButtons.value.length - 1)
      }
      playSound('click')
      break

    case 'ArrowLeft':
      e.preventDefault()
      if (selectedRow.value === 0) {
        // 文件列左移
        if (selectedCol.value > 0) {
          selectedCol.value--
        }
      } else {
        // 按钮列左移
        if (selectedCol.value > 0) {
          selectedCol.value--
        }
      }
      playSound('click')
      break

    case 'ArrowRight':
      e.preventDefault()
      if (selectedRow.value === 0) {
        // 文件列右移
        const maxFileCol = displayFiles.value.length - 1
        if (selectedCol.value < maxFileCol) {
          selectedCol.value++
        }
      } else {
        // 按钮列右移
        const maxBtnCol = footerButtons.value.length - 1
        if (selectedCol.value < maxBtnCol) {
          selectedCol.value++
        }
      }
      playSound('click')
      break

    case 'Enter':
      e.preventDefault()
      if (selectedRow.value === 0) {
        // 打开选中文件
        const file = displayFiles.value[selectedCol.value]
        if (file) openFile(file)
      } else {
        // 执行选中按钮
        const btn = footerButtons.value[selectedCol.value]
        if (btn) btn.action()
      }
      break

    case 'Delete':
    case 'Backspace':
      e.preventDefault()
      if (selectedRow.value === 0 && !isTrashMode.value) {
        const file = displayFiles.value[selectedCol.value]
        if (file && !file.deleted) {
          file.deleted = true
          saveFiles()
          playSound('exit')
          // 调整选中位置
          const maxIdx = displayFiles.value.length - 1
          if (selectedCol.value > maxIdx) selectedCol.value = maxIdx
        }
      }
      break
  }
}

// 更新文件选中状态（根据 selectedCol）
const updateFileSelection = () => {
  const list = displayFiles.value
  if (list.length === 0) return
  if (selectedCol.value < 0) selectedCol.value = 0
  if (selectedCol.value >= list.length) selectedCol.value = list.length - 1
}

// ========== 生命周期 ==========
onMounted(() => {
  initDefaultFiles()
  document.addEventListener('keydown', handleKeydown)
  // 监听自定义返回事件
  document.addEventListener('fasttxt-return', () => {
    // 这里需要访问 emit，通过闭包
    // 但实际上我们需要另一种方式
  })
})

onActivated(() => {
  document.addEventListener('keydown', handleKeydown)
})

onDeactivated(() => {
  document.removeEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.fasttxt-app {
  width: 100%;
  height: 100%;
  background: var(--bg-secondary);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* CRT Scanline */
.fasttxt-app::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, var(--scanline-opacity, 0.03)) 0px,
    rgba(0, 0, 0, var(--scanline-opacity, 0.03)) 1px,
    transparent 1px,
    transparent 2px
  );
  pointer-events: none;
  z-index: 100;
}

/* 装饰螺丝 */
.deco-screw {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--border-color);
  border-radius: 50%;
  z-index: 101;
}
.deco-screw::before {
  content: '+';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 6px;
  color: #000;
}
.screw-tl { top: 12px; left: 12px; }
.screw-tr { top: 12px; right: 12px; }
.screw-bl { bottom: 15px; left: 20px; }
.screw-br { bottom: 15px; right: 20px; }

/* ========== Header ========== */
.ftxt-header {
  height: 48px;
  background: var(--bg-secondary);
  border-bottom: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  -webkit-app-region: drag;
  flex-shrink: 0;
  position: relative;
}

.ftxt-logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-icon {
  font-size: 18px;
}

.logo-text {
  font-family: 'Press Start 2P', monospace;
  font-size: 14px;
  color: var(--accent-primary);
  letter-spacing: 3px;
  text-shadow: 0 0 10px var(--accent-primary);
}

.logo-chip {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  color: var(--text-muted);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 2px 4px;
  letter-spacing: 1px;
}

.editor-title {
  font-size: 11px;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ftxt-close-btn {
  position: absolute;
  top: 10px;
  right: 12px;
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
  -webkit-app-region: no-drag;
  z-index: 102;
}

.ftxt-close-btn:hover {
  color: var(--accent-secondary, #ff0080);
  box-shadow: 0 0 12px var(--shadow-color);
  transform: scale(1.1);
}

/* ========== Content ========== */
.ftxt-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px 16px;
  min-height: 0;
  position: relative;
}

/* ========== Search Box ========== */
.ftxt-search {
  position: absolute;
  top: 12px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-card);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  padding: 6px 10px;
  z-index: 10;
  transition: all 0.2s ease;
}

.ftxt-search:focus-within {
  border-color: var(--accent-primary);
  box-shadow: 0 0 12px var(--shadow-color);
}

.search-icon {
  font-size: 12px;
}

.search-input {
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  width: 120px;
}

.search-input::placeholder {
  color: var(--text-muted);
}

/* ========== File List ========== */
.ftxt-file-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 44px 4px 8px 4px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  align-content: start;
  scrollbar-width: thin;
  scrollbar-color: var(--border-color) transparent;
}

.ftxt-file-list::-webkit-scrollbar {
  width: 6px;
}

.ftxt-file-list::-webkit-scrollbar-track {
  background: transparent;
}

.ftxt-file-list::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

/* Empty State */
.ftxt-empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  opacity: 0.6;
  padding: 40px 0;
}

.empty-icon {
  font-size: 48px;
  animation: float 3s ease-in-out infinite;
}

.empty-text {
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 1px;
}

.empty-hint {
  font-family: 'Press Start 2P', monospace;
  font-size: 7px;
  color: var(--text-muted);
  opacity: 0.6;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

/* File Card */
.ftxt-file-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--bg-card);
  border: 2px solid var(--border-color);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  animation: cardFadeIn 0.3s ease-out both;
  user-select: none;
  min-height: 48px;
  overflow: hidden;
}

.ftxt-file-card:hover {
  border-color: var(--accent-primary);
  box-shadow: 0 0 12px var(--shadow-color);
  transform: translateY(-4px);
}

.ftxt-file-card.selected {
  border-color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 10%, var(--bg-card));
  box-shadow: 0 0 16px var(--shadow-color);
}

.ftxt-file-card.dragging {
  opacity: 0.4;
  transform: scale(0.95);
}

.ftxt-file-card.is-deleted {
  opacity: 0.7;
  border-style: dashed;
}

.ftxt-file-card.is-deleted:hover {
  border-color: var(--accent-secondary, #ff0080);
}

@keyframes cardFadeIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.file-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-deleted-badge {
  font-family: 'Press Start 2P', monospace;
  font-size: 5px;
  color: var(--accent-secondary, #ff0080);
  border: 1px solid var(--accent-secondary, #ff0080);
  border-radius: 4px;
  padding: 2px 4px;
  flex-shrink: 0;
}

/* ========== Trash Zone ========== */
.ftxt-trash-zone {
  position: absolute;
  bottom: 60px;
  right: 16px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 2px dashed var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  z-index: 5;
}

.ftxt-trash-zone.drag-over {
  border-color: var(--accent-secondary, #ff0080);
  background: color-mix(in srgb, var(--accent-secondary, #ff0080) 15%, transparent);
  transform: scale(1.15);
  box-shadow: 0 0 20px var(--accent-secondary, #ff0080);
}

.trash-icon-large {
  font-size: 28px;
}

/* ========== Shredder Zone ========== */
.ftxt-shredder-zone {
  position: absolute;
  bottom: 60px;
  right: 16px;
  width: 80px;
  height: 60px;
  border-radius: 10px;
  border: 2px dashed var(--accent-secondary, #ff0080);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.3s ease;
  z-index: 5;
}

.ftxt-shredder-zone.drag-over {
  border-color: #ff0000;
  background: color-mix(in srgb, #ff0000 20%, transparent);
  transform: scale(1.1);
  box-shadow: 0 0 20px #ff0000;
}

.shredder-icon {
  font-size: 24px;
}

.shredder-label {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  color: var(--accent-secondary, #ff0080);
  letter-spacing: 1px;
}

/* ========== Footer ========== */
.ftxt-footer {
  height: 50px;
  background: var(--bg-secondary);
  border-top: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
}

.footer-buttons {
  display: flex;
  align-items: center;
  gap: 12px;
}

.footer-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid var(--border-color);
  background: var(--bg-card);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.footer-btn:hover {
  border-color: var(--accent-primary);
  transform: scale(1.1);
}

.footer-btn.active {
  border-color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 20%, var(--bg-card));
  box-shadow: 0 0 12px var(--shadow-color);
}

.footer-btn.btn-focused {
  border-color: var(--accent-primary);
  box-shadow: 0 0 16px var(--accent-primary);
  transform: scale(1.15);
}

.footer-btn.shredder-btn {
  border-color: var(--accent-secondary, #ff0080);
}

.footer-btn.shredder-btn:hover {
  border-color: var(--accent-secondary, #ff0080);
  box-shadow: 0 0 12px var(--accent-secondary, #ff0080);
}


.btn-icon {
  font-size: 18px;
  font-weight: bold;
  transition: color 0.2s ease;
}

.footer-info {
  display: flex;
  align-items: center;
  gap: 4px;
}

.file-count, .trash-count {
  font-family: 'Press Start 2P', monospace;
  font-size: 7px;
  color: var(--text-muted);
  letter-spacing: 1px;
}

/* ========== Editor ========== */
.ftxt-editor {
  flex: 1;
  display: flex;
  min-height: 0;
  background: var(--bg-card);
  margin: 0 16px;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.editor-line-numbers {
  width: 40px;
  background: var(--bg-secondary);
  border-right: 2px solid var(--border-color);
  padding: 12px 0;
  overflow-y: hidden;
  flex-shrink: 0;
}

.line-num {
  font-family: 'Press Start 2P', monospace;
  font-size: 7px;
  color: var(--text-muted);
  text-align: right;
  padding: 0 8px;
  line-height: 1.8;
}

.editor-textarea {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-family: 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.8;
  padding: 12px 16px;
  resize: none;
  tab-size: 2;
}

.editor-textarea::placeholder {
  color: var(--text-muted);
}

.editor-footer {
  justify-content: space-between;
}

.editor-status {
  display: flex;
  gap: 16px;
}

.status-item {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  color: var(--text-muted);
  letter-spacing: 1px;
}

.editor-hint {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  color: var(--accent-primary);
  letter-spacing: 1px;
}

/* ========== Modal ========== */
.ftxt-modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  animation: fadeIn 0.2s ease;
}

.ftxt-modal {
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: 16px;
  padding: 24px;
  max-width: 320px;
  width: 90%;
  text-align: center;
  animation: modalPop 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.modal-icon {
  font-size: 36px;
  margin-bottom: 12px;
}

.modal-title {
  font-family: 'Press Start 2P', monospace;
  font-size: 11px;
  color: var(--accent-primary);
  margin-bottom: 12px;
  letter-spacing: 2px;
}

.modal-message {
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  color: var(--text-secondary);
  line-height: 1.8;
  margin-bottom: 20px;
  white-space: pre-line;
}

.modal-buttons {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.modal-btn {
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  padding: 10px 16px;
  border-radius: 8px;
  border: 2px solid var(--border-color);
  background: var(--bg-card);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 1px;
}

.modal-btn:hover {
  transform: scale(1.05);
}

.modal-btn.primary {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.modal-btn.primary:hover {
  background: var(--accent-primary);
  color: #000;
}

.modal-btn.secondary {
  border-color: var(--text-muted);
  color: var(--text-muted);
}

.modal-btn.danger {
  border-color: var(--accent-secondary, #ff0080);
  color: var(--accent-secondary, #ff0080);
}

.modal-btn.danger:hover {
  background: var(--accent-secondary, #ff0080);
  color: #fff;
}

/* Keyboard selected state */
.btn-selected {
  border-color: var(--accent-primary) !important;
  box-shadow: 0 0 12px var(--accent-primary);
  transform: scale(1.05);
}

.create-option.btn-selected {
  border-color: var(--accent-primary);
  box-shadow: 0 0 12px var(--shadow-color);
  background: color-mix(in srgb, var(--accent-primary) 15%, var(--bg-card));
}

/* Create Menu */
.create-menu {
  min-width: 200px;
}

.create-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.create-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--bg-card);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.create-option:hover {
  border-color: var(--accent-primary);
  box-shadow: 0 0 12px var(--shadow-color);
}

.create-icon {
  font-size: 20px;
}

.create-label {
  font-family: 'Press Start 2P', monospace;
  font-size: 9px;
  color: var(--text-primary);
  letter-spacing: 1px;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes modalPop {
  from {
    opacity: 0;
    transform: scale(0.8) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* ========== Light Mode ========== */
.light-mode .ftxt-search {
  background: var(--bg-card);
}

.light-mode .ftxt-file-card {
  background: var(--bg-card);
}

.light-mode .ftxt-file-card.selected {
  background: color-mix(in srgb, var(--accent-primary) 10%, var(--bg-card));
}

.light-mode .ftxt-trash-zone {
  border-color: #d8cbb2;
}

.light-mode .footer-btn {
  background: var(--bg-card);
}

.light-mode .ftxt-modal {
  background: var(--bg-secondary);
}

.light-mode .modal-btn {
  background: var(--bg-card);
}

.light-mode .editor-line-numbers {
  background: var(--bg-secondary);
}

.light-mode .ftxt-editor {
  background: var(--bg-card);
}

.light-mode .create-option {
  background: var(--bg-card);
}

.light-mode .footer-btn.add-btn {
  background: var(--bg-card);
}
</style>
