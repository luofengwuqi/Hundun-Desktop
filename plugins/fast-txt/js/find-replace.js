    // ========== Find & Replace ==========
    const openFindBar = (withReplace) => {
      playSound('click');
      findBarVisible = true;
      showReplaceMode = withReplace;
      findBar.style.display = '';
      replaceRow.style.display = withReplace ? '' : 'none';
      findInput.value = '';
      replaceInput.value = '';
      findMatches = [];
      findCurrentIdx = -1;
      lastSearchQuery = '';
      findCount.textContent = '0/0';
      setTimeout(() => findInput.focus(), 0);
    };

    const closeFindBar = () => {
      playSound('click');
      findBarVisible = false;
      findBar.style.display = 'none';
      clearFindHighlights();
      setTimeout(() => editorTextarea.focus(), 0);
    };

    const clearFindHighlights = () => {
      // Clear any visual highlights (we track matches in JS)
      findMatches = [];
      findCurrentIdx = -1;
      findCount.textContent = '0/0';
    };

    const performFind = () => {
      const query = findInput.value;
      if (!query) {
        clearFindHighlights();
        return;
      }

      findMatches = [];
      const content = editorContent;
      const lowerContent = content.toLowerCase();
      const lowerQuery = query.toLowerCase();
      let pos = 0;

      while (pos < content.length) {
        const idx = lowerContent.indexOf(lowerQuery, pos);
        if (idx === -1) break;
        findMatches.push({ start: idx, end: idx + query.length });
        pos = idx + 1;
      }

      if (findMatches.length > 0) {
        // Find the match closest to cursor position
        const cursorPos = editorTextarea.selectionStart;
        findCurrentIdx = 0;
        for (let i = 0; i < findMatches.length; i++) {
          if (findMatches[i].start >= cursorPos) {
            findCurrentIdx = i;
            break;
          }
        }
      } else {
        findCurrentIdx = -1;
      }

      lastSearchQuery = query;
      updateFindCount();
      scrollToFindMatch();
    };

    const updateFindCount = () => {
      if (findMatches.length === 0) {
        findCount.textContent = findInput.value ? '0/0' : '0/0';
        findCount.style.color = findInput.value ? 'var(--accent-secondary, #ff0080)' : '';
      } else {
        findCount.textContent = `${findCurrentIdx + 1}/${findMatches.length}`;
        findCount.style.color = '';
      }
    };

    const scrollToFindMatch = () => {
      if (findCurrentIdx < 0 || findCurrentIdx >= findMatches.length) return;
      const match = findMatches[findCurrentIdx];
      editorTextarea.focus();
      editorTextarea.setSelectionRange(match.start, match.end);

      // Scroll the textarea to show the match
      const linesBefore = editorContent.substring(0, match.start).split('\n').length - 1;
      const lineHeight = parseFloat(getComputedStyle(editorTextarea).lineHeight) || 23.4;
      const scrollTarget = linesBefore * lineHeight - editorTextarea.clientHeight / 3;
      editorTextarea.scrollTop = Math.max(0, scrollTarget);
    };

    const findNext = () => {
      if (findMatches.length === 0) return;
      findCurrentIdx = (findCurrentIdx + 1) % findMatches.length;
      updateFindCount();
      scrollToFindMatch();
      playSound('click');
    };

    const findPrev = () => {
      if (findMatches.length === 0) return;
      findCurrentIdx = (findCurrentIdx - 1 + findMatches.length) % findMatches.length;
      updateFindCount();
      scrollToFindMatch();
      playSound('click');
    };

    const replaceOne = () => {
      if (findCurrentIdx < 0 || findCurrentIdx >= findMatches.length) return;
      const match = findMatches[findCurrentIdx];
      const replacement = replaceInput.value;
      const before = editorContent.substring(0, match.start);
      const after = editorContent.substring(match.end);
      editorContent = before + replacement + after;
      editorTextarea.value = editorContent;
      renderEditorStatus();
      renderLineNumbers();
      performFind(); // Re-search after replacement
      playSound('click');
    };

    const replaceAll = () => {
      if (findMatches.length === 0) return;
      const query = findInput.value;
      const replacement = replaceInput.value;
      const count = findMatches.length;

      // Replace from end to start to preserve indices
      let newContent = editorContent;
      const lowerContent = newContent.toLowerCase();
      const lowerQuery = query.toLowerCase();

      // Build new content by replacing all occurrences
      let result = '';
      let pos = 0;
      while (pos < newContent.length) {
        const idx = lowerContent.indexOf(lowerQuery, pos);
        if (idx === -1) {
          result += newContent.substring(pos);
          break;
        }
        result += newContent.substring(pos, idx) + replacement;
        pos = idx + query.length;
      }

      editorContent = result;
      editorTextarea.value = editorContent;
      renderEditorStatus();
      renderLineNumbers();
      performFind(); // Re-search
      playSound('OK');
    };
