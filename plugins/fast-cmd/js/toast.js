    // ========== Toast ==========
    let _toastTimer = null;

    const showToast = (icon, message) => {
      const container = document.getElementById('toastContainer');
      if (!container) return;
      // 清除旧 toast
      container.innerHTML = '';
      if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }

      const toast = document.createElement('div');
      toast.className = 'fcmd-toast';
      toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
      `;
      container.appendChild(toast);

      _toastTimer = setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => { container.innerHTML = ''; }, 300);
        _toastTimer = null;
      }, 3000);
    };
