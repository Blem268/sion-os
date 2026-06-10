/* ============================================
   SION OS — younity.js
   v2.4.0 — CR-003
   Younity = Project + Task manager
   CRM lives in Younity's standalone tool.
   OS manages the work.
   ============================================ */

const Younity = (() => {

  const STATUSES  = ['Planning','Active','On Hold','Complete'];
  const TASK_STATUSES = ['To Do','In Progress','Done','Blocked'];

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr + 'T00:00:00')
      .toLocaleDateString('en-AG', { day:'numeric', month:'short', year:'numeric' });
  }

  function isOverdue(dateStr, done) {
    if (!dateStr || done) return false;
    return new Date(dateStr + 'T00:00:00') < new Date();
  }

  /* ── Metrics ── */
  function renderMetrics() {
    const projects = Store.getAll('younity_projects');
    const tasks    = Store.getAll('younity_tasks');

    const active    = projects.filter(p => p.status === 'Active').length;
    const complete  = projects.filter(p => p.status === 'Complete').length;
    const openTasks = tasks.filter(t => t.status !== 'Done').length;
    const overdue   = tasks.filter(t => isOverdue(t.due_date, t.status === 'Done')).length;

    setEl('y-active-projects', active);
    setEl('y-complete-projects', complete);
    setEl('y-open-tasks', openTasks);
    setEl('y-overdue-tasks', overdue);
  }

  /* ── Render project board ── */
  function renderProjects() {
    const el = document.getElementById('y-project-board');
    if (!el) return;

    const projects = Store.getAll('younity_projects');
    const tasks    = Store.getAll('younity_tasks');

    if (!projects.length) {
      el.innerHTML = '<div class="task-empty">no projects yet — add one above</div>';
      return;
    }

    el.innerHTML = projects.map(p => {
      const pTasks    = tasks.filter(t => t.project_id === p.id);
      const done      = pTasks.filter(t => t.status === 'Done').length;
      const total     = pTasks.length;
      const pct       = total > 0 ? Math.round(done / total * 100) : 0;
      const overdue   = pTasks.filter(t => isOverdue(t.due_date, t.status === 'Done')).length;

      const statusCls = {
        'Planning':  'pill-gray',
        'Active':    'pill-green',
        'On Hold':   'pill-amber',
        'Complete':  'pill-cyan',
      }[p.status] || 'pill-gray';

      return `
        <div class="y-project-card ${p.status === 'Complete' ? 'y-project-complete' : ''}">
          <div class="y-project-header">
            <div class="y-project-name">${escapeHtml(p.name)}</div>
            <div class="y-project-actions">
              ${overdue ? `<span class="pill pill-red" style="font-size:8px">${overdue} overdue</span>` : ''}
              <span class="pill ${statusCls}">${p.status}</span>
              <button class="task-del" onclick="Younity.showTaskForm(${p.id})" title="Add task" aria-label="Add task">
                <i class="ti ti-plus" aria-hidden="true"></i>
              </button>
              <button class="task-del" onclick="Younity.deleteProject(${p.id})" aria-label="Delete project">
                <i class="ti ti-x" aria-hidden="true"></i>
              </button>
            </div>
          </div>
          ${p.client ? `<div class="y-project-client"><i class="ti ti-user" aria-hidden="true"></i> ${escapeHtml(p.client)}</div>` : ''}
          ${p.description ? `<div class="y-project-desc">${escapeHtml(p.description)}</div>` : ''}
          <div class="y-project-meta">
            ${p.due_date ? `<span class="${isOverdue(p.due_date, p.status==='Complete') ? 'red' : 'fg3'}" style="font-size:9px">due ${formatDate(p.due_date)}</span>` : ''}
            ${total > 0 ? `<span class="fg3" style="font-size:9px">${done}/${total} tasks</span>` : ''}
          </div>
          ${total > 0 ? `
            <div class="y-task-progress">
              <div class="prog-track" style="height:2px;">
                <div class="prog-fill ${pct === 100 ? 'green-fill' : 'cyan-fill'}" style="width:${pct}%"></div>
              </div>
              <span class="fg3" style="font-size:9px">${pct}%</span>
            </div>` : ''}
          <div class="y-task-list" id="y-tasks-${p.id}">
            ${renderProjectTasks(pTasks, p.id)}
          </div>
          <div class="y-project-status-row">
            <select class="y-stage-select" onchange="Younity.changeStatus(${p.id}, this.value)">
              ${STATUSES.map(s => `<option value="${s}" ${p.status===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>`;
    }).join('');
  }

  function renderProjectTasks(tasks, projectId) {
    if (!tasks.length) return '<div class="task-empty" style="font-size:10px;padding:6px 0">no tasks — click + to add</div>';

    return tasks.map(t => {
      const overdue = isOverdue(t.due_date, t.status === 'Done');
      const statusCls = { 'Done':'checked', 'In Progress':'', 'Blocked':'', 'To Do':'' }[t.status] || '';
      return `
        <div class="task-row ${t.status==='Done'?'task-done':''} ${overdue?'bp-overdue':''}" style="padding:5px 8px">
          <div class="task-check ${t.status==='Done'?'checked':''}"
               onclick="Younity.toggleTask(${t.id})"
               style="width:12px;height:12px;font-size:9px">
            ${t.status==='Done'?'<i class="ti ti-check"></i>':''}
          </div>
          <div class="work-task-body">
            <div class="work-task-title" style="font-size:10px">${escapeHtml(t.title)}</div>
            <div class="work-task-meta">
              ${t.due_date ? `<span class="work-due-badge ${overdue?'bp-overdue-badge':''}" style="font-size:8px">${overdue?'overdue · ':''}${formatDate(t.due_date)}</span>` : ''}
              ${t.time_logged ? `<span class="fg3" style="font-size:9px">${t.time_logged}h logged</span>` : ''}
            </div>
          </div>
          <select class="y-stage-select" style="font-size:9px;padding:2px 4px" onchange="Younity.changeTaskStatus(${t.id}, this.value)">
            ${TASK_STATUSES.map(s=>`<option value="${s}" ${t.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
          <button class="task-del" onclick="Younity.deleteTask(${t.id})" aria-label="Delete task">
            <i class="ti ti-x" aria-hidden="true"></i>
          </button>
        </div>`;
    }).join('');
  }

  /* ── Change project status ── */
  function changeStatus(id, status) {
    Store.update('younity_projects', id, { status });
    renderAll();
  }

  /* ── Toggle task ── */
  function toggleTask(id) {
    const task = Store.getAll('younity_tasks').find(t => t.id === id);
    if (!task) return;
    Store.update('younity_tasks', id, { status: task.status === 'Done' ? 'To Do' : 'Done' });
    renderAll();
  }

  /* ── Change task status ── */
  function changeTaskStatus(id, status) {
    Store.update('younity_tasks', id, { status });
    renderAll();
  }

  /* ── Delete ── */
  function deleteProject(id) {
    Store.delete('younity_projects', id);
    // Also delete associated tasks
    Store.getAll('younity_tasks')
      .filter(t => t.project_id === id)
      .forEach(t => Store.delete('younity_tasks', t.id));
    renderAll();
  }

  function deleteTask(id) {
    Store.delete('younity_tasks', id);
    renderAll();
  }

  /* ── Project form ── */
  function showProjectForm() {
    clearProjectForm();
    document.getElementById('y-project-form')?.classList.remove('hidden');
    document.getElementById('yp-name')?.focus();
  }
  function hideProjectForm() {
    document.getElementById('y-project-form')?.classList.add('hidden');
    clearProjectForm();
  }
  function clearProjectForm() {
    ['yp-name','yp-client','yp-description','yp-due'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const st = document.getElementById('yp-status');
    if (st) st.value = 'Planning';
  }
  function saveProject() {
    const name = document.getElementById('yp-name')?.value.trim();
    if (!name) { document.getElementById('yp-name')?.focus(); return; }
    Store.insert('younity_projects', {
      name,
      client:      document.getElementById('yp-client')?.value.trim()      || '',
      description: document.getElementById('yp-description')?.value.trim() || '',
      status:      document.getElementById('yp-status')?.value             || 'Planning',
      due_date:    document.getElementById('yp-due')?.value                || null,
    });
    hideProjectForm();
    renderAll();
  }

  /* ── Task form ── */
  let _activeProjectId = null;
  function showTaskForm(projectId) {
    _activeProjectId = projectId;
    clearTaskForm();
    const form    = document.getElementById('y-task-form');
    const titleEl = document.getElementById('yt-project-name');
    if (form) form.classList.remove('hidden');
    const project = Store.getAll('younity_projects').find(p => p.id === projectId);
    if (titleEl && project) titleEl.textContent = project.name;
    document.getElementById('yt-title')?.focus();
  }
  function hideTaskForm() {
    document.getElementById('y-task-form')?.classList.add('hidden');
    clearTaskForm();
    _activeProjectId = null;
  }
  function clearTaskForm() {
    ['yt-title','yt-due','yt-time'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const st = document.getElementById('yt-status');
    if (st) st.value = 'To Do';
  }
  function saveTask() {
    const title = document.getElementById('yt-title')?.value.trim();
    if (!title || !_activeProjectId) { document.getElementById('yt-title')?.focus(); return; }
    Store.insert('younity_tasks', {
      project_id:  _activeProjectId,
      title,
      status:      document.getElementById('yt-status')?.value  || 'To Do',
      due_date:    document.getElementById('yt-due')?.value     || null,
      time_logged: parseFloat(document.getElementById('yt-time')?.value) || 0,
    });
    hideTaskForm();
    renderAll();
  }

  function setEl(id, val) {
    const el = document.getElementById(id); if (el) el.textContent = val;
  }

  function renderAll() {
    renderMetrics();
    renderProjects();
  }

  function getStats() {
    const tasks = Store.getAll('younity_tasks');
    const now   = new Date();
    const thisMonth = d => { if (!d) return false; const x = new Date(d); return x.getMonth() === now.getMonth() && x.getFullYear() === now.getFullYear(); };
    const revenue = Store.getAll('income').filter(i => thisMonth(i.received_date) && i.source === 'Younity Consultancy').reduce((s, i) => s + (parseFloat(i.amount_xcd) || 0), 0);
    return {
      openTasks: tasks.filter(t => t.status !== 'Done').length,
      revenue,
    };
  }

  function init() { renderAll(); }

  return {
    init, renderAll, getStats,
    changeStatus, toggleTask, changeTaskStatus,
    deleteProject, deleteTask,
    showProjectForm, hideProjectForm, saveProject,
    showTaskForm, hideTaskForm, saveTask,
  };

})();

document.addEventListener('DOMContentLoaded', Younity.init);
