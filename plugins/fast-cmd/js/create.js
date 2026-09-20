    // ========== 重名检测 ==========
    const getUniqueName = (baseName, ext) => {
      const currentFiles = isFolderMode
        ? files.filter(f => !f.deleted && f.parentPath === currentFolderPath)
        : files.filter(f => !f.deleted && !f.parentPath);
      const existingNames = new Set(currentFiles.map(f => f.name));
      let candidate = baseName + ext;
      if (!existingNames.has(candidate)) return candidate;
      let n = 1;
      let next = baseName + n + ext;
      while (existingNames.has(next)) { n++; next = baseName + n + ext; }
      return next;
    };

    // ========== Create File / Folder ==========
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
      const baseName = 'new_script';
      const name = getUniqueName(baseName, ext);
      const api = fsAPI();
      const subPath = isFolderMode ? `${currentFolderPath}/${name}` : name;
      const content = type === 'bat' ? FastCmdI18n.t('defaults.bat') : FastCmdI18n.t('defaults.ps1');
      if (api) {
        await api.writeFile(subPath, content);
        await loadFilesFromDisk();
      } else {
        const id = isFolderMode ? `${currentFolderPath}/${name}` : name;
        files.push({ id, name, content, deleted: false, order: files.length, isFolder: false, parentPath: currentFolderPath });
      }
      saveFiles();
      playSound('OK');
      updateUI();
    };

    const createFolder = async () => {
      closeCreateMenu();
      const api = fsAPI();
      const folderName = getUniqueName('NewFolder', '');
      const subPath = isFolderMode ? `${currentFolderPath}/${folderName}` : folderName;
      if (api) {
        await api.mkdir(subPath);
        await loadFilesFromDisk();
      } else {
        const id = isFolderMode ? `${currentFolderPath}/${folderName}` : folderName;
        files.push({ id, name: folderName, content: '', isFolder: true, deleted: false, order: files.length, parentPath: currentFolderPath });
      }
      saveFiles();
      playSound('OK');
      updateUI();
    };
