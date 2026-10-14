    // ========== 提醒引擎 ==========
    // 1s tick: ①截止翻转 → 状态重算 + 重排 ②提醒时间到达 → 弹窗 (窗口可见) / 系统通知 (窗口隐藏)
    // fired 记录已触发/已抑制的提醒时间点并持久化, 避免重启后重复弹出;
    // 超出 GRACE_MS 的过期提醒视为"应用未运行时错过", 静默补记 (决策44)
    let _reminderTimer = null;
    let _lastStatusSig = '';
    let _reminderQueue = [];

    const statusSignature = () =>
      TaskStore.getAll().map((t) => t.id + ':' + TaskStore.statusOf(t)).join('|');

    const startReminderLoop = () => {
      _lastStatusSig = statusSignature();
      if (_reminderTimer) return;
      _reminderTimer = setInterval(reminderTick, 1000);
    };

    const stopReminderLoop = () => {
      if (_reminderTimer) { clearInterval(_reminderTimer); _reminderTimer = null; }
    };

    const reminderTick = () => {
      try {
        // 1) 截止时间到达 → 已过期 (只在有变化时重绘)
        const sig = statusSignature();
        if (sig !== _lastStatusSig) {
          _lastStatusSig = sig;
          updateUI();
        }
        // 2) 提醒扫描
        checkReminders(Date.now());
      } catch (e) {
        console.error('[Task] reminder tick error:', e);
      }
    };

    const checkReminders = (now) => {
      let dirty = false;
      for (const task of TaskStore.getAll()) {
        if (!task.reminders.length) continue;
        for (const rt of task.reminders) {
          if (task.fired.includes(rt)) continue;
          if (task.completed) { task.fired.push(rt); dirty = true; continue; } // 已完成不再提醒
          if (now < rt) continue;
          task.fired.push(rt); dirty = true;
          if (now - rt <= TaskStore.GRACE_MS) fireReminder(task, rt);
          // 超出容忍窗口: 应用当时未运行, 静默补记 (避免启动瞬间全部弹出)
        }
      }
      if (dirty) TaskStore.persist();
    };

    const fireReminder = (task, rt) => {
      console.log('[Task] reminder fired:', task.name, new Date(rt).toISOString());
      if (!document.hidden) {
        // 窗口可见 → 应用内弹窗提醒 (规格 2.1 默认提醒方式)
        playSound('bengbeng');
        _reminderQueue.push({ name: task.name, rt });
        flushReminderQueue();
      } else {
        // 窗口隐藏 (用户在母程序) → 系统通知
        notifySystem(task.name, rt);
      }
    };

    // ========== 系统通知 (HTML5 Notification, Electron 渲染进程可用) ==========
    const notifySystem = (name, rt) => {
      try {
        if (typeof Notification === 'undefined') return;
        const title = TaskI18n.t('reminder.notifTitle');
        const body = TaskI18n.t('reminder.notifBody', { name, time: TaskStore.formatFull(rt) });
        const fire = () => { try { new Notification(title, { body }); } catch (e) { console.warn('[Task] Notification failed:', e); } };
        if (Notification.permission === 'granted') {
          fire();
        } else if (Notification.permission === 'default' && typeof Notification.requestPermission === 'function') {
          Promise.resolve(Notification.requestPermission())
            .then((p) => { if (p === 'granted') fire(); })
            .catch(() => {});
        }
      } catch (e) {
        console.warn('[Task] notifySystem error:', e);
      }
    };

    // ========== 应用内弹窗 (排队: 一次只弹一个, 关闭后继续下一个) ==========
    function flushReminderQueue() {
      if (modalVisible || !_reminderQueue.length) return;
      const item = _reminderQueue.shift();
      showModal(
        '⏰',
        TaskI18n.t('reminder.title'),
        TaskI18n.t('reminder.msg', { name: item.name, time: TaskStore.formatFull(item.rt) }),
        [{ text: TaskI18n.t('reminder.ok'), class: 'primary', action: () => { closeModal(); } }]
      );
    }
