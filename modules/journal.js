/* ============================================
   SION OS — journal.js
   v2.6.0 — Sprint 13
   Private journal with full CRUD + vault sync
   ============================================ */

const Journal = (() => {

  let _editId = null;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr + 'T00:00:00')
      .toLocaleDateString('en-AG', { weekday:'short', day:'numeric', month:'long', year:'numeric' });
  }

  function isThisMonth(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr), n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }

  /* ── Metrics ── */
  function renderMetrics() {
    const entries = Store.getAll('journal_entries');
    const total   = entries.length;
    const month   = entries.filter(e => isThisMonth(e.entry_date)).length;

    // Streak: consecutive days with an entry
    const sorted = [...entries].sort((a,b) => new Date(b.entry_date) - new Date(a.entry_date));
    let streak = 0;
    if (sorted.length > 0) {
      let check = new Date();
      check.setHours(0,0,0,0);
      for (const e of sorted) {
        const d = new Date(e.entry_date + 'T00:00:00');
        if (d.toDateString() === check.toDateString()) {
          streak++;
          check.setDate(check.getDate() - 1);
        } else break;
      }
    }

    // Avg mood this month
    const moodEntries = entries.filter(e => isThisMonth(e.entry_date) && e.mood);
    const avgMood = moodEntries.length
      ? (moodEntries.reduce((s,e) => s + parseInt(e.mood), 0) / moodEntries.length).toFixed(1)
      : '—';

    setEl('j-total',  total);
    setEl('j-month',  month);
    setEl('j-streak', streak);
    setEl('j-mood',   avgMood);
    setEl('j-count',  total + ' total');
  }

  /* ── Render entries ── */
  function renderEntries() {
    const el = document.getElementById('j-entry-list');
    if (!el) return;

    const entries = Store.getAll('journal_entries')
      .sort((a,b) => new Date(b.entry_date) - new Date(a.entry_date));

    if (!entries.length) {
      el.innerHTML = '<div class="task-empty">no entries yet — write your first one above</div>';
      return;
    }

    const moodLabel = { '5':'Excellent','4':'Good','3':'Neutral','2':'Low','1':'Bad' };
    const moodCls   = { '5':'green','4':'cyan','3':'amber','2':'amber','1':'red' };

    el.innerHTML = entries.map(e => {
      const tags = e.tags ? e.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      const preview = e.body ? e.body.slice(0, 160) + (e.body.length > 160 ? '...' : '') : '';

      return `
        <div class="journal-card" id="j-card-${e.id}">
          <div class="journal-card-header">
            <div class="journal-card-left">
              <div class="journal-card-date">${formatDate(e.entry_date)}</div>
              ${e.title ? `<div class="journal-card-title">${escapeHtml(e.title)}</div>` : ''}
            </div>
            <div class="journal-card-right">
              ${e.mood ? `<span class="journal-mood ${moodCls[e.mood]}">${moodLabel[e.mood] || e.mood}</span>` : ''}
              <button class="task-del" onclick="Journal.editEntry(${e.id})" aria-label="Edit entry" title="Edit">
                <i class="ti ti-pencil" aria-hidden="true"></i>
              </button>
              <button class="task-del" onclick="Journal.deleteEntry(${e.id})" aria-label="Delete entry">
                <i class="ti ti-x" aria-hidden="true"></i>
              </button>
            </div>
          </div>
          ${tags.length ? `
            <div class="journal-tags">
              ${tags.map(t => `<span class="journal-tag">${escapeHtml(t)}</span>`).join('')}
            </div>` : ''}
          <div class="journal-body" id="j-body-${e.id}">${escapeHtml(preview)}</div>
          ${e.body && e.body.length > 160 ? `
            <button class="journal-expand" onclick="Journal.toggleExpand(${e.id}, this)">
              show more
            </button>` : ''}
        </div>`;
    }).join('');
  }

  /* ── Toggle expand ── */
  function toggleExpand(id, btn) {
    const entry = Store.getAll('journal_entries').find(e => e.id === id);
    if (!entry) return;
    const bodyEl = document.getElementById(`j-body-${id}`);
    if (!bodyEl) return;
    const expanded = btn.textContent === 'show less';
    bodyEl.textContent = expanded
      ? entry.body.slice(0, 160) + (entry.body.length > 160 ? '...' : '')
      : entry.body;
    btn.textContent = expanded ? 'show more' : 'show less';
  }

  /* ── Form ── */
  function showEntryForm() {
    _editId = null;
    clearForm();
    const dateEl = document.getElementById('je-date');
    if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
    const titleEl = document.getElementById('j-form-title');
    if (titleEl) titleEl.textContent = 'new journal entry';
    document.getElementById('j-entry-form')?.classList.remove('hidden');
    document.getElementById('je-body')?.focus();
  }

  function hideEntryForm() {
    document.getElementById('j-entry-form')?.classList.add('hidden');
    clearForm();
    _editId = null;
  }

  function clearForm() {
    ['je-title','je-tags','je-body','je-date'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const mood = document.getElementById('je-mood');
    if (mood) mood.value = '';
  }

  /* ── Edit ── */
  function editEntry(id) {
    const entry = Store.getAll('journal_entries').find(e => e.id === id);
    if (!entry) return;
    _editId = id;
    const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
    set('je-title', entry.title);
    set('je-date',  entry.entry_date);
    set('je-mood',  entry.mood);
    set('je-tags',  entry.tags);
    set('je-body',  entry.body);
    const titleEl = document.getElementById('j-form-title');
    if (titleEl) titleEl.textContent = 'edit entry — ' + formatDate(entry.entry_date);
    document.getElementById('j-entry-form')?.classList.remove('hidden');
    document.getElementById('je-body')?.focus();
  }

  /* ── Save ── */
  function saveEntry() {
    const body = document.getElementById('je-body')?.value.trim();
    if (!body) { document.getElementById('je-body')?.focus(); return; }

    const data = {
      title:      document.getElementById('je-title')?.value.trim() || '',
      entry_date: document.getElementById('je-date')?.value || new Date().toISOString().split('T')[0],
      mood:       document.getElementById('je-mood')?.value || '',
      tags:       document.getElementById('je-tags')?.value || '',
      body,
    };

    let entry;
    if (_editId) {
      Store.update('journal_entries', _editId, data);
      entry = { id: _editId, ...data };
    } else {
      entry = Store.insert('journal_entries', data);
    }

    // Vault sync
    if (window.electronAPI?.writeVaultNote) {
      const date  = data.entry_date;
      const tags  = data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      window.electronAPI.writeVaultNote(
        `daily/${date}-journal.md`,
        { date, type: 'journal', status: 'active', project: 'personal', tags: JSON.stringify(['journal', ...tags]) },
        `# ${data.title || 'Journal — ' + date}\n\n${data.mood ? '**Mood:** ' + data.mood + '/5\n\n' : ''}${body}\n`
      );
    }

    hideEntryForm();
    renderAll();
  }

  /* ── Delete ── */
  function deleteEntry(id) {
    Store.delete('journal_entries', id);
    renderAll();
  }

  function setEl(id, val) {
    const el = document.getElementById(id); if (el) el.textContent = val;
  }

  function renderAll() {
    renderMetrics();
    renderEntries();
  }

  function init() { renderAll(); }

  return {
    init, renderAll,
    showEntryForm, hideEntryForm, saveEntry,
    editEntry, deleteEntry, toggleExpand,
  };

})();

document.addEventListener('DOMContentLoaded', Journal.init);
