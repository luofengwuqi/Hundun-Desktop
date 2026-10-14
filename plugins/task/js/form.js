    // ========== 表单视图 (创建 / 编辑任务) + 任务操作流 ==========
    let formSnapshot = '';

    const rawFormData = () => JSON.stringify({
      n: fName.value.trim(),
      r: getReminderValues(),
      d: fDeadline.value,
      m: fMethod.value,
    });

    const isFormDirty = () => rawFormData() !== formSnapshot;
    const snapshotForm = () => { formSnapshot = rawFormData(); };

    // ========== 提醒时间行 (允许多个, 全空 = 无提醒) ==========
    const addReminderRow = (value = '') => {
      const row = document.createElement('div');
      row.className = 'reminder-row';
      row.innerHTML = `
        <input type="datetime-local" class="form-input reminder-input" />
        <button type="button" class="mini-btn danger reminder-remove" title="${escapeHtml(TaskI18n.t('form.remove'))}">×</button>
      `;
      const input = row.querySelector('.reminder-input');
      if (value) input.value = value;
      row.querySelector('.reminder-remove').addEventListener('click', () => {
        row.remove();
        updateMethodState();
        playSound('click');
      });
      reminderRows.appendChild(row);
      updateMethodState();
    };

    const setReminderRows = (values) => {
      reminderRows.innerHTML = '';
      (values && values.length ? values : ['']).forEach((v) => addReminderRow(v));
    };

    const getReminderValues = () => [...reminderRows.querySelectorAll('.reminder-input')].map((i) => i.value);

    // 提醒方式: 仅当提醒时间非空时允许填写 (规格 2.1), 默认弹窗提醒
    const updateMethodState = () => {
      const hasValue = getReminderValues().some((v) => !!v);
      methodGroup.classList.toggle('disabled', !hasValue);
      fMethod.disabled = !hasValue;
      if (!hasValue) fMethod.value = 'popup';
    };

    // ========== 打开表单 ==========
    const openCreateForm = () => {
      playSound('click');
      formMode = 'create';
      editingTaskId = null;
      fName.value = '';
      setReminderRows([]);            // 一个空提醒行, 可增可删
      fDeadline.value = '';
      fMethod.value = 'popup';
      deleteBtn.style.display = 'none';
      switchView('form');
      updateMethodState();
      snapshotForm();
      fName.focus();
    };

    const openEditForm = (task) => {
      if (!task) return;
      playSound('click');
      formMode = 'edit';
      editingTaskId = task.id;
      fName.value = task.name;
      setReminderRows(task.reminders.map(TaskStore.toLocalInput));
      fDeadline.value = task.deadline != null ? TaskStore.toLocalInput(task.deadline) : '';
      fMethod.value = task.remindMethod || 'popup';
      deleteBtn.style.display = '';
      switchView('form');
      updateMethodState();
      snapshotForm();
      fName.focus();
      // 名称整段选中, 便于直接覆盖
      if (fName.select) fName.select();
    };

    // ========== 收集 / 校验 ==========
    const collectFormData = () => {
      const reminders = getReminderValues().filter(Boolean).map(TaskStore.fromLocalInput);
      if (reminders.some((v) => !Number.isFinite(v))) return null;
      let deadline = null;
      if (fDeadline.value) {
        deadline = TaskStore.fromLocalInput(fDeadline.value);
        if (!Number.isFinite(deadline)) return null;
      }
      return {
        name: fName.value.trim(),
        reminders: reminders.filter(Number.isFinite).sort((a, b) => a - b),
        remindMethod: fMethod.value || 'popup',
        deadline,
      };
    };

    // ========== 保存 / 取消 ==========
    const saveForm = () => {
      if (currentView !== 'form') return;
      const fd = collectFormData();
      if (!fd) {
        playSound('error');
        showToast('⚠️', TaskI18n.t('toast.invalidTime'));
        return;
      }
      if (formMode === 'create') {
        const task = TaskStore.addTask(fd);
        playSound('OK');
        showToast('✅', TaskI18n.t('toast.created', { name: task ? task.name : '' }));
      } else {
        const task = TaskStore.updateTask(editingTaskId, fd);
        playSound('OK');
        showToast('✅', TaskI18n.t('toast.updated', { name: task ? task.name : '' }));
      }
      backToMainView();
    };

    const cancelForm = () => {
      if (currentView !== 'form') return;
      if (isFormDirty()) {
        showModal('⚠️', TaskI18n.t('modal.discardTitle'), TaskI18n.t('modal.discardMsg'), [
          {
            text: TaskI18n.t('modal.discardBtn'), class: 'danger',
            action: () => { closeModal(); backToMainView(); playSound('exit'); },
          },
          { text: TaskI18n.t('modal.cancel'), class: 'secondary', action: closeModal },
        ]);
        return;
      }
      backToMainView();
      playSound('exit');
    };

    const backToMainView = () => {
      switchView('main');
      formMode = null;
      editingTaskId = null;
      updateUI();
    };

    // ========== 列表级操作流 ==========
    const toggleCompleteFlow = (id) => {
      const task = TaskStore.toggleComplete(id);
      if (!task) return;
      if (task.completed) {
        playSound('OK');
        showToast('✅', TaskI18n.t('toast.completed', { name: task.name }));
      } else {
        playSound('change');
        showToast('↩', TaskI18n.t('toast.uncompleted', { name: task.name }));
      }
      updateUI();
    };

    const confirmDeleteTask = (id) => {
      const task = TaskStore.getById(id);
      if (!task) return;
      showModal('🗑', TaskI18n.t('modal.deleteTitle'), TaskI18n.t('modal.deleteMsg', { name: task.name }), [
        {
          text: TaskI18n.t('modal.deleteBtn'), class: 'danger',
          action: () => {
            TaskStore.removeTask(id);
            closeModal();
            playSound('exit');
            showToast('🗑', TaskI18n.t('toast.deleted', { name: task.name }));
            if (currentView === 'form') backToMainView();
            else updateUI();
          },
        },
        { text: TaskI18n.t('modal.cancel'), class: 'secondary', action: closeModal },
      ]);
    };

    const clearCompletedFlow = () => {
      const counts = TaskStore.countByStatus();
      if (counts.completed === 0) {
        playSound('change');
        showToast('🧹', TaskI18n.t('toast.cleanedNone'));
        return;
      }
      showModal('🧹', TaskI18n.t('modal.cleanTitle'), TaskI18n.t('modal.cleanMsg', { n: counts.completed }), [
        {
          text: TaskI18n.t('modal.cleanBtn'), class: 'danger',
          action: () => {
            const removed = TaskStore.clearCompleted();
            closeModal();
            playSound('exit');
            showToast('🧹', TaskI18n.t('toast.cleaned', { n: removed }));
            updateUI();
          },
        },
        { text: TaskI18n.t('modal.cancel'), class: 'secondary', action: closeModal },
      ]);
    };
