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
      // 选项随平台而定 (Windows: .bat/.ps1, Linux: .sh), 动态渲染 (决策42)
      createOptions.innerHTML = '';
      FastCmdPlatform.createTypes.forEach((type, idx) => {
        const meta = FastCmdPlatform.CREATE_TYPES[type];
        const btn = document.createElement('button');
        btn.className = 'create-option' + (idx === createMenuSelectedIdx ? ' btn-selected' : '');
        btn.dataset.type = type;
        btn.innerHTML = `<span class="create-icon">${meta.icon}</span><span class="create-label">${FastCmdI18n.t(meta.labelKey)}</span>`;
        btn.addEventListener('click', () => createFile(type));
        createOptions.appendChild(btn);
      });
    };

    const createFile = async (type) => {
      const meta = FastCmdPlatform.CREATE_TYPES[type];
      if (!meta || !FastCmdPlatform.createTypes.includes(type)) return;
      closeCreateMenu();
      const name = getUniqueName('new_script', meta.ext);
      const api = fsAPI();
      const content = FastCmdI18n.t(meta.defaultsKey);
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
