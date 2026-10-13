    // ========== Event Listeners ==========
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', handleGlobalDrop);

    // Search
    searchInput.addEventListener('focus', () => { isSearchFocused = true; updateUI(); });
    searchInput.addEventListener('input', (e) => { searchQuery = e.target.value; selectedCol = 0; updateUI(); });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        searchInput.value = ''; searchQuery = ''; searchInput.blur(); isSearchFocused = false; updateUI();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault(); e.stopPropagation();
        searchInput.blur(); isSearchFocused = false; selectedRow = 0; selectedCol = 0;
        playSound('click'); updateUI();
      } else if (e.key === 'Backspace' && searchInput.value === '') {
        e.preventDefault(); e.stopPropagation();
      } else { e.stopPropagation(); }
    });
    searchInput.addEventListener('blur', () => {
      setTimeout(() => { if (document.activeElement !== searchInput) { isSearchFocused = false; updateUI(); } }, 150);
    });

    // File list drag
    fileList.addEventListener('dragover', handleListDragOver);
    fileList.addEventListener('drop', handleListDrop);

    // Trash zone
    trashZone.addEventListener('dragover', (e) => { e.preventDefault(); isTrashDragOver = true; trashZone.classList.add('drag-over'); });
    trashZone.addEventListener('dragleave', () => { isTrashDragOver = false; trashZone.classList.remove('drag-over'); });
    trashZone.addEventListener('drop', handleTrashDrop);

    // Shredder zone
    shredderZone.addEventListener('dragover', (e) => { e.preventDefault(); isShredderDragOver = true; shredderZone.classList.add('drag-over'); });
    shredderZone.addEventListener('dragleave', () => { isShredderDragOver = false; shredderZone.classList.remove('drag-over'); });
    shredderZone.addEventListener('drop', handleShredderDrop);

    // Close buttons
    closeBtn.addEventListener('click', returnToParent);

    // Modal overlay click to close
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
    createMenuOverlay.addEventListener('click', (e) => { if (e.target === createMenuOverlay) closeCreateMenu(); });

    // 创建菜单选项 (按钮由 renderCreateMenu 按平台动态生成并各自绑定点击)
    createMenuCancel.addEventListener('click', closeCreateMenu);

    // Global keyboard
    document.addEventListener('keydown', handleKeydown);
