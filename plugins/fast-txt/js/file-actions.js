    // ========== File Operations ==========
    const handleFileClick = (file) => {
      playSound('click');
      isSearchFocused = false;
      const list = getDisplayFiles();
      const idx = list.findIndex(f => f.id === file.id);

      // 已经选中了这个文件 → 打开
      if (selectedRow === 0 && selectedCol === idx) {
        openFile(file);
        return;
      }

      // 没选中 → 选中它
      selectedRow = 0;
      selectedCol = idx;
      updateUI();
    };

    // ========== Rename ==========
    const startRename = (file) => {
      if (isRenaming) return;
      // 文件夹暂不支持重命名
      if (file.isFolder) return;
      playSound('click');

      isRenaming = true;
      renamingFileId = file.id;

      const list = getDisplayFiles();
      const idx = list.findIndex(f => f.id === file.id);
      const cards = fileList.querySelectorAll('.ftxt-file-card');
      const card = cards[idx];
      if (!card) { isRenaming = false; return; }

      const nameEl = card.querySelector('.file-name');
      if (!nameEl) { isRenaming = false; return; }

      // 创建 input 元素
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'file-rename-input';
      input.value = file.name;

      // 替换文件名文本为 input
      nameEl.textContent = '';
      nameEl.appendChild(input);
      input.focus();
      input.select();

      // Enter → 确认, Esc → 取消, 失焦 → 确认
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          confirmRename(file, input.value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelRename(file);
        } else if (e.key === 'Tab') {
          // Tab → 确认当前，重命名下一个
          e.preventDefault();
          confirmRename(file, input.value).then(() => {
            const nextIdx = idx + 1;
            const nextList = getDisplayFiles();
            if (nextIdx < nextList.length) {
              selectedCol = nextIdx;
              updateUI();
              startRename(nextList[nextIdx]);
            }
          });
        }
      });

      input.addEventListener('blur', () => {
        // 延迟处理，避免与 click 事件冲突
        setTimeout(() => {
          if (isRenaming && renamingFileId === file.id) {
            confirmRename(file, input.value);
          }
        }, 100);
      });

      // 阻止点击 input 时的文件选中逻辑
      input.addEventListener('click', (e) => e.stopPropagation());
    };

    const confirmRename = async (file, newName) => {
      if (!isRenaming) return;
      isRenaming = false;
      renamingFileId = null;

      newName = newName.trim();

      // 空名 → 取消
      if (!newName || newName === file.name) {
        cancelRename(file);
        return;
      }

      // 检查重名（同目录下不能有同名文件）
      const currentFiles = file.parentPath
        ? files.filter(f => !f.deleted && f.parentPath === file.parentPath && f.id !== file.id)
        : files.filter(f => !f.deleted && !f.parentPath && f.id !== file.id);
      const duplicate = currentFiles.some(f => f.name === newName);
      if (duplicate) {
        showModal('⚠️', 'RENAME FAILED', `A file named "${newName}" already exists`, [
          { text: 'OK', class: 'primary', action: closeModal }
        ]);
        cancelRename(file);
        return;
      }

      const api = fsAPI();
      if (api) {
        const oldPath = file.parentPath ? `${file.parentPath}/${file.name}` : file.name;
        const newPath = file.parentPath ? `${file.parentPath}/${newName}` : newName;
        await api.rename(oldPath, newPath);
      }

      // 更新文件对象
      const oldId = file.id;
      file.name = newName;
      file.id = file.parentPath ? `${file.parentPath}/${newName}` : newName;
      // content 缓存清空，下次打开时从磁盘重新读取
      file.content = null;

      await saveFiles();
      playSound('OK');
      updateUI();
    };

    const cancelRename = (file) => {
      isRenaming = false;
      renamingFileId = null;
      // 恢复文件名显示
      const list = getDisplayFiles();
      const idx = list.findIndex(f => f.id === file.id);
      const cards = fileList.querySelectorAll('.ftxt-file-card');
      const card = cards[idx];
      if (card) {
        const nameEl = card.querySelector('.file-name');
        if (nameEl) {
          // 移除 input，恢复原始文本
          const input = nameEl.querySelector('.file-rename-input');
          if (input) {
            nameEl.removeChild(input);
          }
          nameEl.textContent = file.name;
        }
      }
      playSound('click');
    };

    const openFile = async (file) => {
      if (file.deleted) {
        restoreFile(file);
        return;
      }

      // 文件夹 → 进入文件夹
      if (file.isFolder) {
        enterFolder(file);
        return;
      }

      const api = fsAPI();
      if (!api) return;

      // 始终从磁盘读取最新内容（不信任缓存，防止旧数据覆盖新编辑）
      const subPath = file.parentPath ? `${file.parentPath}/${file.name}` : file.name;
      const diskContent = await api.readFile(subPath);
      file.content = diskContent !== null ? diskContent : '';
      editorContent = file.content;

      playSound('OK');
      editingFile = file;
      currentView = 'editor';
      // 更新编辑器标题
      editorTitle.textContent = file.name;
      editorIcon.textContent = file.name.endsWith('.md') ? '📝' : '📄';
      // Reset find bar state
      findBarVisible = false;
      findBar.style.display = 'none';
      findMatches = [];
      findCurrentIdx = -1;
      updateUI();
      // 立即将内容写入 textarea（避免异步时序导致空内容覆盖磁盘数据）
      editorTextarea.value = editorContent;
      renderEditorStatus();
      renderLineNumbers();
      setTimeout(() => editorTextarea.focus(), 0);
    };

    const restoreFile = (file) => {
      playSound('click');
      const api = fsAPI();
      if (api) {
        // 从回收站移动回来
        const trashName = file.name.includes('/') ? file.name.split('/').pop() : file.name;
        api.rename(`${TRASH_DIR}/${trashName}`, file.name);
      }
      file.deleted = false;
      saveFiles();
      updateUI();
    };

    const closeEditor = async () => {
      // Close find bar if open
      if (findBarVisible) {
        closeFindBar();
      }
      if (editingFile) {
        const api = fsAPI();
        const newContent = editorContent;
        editingFile.content = newContent;
        // 写入磁盘（使用完整路径）
        if (api) {
          const subPath = editingFile.parentPath ? `${editingFile.parentPath}/${editingFile.name}` : editingFile.name;
          await api.writeFile(subPath, newContent);
        }
        saveFiles();
      }
      playSound('exit');
      currentView = 'main';
      editingFile = null;
      updateUI();
    };

    // ========== External File Import ==========
    const handleGlobalDrop = (e) => {
      e.preventDefault();
      const droppedFiles = e.dataTransfer && e.dataTransfer.files;
      if (!droppedFiles || droppedFiles.length === 0) return;

      for (let i = 0; i < droppedFiles.length; i++) {
        const f = droppedFiles[i];
        const name = f.name.toLowerCase();
        if (name.endsWith('.txt') || name.endsWith('.md')) {
          importFile(f, f.path);
        }
      }
    };

    const importFile = (file, originalPath) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target.result;
        const api = fsAPI();
        const subPath = isFolderMode ? `${currentFolderPath}/${file.name}` : file.name;
        if (api) {
          // 写入磁盘
          await api.writeFile(subPath, content);
          // 刷新文件列表
          await loadFilesFromDisk();
        } else {
          // fallback: 内存
          const id = isFolderMode ? `${currentFolderPath}/${file.name}` : file.name;
          const newFile = {
            id: id,
            name: file.name,
            content: content,
            deleted: false,
            order: files.length,
            isFolder: false,
            parentPath: currentFolderPath
          };
          files.push(newFile);
        }
        // 导入成功后删除原始文件
        if (originalPath) {
          try {
            require('fs').unlinkSync(originalPath);
          } catch (err) {
            console.warn('[FastTXT] 删除原始文件失败:', err.message);
          }
        }
        saveFiles();
        playSound('OK');
        updateUI();
      };
      reader.readAsText(file);
    };
