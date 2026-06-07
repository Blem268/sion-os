/* ============================================
   SION OS — modules/email.js
   v2.9.2 — Sprint 18C
   Gmail client — Phase A (read + AI)
   ============================================ */

const EmailModule = (() => {

  let _folder      = 'INBOX';
  let _tab         = 'primary';
  let _emails      = [];
  let _activeEmail = null;
  let _activeId    = null;
  let _sort        = 'newest';
  let _settings    = {};
  let _pollTimer   = null;
  let _pageToken   = null;
  let _hasMore     = false;
  let _currentActions = [];
  let _aiPanelOpen = false;

  const LABEL_COLOURS = {
    'Work (Silcomm)': '#00d4ff',
    'Blem Tuned':     '#ffc040',
    'Younity':        '#00ff88',
    'Blueport':       '#378ADD',
    'Finance':        '#ff9944',
    'Study (ACCA)':   '#c4a0ff',
    'Personal':       '#888888',
  };

  const TAB_QUERIES = {
    primary: '',
    social:  'category:social',
    updates: 'category:updates',
    forums:  'category:forums',
  };

  const FOLDER_QUERIES = {
    INBOX:   'in:inbox',
    STARRED: 'is:starred',
    SENT:    'in:sent',
    DRAFT:   'in:drafts',
    SPAM:    'in:spam',
    TRASH:   'in:trash',
    ARCHIVE: '-in:inbox -in:sent -in:drafts -in:spam -in:trash',
    SNOOZED: 'label:snoozed',
  };

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Relative timestamps ── */
  function formatEmailDate(dateStr) {
    if (!dateStr) return '';
    let d = new Date(dateStr);

    if (isNaN(d.getTime())) {
      const parsed = new Date(dateStr.replace(/\s\(.*\)$/, ''));
      if (!isNaN(parsed.getTime())) return formatEmailDate(parsed.toISOString());
      return dateStr;
    }

    const now  = new Date();
    const diff = Math.floor((now - d) / 1000);

    if (diff < 60)          return 'just now';
    if (diff < 3600)        return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400)       return d.toLocaleTimeString('en-AG', { hour: '2-digit', minute: '2-digit', hour12: false });
    if (diff < 86400 * 2)   return 'Yesterday';
    if (diff < 86400 * 7)   return d.toLocaleDateString('en-AG', { weekday: 'short' });
    if (diff < 86400 * 365) return d.toLocaleDateString('en-AG', { day: 'numeric', month: 'short' });
    return d.toLocaleDateString('en-AG', { day: 'numeric', month: 'short', year: '2-digit' });
  }

  function getInitials(fromStr) {
    const name  = fromStr.replace(/<.*>/, '').trim();
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  function getDisplayName(fromStr) {
    if (!fromStr) return 'Unknown';
    const quotedMatch = fromStr.match(/^"?([^"<]+)"?\s*</);
    if (quotedMatch) return quotedMatch[1].trim();
    const angleMatch = fromStr.match(/^([^<]+)</);
    if (angleMatch) return angleMatch[1].trim();
    const emailMatch = fromStr.match(/^([^@]+)@/);
    if (emailMatch) return emailMatch[1].replace(/[._-]/g, ' ');
    return fromStr.slice(0, 20);
  }

  function getEmail(fromStr) {
    const match = fromStr.match(/<([^>]+)>/);
    return match ? match[1] : fromStr;
  }

  /* ── HTML / plain text body renderer ── */
  function renderEmailBody(body) {
    const bodyEl = document.getElementById('email-detail-body');
    if (!bodyEl) return;

    const looksLikeHtml = /<(div|p|table|html|body|span|a|br|img|td|tr)[\s>]/i.test(body || '');

    if (looksLikeHtml) {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'width:100%;border:none;min-height:200px;max-height:500px;background:#111111;flex:1;display:block';
      iframe.setAttribute('sandbox', 'allow-same-origin');
      iframe.setAttribute('title', 'Email content');
      bodyEl.innerHTML = '';
      bodyEl.appendChild(iframe);
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(`
  <html>
    <head>
      <style>
        * { box-sizing: border-box; }
        html, body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 13px;
          color: #e8e8e8;
          background: #111111;
          padding: 12px;
          margin: 0;
          line-height: 1.6;
          word-break: break-word;
        }
        a { color: #00d4ff; }
        img { max-width: 100%; height: auto; border-radius: 4px; }
        table { max-width: 100% !important; width: 100% !important; }
        td, th { padding: 4px 8px; }
        pre, code { white-space: pre-wrap; font-family: monospace; }
        div[style*="background"], td[style*="background"],
        table[style*="background"] {
          background-color: #111111 !important;
        }
        [style*="color:#ffffff"], [style*="color: #ffffff"],
        [style*="color:white"], [style*="color: white"] {
          color: #e8e8e8 !important;
        }
      </style>
    </head>
    <body>${body}</body>
  </html>
`);
      doc.close();
      iframe.onload = () => {
        try {
          const h = iframe.contentDocument.body.scrollHeight;
          iframe.style.height = Math.min(h + 20, 500) + 'px';
        } catch(e) {}
      };
    } else {
      bodyEl.innerHTML = '';
      const pre = document.createElement('pre');
      pre.style.cssText = 'white-space:pre-wrap;word-break:break-word;font-family:inherit;font-size:12px;color:var(--fg2);line-height:1.7;margin:0';
      pre.textContent = body || '';
      bodyEl.appendChild(pre);
    }

    if (body && body.length >= 3900) {
      const truncEl = document.createElement('div');
      truncEl.className = 'email-truncated-notice';
      truncEl.innerHTML = '<i class="ti ti-info-circle" aria-hidden="true"></i> Email truncated for display. Open in Gmail to see full message.';
      bodyEl.appendChild(truncEl);
    }
  }

  /* ── Init ── */
  async function init() {
    _settings = Store.get('email_settings') || { poll_mins: 15, auto_finance: true };
    await checkAuthStatus();
    renderLabels();
    startPolling();
  }

  /* ── Auth ── */
  async function checkAuthStatus() {
    if (!window.electronAPI?.gmailStatus) {
      document.getElementById('email-auth-prompt')?.classList.remove('hidden');
      document.getElementById('gmail-connect-btn')?.style.setProperty('display', 'block');
      return;
    }

    const status      = await window.electronAPI.gmailStatus();
    const dotEl       = document.getElementById('gmail-status-dot');
    const addrEl      = document.getElementById('gmail-account-addr');
    const btnEl       = document.getElementById('gmail-connect-btn');
    const authPrompt  = document.getElementById('email-auth-prompt');
    const authSection = document.getElementById('email-ai-auth');

    if (status.authed) {
      if (dotEl)      { dotEl.className = 'email-account-dot connected'; }
      if (addrEl)     { addrEl.textContent = status.email || 'Connected'; }
      if (btnEl)      { btnEl.style.display = 'none'; }
      if (authPrompt) { authPrompt.style.display = 'none'; }

      const composeArea = document.querySelector('.email-sidebar');
      if (composeArea) {
        const prompt = composeArea.querySelector('#email-auth-prompt');
        if (prompt) prompt.style.display = 'none';
      }

      await loadEmails();
      await updateUnreadBadge();
      await updateFolderCounts();
    } else {
      if (dotEl)      { dotEl.className = 'email-account-dot'; }
      if (addrEl)     { addrEl.textContent = 'not connected'; }
      if (btnEl)      { btnEl.style.display = 'block'; }
      if (authPrompt) { authPrompt.style.display = 'block'; }
      renderEmptyState();
    }
  }

  async function connectGmail() {
    if (!window.electronAPI?.gmailAuth) return;
    const result = await window.electronAPI.gmailAuth();
    if (result.success) {
      await checkAuthStatus();
    } else {
      alert('Gmail connection failed: ' + result.error);
    }
  }

  /* ── Load emails (with pagination) ── */
  async function loadEmails(append = false) {
    if (!window.electronAPI?.gmailList) return;
    const listEl = document.getElementById('email-list');

    if (!append) {
      _pageToken = null;
      if (listEl) listEl.innerHTML = '<div class="email-loading"><span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span></div>';
    }

    const result = await window.electronAPI.gmailList({
      folder:     _folder,
      maxResults: 20,
      query:      TAB_QUERIES[_tab] || '',
      pageToken:  _pageToken,
    });

    if (result.success) {
      if (append) {
        _emails = [..._emails, ...result.emails];
      } else {
        _emails = result.emails;
      }
      _pageToken = result.nextPageToken || null;
      _hasMore   = !!result.nextPageToken;
      renderEmailList();
      updateFooter();
      preClassifyEmails(_emails);
    } else {
      if (listEl && !append) listEl.innerHTML = `<div class="task-empty">${escapeHtml(result.error || 'Failed to load emails')}</div>`;
    }
  }

  async function loadMore() { await loadEmails(true); }

  function updateFooter() {
    const footerEl = document.getElementById('email-list-footer');
    if (!footerEl) return;

    const showLoadMore = _hasMore || _emails.length >= 20;

    footerEl.innerHTML = `
      <span style="color:var(--fg3);font-size:10px">${_emails.length} emails</span>
      ${showLoadMore
        ? `<button class="email-load-more" onclick="EmailModule.loadMore()">
             <i class="ti ti-refresh" style="font-size:10px" aria-hidden="true"></i>
             Load more
           </button>`
        : ''
      }`;
  }

  /* ── Background pre-classification (first 5 uncached emails) ── */
  async function preClassifyEmails(emails) {
    if (!window.electronAPI?.gmailOpen) return;
    const cached  = new Set(Store.getAll('email_cache').map(c => c.gmail_id));
    const toClass = emails.filter(e => !cached.has(e.id)).slice(0, 5);
    for (const email of toClass) {
      try {
        const result = await window.electronAPI.gmailOpen(email.id);
        if (result.success && result.analysis) renderEmailList();
      } catch(e) { /* silent */ }
      await new Promise(r => setTimeout(r, 800));
    }
  }

  /* ── Render email list ── */
  function renderEmailList() {
    const el = document.getElementById('email-list');
    if (!el) return;

    let sorted = [..._emails];
    if (_sort === 'unread') sorted.sort((a, b) => (a.isRead ? 1 : -1) - (b.isRead ? 1 : -1));
    else if (_sort === 'oldest') sorted.reverse();

    if (!sorted.length) {
      el.innerHTML = '<div class="task-empty" style="padding:20px">No emails</div>';
      return;
    }

    const cached = Store.getAll('email_cache');

    el.innerHTML = sorted.map(e => {
      const initials = getInitials(e.from);
      const name     = getDisplayName(e.from);
      const date     = formatEmailDate(e.date);
      const hit      = cached.find(c => c.gmail_id === e.id);
      const osLabel  = hit?.os_label;
      const labelCol = osLabel ? LABEL_COLOURS[osLabel] : null;
      const isActive = e.id === _activeId;

      return `
        <div class="email-row ${e.isRead ? '' : 'email-unread'} ${isActive ? 'email-row-active' : ''}" onclick="EmailModule.openEmail('${escapeHtml(e.id)}')">
          <div class="email-row-star" onclick="event.stopPropagation();EmailModule.toggleStar('${escapeHtml(e.id)}',${!e.isStarred})">
            <i class="ti ti-star${e.isStarred ? ' email-starred' : ''}" aria-hidden="true"></i>
          </div>
          <div class="email-avatar sm">${escapeHtml(initials)}</div>
          <div class="email-row-body">
            <div class="email-row-top">
              <span class="email-row-from ${e.isRead ? '' : 'email-row-from-bold'}">${escapeHtml(name)}</span>
              ${osLabel ? `<span class="email-row-label" style="background:${labelCol}20;color:${labelCol};border:0.5px solid ${labelCol}40">${escapeHtml(osLabel)}</span>` : ''}
              ${hit?.finance_amount ? `<span class="email-row-amount green">$${hit.finance_amount}</span>` : ''}
              <span class="email-row-date">${escapeHtml(date)}</span>
            </div>
            <div class="email-row-subject ${e.isRead ? '' : 'email-row-subject-bold'}">${escapeHtml(e.subject)}</div>
            <div class="email-row-snippet">${escapeHtml(e.snippet)}</div>
          </div>
        </div>`;
    }).join('');
  }

  /* ── Open email ── */
  async function openEmail(id) {
    _activeId = id;
    renderEmailList();

    const emptyEl   = document.getElementById('email-detail-empty');
    const contentEl = document.getElementById('email-detail-content');
    const aiAuthEl  = document.getElementById('email-ai-auth');
    const aiAnalEl  = document.getElementById('email-ai-analysis');
    if (emptyEl)   emptyEl.classList.add('hidden');
    if (contentEl) contentEl.classList.remove('hidden');
    if (aiAuthEl)  aiAuthEl.classList.add('hidden');
    if (aiAnalEl)  aiAnalEl.classList.remove('hidden');

    // Auto-open AI panel
    _aiPanelOpen = true;
    document.getElementById('email-ai-panel')?.classList.add('open');
    const aiToggleBtn = document.getElementById('email-ai-toggle');
    if (aiToggleBtn) aiToggleBtn.style.color = 'var(--green)';

    // Loading state on subject
    const subjectEl = document.getElementById('email-detail-subject');
    if (subjectEl) subjectEl.innerHTML = '<span style="color:var(--fg3)">Loading...</span>';

    // Thinking dots while Claude analyses
    const summaryEl = document.getElementById('email-ai-summary');
    if (summaryEl) {
      summaryEl.innerHTML = `<div style="display:flex;align-items:center;gap:4px;padding:4px 0"><span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span></div>`;
    }

    const actEl = document.getElementById('email-actions-list');
    if (actEl) actEl.innerHTML = '';
    const finEl = document.getElementById('email-finance-alert');
    if (finEl) finEl.style.display = 'none';
    const finCreated = document.getElementById('email-finance-created');
    if (finCreated) finCreated.style.display = 'none';

    // Restore persisted finance badge from cache
    const cachedEmail = Store.getAll('email_cache').find(c => c.gmail_id === id);
    if (cachedEmail?.finance_logged) {
      if (finEl)      finEl.style.display = 'block';
      if (finCreated) finCreated.style.display = 'flex';
    }

    if (!window.electronAPI?.gmailOpen) return;
    const result = await window.electronAPI.gmailOpen(id);

    if (!result.success) {
      if (summaryEl) summaryEl.textContent = 'Failed to load email.';
      return;
    }

    const email    = result.email;
    const analysis = result.analysis;
    _activeEmail   = email;

    const name     = getDisplayName(email.from);
    const addr     = getEmail(email.from);
    const initials = getInitials(email.from);

    setEl('email-detail-subject', email.subject);
    setEl('email-detail-from-name', name);
    setEl('email-detail-from-addr', addr);
    setEl('email-detail-date', formatEmailDate(email.date));
    setEl('email-detail-avatar', initials);

    renderEmailBody(email.body || '');

    // Label badge
    const labelBadge = document.getElementById('email-detail-label-badge');
    if (labelBadge && analysis?.label) {
      const col = LABEL_COLOURS[analysis.label] || '#888';
      labelBadge.innerHTML = `<span style="background:${col}20;color:${col};border:0.5px solid ${col}40;padding:2px 8px;border-radius:3px;font-size:10px">${escapeHtml(analysis.label)}</span>`;
    }

    // Attachments
    const attEl = document.getElementById('email-attachments');
    if (attEl && email.attachments?.length) {
      attEl.innerHTML = `<div class="email-att-label">Attachments (${email.attachments.length})</div>` +
        email.attachments.map(a => `
          <div class="email-attachment">
            <i class="ti ti-file" aria-hidden="true"></i>
            <div>
              <div style="font-size:11px;color:var(--fg)">${escapeHtml(a.filename)}</div>
              <div style="font-size:10px;color:var(--fg3)">${Math.round((a.size || 0) / 1024)} KB</div>
            </div>
          </div>`).join('');
    } else if (attEl) attEl.innerHTML = '';

    // Toolbar wiring
    const archiveBtn = document.getElementById('email-detail-archive');
    const trashBtn   = document.getElementById('email-detail-trash');
    const starBtn    = document.getElementById('email-detail-star');
    if (archiveBtn) archiveBtn.onclick = () => EmailModule.archiveEmail(id);
    if (trashBtn)   trashBtn.onclick   = () => EmailModule.trashEmail(id);
    if (starBtn)    starBtn.onclick     = () => EmailModule.toggleStar(id, !email.isStarred);

    // AI panel
    if (analysis) {
      if (summaryEl) summaryEl.textContent = analysis.summary || 'No summary available.';

      if (analysis.isFinanceAlert && analysis.financeData?.type) {
        if (finEl) finEl.style.display = 'block';
        const finDetail = document.getElementById('email-finance-detail');
        if (finDetail) finDetail.textContent = `${analysis.financeData.type}: $${analysis.financeData.amount} XCD — ${analysis.financeData.description}`;

        if (result.financeCreated) {
          if (finCreated) finCreated.style.display = 'flex';
          const existing = Store.getAll('email_cache').find(c => c.gmail_id === id);
          if (existing) {
            Store.update('email_cache', existing.id, { finance_logged: true, finance_type: result.financeCreated });
          }
          if (typeof Finance !== 'undefined') Finance.renderAll();
        }
      }

      _currentActions = analysis.suggestedActions || [];

      if (actEl && _currentActions.length) {
        actEl.innerHTML = _currentActions.map((a, i) => `
          <div class="email-suggested-action" style="cursor:pointer" onclick="EmailModule.executeAction(${i})">
            <i class="ti ti-circle-check" style="color:var(--green)" aria-hidden="true"></i>
            <div style="flex:1">
              <div style="font-size:11px;color:var(--fg)">${escapeHtml(a.label)}</div>
              <div style="font-size:10px;color:var(--fg3)">${escapeHtml(a.detail || '')}</div>
            </div>
            <i class="ti ti-chevron-right" style="font-size:10px;color:var(--fg3)" aria-hidden="true"></i>
          </div>`).join('');
      } else if (actEl) {
        actEl.innerHTML = '<div class="fg3" style="font-size:10px">No actions suggested</div>';
      }

      // Cache analysis
      const existing = Store.getAll('email_cache').find(c => c.gmail_id === id);
      if (!existing) {
        Store.insert('email_cache', {
          gmail_id:       id,
          subject:        email.subject,
          os_label:       analysis.label,
          summary:        analysis.summary,
          is_finance:     analysis.isFinanceAlert ? 1 : 0,
          finance_amount: analysis.financeData?.amount || null,
          analysed_at:    new Date().toISOString(),
        });
      }
    }

    const emailInList = _emails.find(e => e.id === id);
    if (emailInList) emailInList.isRead = true;
    renderEmailList();
  }

  /* ── Execute a suggested action ── */
  function executeAction(index) {
    const action = _currentActions[index];
    if (!action) return;

    if (action.type === 'create_task') {
      const title = action.detail || (_activeEmail?.subject || 'Email task');
      Store.insert('tasks', { title: title.slice(0, 80), badge: 'biz', done: false });
      if (typeof Dashboard !== 'undefined') Dashboard.renderTasks();
      if (window.electronAPI?.notify) window.electronAPI.notify('Task created', title.slice(0, 60), false);

    } else if (action.type === 'schedule_call' || action.type === 'create_event') {
      navigate('calendar', document.querySelector('[data-module="calendar"]'));
      setTimeout(() => { if (typeof Cal !== 'undefined') Cal.showEventForm(); }, 200);

    } else if (action.type === 'reply') {
      if (window.electronAPI?.notify) window.electronAPI.notify('Reply', 'Compose coming in Phase B', false);

    } else {
      Store.insert('tasks', { title: action.label, badge: 'biz', done: false });
      if (typeof Dashboard !== 'undefined') Dashboard.renderTasks();
    }
  }

  function closeDetail() {
    _activeId    = null;
    _activeEmail = null;
    document.getElementById('email-detail-empty')?.classList.remove('hidden');
    document.getElementById('email-detail-content')?.classList.add('hidden');
    document.getElementById('email-ai-auth')?.classList.remove('hidden');
    document.getElementById('email-ai-analysis')?.classList.add('hidden');
  }

  /* ── AI panel slide-out toggle ── */
  function toggleAIPanel() {
    _aiPanelOpen = !_aiPanelOpen;
    const panel = document.getElementById('email-ai-panel');
    const btn   = document.getElementById('email-ai-toggle');
    if (panel) {
      if (_aiPanelOpen) panel.classList.add('open');
      else              panel.classList.remove('open');
    }
    if (btn) btn.style.color = _aiPanelOpen ? 'var(--green)' : '';
  }

  /* ── Folder unread counts ── */
  async function updateFolderCounts() {
    if (!window.electronAPI?.gmailLabelCounts) return;
    const counts = await window.electronAPI.gmailLabelCounts();
    const map = {
      'INBOX':   'folder-inbox-count',
      'STARRED': 'folder-starred-count',
      'DRAFT':   'folder-drafts-count',
      'SPAM':    'folder-spam-count',
    };
    Object.entries(map).forEach(([label, elId]) => {
      const el = document.getElementById(elId);
      if (el) {
        el.textContent   = counts[label] > 0 ? counts[label] : '';
        el.style.display = counts[label] > 0 ? 'flex' : 'none';
      }
    });
  }

  /* ── Email actions ── */
  async function toggleStar(id, star) {
    if (!window.electronAPI?.gmailAction) return;
    await window.electronAPI.gmailAction(star ? 'star' : 'unstar', id);
    const e = _emails.find(x => x.id === id);
    if (e) { e.isStarred = star; renderEmailList(); }
  }

  async function archiveEmail(id) {
    if (!window.electronAPI?.gmailAction) return;
    await window.electronAPI.gmailAction('archive', id);
    _emails = _emails.filter(e => e.id !== id);
    closeDetail();
    renderEmailList();
  }

  async function trashEmail(id) {
    if (!window.electronAPI?.gmailAction) return;
    await window.electronAPI.gmailAction('trash', id);
    _emails = _emails.filter(e => e.id !== id);
    closeDetail();
    renderEmailList();
  }

  function snooze(when) {
    const labels = { later: 'Later today at 18:00', tomorrow: 'Tomorrow at 09:00', weekend: 'Saturday at 09:00', nextweek: 'Monday at 09:00' };
    if (window.electronAPI?.notify) window.electronAPI.notify('Email snoozed', labels[when] || when, false);
  }

  /* ── Create task from email ── */
  function createTaskFromEmail() {
    if (!_activeEmail) return;
    const title = _activeEmail.subject.slice(0, 60);
    Store.insert('tasks', { title: 'Email: ' + title, badge: 'biz', done: false });
    if (typeof Dashboard !== 'undefined') Dashboard.renderTasks();
    if (window.electronAPI?.notify) window.electronAPI.notify('Task created', title, false);
  }

  /* ── Folder + tab navigation ── */
  function setFolder(folder, btn) {
    _folder = folder;
    document.querySelectorAll('.email-folder-item').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    loadEmails();
  }

  function setTab(tab, btn) {
    _tab = tab;
    document.querySelectorAll('.email-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    loadEmails();
  }

  function setSort(sort) { _sort = sort; renderEmailList(); }

  /* ── Search with clear button + results count ── */
  async function search(query) {
    if (!query || !window.electronAPI?.gmailSearch) return;
    const clearBtn = document.getElementById('email-search-clear');
    if (clearBtn) clearBtn.classList.remove('hidden');
    const listEl = document.getElementById('email-list');
    if (listEl) listEl.innerHTML = '<div class="email-loading"><span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span></div>';
    const result = await window.electronAPI.gmailSearch(query);
    if (result.success) {
      _emails = result.emails;
      renderEmailList();
      const footerEl = document.getElementById('email-list-footer');
      if (footerEl) footerEl.innerHTML = `<span>${result.emails.length} result${result.emails.length !== 1 ? 's' : ''} for &ldquo;${escapeHtml(query)}&rdquo;</span>`;
    }
  }

  function clearSearch() {
    const input    = document.getElementById('email-search');
    const clearBtn = document.getElementById('email-search-clear');
    if (input)    input.value = '';
    if (clearBtn) clearBtn.classList.add('hidden');
    loadEmails();
  }

  /* ── Labels sidebar ── */
  function renderLabels() {
    const el = document.getElementById('email-labels-list');
    if (!el) return;
    const cached = Store.getAll('email_cache');
    el.innerHTML = Object.entries(LABEL_COLOURS).map(([label, col]) => {
      const count = cached.filter(c => c.os_label === label).length;
      return `
        <button class="email-folder-item" onclick="EmailModule.filterByLabel('${escapeHtml(label)}')" style="gap:8px">
          <span style="width:8px;height:8px;border-radius:50%;background:${col};flex-shrink:0"></span>
          ${escapeHtml(label)}
          ${count > 0 ? `<span class="email-folder-count">${count}</span>` : ''}
        </button>`;
    }).join('');
  }

  function filterByLabel(label) {
    const cached   = Store.getAll('email_cache').filter(c => c.os_label === label);
    const ids      = new Set(cached.map(c => c.gmail_id));
    const filtered = _emails.filter(e => ids.has(e.id));
    const el       = document.getElementById('email-list');
    if (!el) return;
    if (!filtered.length) { el.innerHTML = '<div class="task-empty">No emails with this label yet</div>'; return; }
    _emails = filtered;
    renderEmailList();
  }

  /* ── Unread badge ── */
  async function updateUnreadBadge() {
    if (!window.electronAPI?.gmailUnread) return;
    const { count } = await window.electronAPI.gmailUnread();
    const display    = count > 999 ? '999+' : count > 0 ? String(count) : '';
    const badge1     = document.getElementById('email-unread-badge');
    const badge2     = document.getElementById('sidebar-unread-badge');
    const inboxCount = document.getElementById('folder-inbox-count');

    [badge1, badge2].forEach(el => {
      if (el) {
        el.textContent   = display;
        el.style.display = count > 0 ? 'flex' : 'none';
      }
    });

    if (inboxCount) {
      inboxCount.textContent   = count > 0 ? (count > 9999 ? '9999+' : count) : '';
      inboxCount.style.display = count > 0 ? 'inline' : 'none';
    }
  }

  /* ── Polling ── */
  function startPolling() {
    if (_pollTimer) clearInterval(_pollTimer);
    const mins = (_settings.poll_mins || 15) * 60 * 1000;
    _pollTimer = setInterval(async () => {
      await loadEmails();
      await updateUnreadBadge();
    }, mins);
  }

  /* ── Settings ── */
  function toggleSettings() {
    document.getElementById('email-settings-panel')?.classList.toggle('hidden');
  }

  function saveSettings() {
    _settings.poll_mins    = parseInt(document.getElementById('es-poll')?.value) || 15;
    _settings.auto_finance = document.getElementById('es-autofinance')?.checked ?? true;
    Store.set('email_settings', _settings);
    startPolling();
    toggleSettings();
  }

  function compose() {
    if (window.electronAPI?.notify) window.electronAPI.notify('Coming in Phase B', 'Compose will be available in the next sprint.', false);
  }

  function renderEmptyState() {
    const el = document.getElementById('email-list');
    if (el) el.innerHTML = '<div class="task-empty" style="padding:20px">Connect Gmail to see your emails</div>';
  }

  function setEl(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === 'email-detail-body') el.innerHTML = val;
    else el.textContent = val;
  }

  function renderAll() { renderEmailList(); renderLabels(); }

  return {
    init, renderAll, connectGmail,
    openEmail, closeDetail,
    setFolder, setTab, setSort, search, clearSearch,
    toggleStar, archiveEmail, trashEmail, snooze,
    createTaskFromEmail, filterByLabel,
    toggleSettings, saveSettings, compose,
    executeAction, toggleAIPanel, loadMore,
  };

})();

document.addEventListener('DOMContentLoaded', EmailModule.init);
