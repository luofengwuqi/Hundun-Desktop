    // ========== Render: 播放队列 (抽屉2) ==========
    const renderQueue = () => {
      const wrap = document.getElementById('queueList');
      if (!wrap) return;
      wrap.innerHTML = '';

      // 标题带计数
      const titleEl = document.querySelector('.d2-title');
      if (titleEl) {
        titleEl.textContent = MusicI18n.t('queue.title') + (queue.length ? ' · ' + queue.length : '');
      }

      if (queue.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'd2-empty';
        empty.textContent = MusicI18n.t('queue.empty');
        wrap.appendChild(empty);
        return;
      }

      queue.forEach((file, i) => {
        const item = document.createElement('div');
        item.className = 'q-item' +
          (i === queueSelectedIdx ? ' selected' : '') +
          (i === queueIndex ? ' current' : '');
        item.draggable = true;
        item.dataset.qIdx = i;
        item.dataset.file = file;
        item.innerHTML =
          '<span class="q-idx">' + (i + 1) + '</span>' +
          '<span class="q-eq"><span></span><span></span><span></span></span>' +
          '<span class="q-name"></span>' +
          '<button class="q-del" title="' + escapeHtml(MusicI18n.t('queue.remove')) + '">✕</button>';
        item.querySelector('.q-name').textContent = displayStem(file);

        item.addEventListener('click', () => {
          queueSelectedIdx = i;
          renderQueue();
        });
        item.addEventListener('dblclick', async () => {
          await playIndex(i);
        });

        item.querySelector('.q-del').addEventListener('click', async (e) => {
          e.stopPropagation();
          playSound('click');
          await removeFromQueueAt(i);
        });

        // ---------- 拖拽排序: 拖拽中只挪 DOM, 结束时按 DOM 重建队列 ----------
        item.addEventListener('dragstart', (e) => {
          draggingQueueIdx = i;
          item.classList.add('dragging');
          try {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(i));
          } catch (_) { /* ignore */ }
        });
        item.addEventListener('dragend', () => {
          item.classList.remove('dragging');
          draggingQueueIdx = -1;
          playSound('change');
          finalizeQueueDrag();
        });
        item.addEventListener('dragover', (e) => {
          if (draggingQueueIdx < 0 || draggingQueueIdx === i) return;
          e.preventDefault();
          const dragged = wrap.children[draggingQueueIdx];
          if (!dragged) return;
          if (draggingQueueIdx < i) wrap.insertBefore(dragged, item.nextSibling);
          else wrap.insertBefore(dragged, item);
          draggingQueueIdx = i;
        });

        wrap.appendChild(item);
      });
    };
