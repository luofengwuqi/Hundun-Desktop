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
        await restoreFile(file);
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

      // 加载书签
      await loadBookmarksFromDisk(subPath);

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
      // 清空行号DOM和缓存的行高，强制重建以显示正确的书签状态
      lineNumbers.innerHTML = '';
      delete lineNumbers.dataset.lh;
      renderLineNumbers();
      
      // 跳转到第一个书签位置
      const bookmarkLines = Object.keys(bookmarks).map(Number).sort((a, b) => a - b);
      
      // 先 focus，再滚动到书签 (focus 会滚到光标末尾，所以必须在 focus 之后重新滚)
      setTimeout(() => {
        editorTextarea.focus();
        if (bookmarkLines.length > 0) {
          const firstBookmarkLine = bookmarkLines[0];
          const lineHeight = editorFontSize * 1.8;
          const scrollTo = (firstBookmarkLine - 1) * lineHeight;
          editorTextarea.scrollTop = scrollTo;
          lineNumbers.scrollTop = scrollTo;
        }
      }, 0);
    };

    // ========== Delete to Trash (统一入口: 键盘 Delete / 拖入垃圾桶) ==========
    // 删除文件 → 平铺移入 .trash/<唯一名>; 不再保留文件夹归属/路径, 恢复时回到 file/ 根目录
    const deleteFileToTrash = async (file) => {
      const api = fsAPI();
      if (!api) {
        // fallback: 无磁盘 API，仅内存标记
        file.deleted = true;
        saveFiles();
        updateUI();
        return;
      }
      await runFsOp(async () => {
        try {
          await api.mkdir(TRASH_DIR);
          const diskName = await pickFreeName(TRASH_DIR, file.name); // 磁盘不存在为目标, 防覆盖
          await api.rename(getRelPath(file), `${TRASH_DIR}/${diskName}`);
        } catch (err) {
          console.error('[FastTXT] move to trash failed:', err);
          showModal('⚠️', 'TRASH FAILED', `Cannot move "${file.name}" to trash`, [
            { text: 'OK', class: 'primary', action: closeModal }
          ]);
          playSound('error');
          return;
        }
        await finalizeFsChange('exit');
      });
    };

    // ========== 文件夹删除 (不保留文件夹/路径, 内容平铺入回收站) ==========
    // 空文件夹 → 直接物理删除; 非空 → 弹警告, 确认后把文件夹内所有文件(含子目录, 递归)逐个
    // 移入 .trash/ 平铺存放, 最后删除已搬空的文件夹树; 恢复时每个文件回到 file/ 根目录
    const deleteFolderToTrash = async (folderFile) => {
      const api = fsAPI();
      if (!api) {
        folderFile.deleted = true;
        saveFiles();
        updateUI();
        return;
      }
      const rel = getRelPath(folderFile);
      const relFiles = await collectFolderFiles(rel);
      if (relFiles.length > 0) {
        showModal('⚠️', 'DELETE FOLDER?',
          `"${folderFile.name}" contains ${relFiles.length} file(s). Move them ALL to trash and delete this folder?`, [
          { text: 'Cancel', class: 'secondary', action: closeModal },
          { text: '🗑️ Move to Trash', class: 'danger', action: () => { closeModal(); performFolderDelete(folderFile, relFiles); } }
        ]);
        playSound('click');
        return;
      }
      // 空文件夹 → 直接物理删除
      await runFsOp(async () => {
        try {
          await api.deleteFile(rel);
        } catch (err) {
          console.error('[FastTXT] delete empty folder failed:', err);
          showModal('⚠️', 'DELETE FAILED', `Cannot delete folder "${folderFile.name}"`, [
            { text: 'OK', class: 'primary', action: closeModal }
          ]);
          playSound('error');
          return;
        }
        await finalizeFsChange('exit');
      });
    };

    // 收集文件夹内所有文件 (任意深度, 跳过隐藏项), 返回相对路径数组
    const collectFolderFiles = async (rel) => {
      const api = fsAPI();
      const out = [];
      if (!api) return out;
      let entries = [];
      try { entries = await api.readDir(rel); } catch (_) { return out; }
      for (const en of entries) {
        const subRel = `${rel}/${en.name}`;
        if (en.isDirectory) {
          out.push(...await collectFolderFiles(subRel));
        } else {
          out.push(subRel);
        }
      }
      return out;
    };

    // 确认后的级联删除: 逐个搬移文件入回收站 → 全部成功后删除空文件夹树
    const performFolderDelete = async (folderFile, relFiles) => {
      const api = fsAPI();
      if (!api) return;
      await runFsOp(async () => {
        await api.mkdir(TRASH_DIR);
        let moved = 0;
        for (const relPath of relFiles) {
          const name = relPath.split('/').pop();
          try {
            const diskName = await pickFreeName(TRASH_DIR, name); // 逐个取磁盘上不存在的名字
            await api.rename(relPath, `${TRASH_DIR}/${diskName}`);
            moved++;
          } catch (err) {
            console.warn('[FastTXT] move file to trash failed:', relPath, err);
          }
        }
        // 仅当所有文件都搬移成功, 且文件夹内确实无残留文件时, 才删除文件夹树
        // (二次核对避免确认期间有新文件进入文件夹而被误删)
        let folderRemoved = false;
        const folderRel = getRelPath(folderFile);
        const remaining = (await collectFolderFiles(folderRel)).length;
        if (moved === relFiles.length && remaining === 0) {
          try {
            await api.deleteFile(folderRel);
            folderRemoved = true;
          } catch (err) {
            console.warn('[FastTXT] remove folder tree failed:', err);
          }
        }
        if (moved !== relFiles.length || !folderRemoved) {
          showModal('⚠️', 'DELETE INCOMPLETE',
            `Moved ${moved}/${relFiles.length} file(s) to trash.${folderRemoved ? '' : ` ${remaining} file(s) left; folder kept.`}`, [
            { text: 'OK', class: 'primary', action: closeModal }
          ]);
          playSound('error');
        }
        await finalizeFsChange('exit');
      });
    };

    const restoreFile = async (file) => {
      playSound('click');
      const api = fsAPI();
      if (!api) {
        file.deleted = false;
        saveFiles();
        updateUI();
        return;
      }
      // 恢复: 直接移回 file/ 根目录 (平铺); 根目录已有同名项 → 自动 +1 递增改名
      await runFsOp(async () => {
        const diskName = file.diskName || file.name; // .trash 下的实际磁盘名
        try {
          const targetName = await pickFreeName('', file.name); // 目标必须磁盘上不存在
          await api.rename(`${TRASH_DIR}/${diskName}`, targetName);
        } catch (err) {
          console.error('[FastTXT] restore failed:', err);
          showModal('⚠️', 'RESTORE FAILED', `Cannot restore "${file.name}" to the root folder`, [
            { text: 'OK', class: 'primary', action: closeModal }
          ]);
          playSound('error');
          return;
        }
        await finalizeFsChange('OK');
      });
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
