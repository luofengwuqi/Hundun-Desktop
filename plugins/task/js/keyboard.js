    // ========== Global Keyboard ==========
    const handleKeydown = (e) => {
      let key = e.key;

      // ---------- Modal 打开: 优先拦截 ----------
      if (modalVisible) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (key === 'w' || key === 'W') key = 'ArrowUp';
        if (key === 's' || key === 'S') key = 'ArrowDown';
        if (key === 'a' || key === 'A') key = 'ArrowLeft';
        if (key === 'd' || key === 'D') key = 'ArrowRight';
        if (key === 'Escape') { closeModal(); playSound('click'); }
        else if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
          playSound('click');
          if (key === 'ArrowUp') modalSelectedBtnIdx = modalButtonDefs.length - 1;
          else if (key === 'ArrowDown') modalSelectedBtnIdx = 0;
          else if (key === 'ArrowLeft') modalSelectedBtnIdx = Math.max(0, modalSelectedBtnIdx - 1);
          else if (key === 'ArrowRight') modalSelectedBtnIdx = Math.min(modalButtonDefs.length - 1, modalSelectedBtnIdx + 1);
          renderModal();
        } else if (key === 'Enter' || key === ' ') {
          playSound('click');
          const btn = modalButtonDefs[modalSelectedBtnIdx];
          if (btn && btn.action) btn.action();
        }
        return;
      }

      // ---------- 表单视图: 只响应 Esc / 输入框回车, 不劫持输入 ----------
      if (currentView === 'form') {
        if (key === 'Escape') {
          e.preventDefault();
          cancelForm();
          return;
        }
        if (key === 'Enter' && e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
          e.preventDefault();
          saveForm();
          return;
        }
        return; // 其余按键 (含 WASD) 全部交给表单控件
      }

      // ---------- 主视图: WASD → 方向键映射 (项目键盘规范) ----------
      let mappedKey = key;
      if (mappedKey === 'w' || mappedKey === 'W') mappedKey = 'ArrowUp';
      if (mappedKey === 's' || mappedKey === 'S') mappedKey = 'ArrowDown';
      if (mappedKey === 'a' || mappedKey === 'A') mappedKey = 'ArrowLeft';
      if (mappedKey === 'd' || mappedKey === 'D') mappedKey = 'ArrowRight';
      if (mappedKey === ' ') mappedKey = 'Enter';

      if (key === 'Escape') {
        e.preventDefault();
        returnToParent();
        return;
      }

      switch (mappedKey) {
        case 'ArrowUp': {
          e.preventDefault();
          if (selectedRow === 1) {
            selectedRow = 0;
            const len = TaskStore.getSorted().length;
            selectedCol = Math.min(selectedCol, Math.max(0, len - 1));
          } else if (selectedCol > 0) {
            selectedCol--;
          }
          playSound('click');
          updateUI();
          scrollSelectionIntoView();
          break;
        }

        case 'ArrowDown': {
          e.preventDefault();
          if (selectedRow === 0) {
            const len = TaskStore.getSorted().length;
            if (selectedCol < len - 1) {
              selectedCol++;
            } else {
              selectedRow = 1;
              selectedCol = Math.min(selectedCol, getFooterButtons().length - 1);
            }
          }
          playSound('click');
          updateUI();
          break;
        }

        case 'ArrowLeft': {
          e.preventDefault();
          if (selectedRow === 1 && selectedCol > 0) selectedCol--;
          playSound('click');
          updateUI();
          break;
        }

        case 'ArrowRight': {
          e.preventDefault();
          if (selectedRow === 1 && selectedCol < getFooterButtons().length - 1) selectedCol++;
          playSound('click');
          updateUI();
          break;
        }

        case 'E':
        case 'e': {
          e.preventDefault();
          if (selectedRow === 0) {
            const task = TaskStore.getSorted()[selectedCol];
            if (task) openEditForm(task);
          }
          break;
        }

        case 'Delete':
        case 'Backspace': {
          e.preventDefault();
          if (selectedRow === 0) {
            const task = TaskStore.getSorted()[selectedCol];
            if (task) confirmDeleteTask(task.id);
          }
          break;
        }

        case 'Enter': {
          e.preventDefault();
          if (selectedRow === 0) {
            const task = TaskStore.getSorted()[selectedCol];
            if (task) toggleCompleteFlow(task.id);
          } else {
            const btn = getFooterButtons()[selectedCol];
            if (btn) btn.action();
          }
          break;
        }
      }
    };
