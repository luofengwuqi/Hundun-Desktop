    // ========== Event Listeners ==========
    // 头部
    closeBtn.addEventListener('click', returnToParent);
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

    // 表单
    addReminderBtn.addEventListener('click', () => { addReminderRow(); playSound('click'); fName.blur(); });
    reminderRows.addEventListener('input', updateMethodState);   // 委托: 提醒时间变化 → 解锁提醒方式
    clearDeadlineBtn.addEventListener('click', () => {
      fDeadline.value = '';
      playSound('click');
      fName.blur();
    });
    saveBtn.addEventListener('click', saveForm);
    cancelBtn.addEventListener('click', cancelForm);
    deleteBtn.addEventListener('click', () => { if (editingTaskId) confirmDeleteTask(editingTaskId); });

    // 全局键盘
    document.addEventListener('keydown', handleKeydown);
