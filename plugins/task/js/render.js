    // ========== UI Render ==========
    let _lastListSig = null; // null = 尚未渲染过 (首次必定重建, 空列表也要出空态)

    // 列表签名: 决定是否需要重建 DOM (避免每秒重绘导致卡片入场动画重放)
    const listSignature = (list) => list.map((t) =>
      [t.id, t.name, TaskStore.statusOf(t), t.deadline || '', t.reminders.join(','), t.completed].join('~')
    ).join('|');

    const updateUI = () => {
      if (currentView !== 'main') return;
      clampSelection();
      renderTaskList();
      renderFooter();
    };

    const renderTaskList = () => {
      const list = TaskStore.getSorted();
      const sig = listSignature(list);
      if (sig !== _lastListSig) {
        _lastListSig = sig;
        rebuildTaskListDOM(list);
      } else {
        updateTaskListSelection(list);
      }
    };

    const rebuildTaskListDOM = (list) => {
      const scrollTop = taskList.scrollTop; // 搬移 DOM 前捕获滚动位置 (决策34 同理)
      taskList.innerHTML = '';

      if (list.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'task-empty';
        empty.innerHTML = `
          <div class="empty-icon">📋</div>
          <div class="empty-text">${escapeHtml(TaskI18n.t('empty.title'))}</div>
          <div class="empty-hint">${escapeHtml(TaskI18n.t('empty.hint'))}</div>
        `;
        taskList.appendChild(empty);
        return;
      }

      list.forEach((task, idx) => {
        const status = TaskStore.statusOf(task);
        const card = document.createElement('div');
        card.className = `task-card status-${status}`;
        if (selectedRow === 0 && selectedCol === idx) card.classList.add('selected');
        card.dataset.taskId = task.id;

        const metaParts = [];
        if (task.deadline != null) metaParts.push(TaskI18n.t('card.due', { time: TaskStore.formatShort(task.deadline) }));
        if (task.reminders.length) metaParts.push(TaskI18n.t('card.reminders', { n: task.reminders.length }));

        card.innerHTML = `
          <div class="task-info">
            <div class="task-name">${escapeHtml(task.name)}</div>
            ${metaParts.length ? `<div class="task-meta">${escapeHtml(metaParts.join(' · '))}</div>` : ''}
          </div>
          <span class="task-status status-${status}" title="${escapeHtml(TaskI18n.t('card.toggle'))}">${escapeHtml(TaskI18n.t('status.' + status))}</span>
          <button class="task-edit-btn" title="${escapeHtml(TaskI18n.t('card.edit'))}">✎</button>
        `;

        card.addEventListener('click', () => {
          selectedRow = 0;
          selectedCol = idx;
          updateUI();
        });
        card.querySelector('.task-status').addEventListener('click', (e) => {
          e.stopPropagation();
          selectedRow = 0;
          selectedCol = idx;
          toggleCompleteFlow(task.id);
        });
        card.querySelector('.task-edit-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          selectedRow = 0;
          selectedCol = idx;
          openEditForm(task);
        });

        taskList.appendChild(card);
      });

      taskList.scrollTop = scrollTop;
    };

    const updateTaskListSelection = (list) => {
      const cards = taskList.querySelectorAll('.task-card');
      cards.forEach((card, idx) => {
        card.classList.toggle('selected', selectedRow === 0 && selectedCol === idx);
      });
    };

    // ========== 底部按钮群 ==========
    const getFooterButtons = () => ([
      { id: 'add', icon: '+', action: openCreateForm, title: TaskI18n.t('footer.create') },
      { id: 'clean', icon: '🧹', action: clearCompletedFlow, title: TaskI18n.t('footer.clean') },
    ]);

    const renderFooter = () => {
      const btns = getFooterButtons();
      if (!footerBuilt) { rebuildFooterDOM(btns); footerBuilt = true; }
      updateFooterSelection(btns);
      updateFooterInfo();
    };

    const rebuildFooterDOM = (btns) => {
      footerButtons.innerHTML = '';
      btns.forEach((btn, idx) => {
        const el = document.createElement('button');
        el.className = 'footer-btn ' + btn.id + '-btn';
        el.title = btn.title;
        el.innerHTML = `<span class="btn-icon">${btn.icon}</span>`;
        el.addEventListener('click', () => {
          selectedRow = 1;
          selectedCol = idx;
          btn.action();
        });
        footerButtons.appendChild(el);
      });
    };

    const updateFooterSelection = (btns) => {
      const els = footerButtons.querySelectorAll('.footer-btn');
      els.forEach((el, idx) => {
        el.classList.toggle('btn-focused', selectedRow === 1 && selectedCol === idx);
      });
    };

    const updateFooterInfo = () => {
      const counts = TaskStore.countByStatus();
      let text = TaskI18n.t('footer.count', { n: TaskStore.getAll().length });
      if (counts.completed > 0) text += ' ' + TaskI18n.t('footer.done', { n: counts.completed });
      taskCountEl.textContent = text;
    };

    // ========== 视图切换 (主列表 ↔ 创建/编辑表单, 同一窗口内切换, 大小一致) ==========
    const switchView = (name) => {
      currentView = name;
      viewMain.style.display = name === 'main' ? '' : 'none';
      viewForm.style.display = name === 'form' ? '' : 'none';
      setHeaderTitle();
    };

    const setHeaderTitle = () => {
      if (currentView === 'form') {
        const title = formMode === 'edit' ? TaskI18n.t('form.editTitle') : TaskI18n.t('form.createTitle');
        const chip = formMode === 'edit' ? 'EDIT' : 'NEW';
        headerTitle.innerHTML = `<span class="form-header-title">${escapeHtml(title)}</span><span class="logo-chip">${chip}</span>`;
      } else {
        headerTitle.innerHTML = `
          <span class="logo-icon">📋</span>
          <span class="logo-text">TASK</span>
          <span class="logo-chip">v1.0</span>
        `;
      }
    };

    // ========== 选区夹取 / 滚动跟随 ==========
    const clampSelection = () => {
      if (currentView !== 'main') return;
      const len = selectedRow === 0 ? TaskStore.getSorted().length : getFooterButtons().length;
      if (selectedCol >= len) selectedCol = Math.max(0, len - 1);
      if (selectedCol < 0) selectedCol = 0;
    };

    const scrollSelectionIntoView = () => {
      if (currentView !== 'main' || selectedRow !== 0) return;
      const el = taskList.querySelector('.task-card.selected');
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    };
