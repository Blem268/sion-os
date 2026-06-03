/* ============================================
   SION OS — work.js
   v0.3.0 — Sprint 2
   US-003: Silcomm + NovaTrust separated tasks
   US-004: Recurring monthly tasks pre-loaded
   ============================================ */

const Work = (() => {

  let activeEmployer = 'Silcomm Engineering';

  const EMPLOYERS = {
    'Silcomm Engineering': { role: 'Senior Admin',       tabId: 'tab-count-silcomm'   },
    'NovaTrust':           { role: 'Pre-license / CRM',  tabId: 'tab-count-novatrust' },
  };

  const RECURRING_TASKS = [
    { title: 'Inbox zero & filing sweep',       employer: 'Silcomm Engineering', week: 'Week 1', priority: 'High'   },
    { title: 'Review outstanding admin items',  employer: 'Silcomm Engineering', week: 'Week 1', priority: 'Medium' },
    { title: 'Report preparation',              employer: 'Silcomm Engineering', week: 'Week 2', priority: 'High'   },
    { title: 'Correspondence follow-ups',       employer: 'Silcomm Engineering', week: 'Week 2', priority: 'Medium' },
    { title: 'Mid-month check-in meeting',      employer: 'Silcomm Engineering', week: 'Week 3', priority: 'Medium' },
    { title: 'Systems & process audit',         employer: 'Silcomm Engineering', week: 'Week 3', priority: 'Low'    },
    { title: 'Month-end wrap & sign-offs',      employer: 'Silcomm Engineering', week: 'Week 4', priority: 'High'   },
    { title: 'Plan tasks for next month',       employer: 'Silcomm Engineering', week: 'Week 4', priority: 'Medium' },
    { title: 'CRM data clean-up',               employer: 'NovaTrust',           week: 'Week 1', priority: 'Medium' },
    { title: 'Pre-license admin checklist',     employer: 'NovaTrust',           week: 'Week 2', priority: 'High'   },
  ];

  /* ── Seed recurring tasks on first load ── */
  function seedRecurring() {
    const existing = Store.getAll('work_tasks');
    if (existing.length > 0) return;
    RECURRING_TASKS.forEach(t => {
      Store.insert('work_tasks', {
        ...t,
        status: 'To Do',
        recurring: true,
        done: false,
        notes: '',
        due_date: null,
        source: 'system',
      });
    });
  }

  /* ── Switch employer tab ── */
  function switchTab(employer, btn) {
    activeEmployer = employer;
    document.querySelectorAll('.work-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const nameEl = document.getElementById('work-employer-name');
    const roleEl = document.getElementById('work-employer-role');
    if (nameEl) nameEl.textContent = employer;
    if (roleEl) roleEl.textContent = EMPLOYERS[employer]?.role || '';

    // Show/hide rhythm panel (Silcomm only)
    const rhythmPanel = document.getElementById('work-rhythm-panel');
    if (rhythmPanel) {
      rhythmPanel.style.display = employer === 'Silcomm Engineering' ? '' : 'none';
    }

    renderTasks();
    if (employer === 'Silcomm Engineering') renderRhythm();
  }

  /* ── Render monthly rhythm grid (Silcomm) ── */
  function renderRhythm() {
    const el = document.getElementById('work-rhythm-grid');
    if (!el) return;

    const tasks = Store.getAll('work_tasks')
      .filter(t => t.employer === 'Silcomm Engineering' && t.recurring);

    const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    el.innerHTML = weeks.map(week => {
      const weekTasks = tasks.filter(t => t.week === week);
      const allDone   = weekTasks.length > 0 && weekTasks.every(t => t.done);
      const someDone  = weekTasks.some(t => t.done);
      const statusCls = allDone ? 'rhythm-done' : someDone ? 'rhythm-partial' : '';

      return `
        <div class="rhythm-card ${statusCls}">
          <div class="rhythm-week">${week}</div>
          <div class="rhythm-tasks">
            ${weekTasks.map(t => `
              <div class="rhythm-task ${t.done ? 'rhythm-task-done' : ''}"
                   onclick="Work.toggleWorkTask(${t.id})">
                <span class="rhythm-check ${t.done ? 'checked' : ''}">
                  ${t.done ? '<i class="ti ti-check"></i>' : ''}
                </span>
                <span>${escapeHtml(t.title)}</span>
              </div>
            `).join('')}
          </div>
        </div>`;
    }).join('');
  }

  /* ── Render task list ── */
  function renderTasks() {
    const el      = document.getElementById('work-task-list');
    const countEl = document.getElementById('work-task-count');
    if (!el) return;

    const all     = Store.getAll('work_tasks').filter(t => t.employer === activeEmployer);
    const open    = all.filter(t => !t.done);
    const done    = all.filter(t => t.done);
    const blocked = all.filter(t => t.status === 'Blocked' && !t.done);
    const sorted  = [...open, ...done];

    if (countEl) countEl.textContent = open.length + ' open · ' + done.length + ' done';

    // Update stats
    setEl('work-open-count',    open.length);
    setEl('work-done-count',    done.length);
    setEl('work-blocked-count', blocked.length);

    // Update tab counts
    updateTabCounts();

    if (!all.length) {
      el.innerHTML = '<div class="task-empty">no tasks — add one above</div>';
      return;
    }

    el.innerHTML = sorted.map(t => {
      const priorityCls = t.priority === 'High' ? 'priority-high' : t.priority === 'Low' ? 'priority-low' : 'priority-med';
      const statusCls   = t.status === 'Blocked' ? 'status-blocked' : t.status === 'In Progress' ? 'status-inprog' : '';
      const recurIcon   = t.recurring ? '<i class="ti ti-refresh work-recur-icon" title="recurring" aria-label="recurring"></i>' : '';
      const weekBadge   = t.week ? `<span class="work-week-badge">${t.week}</span>` : '';
      const dueBadge    = t.due_date ? `<span class="work-due-badge">${formatDate(t.due_date)}</span>` : '';

      return `
        <div class="task-row ${t.done ? 'task-done' : ''} ${statusCls}">
          <div class="task-check ${t.done ? 'checked' : ''}"
               onclick="Work.toggleWorkTask(${t.id})"
               role="checkbox" aria-checked="${t.done}">
            ${t.done ? '<i class="ti ti-check" aria-hidden="true"></i>' : ''}
          </div>
          <div class="work-task-body">
            <div class="work-task-title">
              ${recurIcon}
              ${escapeHtml(t.title)}
            </div>
            <div class="work-task-meta">
              <span class="work-priority ${priorityCls}">${t.priority}</span>
              ${weekBadge}
              ${dueBadge}
              ${t.notes ? `<span class="work-note-preview">${escapeHtml(t.notes)}</span>` : ''}
            </div>
          </div>
          <button class="task-del" onclick="Work.deleteWorkTask(${t.id})" aria-label="Delete task">
            <i class="ti ti-x" aria-hidden="true"></i>
          </button>
        </div>`;
    }).join('');
  }

  function updateTabCounts() {
    const all = Store.getAll('work_tasks');
    const silcomm  = all.filter(t => t.employer === 'Silcomm Engineering' && !t.done).length;
    const novatrust = all.filter(t => t.employer === 'NovaTrust' && !t.done).length;
    setEl('tab-count-silcomm',   silcomm);
    setEl('tab-count-novatrust', novatrust);
  }

  /* ── Toggle task ── */
  function toggleWorkTask(id) {
    const task = Store.getAll('work_tasks').find(t => t.id === id);
    if (!task) return;
    Store.update('work_tasks', id, {
      done: !task.done,
      status: !task.done ? 'Done' : 'To Do'
    });
    renderTasks();
    if (activeEmployer === 'Silcomm Engineering') renderRhythm();
  }

  /* ── Delete task ── */
  function deleteWorkTask(id) {
    Store.delete('work_tasks', id);
    renderTasks();
    if (activeEmployer === 'Silcomm Engineering') renderRhythm();
  }

  /* ── Reset recurring tasks ── */
  function resetRecurring() {
    const tasks = Store.getAll('work_tasks');
    tasks.filter(t => t.recurring).forEach(t => {
      Store.update('work_tasks', t.id, { done: false, status: 'To Do' });
    });
    renderTasks();
    renderRhythm();
  }

  /* ── Add task form ── */
  function showAddTask() {
    clearTaskForm();
    const formEl     = document.getElementById('work-task-form');
    const employerEl = document.getElementById('work-form-employer');
    if (formEl)     formEl.classList.remove('hidden');
    if (employerEl) employerEl.textContent = activeEmployer;
    document.getElementById('wt-title')?.focus();
  }

  function hideTaskForm() {
    document.getElementById('work-task-form')?.classList.add('hidden');
    clearTaskForm();
  }

  function clearTaskForm() {
    ['wt-title', 'wt-notes', 'wt-due'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const pri = document.getElementById('wt-priority');
    const sta = document.getElementById('wt-status');
    const wk  = document.getElementById('wt-week');
    const rec = document.getElementById('wt-recurring');
    if (pri) pri.value = 'Medium';
    if (sta) sta.value = 'To Do';
    if (wk)  wk.value  = '';
    if (rec) rec.checked = false;
    document.getElementById('work-task-form').dataset.editId = '';
  }

  function saveTask() {
    const title = document.getElementById('wt-title')?.value.trim();
    if (!title) { document.getElementById('wt-title')?.focus(); return; }

    Store.insert('work_tasks', {
      title,
      employer:  activeEmployer,
      priority:  document.getElementById('wt-priority')?.value || 'Medium',
      status:    document.getElementById('wt-status')?.value   || 'To Do',
      week:      document.getElementById('wt-week')?.value     || null,
      due_date:  document.getElementById('wt-due')?.value      || null,
      notes:     document.getElementById('wt-notes')?.value    || '',
      recurring: document.getElementById('wt-recurring')?.checked || false,
      done:      false,
      source:    'user',
    });

    hideTaskForm();
    renderTasks();
    if (activeEmployer === 'Silcomm Engineering') renderRhythm();
  }

  /* ── Helpers ── */
  function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-AG', { day:'numeric', month:'short' });
  }

  /* ── Init ── */
  function init() {
    seedRecurring();
    renderTasks();
    renderRhythm();
    updateTabCounts();
  }

  return {
    init, switchTab, renderTasks, renderRhythm,
    toggleWorkTask, deleteWorkTask, resetRecurring,
    showAddTask, hideTaskForm, saveTask,
  };

})();

document.addEventListener('DOMContentLoaded', Work.init);
