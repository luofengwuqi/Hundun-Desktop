    // ========== File Operations ==========
    const handleFileClick = (file) => {
      playSound('click');
      isSearchFocused = false;
      const list = getDisplayFiles();
      const idx = list.findIndex(f => f.id === file.id);
      const alreadySelected = selectedRow === 0 && selectedCol === idx;
      selectedRow = 0;
      selectedCol = idx;
      updateUI();
      if (file.deleted) {
        // 回收站: 再次点击已选中项才恢复
        if (alreadySelected) restoreFile(file);
        return;
      }
      // 脚本: 点击即运行, 结果走 toast
      if (isScriptFile(file.name)) runScript(file);
    };

    const runScript = async (file) => {
      const absPath = await resolveScriptAbsPath(file.name);
      if (!absPath || !fs.existsSync(absPath)) {
        showToast('❌', FastCmdI18n.t('toast.scriptError', { name: file.name }));
        playSound('error');
        return;
      }

      const result = await executeScript(absPath, {
        onStarted: () => {
          showToast('🚀', FastCmdI18n.t('toast.scriptRunning', { name: file.name }));
          playSound('OK');
        },
      });

      // 脚本结束后按退出码反馈 (running=超时仍在跑, 不打扰)
      if (result.running) return;
      if (result.ok) {
        showToast('✅', FastCmdI18n.t('toast.scriptSuccess', { name: file.name }));
      } else if (result.code !== null) {
        showToast('⚠️', FastCmdI18n.t('toast.scriptExitCode', { name: file.name, code: result.code }));
        playSound('error');
      } else {
        showToast('❌', FastCmdI18n.t('toast.scriptError', { name: file.name }));
        playSound('error');
      }
    };

    // ========== Rename ==========
    const startRename = (file) => {
      if (isRenaming) return;
      playSound('click');
      isRenaming = true;
      renamingFileId = file.id;

      const list = getDisplayFiles();
      const idx = list.findIndex(f => f.id === file.id);
      const cards = fileList.querySelectorAll('.fcmd-file-card');
      const card = cards[idx];
      if (!card) { isRenaming = false; return; }
      const nameEl = card.querySelector('.file-name');
      if (!nameEl) { isRenaming = false; return; }

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'file-rename-input';
      input.value = file.name;
      nameEl.textContent = '';
      nameEl.appendChild(input);
      input.focus();
      input.select();

      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); confirmRename(file, input.value); }
        else if (e.key === 'Escape') { e.preventDefault(); cancelRename(file); }
        else if (e.key === 'Tab') {
          e.preventDefault();
          confirmRename(file, input.value).then(() => {
            const nextIdx = idx + 1;
            const nextList = getDisplayFiles();
            if (nextIdx < nextList.length) { selectedCol = nextIdx; updateUI(); startRename(nextList[nextIdx]); }
          });
        }
      });
      input.addEventListener('blur', () => {
        setTimeout(() => { if (isRenaming && renamingFileId === file.id) confirmRename(file, input.value); }, 100);
      });
      input.addEventListener('click', (e) => e.stopPropagation());
    };

    const confirmRename = async (file, newName) => {
      if (!isRenaming) return;
      isRenaming = false;
      renamingFileId = null;
      newName = newName.trim();
      if (!newName || newName === file.name) { cancelRename(file); return; }

      const currentFiles = files.filter(f => !f.deleted && f.id !== file.id);
      const duplicate = currentFiles.some(f => f.name === newName);
      if (duplicate) {
        showModal('⚠️', FastCmdI18n.t('modal.renameFailed'), FastCmdI18n.t('modal.renameExists', { name: newName }), [
          { text: FastCmdI18n.t('modal.ok'), class: 'primary', action: closeModal }
        ]);
        cancelRename(file);
        return;
      }

      const api = fsAPI();
      if (api) {
        await api.rename(file.name, newName);
      }
      file.name = newName;
      file.id = newName;
      file.content = null;
      await saveFiles();
      playSound('OK');
      updateUI();
    };

    const cancelRename = (file) => {
      isRenaming = false;
      renamingFileId = null;
      const list = getDisplayFiles();
      const idx = list.findIndex(f => f.id === file.id);
      const cards = fileList.querySelectorAll('.fcmd-file-card');
      const card = cards[idx];
      if (card) {
        const nameEl = card.querySelector('.file-name');
        if (nameEl) {
          const input = nameEl.querySelector('.file-rename-input');
          if (input) nameEl.removeChild(input);
          nameEl.textContent = file.name;
        }
      }
      playSound('click');
    };

    // ========== Delete to Trash ==========
    const deleteFileToTrash = async (file) => {
      const api = fsAPI();
      if (!api) { file.deleted = true; saveFiles(); updateUI(); return; }
      await runFsOp(async () => {
        try {
          await api.mkdir(TRASH_DIR);
          const diskName = await pickFreeName(TRASH_DIR, file.name);
          await api.rename(file.name, `${TRASH_DIR}/${diskName}`);
        } catch (err) {
          console.error('[FastCmd] move to trash failed:', err);
          showModal('⚠️', FastCmdI18n.t('modal.trashFailed'), FastCmdI18n.t('modal.trashCannotMove', { name: file.name }), [
            { text: FastCmdI18n.t('modal.ok'), class: 'primary', action: closeModal }
          ]);
          playSound('error');
          return;
        }
        await finalizeFsChange('exit');
      });
    };

    const restoreFile = async (file) => {
      playSound('click');
      const api = fsAPI();
      if (!api) { file.deleted = false; saveFiles(); updateUI(); return; }
      await runFsOp(async () => {
        const diskName = file.diskName || file.name;
        try {
          const targetName = await pickFreeName('', file.name);
          await api.rename(`${TRASH_DIR}/${diskName}`, targetName);
        } catch (err) {
          console.error('[FastCmd] restore failed:', err);
          showModal('⚠️', FastCmdI18n.t('modal.restoreFailed'), FastCmdI18n.t('modal.restoreCannot', { name: file.name }), [
            { text: FastCmdI18n.t('modal.ok'), class: 'primary', action: closeModal }
          ]);
          playSound('error');
          return;
        }
        await finalizeFsChange('OK');
      });
    };

    // ========== External File Import ==========
    const handleGlobalDrop = (e) => {
      e.preventDefault();
      const droppedFiles = e.dataTransfer && e.dataTransfer.files;
      if (!droppedFiles || droppedFiles.length === 0) return;
      for (let i = 0; i < droppedFiles.length; i++) {
        const f = droppedFiles[i];
        // 只导入当前系统支持的脚本后缀 (不支持的不显示也不收, 见 platform.js)
        if (isScriptFile(f.name)) {
          importFile(f, f.path);
        }
      }
    };

    const importFile = (file, originalPath) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target.result;
        const api = fsAPI();
        if (api) {
          await api.writeFile(file.name, content);
          await loadFilesFromDisk();
        } else {
          files.push({ id: file.name, name: file.name, content, deleted: false, order: files.length, isFolder: false });
        }
        if (originalPath) {
          try { require('fs').unlinkSync(originalPath); }
          catch (err) { console.warn('[FastCmd] 删除原始文件失败:', err.message); }
        }
        saveFiles();
        playSound('OK');
        updateUI();
      };
      reader.readAsText(file);
    };
