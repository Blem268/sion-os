/* ============================================
   SION OS — goals.js
   Dedicated goals & milestones page — life section
   ============================================ */

const Goals = (() => {

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    const today  = new Date();
    today.setHours(0,0,0,0); target.setHours(0,0,0,0);
    return Math.ceil((target - today) / 86400000);
  }

  /* ── Summary metric cards ── */
  function renderSummary() {
    const el = document.getElementById('goals-summary');
    if (!el) return;
    const milestones = Store.getAll('milestones');
    const total    = milestones.length;
    const achieved = milestones.filter(m => m.target_value != null && (m.current_value || 0) >= m.target_value).length;
    const upcoming = milestones.filter(m => { const d = daysUntil(m.target_date); return d !== null && d >= 0 && d <= 30; }).length;
    const overdue  = milestones.filter(m => { const d = daysUntil(m.target_date); return d !== null && d < 0; }).length;

    el.innerHTML = `
      <div class="metric-card cyan-accent">
        <div class="mc-label">total goals</div>
        <div class="mc-val white">${total}</div>
        <div class="mc-sub">milestones tracked</div>
      </div>
      <div class="metric-card ${achieved > 0 ? 'green-accent' : ''}">
        <div class="mc-label">achieved</div>
        <div class="mc-val ${achieved > 0 ? 'green' : 'fg3'}">${achieved}</div>
        <div class="mc-sub">target value reached</div>
      </div>
      <div class="metric-card ${upcoming > 0 ? 'amber-accent' : ''}">
        <div class="mc-label">due within 30d</div>
        <div class="mc-val ${upcoming > 0 ? 'amber' : 'fg3'}">${upcoming}</div>
        <div class="mc-sub">upcoming deadlines</div>
      </div>
      <div class="metric-card ${overdue > 0 ? 'red-accent' : ''}">
        <div class="mc-label">overdue</div>
        <div class="mc-val ${overdue > 0 ? 'red' : 'fg3'}">${overdue}</div>
        <div class="mc-sub">past target date</div>
      </div>`;
  }

  /* ── Milestones list ── */
  function renderMilestones() {
    const el = document.getElementById('goals-list');
    if (!el) return;
    const milestones = Store.getAll('milestones');
    if (!milestones.length) {
      el.innerHTML = '<div class="task-empty">no goals yet — add one above</div>';
      return;
    }

    const sorted = milestones.slice().sort((a, b) => {
      const da = a.target_date ? daysUntil(a.target_date) : Infinity;
      const db = b.target_date ? daysUntil(b.target_date) : Infinity;
      return da - db;
    });

    el.innerHTML = sorted.map(m => {
      const days     = daysUntil(m.target_date);
      const hasProg  = m.target_value != null;
      const pct      = hasProg ? Math.min(100, Math.max(0, Math.round((m.current_value || 0) / m.target_value * 100))) : null;
      const achieved = hasProg && (m.current_value || 0) >= m.target_value;

      let cdHtml = '';
      if (days !== null) {
        const cls   = days < 0 ? 'red' : days <= 14 ? 'amber' : 'cyan';
        const label = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'due today' : `${days}d remaining`;
        cdHtml = `<span class="ms-countdown ${cls}">${label}</span>`;
      }

      let progHtml = '';
      if (hasProg) {
        const pctCls = achieved ? 'green' : pct >= 75 ? 'cyan' : pct >= 40 ? 'amber' : 'red';
        const cur  = (m.current_value || 0).toLocaleString();
        const tgt  = m.target_value.toLocaleString();
        const unit = m.unit ? ' ' + m.unit : '';
        progHtml = `
          <div class="goals-prog-row">
            <div class="goals-prog-track">
              <div class="prog-fill ${pctCls}-fill" style="width:${pct}%"></div>
            </div>
            <span class="goals-prog-pct ${pctCls}">${pct}%${achieved ? ' ✓' : ''}</span>
          </div>
          <div class="goals-prog-label">${cur}${unit} <span class="fg3">of</span> ${tgt}${unit}</div>`;
      }

      const dateStr = m.target_date
        ? new Date(m.target_date + 'T00:00:00').toLocaleDateString('en-AG', { day: 'numeric', month: 'short', year: 'numeric' })
        : null;

      const cardCls = achieved ? ' goals-achieved' : days !== null && days < 0 ? ' goals-overdue' : '';

      return `<div class="goals-card${cardCls}">
        <div class="goals-card-top">
          <div>
            <div class="goals-name">${escapeHtml(m.name)}</div>
            ${dateStr ? `<div class="goals-date-label"><i class="ti ti-calendar" style="font-size:10px"></i> ${dateStr}</div>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            ${cdHtml}
            <button class="task-del" onclick="Goals.showForm(${m.id})" aria-label="Edit">
              <i class="ti ti-pencil" aria-hidden="true"></i>
            </button>
            <button class="task-del" onclick="Goals.deleteGoal(${m.id})" aria-label="Delete">
              <i class="ti ti-x" aria-hidden="true"></i>
            </button>
          </div>
        </div>
        ${progHtml}
      </div>`;
    }).join('');
  }

  /* ── Form ── */
  function showForm(id) {
    const form = document.getElementById('goals-form');
    if (!form) return;
    if (id) {
      const m = Store.getAll('milestones').find(x => x.id === id);
      if (!m) return;
      document.getElementById('gl-name').value    = m.name || '';
      document.getElementById('gl-date').value    = m.target_date || '';
      document.getElementById('gl-target').value  = m.target_value ?? '';
      document.getElementById('gl-current').value = m.current_value ?? '';
      document.getElementById('gl-unit').value    = m.unit || '';
      form.dataset.editId = id;
      document.querySelector('#goals-form .form-title').textContent = 'edit goal';
    } else {
      ['gl-name','gl-date','gl-target','gl-current','gl-unit'].forEach(x => {
        const el = document.getElementById(x); if (el) el.value = '';
      });
      form.dataset.editId = '';
      document.querySelector('#goals-form .form-title').textContent = 'new goal';
    }
    form.classList.remove('hidden');
    document.getElementById('gl-name')?.focus();
  }

  function hideForm() {
    document.getElementById('goals-form')?.classList.add('hidden');
  }

  function saveGoal() {
    const name = document.getElementById('gl-name')?.value.trim();
    if (!name) { document.getElementById('gl-name')?.focus(); return; }
    const form   = document.getElementById('goals-form');
    const editId = form?.dataset.editId ? parseInt(form.dataset.editId) : null;
    const data = {
      name,
      target_date:   document.getElementById('gl-date')?.value        || null,
      target_value:  parseFloat(document.getElementById('gl-target')?.value)  || null,
      current_value: parseFloat(document.getElementById('gl-current')?.value) || null,
      unit:          document.getElementById('gl-unit')?.value.trim() || null,
    };
    if (editId) Store.update('milestones', editId, data);
    else Store.insert('milestones', { ...data, pinned: false });
    hideForm();
    renderAll();
    window.dispatchEvent(new CustomEvent('milestones-changed'));
  }

  function deleteGoal(id) {
    Store.delete('milestones', id);
    renderAll();
    window.dispatchEvent(new CustomEvent('milestones-changed'));
  }

  function renderAll() {
    renderSummary();
    renderMilestones();
  }

  function init() {
    renderAll();
    window.addEventListener('milestones-changed', renderAll);
  }

  return { init, renderAll, showForm, hideForm, saveGoal, deleteGoal };

})();

document.addEventListener('DOMContentLoaded', Goals.init);
