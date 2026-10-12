    // ========== 重名检测 ==========
    const getUniqueName = (baseName, ext) => {
      const existingNames = new Set(getActiveFiles().map(f => f.name));
      let candidate = baseName + ext;
      if (!existingNames.has(candidate)) return candidate;
      let n = 1;
      let next = baseName + n + ext;
      while (existingNames.has(next)) { n++; next = baseName + n + ext; }
      return next;
    };

    // ========== Create File ==========
    const showCreateMenu = () => {
      playSound('click');
      createMenuSelectedIdx = 0;
      showCreateMenuVisible = true;
      renderCreateMenu();
    };

    const closeCreateMenu = () => {
      showCreateMenuVisible = false;
      createMenuOverlay.style.display = 'none';
    };

    const renderCreateMenu = () => {
      if (!showCreateMenuVisible) return;
      createMenuOverlay.style.display = '';
      const options = createOptions.querySelectorAll('.create-option');
      options.forEach((opt, idx) => {
        opt.classList.toggle('btn-selected', idx === createMenuSelectedIdx);
      });
    };

    const createFile = async (type) => {
      closeCreateMenu();
      const ext = type === 'bat' ? '.bat' : '.ps1';
      const name = getUniqueName('new_script', ext);
      const api = fsAPI();
      const content = type === 'bat' ? FastCmdI18n.t('defaults.bat') : FastCmdI18n.t('defaults.ps1');
      if (api) {
        await api.writeFile(name, content);
        await loadFilesFromDisk();
      } else {
        files.push({ id: name, name, content, deleted: false, order: files.length, isFolder: false });
      }
      saveFiles();
      playSound('OK');
      updateUI();
    };
