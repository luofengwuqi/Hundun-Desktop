    /* ============================================================
       云端文档库 (Cloud Link) — 用 git 做后端的文档库
       - 默认关闭: 首次进入只做引导, 用户选「暂不启用」时零副作用
       - 所有 git 操作在主进程 (见 src/main/git-service.js), 这里只发语义化请求
       - 冲突处理: 2.0 自动 / 2.1 云端 / 2.2 本地 / 2.3 都保留
       ============================================================ */

    const CLOUD_STRATEGY_LIST = [
      { id: 'auto', code: '2.0', titleKey: 'cloud.strategy.autoTitle', descKey: 'cloud.strategy.autoDesc' },
      { id: 'cloud', code: '2.1', titleKey: 'cloud.strategy.cloudTitle', descKey: 'cloud.strategy.cloudDesc' },
      { id: 'local', code: '2.2', titleKey: 'cloud.strategy.localTitle', descKey: 'cloud.strategy.localDesc' },
      { id: 'both', code: '2.3', titleKey: 'cloud.strategy.bothTitle', descKey: 'cloud.strategy.bothDesc' }
    ];

    let cloudState = null;
    let cloudScreen = 'loading';        // loading | intro | form | dash | conflict | busy
    let cloudSelection = 0;
    let cloudFormMode = 'new';          // new | existing
    let cloudFormError = null;          // { message, detail }
    let cloudConflicts = [];
    let cloudNotice = null;             // { type: 'ok'|'err'|'warn', text, detail }
    let cloudBusyMsg = '';
    let cloudBusySub = '';
    let cloudLogs = [];                 // { t, text, type }
    let cloudDraft = { remoteUrl: '', branch: 'main', username: '', token: '' };
    let cloudRenderedScreen = null;     // 上次完整渲染的 screen, 用于判断是否播放入场动画
    let cloudEnterTimer = 0;

    const cloudT = (key, params) => FastTXTI18n.t('cloud.' + key, params || {});

    const cloudApi = () => (window.hundun && window.hundun.cloud) || null;

    const cloudEnabledCached = () => {
      try { return localStorage.getItem('fasttxt-cloud-enabled') === '1'; } catch (_) { return false; }
    };

    const cloudCacheEnabled = (flag) => {
      try { localStorage.setItem('fasttxt-cloud-enabled', flag ? '1' : '0'); } catch (_) {}
    };

    const cloudLog = (text, type) => {
      const d = new Date();
      const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      cloudLogs.push({ t, text: String(text || ''), type: type || '' });
      if (cloudLogs.length > 24) cloudLogs = cloudLogs.slice(-24);
    };

    const cloudFmtTime = (ts) => {
      if (!ts) return cloudT('dash.never');
      const d = new Date(ts);
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const cloudErrText = (res) => {
      const code = res && res.code;
      const map = {
        FORBIDDEN: cloudT('err.forbidden'),
        DISABLED: cloudT('err.disabled'),
        NO_MERGE: cloudT('err.noMerge'),
        NO_GIT: cloudT('noGit')
      };
      return (res && res.message) || map[code] || cloudT('err.generic');
    };

    // ========== 视图开关 ==========

    const openCloudView = async () => {
      playSound('click');
      isSearchFocused = false;
      if (searchInput) searchInput.blur();
      currentView = 'cloud';
      cloudScreen = 'loading';
      cloudSelection = 0;
      cloudNotice = null;
      cloudFormError = null;
      renderCloud();
      await cloudRefresh(false);
    };

    const closeCloudView = () => {
      playSound('exit');
      currentView = 'main';
      cloudScreen = 'intro';
      cloudSyncFooterDot();
      updateUI();
    };

    // 底部云按钮的小绿点: 表示云同步处于启用状态
    const cloudSyncFooterDot = () => {
      const btn = document.querySelector('.footer-btn.cloud-btn');
      if (btn) btn.classList.toggle('linked', cloudEnabledCached());
    };

    // ========== 状态拉取 ==========

    const cloudApplyState = (state) => {
      if (!state) return;
      cloudState = state;
      if (Array.isArray(state.conflicts) && state.conflicts.length) cloudConflicts = state.conflicts;
      cloudCacheEnabled(!!state.enabled);
      cloudSyncFooterDot();
    };

    const cloudRefresh = async (forceDetect) => {
      const api = cloudApi();
      if (!api) {
        cloudScreen = 'intro';
        cloudNotice = { type: 'err', text: cloudT('noApi'), detail: cloudT('noApiHint') };
        renderCloud();
        return;
      }
      try {
        // detect 与 state 互不依赖（state 自己也会探测 git），并行发出去省一个来回
        const [detect, res] = await Promise.all([api.detect(!!forceDetect), api.state()])
        if (detect && detect.ok === false) {
          cloudNotice = { type: 'err', text: cloudErrText(detect) };
        }
        if (res && res.ok) {
          cloudApplyState(res.state);
          cloudNotice = null;
          cloudScreen = cloudPickScreen();
        } else if (res && res.state) {
          cloudApplyState(res.state);
          cloudScreen = 'intro';
          cloudNotice = { type: 'err', text: cloudErrText(res), detail: res.detail };
        } else {
          cloudScreen = 'intro';
          cloudNotice = { type: 'err', text: cloudT('err.generic') };
        }
      } catch (err) {
        console.error('[FastTXT] cloud refresh failed:', err);
        cloudScreen = 'intro';
        cloudNotice = { type: 'err', text: cloudT('err.generic'), detail: String(err && err.message ? err.message : err) };
      }
      renderCloud();
    };

    const cloudPickScreen = () => {
      const s = cloudState || {};
      if (!s.enabled) return 'intro';
      if (s.merging) {
        if (Array.isArray(s.conflicts) && s.conflicts.length) cloudConflicts = s.conflicts;
        return 'conflict';
      }
      return 'dash';
    };

    // ========== 模板 ==========

    const cloudBannerHtml = (notice) => {
      if (!notice) return '';
      const bar = notice.type === 'ok' ? 'OK' : notice.type === 'warn' ? '!' : 'ERR';
      return `<div class="cloud-banner ${notice.type}">
        <span class="bar">${bar}</span>
        <span>${escapeHtml(notice.text || '')}${notice.detail ? `<span class="detail">${escapeHtml(notice.detail)}</span>` : ''}</span>
      </div>`;
    };

    const cloudBusyHtml = (msg, sub) => `
      <div class="cloud-busy">
        <div class="blocks"><i></i><i></i><i></i><i></i></div>
        <div class="msg">${escapeHtml(msg || '')}</div>
        <div class="sub">${escapeHtml(sub || '')}</div>
      </div>`;

    const cloudIntroHtml = () => {
      const s = cloudState || {};
      const options = [
        { title: cloudT('intro.opt1Title'), desc: cloudT('intro.opt1Desc') },
        { title: cloudT('intro.opt2Title'), desc: cloudT('intro.opt2Desc') },
        { title: cloudT('intro.opt3Title'), desc: cloudT('intro.opt3Desc') }
      ];
      const gitBanner = s.gitAvailable === false
        ? `<div class="cloud-banner warn">
             <span class="bar">!</span>
             <span>${escapeHtml(cloudT('noGit'))}
               <span class="detail">${escapeHtml(cloudT('noGitHint'))}</span>
             </span>
             <button class="cloud-back" data-act="retry-detect" style="margin-left:auto;flex-shrink:0;">${escapeHtml(cloudT('retryDetect'))}</button>
           </div>`
        : '';

      return `
        <div class="cloud-intro">
          <div class="cloud-uplink"></div>
          ${cloudBannerHtml(cloudNotice)}
          ${gitBanner}
          <div class="cloud-hero">
            <div class="cloud-hero-top">
              <div class="cloud-kicker">${escapeHtml(cloudT('intro.eyebrow'))}</div>
              <div class="cloud-chips">
                <span class="cloud-chip">${escapeHtml(cloudT('intro.chip1'))}</span>
                <span class="cloud-chip">${escapeHtml(cloudT('intro.chip2'))}</span>
                <span class="cloud-chip">${escapeHtml(cloudT('intro.chip3'))}</span>
              </div>
            </div>
            <h1>${escapeHtml(cloudT('intro.title'))}</h1>
            <p>${escapeHtml(cloudT('intro.desc'))}</p>
          </div>
          <div class="cloud-options">
            ${options.map((o, i) => `
              <button class="cloud-option ${cloudSelection === i ? 'selected' : ''}" data-act="intro" data-idx="${i}">
                <span class="opt-no">${String(i + 1).padStart(2, '0')}</span>
                <span class="opt-main">
                  <span class="opt-title">${escapeHtml(o.title)}</span>
                  <span class="opt-desc">${escapeHtml(o.desc)}</span>
                </span>
                <span class="opt-go">↵</span>
              </button>`).join('')}
          </div>
          <div class="cloud-footnote">${escapeHtml(cloudT('intro.footnote'))}</div>
        </div>`;
    };

    // 根据远程地址的主机给「用户名 / 令牌」区域换更贴切的提示：
    // GitHub 用 x-access-token + PAT，Gitee 用私人令牌，GitLab 才是 oauth2。
    const cloudRemoteHost = () => {
      const raw = String(cloudDraft.remoteUrl || (cloudState && cloudState.remote) || '');
      const m = raw.match(/^(?:[a-z]+:\/\/)?(?:[^@/]+@)?([^/:?#]+)/i);
      return (m && m[1] ? m[1] : '').toLowerCase();
    };
    const cloudAuthHintKey = () => {
      const h = cloudRemoteHost();
      if (h.includes('github')) return 'form.authGithub';
      if (h.includes('gitee')) return 'form.authGitee';
      return 'form.authOther';
    };
    const cloudUserPhKey = () => {
      const h = cloudRemoteHost();
      if (h.includes('github')) return 'form.usernamePhGithub';
      if (h.includes('gitee')) return 'form.usernamePhGitee';
      return 'form.usernamePhOther';
    };

    const cloudFormHtml = () => {
      const isNew = cloudFormMode === 'new';
      return `
        <div class="cloud-form-wrap">
          <div class="cloud-uplink"></div>
          ${cloudBannerHtml(cloudNotice)}
          ${cloudBannerHtml(cloudFormError ? { type: 'err', text: cloudFormError.message, detail: cloudFormError.detail } : null)}
          <button class="cloud-back" data-act="back">${escapeHtml(cloudT('form.back'))}</button>
          <div class="cloud-form-head">
            <div class="cloud-kicker">${escapeHtml(cloudT(isNew ? 'form.newKicker' : 'form.existingKicker'))}</div>
            <h2>${escapeHtml(cloudT(isNew ? 'form.newTitle' : 'form.existingTitle'))}</h2>
            <p>${escapeHtml(cloudT(isNew ? 'form.newHint' : 'form.existingHint'))}</p>
          </div>
          <form class="cloud-form" id="cloudForm" autocomplete="off" spellcheck="false">
            <div class="cloud-field wide">
              <label for="cloudRemote">${escapeHtml(cloudT('form.remote'))}</label>
              <div class="cloud-input-row">
                <span class="cloud-prompt">$</span>
                <input id="cloudRemote" name="remoteUrl" type="text" value="${escapeHtml(cloudDraft.remoteUrl)}"
                       placeholder="${escapeHtml(cloudT('form.remotePh'))}" spellcheck="false" />
              </div>
            </div>
            <div class="cloud-field">
              <label for="cloudBranch">${escapeHtml(cloudT('form.branch'))}</label>
              <div class="cloud-input-row">
                <span class="cloud-prompt">#</span>
                <input id="cloudBranch" name="branch" type="text" value="${escapeHtml(cloudDraft.branch || 'main')}" spellcheck="false" />
              </div>
            </div>
            <div class="cloud-field">
              <label for="cloudUsername">${escapeHtml(cloudT('form.username'))}</label>
              <div class="cloud-input-row">
                <span class="cloud-prompt">@</span>
                <input id="cloudUsername" name="username" type="text" value="${escapeHtml(cloudDraft.username)}"
                       placeholder="${escapeHtml(cloudT(cloudUserPhKey()))}" spellcheck="false" />
              </div>
            </div>
            <div class="cloud-field wide">
              <label for="cloudToken">${escapeHtml(cloudT('form.token'))}</label>
              <div class="cloud-input-row">
                <span class="cloud-prompt">*</span>
                <input id="cloudToken" name="token" type="password" value="${escapeHtml(cloudDraft.token)}"
                       placeholder="${escapeHtml(cloudT('form.tokenPh'))}" spellcheck="false" />
                <button type="button" class="cloud-reveal" data-act="reveal" title="show / hide">👁</button>
              </div>
              <div class="cloud-hint" id="cloudAuthHint">${escapeHtml(cloudT(cloudAuthHintKey()))}</div>
            </div>
            <div class="cloud-form-actions">
              <span class="cloud-hint cloud-mono">fasttxt → git remote</span>
              <button type="submit" class="cloud-primary">${escapeHtml(cloudT('form.submit'))}</button>
            </div>
          </form>
        </div>`;
    };

    const cloudDashActions = () => {
      const s = cloudState || {};
      const pending = s.merging;
      const list = [];
      if (pending) {
        list.push({ id: 'resolve', label: cloudT('dash.resolve'), hint: cloudT('dash.resolveHint', { count: (cloudConflicts || []).length }) });
      }
      list.push({ id: 'sync', label: cloudT('dash.sync'), hint: cloudT('dash.syncHint') });
      list.push({ id: 'reconfigure', label: cloudT('dash.reconfigure'), hint: cloudT('dash.reconfigureHint') });
      list.push({ id: 'disable', label: cloudT('dash.disable'), hint: cloudT('dash.disableHint'), danger: true });
      list.push({ id: 'back', label: cloudT('dash.back'), hint: cloudT('dash.backHint') });
      return list;
    };

    const cloudDashHtml = () => {
      const s = cloudState || {};
      const dirty = Array.isArray(s.dirty) ? s.dirty : [];
      const actions = cloudDashActions();
      if (cloudSelection >= actions.length) cloudSelection = 0;
      const commitText = s.lastCommit && s.lastCommit.subject
        ? `${(s.lastCommit.date || '').slice(0, 10)} ${String(s.lastCommit.subject).slice(0, 30)}`
        : '—';

      return `
        <div class="cloud-dash">
          <div class="cloud-uplink"></div>
          ${cloudBannerHtml(cloudNotice)}
          <div class="cloud-dash-head">
            <div style="min-width:0;">
              <div class="cloud-kicker">CLOUD LINK · ${escapeHtml(cloudT('dash.linkOn'))}</div>
              <div class="cloud-repo">${escapeHtml(s.remote || '—')}</div>
              <div class="cloud-sub">${escapeHtml(cloudT('dash.branch', { branch: s.branch || 'main' }))} · ${escapeHtml(s.lastSyncAt ? cloudT('dash.lastSync', { time: cloudFmtTime(s.lastSyncAt) }) : cloudT('dash.never'))}</div>
            </div>
            <div class="cloud-led ${s.merging ? 'warn' : ''}"></div>
          </div>
          <div class="cloud-dash-grid">
            <section class="cloud-panel">
              <div class="panel-title">${escapeHtml(cloudT('dash.panelStatus'))}</div>
              <div class="cloud-rows">
                <div class="cloud-row"><span class="k">${escapeHtml(cloudT('dash.rowRemote'))}</span><span class="v">${escapeHtml((s.remote || '—').replace(/^https?:\/\//, ''))}</span></div>
                <div class="cloud-row"><span class="k">${escapeHtml(cloudT('dash.rowBranch'))}</span><span class="v">${escapeHtml(s.branch || 'main')}</span></div>
                <div class="cloud-row"><span class="k">${escapeHtml(cloudT('dash.rowAhead'))}</span><span class="v ${s.ahead > 0 ? 'warn' : 'ok'}">${s.ahead || 0}</span></div>
                <div class="cloud-row"><span class="k">${escapeHtml(cloudT('dash.rowBehind'))}</span><span class="v ${s.behind > 0 ? 'warn' : 'ok'}">${s.behind || 0}</span></div>
                <div class="cloud-row"><span class="k">${escapeHtml(cloudT('dash.rowLocal'))}</span><span class="v ${dirty.length ? 'warn' : 'ok'}">${dirty.length}</span></div>
                <div class="cloud-row"><span class="k">${escapeHtml(cloudT('dash.rowMerge'))}</span><span class="v ${s.merging ? 'bad' : 'ok'}">${escapeHtml(s.merging ? cloudT('dash.mergePending') : cloudT('dash.mergeClean'))}</span></div>
                <div class="cloud-row"><span class="k">${escapeHtml(cloudT('dash.rowCommit'))}</span><span class="v">${escapeHtml(commitText)}</span></div>
              </div>
            </section>
            <section class="cloud-panel">
              <div class="panel-title">${escapeHtml(cloudT('dash.panelActions'))}</div>
              <div class="cloud-actions">
                ${actions.map((a, i) => `
                  <button class="cloud-action ${cloudSelection === i ? 'selected' : ''} ${a.danger ? 'danger' : ''}" data-act="action" data-id="${a.id}">
                    <span class="idx">${String(i + 1).padStart(2, '0')}</span>
                    <span class="label">${escapeHtml(a.label)}<span class="tail" style="margin-left:8px;">${escapeHtml(a.hint)}</span></span>
                  </button>`).join('')}
              </div>
            </section>
          </div>
          <div>
            <div class="panel-title" style="margin: 2px 0 6px;">${escapeHtml(cloudT('dash.log'))}</div>
            <div class="cloud-log">
              ${cloudLogs.length
                ? cloudLogs.slice(-8).map((l) => `<div class="line ${l.type}"><span class="t">${escapeHtml(l.t)}</span>${escapeHtml(l.text)}</div>`).join('')
                : `<div class="line">${escapeHtml(cloudT('dash.noLog'))}</div>`}
            </div>
          </div>
        </div>`;
    };

    const cloudConflictHtml = () => {
      const list = cloudConflicts || [];
      if (cloudSelection >= CLOUD_STRATEGY_LIST.length) cloudSelection = 0;
      return `
        <div class="cloud-conflict">
          <div class="cloud-uplink"></div>
          ${cloudBannerHtml(cloudNotice)}
          <div class="cloud-conflict-head">
            <div>
              <div class="cloud-kicker">${escapeHtml(cloudT('conflict.kicker'))}</div>
              <h2>${escapeHtml(cloudT('conflict.title', { count: list.length }))}</h2>
              <p>${escapeHtml(cloudT('conflict.desc'))}</p>
            </div>
            <button class="cloud-back" data-act="back-dash" style="flex-shrink:0;">${escapeHtml(cloudT('conflict.backDash'))}</button>
          </div>
          <div class="cloud-conflict-list">
          ${list.map((c) => `
            <div class="cloud-file-conflict">
              <div class="cf-name">
                <span class="cf-status">${escapeHtml(c.status || 'UU')}</span>
                <span>${escapeHtml(c.path)}</span>
              </div>
              <div class="cf-panes">
                <div class="cf-pane local ${c.ours ? '' : 'empty'}">
                  <div class="tag">${escapeHtml(cloudT('conflict.local'))}</div>
                  <pre>${c.ours ? escapeHtml(c.ours.preview) : escapeHtml(cloudT('conflict.emptySide'))}</pre>
                </div>
                <div class="cf-pane cloud ${c.theirs ? '' : 'empty'}">
                  <div class="tag">${escapeHtml(cloudT('conflict.cloud'))}</div>
                  <pre>${c.theirs ? escapeHtml(c.theirs.preview) : escapeHtml(cloudT('conflict.emptySide'))}</pre>
                </div>
              </div>
            </div>`).join('')}
          </div>
          <div class="cloud-strategies">
            ${CLOUD_STRATEGY_LIST.map((s, i) => `
              <button class="cloud-strategy ${cloudSelection === i ? 'selected' : ''}" data-act="strategy-click" data-idx="${i}">
                <span class="code">${s.code}</span>
                <span>
                  <span class="s-title">${escapeHtml(cloudT('strategy.' + s.id + 'Title'))}</span>
                  <span class="s-desc">${escapeHtml(cloudT('strategy.' + s.id + 'Desc'))}</span>
                </span>
              </button>`).join('')}
          </div>
        </div>`;
    };

    // ========== 渲染 ==========

    const cloudRenderChrome = () => {
      const legend = document.getElementById('cloudLegend');
      const tip = document.getElementById('cloudTip');
      const chip = document.getElementById('cloudChip');
      if (legend) {
        const kbd = (k) => `<kbd>${escapeHtml(k)}</kbd>`;
        if (cloudScreen === 'form') {
          legend.innerHTML = `${kbd('Tab')} ${escapeHtml(cloudT('legendTab'))} · ${kbd('Enter')} ${escapeHtml(cloudT('legendEnter'))} · ${kbd('Esc')} ${escapeHtml(cloudT('legendEsc'))}`;
        } else if (cloudScreen === 'busy' || cloudScreen === 'loading') {
          legend.innerHTML = `<span class="cloud-mono">git</span>`;
        } else {
          legend.innerHTML = `${kbd('↑↓')} ${escapeHtml(cloudT('legendNav'))} · ${kbd('Enter')} ${escapeHtml(cloudT('legendEnter'))} · ${kbd('Esc')} ${escapeHtml(cloudT('legendEsc'))}`;
        }
      }
      if (tip) {
        const s = cloudState || {};
        if (cloudScreen === 'busy') tip.textContent = cloudBusySub || '';
        else if (cloudScreen === 'form') tip.textContent = cloudFormMode === 'new' ? 'new repo' : 'existing repo';
        else if (!s.enabled) tip.textContent = 'cloud: off';
        else tip.textContent = `${s.branch || 'main'} · ↑${s.ahead || 0} ↓${s.behind || 0} · ${(s.dirty || []).length} local`;
      }
      if (chip) chip.textContent = (cloudState && cloudState.enabled) ? 'GIT' : 'OFF';
    };

    const cloudBind = (body) => {
      body.querySelectorAll('[data-act]').forEach((el) => {
        const act = el.dataset.act;
        if (act === 'reveal') {
          el.addEventListener('click', () => {
            const input = body.querySelector('#cloudToken');
            if (!input) return;
            input.type = input.type === 'password' ? 'text' : 'password';
          });
          return;
        }
        el.addEventListener('click', () => {
          cloudNotice = null;
          if (act === 'intro') return cloudChooseIntro(parseInt(el.dataset.idx, 10) || 0);
          if (act === 'retry-detect') { cloudRefresh(true); return; }
          if (act === 'back') { playSound('exit'); cloudScreen = 'intro'; cloudSelection = 0; renderCloud(); return; }
          if (act === 'back-dash') { playSound('exit'); cloudScreen = 'dash'; cloudSelection = 0; renderCloud(); return; }
          if (act === 'action') return cloudRunAction(el.dataset.id);
          if (act === 'strategy-click') {
            cloudSelection = parseInt(el.dataset.idx, 10) || 0;
            cloudUpdateSelection(false);
            return;
          }
        });
      });

      // 远程地址变化 → 只改提示文字，不重建表单（重建会丢焦点/闪一下）
      const remoteInput = body.querySelector('#cloudRemote');
      const authHint = body.querySelector('#cloudAuthHint');
      if (remoteInput && authHint) {
        remoteInput.addEventListener('input', () => {
          cloudDraft.remoteUrl = remoteInput.value;
          authHint.textContent = cloudT(cloudAuthHintKey());
        });
      }

      const form = body.querySelector('#cloudForm');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          cloudSubmitForm(form);
        });
        form.querySelectorAll('input').forEach((input) => {
          input.addEventListener('input', () => {
            cloudDraft[input.name] = input.value;
          });
        });
      }
    };

    const renderCloud = () => {
      const body = document.getElementById('cloudBody');
      if (!body) return;
      const screenChanged = cloudRenderedScreen !== cloudScreen;

      if (cloudScreen === 'loading') body.innerHTML = cloudBusyHtml(cloudT('loading'), cloudT('loadingSub'));
      else if (cloudScreen === 'busy') body.innerHTML = cloudBusyHtml(cloudBusyMsg, cloudBusySub);
      else if (cloudScreen === 'intro') body.innerHTML = cloudIntroHtml();
      else if (cloudScreen === 'form') body.innerHTML = cloudFormHtml();
      else if (cloudScreen === 'dash') body.innerHTML = cloudDashHtml();
      else if (cloudScreen === 'conflict') body.innerHTML = cloudConflictHtml();
      else body.innerHTML = cloudIntroHtml();

      body.classList.toggle('is-conflict', cloudScreen === 'conflict');

      // 入场动画只在「换了页面」时播放一次。
      // 之前箭头键也走 renderCloud，整块 innerHTML 重建会让 cloudRise 动画每次从头播放，
      // 三个选项卡每次按键都从 opacity:0 重新浮现 —— 这就是一闪一闪的来源。
      body.classList.toggle('is-enter', screenChanged);
      if (screenChanged) {
        clearTimeout(cloudEnterTimer);
        cloudEnterTimer = setTimeout(() => body.classList.remove('is-enter'), 460);
        body.scrollTop = 0;
      }
      cloudRenderedScreen = cloudScreen;

      cloudBind(body);
      cloudRenderChrome();
    };

    // 只换选中项，不重建 DOM（键盘上下移动 / 点策略行走这里）。
    // 保持 DOM 稳定，动画、滚动位置、焦点都不会被重置。
    const cloudUpdateSelection = (ensureVisible) => {
      const body = document.getElementById('cloudBody');
      if (!body) return;
      const items = body.querySelectorAll('[data-act="intro"], [data-act="strategy-click"], [data-act="action"]');
      items.forEach((el, i) => {
        const on = i === cloudSelection;
        el.classList.toggle('selected', on);
        if (on && ensureVisible) el.scrollIntoView({ block: 'nearest' });
      });
    };

    // ========== 交互 ==========

    const cloudChooseIntro = (idx) => {
      playSound('click');
      cloudNotice = null;
      cloudFormError = null;
      if (idx === 2) {
        // 暂不启用: 直接回主页面, 不写任何状态
        closeCloudView();
        return;
      }
      cloudFormMode = idx === 0 ? 'new' : 'existing';
      const s = cloudState || {};
      if (s.remote && !cloudDraft.remoteUrl) cloudDraft.remoteUrl = s.remote;
      cloudScreen = 'form';
      cloudSelection = 0;
      renderCloud();
      setTimeout(() => {
        const input = document.getElementById('cloudRemote');
        if (input) input.focus();
      }, 30);
    };

    const cloudReadForm = (form) => {
      const get = (name) => {
        const el = form.querySelector(`[name="${name}"]`);
        return el ? el.value.trim() : '';
      };
      cloudDraft = {
        remoteUrl: get('remoteUrl'),
        branch: get('branch') || 'main',
        username: get('username'),
        token: get('token')
      };
      return { ...cloudDraft };
    };

    const cloudValidUrl = (url) => /^(https?:\/\/|ssh:\/\/|[\w.-]+@[\w.-]+:[\w./~-]+)/i.test(url);

    const cloudSubmitForm = async (form) => {
      const api = cloudApi();
      if (!api) return;
      const values = cloudReadForm(form);
      if (!cloudValidUrl(values.remoteUrl)) {
        cloudFormError = { message: cloudT('form.badUrl'), detail: '' };
        renderCloud();
        playSound('error');
        return;
      }
      cloudFormError = null;
      cloudNotice = null;
      cloudBusyMsg = cloudT('form.submitting');
      cloudBusySub = cloudFormMode === 'new' ? 'git init → commit → push' : 'git fetch → merge';
      cloudScreen = 'busy';
      renderCloud();
      playSound('loading');

      let res = null;
      try {
        res = await api.setup(values);
      } catch (err) {
        res = { ok: false, message: String(err && err.message ? err.message : err) };
      }

      if (res && res.ok) {
        cloudApplyState(res.state);
        cloudLog(cloudT('msg.setupOk'), 'ok');
        cloudNotice = { type: 'ok', text: cloudT('msg.setupOk') };
        await cloudReloadFiles();
        cloudScreen = cloudPickScreen();
        playSound('OK');
      } else if (res && res.code === 'CONFLICT') {
        cloudApplyState(res.state);
        cloudConflicts = res.conflicts || (res.state && res.state.conflicts) || [];
        cloudLog(cloudT('msg.setupConflict', { count: cloudConflicts.length }), 'warn');
        cloudNotice = { type: 'warn', text: cloudT('msg.setupConflict', { count: cloudConflicts.length }) };
        cloudScreen = 'conflict';
        cloudSelection = 0;
        await cloudReloadFiles();
        playSound('error');
      } else {
        cloudScreen = 'form';
        cloudFormError = { message: cloudErrText(res), detail: (res && res.detail) || '' };
        cloudLog(cloudErrText(res), 'err');
        playSound('error');
      }
      renderCloud();
    };

    const cloudRunAction = async (id) => {
      if (id === 'back') { closeCloudView(); return; }
      if (id === 'reconfigure') {
        cloudNotice = null;
        cloudFormMode = 'existing';
        cloudScreen = 'form';
        cloudSelection = 0;
        const s = cloudState || {};
        cloudDraft = { remoteUrl: s.remote || '', branch: s.branch || 'main', username: s.username || '', token: '' };
        renderCloud();
        return;
      }
      if (id === 'disable') {
        playSound('click');
        showModal('☁️', cloudT('dash.disable'), cloudT('dash.disabledNote'), [
          { text: FastTXTI18n.t('modal.cancel'), class: 'secondary', action: closeModal },
          {
            text: cloudT('dash.disable'),
            class: 'danger',
            action: async () => {
              closeModal();
              const api = cloudApi();
              if (!api) return;
              const res = await api.disable();
              if (res && res.ok) {
                cloudApplyState(res.state || { ...(cloudState || {}), enabled: false });
                cloudLog(cloudT('msg.disableOk'), 'warn');
                cloudNotice = { type: 'ok', text: cloudT('msg.disableOk') };
                cloudScreen = 'intro';
                playSound('OK');
              } else {
                cloudNotice = { type: 'err', text: cloudErrText(res) };
                cloudScreen = 'dash';
                playSound('error');
              }
              renderCloud();
            }
          }
        ]);
        return;
      }
      if (id === 'resolve') {
        if (!(cloudConflicts || []).length) {
          const api = cloudApi();
          if (api && api.conflicts) {
            const res = await api.conflicts();
            if (res && res.ok && res.conflicts) cloudConflicts = res.conflicts;
          }
        }
        cloudScreen = 'conflict';
        cloudSelection = 0;
        cloudNotice = null;
        renderCloud();
        return;
      }
      if (id === 'sync') {
        const api = cloudApi();
        if (!api) return;
        cloudBusyMsg = cloudT('dash.sync');
        cloudBusySub = 'commit → fetch → merge → push';
        cloudNotice = null;
        cloudScreen = 'busy';
        renderCloud();
        playSound('loading');
        let res = null;
        try {
          res = await api.sync();
        } catch (err) {
          res = { ok: false, message: String(err && err.message ? err.message : err) };
        }
        if (res && res.ok) {
          cloudApplyState(res.state);
          cloudLog(cloudT('msg.syncOk'), 'ok');
          cloudNotice = { type: 'ok', text: cloudT('msg.syncOk') };
          await cloudReloadFiles();
          cloudScreen = cloudPickScreen();
          playSound('OK');
        } else if (res && res.code === 'CONFLICT') {
          cloudApplyState(res.state);
          cloudConflicts = res.conflicts || (res.state && res.state.conflicts) || [];
          cloudLog(cloudT('msg.setupConflict', { count: cloudConflicts.length }), 'warn');
          cloudNotice = { type: 'warn', text: cloudT('msg.setupConflict', { count: cloudConflicts.length }) };
          cloudScreen = 'conflict';
          cloudSelection = 0;
          await cloudReloadFiles();
          playSound('error');
        } else {
          cloudApplyState(res && res.state);
          cloudNotice = { type: 'err', text: cloudErrText(res), detail: (res && res.detail) || '' };
          cloudLog(cloudErrText(res), 'err');
          cloudScreen = 'dash';
          playSound('error');
        }
        renderCloud();
      }
    };

    const cloudApplyStrategy = async (idx) => {
      const api = cloudApi();
      if (!api) return;
      const strategy = CLOUD_STRATEGY_LIST[idx];
      if (!strategy) return;
      cloudBusyMsg = cloudT('conflict.applying');
      cloudBusySub = `${strategy.code} ${cloudT('strategy.' + strategy.id + 'Title')}`;
      cloudNotice = null;
      cloudScreen = 'busy';
      renderCloud();
      playSound('loading');
      let res = null;
      try {
        res = await api.resolve(strategy.id);
      } catch (err) {
        res = { ok: false, message: String(err && err.message ? err.message : err) };
      }
      if (res && res.ok) {
        cloudApplyState(res.state);
        cloudConflicts = [];
        cloudLog(cloudT('msg.resolveOk') + ` (${strategy.code})`, 'ok');
        cloudNotice = { type: 'ok', text: cloudT('conflict.resolved', { count: (res.resolved || []).length }) };
        await cloudReloadFiles();
        cloudScreen = cloudPickScreen();
        playSound('OK');
      } else {
        cloudApplyState(res && res.state);
        if (res && res.state && Array.isArray(res.state.conflicts) && res.state.conflicts.length) {
          cloudConflicts = res.state.conflicts;
        }
        cloudNotice = { type: 'err', text: cloudErrText(res), detail: (res && res.detail) || '' };
        cloudLog(cloudErrText(res), 'err');
        cloudScreen = 'conflict';
        playSound('error');
      }
      renderCloud();
    };

    const cloudReloadFiles = async () => {
      try {
        if (currentView === 'cloud') {
          await loadFilesFromDisk();
        }
      } catch (err) {
        console.warn('[FastTXT] cloud reload files failed:', err);
      }
    };

    // ========== 键盘 ==========

    const handleCloudKeydown = (e) => {
      const tag = (e.target && e.target.tagName) || '';
      const inField = tag === 'INPUT' || tag === 'TEXTAREA';

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (cloudScreen === 'form') {
          playSound('exit');
          cloudScreen = 'intro';
          cloudSelection = 0;
          cloudNotice = null;
          cloudFormError = null;
          renderCloud();
        } else if (cloudScreen === 'conflict') {
          playSound('exit');
          cloudScreen = 'dash';
          cloudSelection = 0;
          renderCloud();
        } else if (cloudScreen === 'dash' || cloudScreen === 'intro') {
          closeCloudView();
        }
        return;
      }

      if (cloudScreen === 'loading' || cloudScreen === 'busy') return;

      if (cloudScreen === 'form') {
        if (inField && e.key === 'Enter') {
          e.preventDefault();
          const form = document.getElementById('cloudForm');
          if (form) cloudSubmitForm(form);
          return;
        }
        if (!inField && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          const form = document.getElementById('cloudForm');
          if (form) cloudSubmitForm(form);
        }
        return;
      }

      if (inField) return;

      let key = e.key;
      if (key === 'w' || key === 'W') key = 'ArrowUp';
      if (key === 's' || key === 'S') key = 'ArrowDown';
      if (key === 'a' || key === 'A') key = 'ArrowLeft';
      if (key === 'd' || key === 'D') key = 'ArrowRight';

      // 反向: 左/上 移一位, 右/下 移一位 (列表是单列, 左右也当作上下)
      const total = cloudScreen === 'intro' ? 3
        : cloudScreen === 'conflict' ? CLOUD_STRATEGY_LIST.length
        : cloudDashActions().length;

      if (key === 'ArrowUp' || key === 'ArrowLeft' || key === 'ArrowDown' || key === 'ArrowRight') {
        e.preventDefault();
        const dir = (key === 'ArrowUp' || key === 'ArrowLeft') ? -1 : 1;
        cloudSelection = (cloudSelection + dir + total) % total;
        playSound('click');
        cloudUpdateSelection(true);
        return;
      }

      if (key === 'Enter' || key === ' ') {
        e.preventDefault();
        playSound('click');
        if (cloudScreen === 'intro') cloudChooseIntro(cloudSelection);
        else if (cloudScreen === 'conflict') cloudApplyStrategy(cloudSelection);
        else if (cloudScreen === 'dash') {
          const actions = cloudDashActions();
          const action = actions[cloudSelection];
          if (action) cloudRunAction(action.id);
        }
      }
    };

    // 云端页 ✕ = 返回主页面 (不退出子程序; 退出仍走主页面 Esc / ✕)
    const cloudCloseBtn = document.getElementById('cloudCloseBtn');
    if (cloudCloseBtn) cloudCloseBtn.addEventListener('click', closeCloudView);
