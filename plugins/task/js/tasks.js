    // ========== 任务数据模型 ==========
    // 持久化: hundun.storage (主进程 JSON, 原子写 + 防抖 + 退出 flush), 见决策43。
    // SQLite 已审核否决: 生产包不含 node_modules (原生模块无法分发)、
    // 决策8 明确规避原生编译、插件层无 DB 通道、个人任务清单规模 JSON 完全够用。
    const TaskStore = (() => {
      const STORAGE_KEY = 'tasks';
      const GRACE_MS = 120000; // 提醒容忍窗口: 超过视为"应用未运行时错过", 静默补记不弹出

      let data = { version: 1, tasks: [] };

      // ---------- 格式化 ----------
      const pad2 = (n) => String(n).padStart(2, '0');

      // datetime-local 输入值 (本地时间, 分钟精度)
      const toLocalInput = (ms) => {
        const d = new Date(ms);
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      };

      // datetime-local 值 → epoch ms (非法返回 NaN)
      const fromLocalInput = (s) => {
        if (!s) return null;
        const v = Date.parse(s);
        return Number.isFinite(v) ? v : NaN;
      };

      // 卡片 meta 用短格式: 10-20 18:00
      const formatShort = (ms) => {
        const d = new Date(ms);
        return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      };

      // 提醒消息用完整格式: 2026-10-20 18:00
      const formatFull = (ms) => {
        const d = new Date(ms);
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      };

      // ---------- 状态计算 (完成 > 过期 > 未完成) ----------
      const statusOf = (task, now = Date.now()) => {
        if (task.completed) return 'completed';
        if (task.deadline != null && now >= task.deadline) return 'expired';
        return 'pending';
      };

      // 排序: 未完成(截止近的优先, 无截止排未完成末尾) > 已过期 > 已完成
      const getSorted = (now = Date.now()) => {
        const rank = (t) => { const s = statusOf(t, now); return s === 'pending' ? 0 : s === 'expired' ? 1 : 2; };
        return [...data.tasks].sort((a, b) => {
          const ra = rank(a), rb = rank(b);
          if (ra !== rb) return ra - rb;
          if (ra === 0) {
            const da = a.deadline == null ? Infinity : a.deadline;
            const db = b.deadline == null ? Infinity : b.deadline;
            if (da !== db) return da - db;
            return a.createdAt - b.createdAt;
          }
          if (ra === 1) return (b.deadline || 0) - (a.deadline || 0);   // 最近过期在前
          return (b.completedAt || 0) - (a.completedAt || 0);           // 最近完成在前
        });
      };

      // ---------- 自动命名: task + 最小未占用数字 ----------
      // exclude: 更新场景排除自身旧名 (清空名字重新自动命名时不会跳号)
      const autoName = (exclude = null) => {
        const used = new Set(data.tasks.filter((t) => t !== exclude).map((t) => t.name.toLowerCase()));
        let n = 1;
        while (used.has('task' + n)) n++;
        return 'task' + n;
      };

      // ---------- 规范化 (防御外部数据损坏) ----------
      const normalizeTask = (raw) => {
        if (!raw || typeof raw !== 'object') return null;
        const arr = (v) => (Array.isArray(v) ? [...new Set(v.filter((x) => Number.isFinite(x)))].sort((a, b) => a - b) : []);
        return {
          id: typeof raw.id === 'string' && raw.id ? raw.id : 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
          name: typeof raw.name === 'string' ? raw.name.trim() : '',
          deadline: Number.isFinite(raw.deadline) ? raw.deadline : null,
          reminders: arr(raw.reminders),
          remindMethod: raw.remindMethod === 'popup' ? 'popup' : 'popup', // 其他方式待补充
          completed: !!raw.completed,
          completedAt: Number.isFinite(raw.completedAt) ? raw.completedAt : null,
          createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
          updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now(),
          fired: arr(raw.fired),
        };
      };

      // ---------- 持久化 ----------
      const storageApi = () => (window.hundun && window.hundun.storage ? window.hundun.storage : null);

      const persist = () => {
        const api = storageApi();
        if (api) {
          try {
            const p = api.set(STORAGE_KEY, JSON.parse(JSON.stringify(data)));
            if (p && typeof p.catch === 'function') p.catch((e) => console.error('[Task] storage.set failed:', e));
          } catch (e) { console.error('[Task] storage.set failed:', e); }
        }
        // localStorage 镜像: storage API 不可用 (旧宿主/降级) 时的兜底, 不作为主数据源
        try { localStorage.setItem('task-data', JSON.stringify(data)); } catch (e) { /* ignore */ }
      };

      const load = async () => {
        let raw = null;
        const api = storageApi();
        if (api) {
          try { raw = await api.get(STORAGE_KEY, null); } catch (e) { console.error('[Task] storage.get failed:', e); }
        }
        if (raw == null) {
          try { const ls = localStorage.getItem('task-data'); if (ls) raw = JSON.parse(ls); } catch (e) { /* ignore */ }
        }
        if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (e) { raw = null; } }

        data = { version: 1, tasks: [] };
        if (raw && Array.isArray(raw.tasks)) {
          data.tasks = raw.tasks.map(normalizeTask).filter(Boolean);
        }
        // 空名任务补自动名 (须在全部任务就位后)
        data.tasks.forEach((t) => { if (!t.name) t.name = autoName(); });
      };

      // ---------- CRUD ----------
      const getAll = () => data.tasks;
      const getById = (id) => data.tasks.find((t) => t.id === id) || null;

      const addTask = ({ name, reminders = [], remindMethod = 'popup', deadline = null }) => {
        const now = Date.now();
        const task = normalizeTask({
          id: 't' + now.toString(36) + Math.random().toString(36).slice(2, 6),
          name: name && name.trim() ? name.trim() : '',
          reminders, remindMethod, deadline,
          completed: false, createdAt: now, updatedAt: now, fired: [],
        });
        if (!task) return null;
        if (!task.name) task.name = autoName(); // autoName 依赖现有列表, 须 push 前先算
        data.tasks.push(task);
        persist();
        return task;
      };

      const updateTask = (id, patch) => {
        const task = getById(id);
        if (!task) return null;
        if (patch.name !== undefined) {
          const nn = String(patch.name).trim();
          task.name = nn || autoName(task); // 编辑时清空 → 重新自动命名
        }
        if (patch.deadline !== undefined) task.deadline = patch.deadline;
        if (patch.reminders !== undefined) task.reminders = [...new Set(patch.reminders.filter(Number.isFinite))].sort((a, b) => a - b);
        if (patch.remindMethod !== undefined) task.remindMethod = patch.remindMethod;
        task.updatedAt = Date.now();
        persist();
        return task;
      };

      const removeTask = (id) => {
        const before = data.tasks.length;
        data.tasks = data.tasks.filter((t) => t.id !== id);
        if (data.tasks.length !== before) { persist(); return true; }
        return false;
      };

      const toggleComplete = (id) => {
        const task = getById(id);
        if (!task) return null;
        task.completed = !task.completed;
        task.completedAt = task.completed ? Date.now() : null;
        task.updatedAt = Date.now();
        persist();
        return task;
      };

      const clearCompleted = () => {
        const before = data.tasks.length;
        data.tasks = data.tasks.filter((t) => !t.completed);
        const removed = before - data.tasks.length;
        if (removed) persist();
        return removed;
      };

      const countByStatus = (now = Date.now()) => {
        const c = { pending: 0, expired: 0, completed: 0 };
        data.tasks.forEach((t) => { c[statusOf(t, now)]++; });
        return c;
      };

      return {
        load, persist, getAll, getById, addTask, updateTask, removeTask,
        toggleComplete, clearCompleted, statusOf, getSorted, autoName,
        countByStatus, toLocalInput, fromLocalInput, formatShort, formatFull,
        GRACE_MS,
      };
    })();
