    // ========== Toast ==========
    const toastContainer = () => document.getElementById('toastContainer');

    const showToast = (message, type = 'info', duration = 2400) => {
      const container = toastContainer();
      if (!container) return;
      const toast = document.createElement('div');
      toast.className = 'mc-toast ' + type;
      toast.textContent = message;
      container.appendChild(toast);
      setTimeout(() => {
        toast.classList.add('out');
        setTimeout(() => toast.remove(), 300);
      }, duration);
      // 同屏最多 3 条
      while (container.children.length > 3) container.firstChild.remove();
    };
