    // ========== Modal ==========
    const showModal = (icon, title, message, buttons) => {
      modalIconText = icon;
      modalTitleText = title;
      modalMessageText = message;
      modalButtonDefs = buttons;
      modalSelectedBtnIdx = 0;
      modalVisible = true;
      renderModal();
    };

    const closeModal = () => {
      modalVisible = false;
      modalOverlay.style.display = 'none';
      // 关闭后冲刷提醒弹窗队列 (提醒 modal 排在其他 modal 之后)
      if (typeof flushReminderQueue === 'function') flushReminderQueue();
    };

    const renderModal = () => {
      if (!modalVisible) return;
      modalOverlay.style.display = '';
      modalIcon.textContent = modalIconText;
      modalTitle.textContent = modalTitleText;
      modalMessage.textContent = modalMessageText;

      modalButtons.innerHTML = '';
      modalButtonDefs.forEach((btn, idx) => {
        const el = document.createElement('button');
        el.className = 'modal-btn';
        if (btn.class) el.className += ' ' + btn.class;
        if (idx === modalSelectedBtnIdx) el.className += ' btn-selected';
        el.textContent = btn.text;
        el.addEventListener('click', btn.action);
        modalButtons.appendChild(el);
      });
    };
