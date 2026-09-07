    // ========== 重名检测 ==========
    const getUniqueName = (baseName, ext) => {
      const currentFiles = isFolderMode
        ? files.filter(f => !f.deleted && f.parentPath === currentFolderPath)
        : files.filter(f => !f.deleted && !f.parentPath);
      const existingNames = new Set(currentFiles.map(f => f.name));

      let candidate = baseName + ext;
      if (!existingNames.has(candidate)) return candidate;
      return baseName + '1' + ext;
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
      const ext = type === 'txt' ? '.txt' : '.md';
      const baseName = `new_file`;
      const name = getUniqueName(baseName, ext);
      const api = fsAPI();
      const subPath = isFolderMode ? `${currentFolderPath}/${name}` : name;
      if (api) {
        await api.writeFile(subPath, '');
        await loadFilesFromDisk();
      } else {
        const id = isFolderMode ? `${currentFolderPath}/${name}` : name;
        const newFile = {
          id: id,
          name: name,
          content: '',
          deleted: false,
          order: files.length,
          isFolder: false,
          parentPath: currentFolderPath
        };
        files.push(newFile);
      }
      saveFiles();
      playSound('OK');
      // 找到刚创建的文件并打开编辑
      const newFile = files.find(f => f.name === name);
      if (newFile) {
        editingFile = newFile;
        editorContent = '';
        currentView = 'editor';
        updateUI();
        setTimeout(() => editorTextarea.focus(), 0);
      } else {
        updateUI();
      }
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
        const newFolder = {
          id: id,
          name: folderName,
          content: '',
          isFolder: true,
          deleted: false,
          order: files.length,
          parentPath: currentFolderPath
        };
        files.push(newFolder);
      }
      saveFiles();
      playSound('OK');
      updateUI();
    };
