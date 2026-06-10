/* ============================================
   SION OS — blueport.js
   v0.5.0 — Sprint 4
   US-010: Full PM system
   US-011: Launch progress % + deadline warning
   ============================================ */

const Blueport = (() => {

  const LAUNCH_DATE = new Date('2026-09-01');
  const CATEGORIES  = ['Legal','Operations','Marketing','Finance','Technology'];

  const CAT_CLS = {
    Legal:       'cat-legal',
    Operations:  'cat-ops',
    Marketing:   'cat-mkt',
    Finance:     'cat-fin',
    Technology:  'cat-tech',
  };

  const SEED_TASKS = [
    { title:'Register Blueport Agency as a business entity',    category:'Legal',       due:'2026-06-30' },
    { title:'Open business bank account',                       category:'Legal',       due:'2026-07-15' },
    { title:'Draft standard shipping service agreement',        category:'Legal',       due:'2026-07-31' },
    { title:'Plan primary delivery routes in Antigua',          category:'Operations',  due:'2026-07-01' },
    { title:'Source and price cargo insurance',                 category:'Operations',  due:'2026-07-15' },
    { title:'Build Blueport website (basic landing page)',      category:'Marketing',   due:'2026-07-31' },
    { title:'Create social media profiles (Instagram + Facebook)', category:'Marketing', due:'2026-07-31' },
    { title:'Outreach to 10 potential anchor clients',          category:'Marketing',   due:'2026-08-31' },
    { title:'Build revenue projection model for Year 1',        category:'Finance',     due:'2026-06-30' },
    { title:'Set up accounting system',                         category:'Finance',     due:'2026-07-15' },
    { title:'Confirm loan drawdown date with bank',             category:'Finance',     due:'2026-06-20' },
    { title:'Set up WhatsApp Business line for Blueport',       category:'Technology',  due:'2026-07-01' },
    { title:'Create client booking/inquiry form',               category:'Technology',  due:'2026-07-31' },
    { title:'Set up Notion CRM for Blueport early clients',     category:'Technology',  due:'2026-06-02', done: true },
  ];

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function daysUntil(date) {
    const today = new Date(); today.setHours(0,0,0,0);
    const d = new Date(date); d.setHours(0,0,0,0);
    return Math.ceil((d - today) / 86400000);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr + 'T00:00:00')
      .toLocaleDateString('en-AG', { day:'numeric', month:'short' });
  }

  function isOverdue(dateStr, done) {
    if (!dateStr || done) return false;
    return new Date(dateStr + 'T00:00:00') < new Date();
  }

  /* ── Seed tasks ── */
  function seedTasks() {
    if (Store.getAll('blueport_tasks').length > 0) return;
    SEED_TASKS.forEach(t => {
      Store.insert('blueport_tasks', {
        title:    t.title,
        category: t.category,
        status:   t.done ? 'Done' : 'Not Started',
        due_date: t.due || null,
        done:     t.done || false,
        blocker:  '',
      });
    });
  }

  /* ── Metrics ── */
  function renderMetrics() {
    const tasks   = Store.getAll('blueport_tasks');
    const total   = tasks.length;
    const done    = tasks.filter(t => t.done).length;
    const pct     = total > 0 ? Math.round(done / total * 100) : 0;
    const daysLeft = daysUntil(LAUNCH_DATE);

    // Days sub
    setEl('bp-days-sub',  daysLeft > 0 ? daysLeft + ' days away' : 'launch day!');
    setEl('bp-pct',       pct + '%');
    setEl('bp-task-sub',  done + ' of ' + total + ' done');

    // Progress bar
    const bar = document.getElementById('bp-prog-bar');
    const pct2 = document.getElementById('bp-prog-pct');
    if (bar)  bar.style.width = pct + '%';
    if (pct2) pct2.textContent = pct + '%';

    // Status card
    const statusVal = document.getElementById('bp-status-val');
    const statusSub = document.getElementById('bp-status-sub');
    const statusCard = document.getElementById('bp-status-card');
    if (daysLeft <= 0) {
      if (statusVal)  { statusVal.textContent = 'launched!'; statusVal.className = 'mc-val green'; }
      if (statusSub)    statusSub.textContent = 'blueport is live';
    } else {
      // Projected weeks to complete
      const remaining  = total - done;
      const weeksElapsed = Math.max(1, (new Date() - new Date('2026-06-09')) / (7 * 86400000));
      const rate       = done / weeksElapsed;
      const weeksNeeded = rate > 0 ? Math.ceil(remaining / rate) : 99;
      const projectedDate = new Date();
      projectedDate.setDate(projectedDate.getDate() + weeksNeeded * 7);
      const onTrack = projectedDate <= LAUNCH_DATE;

      if (statusVal) {
        statusVal.textContent = onTrack ? 'on track' : 'at risk';
        statusVal.className   = 'mc-val ' + (onTrack ? 'green' : 'red');
      }
      if (statusSub)  statusSub.textContent = onTrack
        ? 'projected: ' + projectedDate.toLocaleDateString('en-AG', {day:'numeric',month:'short'})
        : 'projected past sep 2026 — speed up!';
      if (statusCard) statusCard.className = 'metric-card ' + (onTrack ? '' : 'red-accent');
    }
  }

  /* ── Render checklist ── */
  function renderChecklist() {
    const el = document.getElementById('bp-checklist');
    if (!el) return;
    const tasks = Store.getAll('blueport_tasks');

    el.innerHTML = CATEGORIES.map(cat => {
      const catTasks = tasks.filter(t => t.category === cat);
      if (!catTasks.length) return '';
      const catDone  = catTasks.filter(t => t.done).length;
      const catPct   = Math.round(catDone / catTasks.length * 100);

      return `
        <div class="bp-category">
          <div class="bp-cat-header">
            <span class="bp-cat-name ${CAT_CLS[cat]}">${cat}</span>
            <span class="bp-cat-progress">${catDone}/${catTasks.length}</span>
            <div class="bp-cat-bar">
              <div class="bp-cat-fill" style="width:${catPct}%"></div>
            </div>
          </div>
          <div class="task-list">
            ${catTasks.map(t => {
              const overdue = isOverdue(t.due_date, t.done);
              return `
                <div class="task-row ${t.done ? 'task-done' : ''} ${overdue ? 'bp-overdue' : ''}">
                  <div class="task-check ${t.done ? 'checked' : ''}"
                       onclick="Blueport.toggleTask(${t.id})"
                       role="checkbox" aria-checked="${t.done}">
                    ${t.done ? '<i class="ti ti-check" aria-hidden="true"></i>' : ''}
                  </div>
                  <div class="work-task-body">
                    <div class="work-task-title">${escapeHtml(t.title)}</div>
                    <div class="work-task-meta">
                      ${t.due_date ? `<span class="work-due-badge ${overdue ? 'bp-overdue-badge' : ''}">${overdue ? 'overdue · ' : ''}${formatDate(t.due_date)}</span>` : ''}
                      ${t.blocker  ? `<span class="bp-blocker"><i class="ti ti-alert-triangle" aria-hidden="true"></i> ${escapeHtml(t.blocker)}</span>` : ''}
                    </div>
                  </div>
                  <button class="task-del" onclick="Blueport.deleteTask(${t.id})" aria-label="Delete">
                    <i class="ti ti-x" aria-hidden="true"></i>
                  </button>
                </div>`;
            }).join('')}
          </div>
        </div>`;
    }).join('');
  }

  /* ── Toggle task ── */
  function toggleTask(id) {
    const task = Store.getAll('blueport_tasks').find(t => t.id === id);
    if (!task) return;
    Store.update('blueport_tasks', id, { done: !task.done, status: !task.done ? 'Done' : 'Not Started' });
    renderAll();
    // Also refresh dashboard progress bar if visible
    if (typeof Dashboard !== 'undefined') Dashboard.renderProgress();
  }

  /* ── Delete task ── */
  function deleteTask(id) {
    Store.delete('blueport_tasks', id);
    renderAll();
  }

  /* ── Task form ── */
  function showTaskForm() {
    clearTaskForm();
    document.getElementById('bp-task-form')?.classList.remove('hidden');
    document.getElementById('bt-title')?.focus();
  }

  function hideTaskForm() {
    document.getElementById('bp-task-form')?.classList.add('hidden');
    clearTaskForm();
  }

  function clearTaskForm() {
    ['bt-title','bt-due','bt-blocker'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const cat = document.getElementById('bt-category');
    if (cat) cat.value = 'Legal';
  }

  function saveTask() {
    const title = document.getElementById('bt-title')?.value.trim();
    if (!title) { document.getElementById('bt-title')?.focus(); return; }
    Store.insert('blueport_tasks', {
      title,
      category: document.getElementById('bt-category')?.value || 'Operations',
      due_date: document.getElementById('bt-due')?.value      || null,
      blocker:  document.getElementById('bt-blocker')?.value  || '',
      status:   'Not Started',
      done:     false,
    });
    hideTaskForm();
    renderAll();
  }

  function setEl(id, val) {
    const el = document.getElementById(id); if (el) el.textContent = val;
  }

  function renderAll() { renderMetrics(); renderChecklist(); }

  function getStats() {
    const tasks = Store.getAll('blueport_tasks');
    const done  = tasks.filter(t => t.done).length;
    const pct   = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    const daysToLaunch = Math.ceil((new Date('2026-09-01') - new Date()) / 86400000);
    return { total: tasks.length, done, pct, daysToLaunch };
  }

  function init() { seedTasks(); renderAll(); }

  return { init, renderAll, getStats, toggleTask, deleteTask, showTaskForm, hideTaskForm, saveTask };

})();

document.addEventListener('DOMContentLoaded', Blueport.init);
