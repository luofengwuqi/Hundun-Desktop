    // ========== i18n: 静态 HTML 翻译 ==========
    // data-i18n / data-i18n-placeholder / data-i18n-title
    const applyI18nHtml = () => {
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const v = MusicI18n.get(el.getAttribute('data-i18n'));
        if (typeof v === 'string') el.textContent = v;
      });
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const v = MusicI18n.get(el.getAttribute('data-i18n-placeholder'));
        if (typeof v === 'string') el.setAttribute('placeholder', v);
      });
      document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const v = MusicI18n.get(el.getAttribute('data-i18n-title'));
        if (typeof v === 'string') el.setAttribute('title', v);
      });
    };
