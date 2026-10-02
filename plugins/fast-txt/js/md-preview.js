    // ========== Markdown 浏览/编辑模式 (Typora 式实时渲染) ==========
    // 依赖: js/vendor/marked → 实际为 markdown-it (window.markdownit)
    //
    // 架构:
    //   editorContent 仍是唯一事实源。
    //   浏览模式把文档按 markdown-it 顶层 token 的 map 切成连续行区间(块),
    //   光标所在块内嵌一个持久 textarea 显示源码, 其余块渲染为 HTML。
    //   输入 → 回写 editorContent → 防抖重解析 → 按光标重新定位活动块,
    //   实现 "输入 # 标题, 光标离开后即成标题" 的实时渲染体验。
    //   编辑模式 = 原有纯源码 textarea 视图 (行号/书签/查找替换全部可用)。

    const mdParser = (typeof markdownit !== 'undefined')
      // html:false → 原始 HTML 转义, 防注入
      // breaks:true → GitHub 风格软换行, 段落内单个换行直接渲染为 <br>
      //   (不再要求行尾两个空格或反斜杠; 行尾双空格硬换行仍然有效)
      //   仅作用于内联渲染, 不改变块级解析 → 分块/活动块定位不受影响
      ? markdownit({ html: false, linkify: true, breaks: true })
      : null;

    const mdPreviewEl = document.getElementById('mdPreview');
    const mdModeSwitchEl = document.getElementById('mdModeSwitch');

    // 持久源码 textarea: 在活动块之间移动复用 (避免重建破坏输入法/光标)
    const mdTa = document.createElement('textarea');
    mdTa.className = 'md-src';
    mdTa.spellcheck = false;
    mdTa.setAttribute('aria-label', 'markdown source');

    let mdMode = 'edit';   // 'browse' | 'edit' (仅 .md 文件生效)
    let mdActive = null;   // {start, end} 活动块在 editorContent 中的行区间 [start, end)
    let mdRenderTimer = null;
    let mdComposing = false; // 输入法组合中 (跳过重渲染)
    const MD_DEBOUNCE = 80;

    // ========== 基础工具 ==========
    const isMdFile = (f) => !!f && !f.isFolder && /\.md$/i.test(f.name);
    const isMdBrowse = () => currentView === 'editor' && !!editingFile && isMdFile(editingFile) && mdMode === 'browse';
    const mdHasActiveBlock = () => !!mdActive; // 浏览模式下是否有正在编辑的块

    const mdLineHeight = () => editorFontSize * 1.8; // 与主 textarea 行高一致

    const getTaCaret = (ta) => {
      const upTo = ta.value.slice(0, ta.selectionStart);
      return {
        line: upTo.split('\n').length - 1,
        col: ta.selectionStart - (upTo.lastIndexOf('\n') + 1),
      };
    };

    const setTaCaret = (ta, line, col) => {
      const arr = ta.value.split('\n');
      const li = Math.max(0, Math.min(line, arr.length - 1));
      const cl = Math.max(0, Math.min(col, arr[li].length));
      let off = 0;
      for (let i = 0; i < li; i++) off += arr[i].length + 1;
      off += cl;
      ta.setSelectionRange(off, off);
    };

    // ========== 分块: markdown-it token map → 连续行区间 ==========
    const computeMdBlocks = (lines) => {
      if (!mdParser || lines.length === 0) return [{ start: 0, end: Math.max(1, lines.length) }];
      const tokens = mdParser.parse(lines.join('\n'), {});
      const blocks = [];
      let i = 0;
      while (i < tokens.length) {
        const t = tokens[i];
        if (t.nesting === 1) {
          // 成对 open/close: 整个结构(列表/引用/表格等)作为一个块
          let depth = 0, j = i;
          for (; j < tokens.length; j++) {
            depth += tokens[j].nesting;
            if (depth === 0) break;
          }
          if (t.map) blocks.push({ start: t.map[0], end: t.map[1] });
          i = j + 1;
        } else if (t.nesting === 0) {
          // 自闭合块 (heading/fence/hr/html_block...) — inline 由所属块覆盖
          if (t.map && t.type !== 'inline') blocks.push({ start: t.map[0], end: t.map[1] });
          i++;
        } else {
          i++; // 孤立 close (不应出现)
        }
      }
      if (blocks.length === 0) return [{ start: 0, end: lines.length }];
      // 归一化: 块间的空行归入前一块(开头空行归入首块), 保证 [0, lines.length) 全覆盖
      // → 任意光标行都必然落在某个块内, 活动块定位无死角
      blocks[0].start = 0;
      for (let k = 0; k < blocks.length - 1; k++) blocks[k].end = blocks[k + 1].start;
      blocks[blocks.length - 1].end = lines.length;
      return blocks;
    };

    // ========== 渲染缓存 (source → html) ==========
    const mdHtmlCache = new Map();
    const MD_CACHE_MAX = 300;
    const renderMdHtml = (source) => {
      let html = mdHtmlCache.get(source);
      if (html === undefined) {
        html = mdParser ? mdParser.render(source) : escapeHtml(source);
        if (mdHtmlCache.size >= MD_CACHE_MAX) mdHtmlCache.clear();
        mdHtmlCache.set(source, html);
      }
      return html;
    };

    // ========== 主渲染 ==========
    const renderMdPreview = () => {
      if (!mdPreviewEl || !mdParser || !isMdBrowse()) return;
      const lines = editorContent.split('\n');
      const blocks = computeMdBlocks(lines);

      // 活动块光标 → 全局行 (用于重新定位活动块)
      let caretGlobal = null;
      let prevLocal = null;
      if (mdActive) {
        prevLocal = getTaCaret(mdTa);
        caretGlobal = Math.max(0, Math.min(mdActive.start + prevLocal.line, lines.length - 1));
      }

      let activeIdx = -1;
      if (caretGlobal !== null) {
        activeIdx = blocks.findIndex((b) => caretGlobal >= b.start && caretGlobal < b.end);
        if (activeIdx < 0) activeIdx = 0;
      }

      const hadFocus = document.activeElement === mdTa;

      // 收集旧块 DOM (source → el) 供复用; 含 textarea 的旧活动块单独处理
      const oldActiveEl = (mdTa.parentNode && mdTa.parentNode.classList
        && mdTa.parentNode.classList.contains('md-block')) ? mdTa.parentNode : null;
      const reusable = new Map();
      Array.from(mdPreviewEl.children).forEach((el) => {
        if (el === oldActiveEl) return;
        const s = el.__mdSource;
        if (typeof s === 'string') {
          if (!reusable.has(s)) reusable.set(s, []);
          reusable.get(s).push(el);
        }
      });

      // 目标活动块 (若与旧活动块同起点 → 原地复用, 不移动 mdTa, 焦点/光标零打扰)
      const targetActive = activeIdx >= 0 ? blocks[activeIdx] : null;
      const reuseActiveEl = (oldActiveEl && targetActive
        && +oldActiveEl.dataset.start === Math.max(0, Math.min(targetActive.start, lines.length - 1)));

      // ⚠️ 滚动位置 + 锚点必须在移动 DOM 之前捕获:
      //   下面构建 frag 时, 复用的旧块元素会被 appendChild 搬进游离 fragment,
      //   预览容器被搬空 → Chromium 立即把 scrollTop 钳为 0;
      //   若像旧代码那样"构建完再读 scrollTop", 读到的已经是 0 → 点击后整屏跳回文档顶部。
      const st = mdPreviewEl.scrollTop;
      const contTop = mdPreviewEl.getBoundingClientRect().top;
      // 以目标活动块(用户点击/光标所在的块)为锚: 重建后把它的顶边拉回原视觉位置
      let anchorTop = null;
      if (activeIdx >= 0) {
        const anchorStart = Math.max(0, Math.min(blocks[activeIdx].start, lines.length - 1));
        const anchorEl = mdPreviewEl.querySelector('.md-block[data-start="' + anchorStart + '"]');
        if (anchorEl) anchorTop = anchorEl.getBoundingClientRect().top - contTop;
      }

      const frag = document.createDocumentFragment();
      blocks.forEach((b, idx) => {
        const start = Math.max(0, Math.min(b.start, lines.length - 1));
        const end = Math.max(start + 1, Math.min(b.end, lines.length));
        const source = lines.slice(start, end).join('\n');
        let el;
        if (idx === activeIdx) {
          el = reuseActiveEl ? oldActiveEl : document.createElement('div');
          el.className = 'md-block is-active';
          if (mdTa.value !== source) {
            // 外部内容变化(撤销/重做等) → 同步源码并尽量保持局部光标
            mdTa.value = source;
            if (prevLocal) setTaCaret(mdTa, prevLocal.line, prevLocal.col);
          }
          fitMdTa();
          if (mdTa.parentNode !== el) el.appendChild(mdTa);
        } else {
          const pool = reusable.get(source);
          el = (pool && pool.length) ? pool.pop() : document.createElement('div');
          el.className = 'md-block';
          if (!el.firstChild) el.innerHTML = renderMdHtml(source); // 新建 → 渲染
        }
        el.dataset.start = start;
        el.dataset.end = end;
        el.__mdSource = source;
        frag.appendChild(el);
      });

      mdPreviewEl.textContent = '';
      mdPreviewEl.appendChild(frag);
      mdPreviewEl.scrollTop = st;

      if (activeIdx >= 0) {
        const el = mdPreviewEl.children[activeIdx]; // appendChild 已把子节点从 frag 移入预览容器
        mdActive = { start: +el.dataset.start, end: +el.dataset.end };
        // 锚点校正: 活动块由"渲染态↔源码态"互换会改变上方块高度, 补偿位移保证点哪里显示哪里
        if (anchorTop !== null) {
          const newTop = el.getBoundingClientRect().top - mdPreviewEl.getBoundingClientRect().top;
          const delta = newTop - anchorTop;
          if (delta) mdPreviewEl.scrollTop = st + delta;
        }
        // DOM 移动可能夺走焦点 → 恢复 (选区不受影响)
        if (hadFocus && document.activeElement !== mdTa) mdTa.focus({ preventScroll: true });
      } else {
        mdActive = null;
      }
    };

    const scheduleMdRender = (immediate) => {
      if (mdRenderTimer) { clearTimeout(mdRenderTimer); mdRenderTimer = null; }
      if (immediate) { renderMdPreview(); return; }
      if (mdComposing) return; // 输入法组合中不重渲染, compositionend 会补一次立即渲染
      mdRenderTimer = setTimeout(() => { mdRenderTimer = null; renderMdPreview(); }, MD_DEBOUNCE);
    };

    // ========== 源码 textarea 自适应高度 / 缩放同步 ==========
    const fitMdTa = () => {
      const lh = mdLineHeight();
      const n = mdTa.value.split('\n').length;
      mdTa.style.fontSize = editorFontSize + 'px';
      mdTa.style.lineHeight = lh + 'px';
      mdTa.style.height = (n * lh) + 'px';
    };

    // 等宽字符宽度 (点击位置 → 列号估算)
    let _mdCharW = null, _mdCharWSize = -1;
    const mdCharWidth = () => {
      if (_mdCharW && _mdCharWSize === editorFontSize) return _mdCharW;
      const span = document.createElement('span');
      span.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font-family:"Courier New",monospace;font-size:' + editorFontSize + 'px;';
      span.textContent = 'M'.repeat(40);
      document.body.appendChild(span);
      _mdCharW = span.getBoundingClientRect().width / 40 || 8;
      _mdCharWSize = editorFontSize;
      span.remove();
      return _mdCharW;
    };

    // ========== 活动块 ==========
    const activateMdBlock = (start, end, line, col) => {
      const lines = editorContent.split('\n');
      if (lines.length === 0) return;
      const s = Math.max(0, Math.min(start, lines.length - 1));
      const e = Math.max(s + 1, Math.min(end, lines.length));
      const source = lines.slice(s, e).join('\n');
      if (mdTa.value !== source) mdTa.value = source;
      mdActive = { start: s, end: e };
      setTaCaret(mdTa, line || 0, col || 0); // 先设光标, 让 render 的全局行定位正确
      fitMdTa();
      scheduleMdRender(true);
      mdTa.focus({ preventScroll: true });
    };

    // 输入回写: 活动块行区间替换 (textarea 行数变化 → 区间随之伸缩)
    const onMdTaInput = () => {
      if (!mdActive) return;
      pushUndoState(); // 与主 textarea 相同的撤销栈模式
      const newLines = mdTa.value.split('\n');
      const lines = editorContent.split('\n');
      const start = mdActive.start;
      const oldEnd = Math.min(mdActive.end, lines.length);
      editorContent = lines.slice(0, start).concat(newLines, lines.slice(oldEnd)).join('\n');
      mdActive.end = start + newLines.length;
      fitMdTa();
      renderEditorStatus();   // 行数/字符/字数实时刷新
      scheduleMdRender();     // 防抖重解析 (输入法组合期间跳过)
    };

    // ========== 模式切换 ==========
    const setMdModeUi = (mode) => {
      if (!mdModeSwitchEl) return;
      mdModeSwitchEl.querySelectorAll('.md-mode-seg').forEach((seg) => {
        seg.classList.toggle('active', seg.dataset.mode === mode);
      });
    };

    // 浏览模式接管编辑器视图
    const enterMdBrowse = (mapCaret) => {
      let caretLine = null, caretCol = 0;
      if (mapCaret) {
        const lc = getTaCaret(editorTextarea);
        caretLine = lc.line;
        caretCol = lc.col;
      }
      if (findBarVisible) closeFindBar(); // 查找/替换只在编辑模式工作
      lineNumbers.style.display = 'none';
      editorTextarea.style.display = 'none';
      mdPreviewEl.style.display = '';
      mdMode = 'browse';
      setMdModeUi('browse');

      if (caretLine !== null) {
        // 从编辑模式切入: 光标所在行 → 激活对应块, 编辑不中断
        const lines = editorContent.split('\n');
        const blocks = computeMdBlocks(lines);
        const b = blocks.find((x) => caretLine >= x.start && caretLine < x.end) || blocks[0];
        activateMdBlock(b.start, b.end, caretLine - b.start, caretCol);
      } else {
        mdActive = null;
        mdTa.value = '';
        scheduleMdRender(true);
      }
    };

    // 编辑模式: 恢复纯源码视图, 光标从活动块映射回来
    const enterMdEdit = () => {
      let line = 0, col = 0;
      if (mdActive) {
        const lc = getTaCaret(mdTa);
        line = mdActive.start + lc.line;
        col = lc.col;
      }
      if (mdRenderTimer) { clearTimeout(mdRenderTimer); mdRenderTimer = null; }
      mdPreviewEl.style.display = 'none';
      mdActive = null;
      mdTa.value = '';
      lineNumbers.style.display = '';
      editorTextarea.style.display = '';
      mdMode = 'edit';
      setMdModeUi('edit');
      editorTextarea.value = editorContent;
      renderEditorStatus();
      renderLineNumbers();
      setTaCaret(editorTextarea, line, col);
      editorTextarea.focus();
    };

    const setMdMode = (mode) => {
      if (!editingFile || !isMdFile(editingFile)) return;
      if (mode === mdMode) { setMdModeUi(mode); return; }
      if (mode === 'browse') enterMdBrowse(true);
      else enterMdEdit();
    };

    // 打开文件时初始化: .md → 默认浏览; 其他 → 标准视图
    const initMdForCurrentFile = () => {
      if (!editingFile) return;
      if (isMdFile(editingFile)) {
        mdModeSwitchEl.style.display = '';
        enterMdBrowse(false);
      } else {
        mdModeSwitchEl.style.display = 'none';
        ensureStandardEditorView();
      }
    };

    const ensureStandardEditorView = () => {
      if (mdRenderTimer) { clearTimeout(mdRenderTimer); mdRenderTimer = null; }
      mdMode = 'edit';
      if (mdPreviewEl) mdPreviewEl.style.display = 'none';
      if (mdModeSwitchEl) mdModeSwitchEl.style.display = 'none';
      mdActive = null;
      mdTa.value = '';
      lineNumbers.style.display = '';
      editorTextarea.style.display = '';
    };

    // 关闭编辑器 → 完全复位
    const resetMdEditor = () => ensureStandardEditorView();

    // 撤销/重做等外部内容变化 → 立即同步渲染
    const refreshMdAfterExternalChange = () => {
      if (isMdBrowse()) scheduleMdRender(true);
    };

    // 浏览模式下滚动到指定源码行所在块 (书签跳转用)
    const scrollMdToLine = (line) => {
      if (!mdPreviewEl) return;
      const els = mdPreviewEl.querySelectorAll('.md-block[data-start]');
      for (const el of els) {
        const s = +el.dataset.start, e = +el.dataset.end;
        if (line >= s && line < e) {
          mdPreviewEl.scrollTop = Math.max(0, el.offsetTop - 24);
          return;
        }
      }
    };

    // ========== 事件绑定 ==========
    if (mdPreviewEl) {
      // 点击渲染块 → 激活为源码编辑; 点击链接 → 系统浏览器打开
      mdPreviewEl.addEventListener('click', (e) => {
        const a = e.target.closest && e.target.closest('a[href]');
        if (a) {
          e.preventDefault();
          const href = a.getAttribute('href') || '';
          if (/^https?:\/\//i.test(href)) {
            try { require('electron').ipcRenderer.invoke('app:openExternal', href); } catch (_) {}
          }
          return;
        }
        if (mdTa.contains(e.target)) return; // 正在编辑的源码区 → 原生光标行为

        const blockEl = e.target.closest && e.target.closest('.md-block');
        if (!blockEl) return;
        const start = +blockEl.dataset.start;
        const end = +blockEl.dataset.end;
        const lines = editorContent.split('\n');
        const rect = blockEl.getBoundingClientRect();
        const lh = mdLineHeight();
        const PAD_TOP = 2; // .md-block padding-top

        // 点击坐标 → 源码行/列 (行按等高估算, 列按等宽字符估算)
        const localLine = Math.max(0, Math.min(Math.floor((e.clientY - rect.top - PAD_TOP) / lh), end - start - 1));
        const srcLine = lines[Math.min(start + localLine, lines.length - 1)] || '';
        const col = Math.max(0, Math.min(Math.round((e.clientX - rect.left - 8) / mdCharWidth()), srcLine.length));

        if (mdActive && mdActive.start === start && mdActive.end === end) {
          // 已是活动块: 只重设光标
          setTaCaret(mdTa, localLine, col);
          mdTa.focus({ preventScroll: true });
          return;
        }
        activateMdBlock(start, end, localLine, col);
      });

      // 浏览模式下 Ctrl+滚轮缩放字号 (与主 textarea 逻辑一致)
      mdPreviewEl.addEventListener('wheel', (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        const MIN = 8, MAX = 32;
        const delta = e.deltaY > 0 ? -1 : 1;
        const newSize = Math.min(MAX, Math.max(MIN, editorFontSize + delta));
        if (newSize === editorFontSize) return;
        editorFontSize = newSize;
        editorTextarea.style.fontSize = editorFontSize + 'px';
        editorTextarea.style.lineHeight = mdLineHeight() + 'px';
        if (mdActive) fitMdTa();
        _mdCharW = null; // 失效字符宽度缓存
        renderLineNumbers(); // 行高同步 (切到编辑模式时一致)
      }, { passive: false });
    }

    // 滑块: 点击切换浏览/编辑
    if (mdModeSwitchEl) {
      mdModeSwitchEl.addEventListener('click', (e) => {
        const seg = e.target.closest && e.target.closest('.md-mode-seg');
        if (!seg) return;
        playSound('click');
        setMdMode(seg.dataset.mode);
      });
    }

    // 源码 textarea: 输入 / 输入法 / Tab
    mdTa.addEventListener('input', onMdTaInput);
    mdTa.addEventListener('compositionstart', () => { mdComposing = true; });
    mdTa.addEventListener('compositionend', () => {
      mdComposing = false;
      scheduleMdRender(true); // 组合结束后立即渲染
    });
    mdTa.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        const s = mdTa.selectionStart;
        mdTa.value = mdTa.value.slice(0, s) + '  ' + mdTa.value.slice(mdTa.selectionEnd);
        mdTa.setSelectionRange(s + 2, s + 2);
        onMdTaInput();
      }
    });

    // 防抖渲染期间切换文件/关闭 → 丢弃挂起的渲染
    window.addEventListener('beforeunload', () => {
      if (mdRenderTimer) { clearTimeout(mdRenderTimer); mdRenderTimer = null; }
    });
