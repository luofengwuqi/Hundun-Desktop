    // ========== Toast ==========
    // 导入结果反馈 (决策58): 与 FastCmd / Music 的 toast 语义一致, 轻量、不打断操作。
    // 独立类名前缀, 避免与家族其它插件的 toast 样式串味。
    const showToast = (icon, message, duration = 2600) => {
      const container = document.getElementById('toastContainer');
      if (!container) return;
      const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

      const toast = document.createElement('div');
      toast.className = 'ftxt-toast';
      toast.innerHTML = `<span class="ftxt-toast-icon">${esc(icon)}</span>` +
        `<span class="ftxt-toast-message">${esc(message)}</span>`;
      container.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
      }, duration);
      // 同屏最多 3 条 (批量导入会连发成功 / 失败 / 跳过)
      while (container.children.length > 3) container.firstChild.remove();
    };
