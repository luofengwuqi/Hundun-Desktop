    // ========== Modal (Promise 化: confirm / prompt) ==========
    const modalOverlay = () => document.getElementById('modalOverlay');

    let _modalResolve = null;
    let _modalIsPrompt = false;

    const _resolveModal = (value) => {
      const overlay = modalOverlay();
      if (overlay) overlay.style.display = 'none';
      const resolve = _modalResolve;
      _modalResolve = null;
      _modalIsPrompt = false;
      if (resolve) resolve(value);
    };

    // 确认: prompt 模式返回输入值, confirm 模式返回 true
    const _okModal = () => {
      const input = document.getElementById('modalInput');
      const v = _modalIsPrompt && input ? input.value.trim() : true;
      _resolveModal(v);
    };

    const _cancelModal = () => _resolveModal(_modalIsPrompt ? null : false);

    /**
     * 显示弹窗
     * @param {Object} opts {icon, title, message, prompt?, defaultValue?, okText?, danger?}
     * @returns {Promise<string|null|boolean>}
     */
    const showModal = (opts) => {
      return new Promise((resolve) => {
        const overlay = modalOverlay();
        if (!overlay) { resolve(opts.prompt ? null : false); return; }
        _modalResolve = resolve;
        _modalIsPrompt = !!opts.prompt;

        const icon = document.getElementById('modalIcon');
        const title = document.getElementById('modalTitle');
        const message = document.getElementById('modalMessage');
        const input = document.getElementById('modalInput');
        const buttons = document.getElementById('modalButtons');

        icon.textContent = opts.icon || '';
        title.textContent = opts.title || '';
        message.innerHTML = '';
        String(opts.message || '').split('\n').forEach((line, i) => {
          if (i > 0) message.appendChild(document.createElement('br'));
          message.appendChild(document.createTextNode(line));
        });

        if (opts.prompt) {
          input.style.display = '';
          input.value = opts.defaultValue || '';
        } else {
          input.style.display = 'none';
        }

        buttons.innerHTML = '';
        const mk = (text, cls, onClick) => {
          const b = document.createElement('button');
          b.className = 'modal-btn ' + cls;
          b.textContent = text;
          b.addEventListener('click', onClick);
          buttons.appendChild(b);
        };
        mk(MusicI18n.t('modal.cancel'), 'secondary', _cancelModal);
        mk(opts.okText || MusicI18n.t('modal.ok'), 'primary', _okModal);

        overlay.style.display = '';
        if (opts.prompt) {
          input.focus();
          input.select();
        }
      });
    };

    const isModalOpen = () => {
      const overlay = modalOverlay();
      return !!overlay && overlay.style.display !== 'none';
    };

    // Enter 确认 / Esc 取消 (捕获阶段, 优先于全局键盘处理)
    document.addEventListener('keydown', (e) => {
      if (!isModalOpen()) return;
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); _okModal(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); _cancelModal(); }
    }, true);
