/* ============================================
   SION OS — dashboard.js
   v0.2.0 — Sprint 1
   US-001: Morning priority view
   US-002: D-Max countdown + custom milestones
   ============================================ */

const Dashboard = (() => {

  /* ── Constants ── */
  const DMAX_TARGET    = new Date('2026-08-01');
  const BLUEPORT_TARGET = new Date('2026-09-01');
  const WEIGHT_START   = 137;
  const WEIGHT_TARGET  = 160;
  const DMAX_MONTHLY   = 3414.83;

  /* ── Seed default tasks if first load ── */
  function seedDefaultTasks() {
    const existing = Store.getAll('tasks');
    if (existing.length > 0) return;
    const defaults = [
      { title: 'Silcomm — inbox zero & filing sweep',        badge: 'work',      done: false },
      { title: 'Blueport — confirm D-Max delivery date',     badge: 'blueport',  done: false },
      { title: 'ACCA FOA — chapter reading',                 badge: 'study',     done: false },
      { title: 'Gym — log today\'s workout',                 badge: 'gym',       done: false },
      { title: 'Younity — review pipeline',                  badge: 'biz',       done: false },
    ];
    defaults.forEach(t => Store.insert('tasks', t));
  }

  /* ── Seed default milestones if first load ── */
  function seedDefaultMilestones() {
    const existing = Store.getAll('milestones');
    if (existing.length > 0) return;
    const defaults = [
      {
        name: 'D-Max arrival',
        target_date: '2026-08-01',
        target_value: 160000,
        current_value: 0,
        unit: 'XCD',
        pinned: true
      },
      {
        name: 'Weight goal',
        target_date: null,
        target_value: 160,
        current_value: 137,
        unit: 'lbs',
        pinned: false
      },
      {
        name: 'Blueport launch',
        target_date: '2026-09-01',
        target_value: null,
        current_value: null,
        unit: null,
        pinned: false
      }
    ];
    defaults.forEach(m => Store.insert('milestones', m));
  }

  /* ── Greeting based on time ── */
  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  /* ── Days between two dates ── */
  function daysUntil(dateStr) {
    const target = new Date(dateStr);
    const today  = new Date();
    today.setHours(0,0,0,0);
    target.setHours(0,0,0,0);
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  }

  /* ── Render metric cards ── */
  function renderMetrics() {
    const dmaxDays = daysUntil('2026-08-01');
    const bpDays   = daysUntil('2026-09-01');

    const dmaxEl  = document.getElementById('dmax-days');
    const dmaxSub = document.getElementById('dmax-sub');
    const bpSub   = document.getElementById('blueport-days-sub');

    if (dmaxEl) {
      if (dmaxDays > 0) {
        dmaxEl.textContent = dmaxDays + 'd';
        dmaxSub.textContent = 'jul/aug 2026 · $' + DMAX_MONTHLY.toLocaleString() + '/mo';
      } else {
        dmaxEl.textContent = 'arrived';
        dmaxEl.className = 'mc-val green';
      }
    }
    if (bpSub) {
      bpSub.textContent = bpDays > 0 ? bpDays + ' days away' : 'launched';
    }
  }

  /* ── Render progress bars ── */
  function renderProgress() {
    const milestones = Store.getAll('milestones');
    const weightMs   = milestones.find(m => m.name === 'Weight goal');
    const weightCur  = weightMs ? (weightMs.current_value || WEIGHT_START) : WEIGHT_START;
    const weightPct  = Math.min(100, Math.max(0,
      Math.round((weightCur - WEIGHT_START) / (WEIGHT_TARGET - WEIGHT_START) * 100)
    ));

    const tasks    = Store.getAll('blueport_tasks');
    const bpDone   = tasks.filter(t => t.done).length;
    const bpTotal  = tasks.length || 15;
    const bpPct    = Math.round(bpDone / bpTotal * 100);

    setBar('pb-weight',   'pb-weight-pct',   weightPct, weightPct + '%');
    setBar('pb-blueport', 'pb-blueport-pct', bpPct,     bpPct + '%');
  }

  function setBar(barId, pctId, pct, label) {
    const bar = document.getElementById(barId);
    const lbl = document.getElementById(pctId);
    if (bar) bar.style.width = pct + '%';
    if (lbl) lbl.textContent = label;
  }

  /* ── Render task list ── */
  function renderTasks() {
    const el = document.getElementById('dash-task-list');
    const countEl = document.getElementById('dash-task-count');
    if (!el) return;

    const tasks = Store.getAll('tasks');
    const open  = tasks.filter(t => !t.done);
    const done  = tasks.filter(t => t.done);
    const sorted = [...open, ...done];

    if (countEl) {
      countEl.textContent = open.length + ' open · ' + done.length + ' done';
    }

    if (tasks.length === 0) {
      el.innerHTML = '<div class="task-empty">no tasks — add one below</div>';
      return;
    }

    el.innerHTML = sorted.map(t => `
      <div class="task-row ${t.done ? 'task-done' : ''}" id="task-${t.id}">
        <div class="task-check ${t.done ? 'checked' : ''}"
             onclick="Dashboard.toggleTask(${t.id})"
             role="checkbox"
             aria-checked="${t.done}"
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

  /* ── Toggle task done ── */
  function toggleTask(id) {
    const tasks = Store.getAll('tasks');
    const task  = tasks.find(t => t.id === id);
    if (!task) return;
    Store.update('tasks', id, { done: !task.done });
    renderTasks();
  }

  /* ── Delete task ── */
  function deleteTask(id) {
    Store.delete('tasks', id);
    renderTasks();
  }

  /* ── Quick add task ── */
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

  /* ── Render milestones ── */
  function renderMilestones() {
    const el = document.getElementById('milestone-list');
    if (!el) return;
    const milestones = Store.getAll('milestones');

    if (milestones.length === 0) {
      el.innerHTML = '<div class="task-empty">no milestones — add one above</div>';
      return;
    }

    el.innerHTML = milestones.map(m => {
      const days    = m.target_date ? daysUntil(m.target_date) : null;
      const hasProg = m.target_value !== null && m.target_value !== undefined;
      const pct     = hasProg
        ? Math.min(100, Math.max(0, Math.round((m.current_value || 0) / m.target_value * 100)))
        : null;

      let countdownHtml = '';
      if (days !== null) {
        const label = days > 0 ? days + 'd away' : days === 0 ? 'today' : 'passed';
        const cls   = days <= 14 ? 'red' : days <= 60 ? 'amber' : 'cyan';
        countdownHtml = `<span class="ms-countdown ${cls}">${label}</span>`;
      }

      let progressHtml = '';
      if (hasProg) {
        const cur = (m.current_value || 0).toLocaleString();
        const tgt = m.target_value.toLocaleString();
        const unit = m.unit ? ' ' + m.unit : '';
        progressHtml = `
          <div class="ms-prog-row">
            <div class="ms-prog-track">
              <div class="ms-prog-fill" style="width:${pct}%"></div>
            </div>
            <span class="ms-prog-pct">${pct}%</span>
          </div>
          <div class="ms-prog-label">${cur}${unit} of ${tgt}${unit}</div>
        `;
      }

      return `
        <div class="milestone-card">
          <div class="ms-top">
            <span class="ms-name">${escapeHtml(m.name)}</span>
            <div class="ms-actions">
              ${countdownHtml}
              <button class="task-del" onclick="Dashboard.editMilestone(${m.id})" aria-label="Edit milestone">
                <i class="ti ti-edit" aria-hidden="true"></i>
              </button>
              <button class="task-del" onclick="Dashboard.deleteMilestone(${m.id})" aria-label="Delete milestone">
                <i class="ti ti-x" aria-hidden="true"></i>
              </button>
            </div>
          </div>
          ${progressHtml}
        </div>
      `;
    }).join('');
  }

  /* ── Milestone form ── */
  function showAddMilestone() {
    clearMilestoneForm();
    document.getElementById('milestone-form').classList.remove('hidden');
    document.getElementById('ms-name').focus();
  }

  function hideMilestoneForm() {
    document.getElementById('milestone-form').classList.add('hidden');
    clearMilestoneForm();
  }

  function clearMilestoneForm() {
    ['ms-name','ms-date','ms-target','ms-current','ms-unit'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('milestone-form').dataset.editId = '';
  }

  function saveMilestone() {
    const name    = document.getElementById('ms-name').value.trim();
    const date    = document.getElementById('ms-date').value || null;
    const target  = parseFloat(document.getElementById('ms-target').value) || null;
    const current = parseFloat(document.getElementById('ms-current').value) || null;
    const unit    = document.getElementById('ms-unit').value.trim() || null;

    if (!name) {
      document.getElementById('ms-name').focus();
      return;
    }

    const editId = document.getElementById('milestone-form').dataset.editId;
    if (editId) {
      Store.update('milestones', parseInt(editId), {
        name, target_date: date, target_value: target,
        current_value: current, unit
      });
    } else {
      Store.insert('milestones', {
        name, target_date: date, target_value: target,
        current_value: current, unit, pinned: false
      });
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

  /* ── Helper: escape HTML ── */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Init ── */
  function init() {
    const greeting = document.getElementById('dash-greeting-text');
    if (greeting) greeting.textContent = getGreeting();

    seedDefaultTasks();
    seedDefaultMilestones();
    renderMetrics();
    renderProgress();
    renderTasks();
    renderMilestones();
  }

  /* ── Public API ── */
  return {
    init,
    toggleTask,
    deleteTask,
    quickAddTask,
    showAddMilestone,
    hideMilestoneForm,
    saveMilestone,
    editMilestone,
    deleteMilestone,
    renderTasks,
    renderMilestones,
    renderMetrics,
    renderProgress,
  };

})();

/* Auto-init when DOM is ready */
document.addEventListener('DOMContentLoaded', Dashboard.init);
