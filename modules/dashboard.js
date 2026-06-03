/* ============================================
   SION OS — dashboard.js
   v1.0.0 — Sprint 7
   US-001: Morning priority view
   US-002: D-Max countdown + custom milestones
   Sprint 7: Live data from all modules + alerts
   ============================================ */

const Dashboard = (() => {

  const WEIGHT_START  = 137;
  const WEIGHT_TARGET = 160;
  const DMAX_MONTHLY  = 3414.83;

  function daysUntil(dateStr) {
    const target = new Date(dateStr);
    const today  = new Date();
    today.setHours(0,0,0,0);
    target.setHours(0,0,0,0);
    return Math.ceil((target - today) / 86400000);
  }

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function isThisMonth(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }

  /* ── Seeds ── */
  function seedTasks() {
    if (Store.getAll('tasks').length > 0) return;
    [
      { title: 'Silcomm — inbox zero & filing sweep',    badge: 'work',     done: false },
      { title: 'Blueport — confirm D-Max delivery date', badge: 'blueport', done: false },
      { title: 'ACCA FOA — chapter reading',             badge: 'study',    done: false },
      { title: 'Gym — log today\'s workout',             badge: 'gym',      done: false },
      { title: 'Younity — review pipeline',              badge: 'biz',      done: false },
    ].forEach(t => Store.insert('tasks', t));
  }

  function seedMilestones() {
    if (Store.getAll('milestones').length > 0) return;
    [
      { name: 'D-Max arrival',   target_date: '2026-08-01', target_value: 160000, current_value: 0,   unit: 'XCD',  pinned: true  },
      { name: 'Weight goal',     target_date: null,          target_value: 160,    current_value: 137, unit: 'lbs',  pinned: false },
      { name: 'Blueport launch', target_date: '2026-09-01', target_value: null,   current_value: null, unit: null,   pinned: false },
    ].forEach(m => Store.insert('milestones', m));
  }

  /* ── Live metrics from all modules ── */
  function renderMetrics() {
    // D-Max countdown
    const dmaxDays = daysUntil('2026-08-01');
    const bpDays   = daysUntil('2026-09-01');
    const dmaxEl   = document.getElementById('dmax-days');
    const dmaxSub  = document.getElementById('dmax-sub');
    const bpSub    = document.getElementById('blueport-days-sub');
    if (dmaxEl) {
      if (dmaxDays > 0) {
        dmaxEl.textContent = dmaxDays + 'd';
        if (dmaxSub) dmaxSub.textContent = 'jul/aug 2026 · $3,414.83/mo from aug';
      } else {
        dmaxEl.textContent = 'arrived';
        dmaxEl.className = 'mc-val green';
      }
    }
    if (bpSub) bpSub.textContent = bpDays > 0 ? bpDays + ' days away' : 'launched!';

    // Live weight from gym module
    const weightEntries = Store.getAll('gym_weight')
      .sort((a,b) => new Date(b.logged_date) - new Date(a.logged_date));
    const currentWeight = weightEntries.length > 0
      ? parseFloat(weightEntries[0].weight_lbs) : WEIGHT_START;
    const weightEl = document.getElementById('dash-weight-val');
    const weightSub = document.getElementById('dash-weight-sub');
    if (weightEl) weightEl.textContent = currentWeight.toFixed(1);
    if (weightSub) weightSub.textContent = Math.max(0, WEIGHT_TARGET - currentWeight).toFixed(1) + ' lb to go';

    // Live Blem revenue
    const blemJobs    = Store.getAll('blem_jobs');
    const blemRevenue = blemJobs
      .filter(j => isThisMonth(j.created_at))
      .reduce((s,j) => s + (parseFloat(j.amount_paid_xcd) || 0), 0);
    const blemActive  = blemJobs.filter(j => j.status !== 'Complete').length;
    const blemEl      = document.getElementById('dash-blem-val');
    const blemSub     = document.getElementById('dash-blem-sub');
    if (blemEl)  blemEl.textContent  = '$' + blemRevenue.toLocaleString();
    if (blemSub) blemSub.textContent = blemActive + ' active job' + (blemActive !== 1 ? 's' : '');

    // Live Younity gap
    const younityClients = Store.getAll('younity_clients');
    const younityRevenue = younityClients
      .filter(c => c.stage === 'Active' || c.stage === 'Retained')
      .reduce((s,c) => s + (parseFloat(c.contract_value_xcd) || 0), 0);
    const younityGap  = Math.max(0, 2000 - younityRevenue);
    const younityEl   = document.getElementById('dash-younity-val');
    const younitySub  = document.getElementById('dash-younity-sub');
    if (younityEl)  younityEl.textContent  = '$' + younityGap.toLocaleString();
    if (younitySub) younitySub.textContent = younityGap === 0 ? 'target hit!' : 'gap to $2K target';

    // Finance coverage
    const income   = Store.getAll('income')
      .filter(i => isThisMonth(i.received_date))
      .reduce((s,i) => s + (parseFloat(i.amount_xcd) || 0), 0);
    const expenses = Store.getAll('expenses')
      .filter(e => isThisMonth(e.expense_date))
      .reduce((s,e) => s + (parseFloat(e.amount_xcd) || 0), 0);
    const net      = income - expenses;
    const coverage = Math.round(net / DMAX_MONTHLY * 100);
    const covEl    = document.getElementById('dash-coverage-val');
    const covSub   = document.getElementById('dash-coverage-sub');
    if (covEl) {
      covEl.textContent = coverage + '%';
      covEl.className   = 'mc-val ' + (coverage >= 120 ? 'green' : coverage >= 100 ? 'amber' : 'red');
    }
    if (covSub) covSub.textContent = 'of D-Max payment covered';
  }

  /* ── Live progress bars ── */
  function renderProgress() {
    // Weight
    const entries = Store.getAll('gym_weight')
      .sort((a,b) => new Date(b.logged_date) - new Date(a.logged_date));
    const currentWeight = entries.length > 0
      ? parseFloat(entries[0].weight_lbs) : WEIGHT_START;
    const weightPct = Math.min(100, Math.max(0,
      Math.round((currentWeight - WEIGHT_START) / (WEIGHT_TARGET - WEIGHT_START) * 100)
    ));

    // Blueport
    const bpTasks = Store.getAll('blueport_tasks');
    const bpDone  = bpTasks.filter(t => t.done).length;
    const bpTotal = bpTasks.length || 15;
    const bpPct   = Math.round(bpDone / bpTotal * 100);

    // Younity
    const yClients = Store.getAll('younity_clients');
    const yRevenue = yClients
      .filter(c => c.stage === 'Active' || c.stage === 'Retained')
      .reduce((s,c) => s + (parseFloat(c.contract_value_xcd) || 0), 0);
    const yPct = Math.min(100, Math.round(yRevenue / 2000 * 100));

    setBar('pb-weight',   'pb-weight-pct',   weightPct, weightPct + '%');
    setBar('pb-blueport', 'pb-blueport-pct', bpPct,     bpPct + '%');
    setBar('pb-younity',  'pb-younity-pct',  yPct,      yPct + '%');
  }

  function setBar(barId, pctId, pct, label) {
    const bar = document.getElementById(barId);
    const lbl = document.getElementById(pctId);
    if (bar) bar.style.width = pct + '%';
    if (lbl) lbl.textContent = label;
  }

  /* ── Smart alerts ── */
  function renderAlerts() {
    const el = document.getElementById('dash-alerts');
    if (!el) return;

    const alerts = [];

    // D-Max coverage
    const income = Store.getAll('income')
      .filter(i => isThisMonth(i.received_date))
      .reduce((s,i) => s + (parseFloat(i.amount_xcd) || 0), 0);
    const expenses = Store.getAll('expenses')
      .filter(e => isThisMonth(e.expense_date))
      .reduce((s,e) => s + (parseFloat(e.amount_xcd) || 0), 0);
    const net = income - expenses;
    const coverage = net / DMAX_MONTHLY * 100;
    if (coverage < 100 && (income > 0 || expenses > 0)) {
      alerts.push({ level: 'red', msg: 'D-Max coverage is ' + Math.round(coverage) + '% — net income below $3,414.83 this month' });
    }

    // Overdue Younity next actions
    const overdueY = Store.getAll('younity_clients')
      .filter(c => c.next_action_date && new Date(c.next_action_date + 'T00:00:00') < new Date() && c.stage !== 'Lost');
    if (overdueY.length > 0) {
      alerts.push({ level: 'amber', msg: overdueY.length + ' Younity client' + (overdueY.length > 1 ? 's' : '') + ' with overdue follow-up' });
    }

    // Overdue Blueport tasks
    const overdueB = Store.getAll('blueport_tasks')
      .filter(t => !t.done && t.due_date && new Date(t.due_date + 'T00:00:00') < new Date());
    if (overdueB.length > 0) {
      alerts.push({ level: 'amber', msg: overdueB.length + ' Blueport task' + (overdueB.length > 1 ? 's' : '') + ' overdue — launch at risk' });
    }

    // No Blem jobs in 14 days
    const blemJobs = Store.getAll('blem_jobs');
    if (blemJobs.length > 0) {
      const latest   = blemJobs.slice().sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0];
      const daysSince = Math.floor((new Date() - new Date(latest.created_at)) / 86400000);
      if (daysSince >= 14) {
        alerts.push({ level: 'amber', msg: 'No Blem Tuned job logged in ' + daysSince + ' days — pipeline running dry?' });
      }
    }

    // Weight not logged in 3 days
    const weightEntries = Store.getAll('gym_weight');
    if (weightEntries.length > 0) {
      const latest    = weightEntries.slice().sort((a,b) => new Date(b.logged_date) - new Date(a.logged_date))[0];
      const daysSince = Math.floor((new Date() - new Date(latest.logged_date + 'T00:00:00')) / 86400000);
      if (daysSince >= 3) {
        alerts.push({ level: 'gray', msg: 'Weight not logged in ' + daysSince + ' days — still on track?' });
      }
    }

    if (!alerts.length) {
      el.innerHTML = '<div class="alert-ok"><i class="ti ti-circle-check" aria-hidden="true"></i> All systems clear</div>';
      return;
    }

    el.innerHTML = alerts.map(a => `
      <div class="alert-item alert-${a.level}">
        <i class="ti ti-alert-triangle" aria-hidden="true"></i>
        ${escapeHtml(a.msg)}
      </div>`).join('');
  }

  /* ── Task queue ── */
  function renderTasks() {
    const el      = document.getElementById('dash-task-list');
    const countEl = document.getElementById('dash-task-count');
    if (!el) return;

    const tasks  = Store.getAll('tasks');
    const open   = tasks.filter(t => !t.done);
    const done   = tasks.filter(t => t.done);
    const sorted = [...open, ...done];

    if (countEl) countEl.textContent = open.length + ' open · ' + done.length + ' done';

    if (!tasks.length) {
      el.innerHTML = '<div class="task-empty">no tasks — add one below</div>';
      return;
    }

    el.innerHTML = sorted.map(t => `
      <div class="task-row${t.done ? ' task-done' : ''}">
        <div class="task-check${t.done ? ' checked' : ''}"
             onclick="Dashboard.toggleTask(${t.id})"
             role="checkbox" aria-checked="${t.done}"
             aria-label="Mark task done">
          ${t.done ? '<i class="ti ti-check" aria-hidden="true"></i>' : ''}
        </div>
        <span class="task-title">${escapeHtml(t.title)}</span>
        <span class="task-badge badge-${t.badge || 'biz'}">${t.badge || 'task'}</span>
        <button class="task-del" onclick="Dashboard.deleteTask(${t.id})" aria-label="Delete task">
          <i class="ti ti-x" aria-hidden="true"></i>
        </button>
      </div>
    `).join('');
  }

  function toggleTask(id) {
    const task = Store.getAll('tasks').find(t => t.id === id);
    if (!task) return;
    Store.update('tasks', id, { done: !task.done });
    renderTasks();
  }

  function deleteTask(id) {
    Store.delete('tasks', id);
    renderTasks();
  }

  function quickAddTask() {
    const input = document.getElementById('dash-quick-add');
    const badge = document.getElementById('dash-quick-badge');
    const title = input ? input.value.trim() : '';
    if (!title) return;
    Store.insert('tasks', { title, badge: badge ? badge.value : 'biz', done: false });
    input.value = '';
    renderTasks();
    input.focus();
  }

  /* ── Milestones ── */
  function renderMilestones() {
    const el = document.getElementById('milestone-list');
    if (!el) return;
    const milestones = Store.getAll('milestones');
    if (!milestones.length) {
      el.innerHTML = '<div class="task-empty">no milestones — add one above</div>';
      return;
    }

    el.innerHTML = milestones.map(m => {
      const days    = m.target_date ? daysUntil(m.target_date) : null;
      const hasProg = m.target_value != null;
      const pct     = hasProg
        ? Math.min(100, Math.max(0, Math.round((m.current_value || 0) / m.target_value * 100)))
        : null;

      let cdHtml = '';
      if (days !== null) {
        const label = days > 0 ? days + 'd away' : days === 0 ? 'today' : 'passed';
        const cls   = days <= 14 ? 'red' : days <= 60 ? 'amber' : 'cyan';
        cdHtml = `<span class="ms-countdown ${cls}">${label}</span>`;
      }

      let progHtml = '';
      if (hasProg) {
        const cur  = (m.current_value || 0).toLocaleString();
        const tgt  = m.target_value.toLocaleString();
        const unit = m.unit ? ' ' + m.unit : '';
        progHtml = `
          <div class="ms-prog-row">
            <div class="ms-prog-track">
              <div class="ms-prog-fill" style="width:${pct}%"></div>
            </div>
            <span class="ms-prog-pct">${pct}%</span>
          </div>
          <div class="ms-prog-label">${cur}${unit} of ${tgt}${unit}</div>`;
      }

      return `
        <div class="milestone-card">
          <div class="ms-top">
            <span class="ms-name">${escapeHtml(m.name)}</span>
            <div class="ms-actions">
              ${cdHtml}
              <button class="task-del" onclick="Dashboard.editMilestone(${m.id})" aria-label="Edit">
                <i class="ti ti-edit" aria-hidden="true"></i>
              </button>
              <button class="task-del" onclick="Dashboard.deleteMilestone(${m.id})" aria-label="Delete">
                <i class="ti ti-x" aria-hidden="true"></i>
              </button>
            </div>
          </div>
          ${progHtml}
        </div>`;
    }).join('');
  }

  function showAddMilestone() {
    clearForm();
    document.getElementById('milestone-form').classList.remove('hidden');
    document.getElementById('ms-name').focus();
  }

  function hideMilestoneForm() {
    document.getElementById('milestone-form').classList.add('hidden');
    clearForm();
  }

  function clearForm() {
    ['ms-name','ms-date','ms-target','ms-current','ms-unit'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('milestone-form').dataset.editId = '';
  }

  function saveMilestone() {
    const name    = document.getElementById('ms-name').value.trim();
    const date    = document.getElementById('ms-date').value || null;
    const target  = parseFloat(document.getElementById('ms-target').value)  || null;
    const current = parseFloat(document.getElementById('ms-current').value) || null;
    const unit    = document.getElementById('ms-unit').value.trim() || null;
    if (!name) { document.getElementById('ms-name').focus(); return; }

    const editId = document.getElementById('milestone-form').dataset.editId;
    if (editId) {
      Store.update('milestones', parseInt(editId), { name, target_date: date, target_value: target, current_value: current, unit });
    } else {
      Store.insert('milestones', { name, target_date: date, target_value: target, current_value: current, unit, pinned: false });
    }
    hideMilestoneForm();
    renderMilestones();
    renderProgress();
  }

  function editMilestone(id) {
    const m = Store.getAll('milestones').find(x => x.id === id);
    if (!m) return;
    document.getElementById('ms-name').value    = m.name || '';
    document.getElementById('ms-date').value    = m.target_date || '';
    document.getElementById('ms-target').value  = m.target_value ?? '';
    document.getElementById('ms-current').value = m.current_value ?? '';
    document.getElementById('ms-unit').value    = m.unit || '';
    document.getElementById('milestone-form').dataset.editId = id;
    document.getElementById('milestone-form').classList.remove('hidden');
    document.getElementById('ms-name').focus();
  }

  function deleteMilestone(id) {
    Store.delete('milestones', id);
    renderMilestones();
  }

  function renderAll() {
    const greeting = document.getElementById('dash-greeting-text');
    if (greeting) greeting.textContent = getGreeting();
    renderMetrics();
    renderProgress();
    renderAlerts();
    renderTasks();
    renderMilestones();
  }

  function init() {
    seedTasks();
    seedMilestones();
    renderAll();
  }

  return {
    init, renderAll, renderTasks, renderMilestones, renderMetrics, renderProgress,
    toggleTask, deleteTask, quickAddTask,
    showAddMilestone, hideMilestoneForm, saveMilestone,
    editMilestone, deleteMilestone,
  };

})();

document.addEventListener('DOMContentLoaded', Dashboard.init);
