    // ========== File Operations ==========
    const handleFileClick = (file) => {
      playSound('click');
      isSearchFocused = false;
      const list = getDisplayFiles();
      const idx = list.findIndex(f => f.id === file.id);
      if (selectedRow === 0 && selectedCol === idx) {
        // 已选中 → 执行操作
        if (file.deleted) { restoreFile(file); }
        else if (file.isFolder) { enterFolder(file); }
        else { showScriptActionModal(file); }
        return;
      }
      selectedRow = 0;
      selectedCol = idx;
      updateUI();
    };

    // ========== 弹出脚本操作模态框 ==========
    const showScriptActionModal = async (file) => {
      if (!isScriptFile(file.name)) return;
      const type = getScriptType(file.name);
      const typeName = type === 'powershell' ? 'PowerShell' : 'Batch/CMD';
      const absPath = await resolveScriptAbsPath(getRelPath(file));
      const info = absPath ? getScriptInfo(absPath) : null;

      const msgParts = [
        FastCmdI18n.t('modal.runConfirm'),
        '',
        `Type: ${typeName}`,
        info ? `Size: ${info.size} bytes` : '',
      ].filter(Boolean);

      showModal('⚡', file.name, msgParts.join('\n'), [
        { text: FastCmdI18n.t('modal.run'), class: 'run-btn', action: () => { closeModal(); runScript(file); } },
        { text: FastCmdI18n.t('modal.edit'), class: 'primary', action: () => { closeModal(); editScript(file); } },
        { text: FastCmdI18n.t('modal.cancel'), class: 'secondary', action: closeModal },
      ]);
    };

    const runScript = async (file) => {
      const absPath = await resolveScriptAbsPath(getRelPath(file));
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
      if (!result.ok) {
        if (result.code !== null) {
          showToast('⚠️', FastCmdI18n.t('toast.scriptExitCode', { name: file.name, code: result.code }));
        } else {
          showToast('❌', FastCmdI18n.t('toast.scriptError', { name: file.name }));
        }
        playSound('error');
      }
    };

    const editScript = (file) => {
      resolveScriptAbsPath(getRelPath(file)).then((absPath) => {
        if (!absPath || !fs.existsSync(absPath)) {
          showToast('❌', FastCmdI18n.t('toast.scriptError', { name: file.name }));
          playSound('error');
          return;
        }
        const success = openInSystemEditor(absPath);
        if (success) {
          showToast('✏️', FastCmdI18n.t('toast.editorOpen', { name: file.name }));
          playSound('click');
        }
      });
    };

    // ========== Rename ==========
    const startRename = (file) => {
      if (isRenaming) return;
      if (file.isFolder) return;
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

      const currentFiles = file.parentPath
        ? files.filter(f => !f.deleted && f.parentPath === file.parentPath && f.id !== file.id)
        : files.filter(f => !f.deleted && !f.parentPath && f.id !== file.id);
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
        const oldPath = file.parentPath ? `${file.parentPath}/${file.name}` : file.name;
        const newPath = file.parentPath ? `${file.parentPath}/${newName}` : newName;
        await api.rename(oldPath, newPath);
      }
      file.name = newName;
      file.id = file.parentPath ? `${file.parentPath}/${newName}` : newName;
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
          await api.rename(getRelPath(file), `${TRASH_DIR}/${diskName}`);
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

    const deleteFolderToTrash = async (folderFile) => {
      const api = fsAPI();
      if (!api) { folderFile.deleted = true; saveFiles(); updateUI(); return; }
      const rel = getRelPath(folderFile);
      const relFiles = await collectFolderFiles(rel);
      if (relFiles.length > 0) {
        showModal('⚠️', FastCmdI18n.t('modal.deleteFolder'),
          FastCmdI18n.t('modal.deleteFolderConfirm', { name: folderFile.name, count: relFiles.length }), [
          { text: FastCmdI18n.t('modal.cancel'), class: 'secondary', action: closeModal },
          { text: FastCmdI18n.t('modal.deleteFolderBtn'), class: 'danger', action: () => { closeModal(); performFolderDelete(folderFile, relFiles); } }
        ]);
        playSound('click');
        return;
      }
      await runFsOp(async () => {
        try { await api.deleteFile(rel); }
        catch (err) {
          console.error('[FastCmd] delete empty folder failed:', err);
          showModal('⚠️', FastCmdI18n.t('modal.deleteFailed'), FastCmdI18n.t('modal.deleteCannotFolder', { name: folderFile.name }), [
            { text: FastCmdI18n.t('modal.ok'), class: 'primary', action: closeModal }
          ]);
          playSound('error');
          return;
        }
        await finalizeFsChange('exit');
      });
    };

    const collectFolderFiles = async (rel) => {
      const api = fsAPI();
      const out = [];
      if (!api) return out;
      let entries = [];
      try { entries = await api.readDir(rel); } catch (_) { return out; }
      for (const en of entries) {
        const subRel = `${rel}/${en.name}`;
        if (en.isDirectory) { out.push(...await collectFolderFiles(subRel)); }
        else { out.push(subRel); }
      }
      return out;
    };

    const performFolderDelete = async (folderFile, relFiles) => {
      const api = fsAPI();
      if (!api) return;
      await runFsOp(async () => {
        await api.mkdir(TRASH_DIR);
        let moved = 0;
        for (const relPath of relFiles) {
          const name = relPath.split('/').pop();
          try {
            const diskName = await pickFreeName(TRASH_DIR, name);
            await api.rename(relPath, `${TRASH_DIR}/${diskName}`);
            moved++;
          } catch (err) { console.warn('[FastCmd] move file to trash failed:', relPath, err); }
        }
        let folderRemoved = false;
        const folderRel = getRelPath(folderFile);
        const remaining = (await collectFolderFiles(folderRel)).length;
        if (moved === relFiles.length && remaining === 0) {
          try { await api.deleteFile(folderRel); folderRemoved = true; }
          catch (err) { console.warn('[FastCmd] remove folder tree failed:', err); }
        }
        if (moved !== relFiles.length || !folderRemoved) {
          const msg = folderRemoved
            ? FastCmdI18n.t('modal.deleteIncompleteMsg', { moved, total: relFiles.length })
            : FastCmdI18n.t('modal.deleteIncompleteMsg', { moved, total: relFiles.length }) + ' ' + FastCmdI18n.t('modal.deleteIncompleteRemain', { n: remaining });
          showModal('⚠️', FastCmdI18n.t('modal.deleteIncomplete'), msg, [
            { text: FastCmdI18n.t('modal.ok'), class: 'primary', action: closeModal }
          ]);
          playSound('error');
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
        const name = f.name.toLowerCase();
        if (name.endsWith('.bat') || name.endsWith('.cmd') || name.endsWith('.ps1')) {
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
          await api.writeFile(subPath, content);
          await loadFilesFromDisk();
        } else {
          const id = isFolderMode ? `${currentFolderPath}/${file.name}` : file.name;
          files.push({ id, name: file.name, content, deleted: false, order: files.length, isFolder: false, parentPath: currentFolderPath });
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
