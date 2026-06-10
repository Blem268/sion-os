/* ============================================
   SION OS — study.js
   v2.7.0 — Sprint 15B
   Full study hub: plan, schedule, topics,
   sessions, vault browser, AI hub
   ============================================ */

const Study = (() => {

  // Built-in courses — always present
  const BUILTIN_COURSES = [
    { key:'acca', label:'ACCA' },
    { key:'gpm',  label:'Google PM' },
    { key:'trw',  label:'TRW AI' },
    { key:'work', label:'Work' },
  ];

  const COURSE_CLS = { acca:'badge-biz', gpm:'badge-work', trw:'badge-study', work:'badge-work', other:'badge-gym' };

  // Returns full course list (built-in + custom)
  function allCourses() {
    const custom = (_settings.custom_courses || []);
    return [...BUILTIN_COURSES, ...custom];
  }

  function courseLabel(key) {
    const found = allCourses().find(c => c.key === key);
    return found ? found.label : (key || 'Other');
  }

  function courseCls(key) {
    return COURSE_CLS[key] || 'badge-gym';
  }

  let _weekOffset   = 0;
  let _settings     = {};
  let _activeCourse = 'all'; // 'all' or a course key

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

  function today() { return new Date().toISOString().split('T')[0]; }

  /* ── Course tabs ── */
  function renderCourseTabs() {
    const el = document.getElementById('study-course-tabs');
    if (!el) return;
    const courses = [{ key:'all', label:'All' }, ...allCourses()];
    el.innerHTML = courses.map(c => `
      <button class="study-course-tab ${_activeCourse === c.key ? 'active' : ''}"
        onclick="Study.setActiveCourse('${escapeHtml(c.key)}')">
        ${escapeHtml(c.label)}
        ${c.key !== 'all' && !BUILTIN_COURSES.find(b => b.key === c.key) ? `
          <span class="course-tab-del" onclick="event.stopPropagation();Study.deleteCourse('${escapeHtml(c.key)}')" title="Remove subject">×</span>
        ` : ''}
      </button>`).join('');
  }

  function setActiveCourse(key) {
    _activeCourse = key;
    renderCourseTabs();
    renderMetrics();
    renderPlan();
    renderSchedule();
    renderTopics();
    renderSessions();
    // Pre-select course in open forms
    syncFormCourseSelects();
  }

  function syncFormCourseSelects() {
    // Re-populate all course <select> dropdowns with current course list
    const selects = ['sp-course', 'ss-course', 'st-topic-course'];
    const courses = allCourses();
    selects.forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const current = sel.value;
      sel.innerHTML = courses.map(c =>
        `<option value="${escapeHtml(c.key)}">${escapeHtml(c.label)}</option>`
      ).join('');
      // Pre-select active course (if not 'all')
      if (_activeCourse !== 'all') sel.value = _activeCourse;
      else if (current) sel.value = current;
    });
  }

  function toggleAddCourseForm() {
    const form = document.getElementById('study-add-course-form');
    if (!form) return;
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) {
      document.getElementById('new-course-label')?.focus();
    }
  }

  function saveNewCourse() {
    const label = document.getElementById('new-course-label')?.value.trim();
    if (!label) return;
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const custom = _settings.custom_courses || [];
    if (allCourses().find(c => c.key === key)) {
      // Duplicate — just close
      toggleAddCourseForm();
      return;
    }
    custom.push({ key, label });
    _settings.custom_courses = custom;
    Store.set('study_settings', _settings);
    document.getElementById('new-course-label').value = '';
    toggleAddCourseForm();
    renderCourseTabs();
    syncFormCourseSelects();
  }

  function deleteCourse(key) {
    _settings.custom_courses = (_settings.custom_courses || []).filter(c => c.key !== key);
    Store.set('study_settings', _settings);
    if (_activeCourse === key) _activeCourse = 'all';
    renderCourseTabs();
    renderAll();
  }

  /* ── Settings ── */
  function loadSettings() {
    _settings = Store.get('study_settings') || {
      daily_goal_hrs:  3,
      exam_date:       '',
      pom_work:        25,
      pom_short:       5,
      pom_long:        15,
      custom_courses:  [],
    };
    if (!_settings.custom_courses) _settings.custom_courses = [];
  }

  function saveSettings() {
    _settings.daily_goal_hrs = parseFloat(document.getElementById('st-daily-goal')?.value) || 3;
    _settings.exam_date      = document.getElementById('st-exam-date')?.value || '2026-11-01';
    _settings.pom_work       = parseInt(document.getElementById('st-pom-work')?.value)  || 25;
    _settings.pom_short      = parseInt(document.getElementById('st-pom-short')?.value) || 5;
    _settings.pom_long       = parseInt(document.getElementById('st-pom-long')?.value)  || 15;
    Store.set('study_settings', _settings);
    if (typeof Pomodoro !== 'undefined') Pomodoro.applySettings(_settings);
    toggleSettings();
    renderMetrics();
  }

  function toggleSettings() {
    const panel = document.getElementById('study-settings-panel');
    if (!panel) return;
    const hidden = panel.classList.toggle('hidden');
    if (!hidden) {
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
      set('st-daily-goal', _settings.daily_goal_hrs);
      set('st-exam-date',  _settings.exam_date);
      set('st-pom-work',   _settings.pom_work);
      set('st-pom-short',  _settings.pom_short);
      set('st-pom-long',   _settings.pom_long);
    }
  }

  /* ── Metrics ── */
  function renderMetrics() {
    const sessions  = Store.getAll('study_sessions');
    const filtered  = _activeCourse === 'all' ? sessions : sessions.filter(s => s.course === _activeCourse);
    const todaySess = filtered.filter(s => s.session_date === today());
    const todayMins = todaySess.reduce((s,sess) => s + (parseInt(sess.duration_mins)||0), 0);
    const goalMins  = (_settings.daily_goal_hrs || 3) * 60;
    const goalPct   = Math.min(100, Math.round(todayMins / goalMins * 100));
    const hrs       = Math.floor(todayMins / 60);
    const mins      = todayMins % 60;

    setEl('st-today-time', `${hrs}h ${mins}m`);
    setEl('st-today-goal', `of ${_settings.daily_goal_hrs || 3}h goal`);
    setEl('st-ring-pct',   goalPct + '%');

    const ring = document.getElementById('st-ring-fill');
    if (ring) ring.setAttribute('stroke-dasharray', `${goalPct} ${100 - goalPct}`);

    // Subject progress card — shows active course or overall
    const allTopics = Store.getAll('study_topics');
    const subjTopics = _activeCourse === 'all' ? allTopics : allTopics.filter(t => t.course === _activeCourse);
    const subj_done  = subjTopics.reduce((s,t) => s + (parseInt(t.completed)||0), 0);
    const subj_tot   = subjTopics.reduce((s,t) => s + (parseInt(t.total)||0), 0);
    const subj_pct   = subj_tot > 0 ? Math.round(subj_done / subj_tot * 100) : 0;
    const subjName   = _activeCourse === 'all' ? 'Overall' : courseLabel(_activeCourse);
    setEl('st-subject-label', `${subjName.toUpperCase()} PROGRESS`);
    setEl('st-acca-pct', subj_pct + '%');
    setEl('st-acca-sub', `${subj_done} / ${subj_tot} topics`);
    const accaRing = document.getElementById('st-acca-ring');
    if (accaRing) accaRing.setAttribute('stroke-dasharray', `${subj_pct} ${100 - subj_pct}`);

    const sorted = [...sessions].sort((a,b) => new Date(b.session_date) - new Date(a.session_date));
    let streak = 0;
    if (sorted.length) {
      let check = new Date(); check.setHours(0,0,0,0);
      const seen = new Set(sorted.map(s => s.session_date));
      while (seen.has(check.toISOString().split('T')[0])) {
        streak++;
        check.setDate(check.getDate() - 1);
      }
    }
    setEl('st-streak', streak);

    const examDate = _settings.exam_date || '';
    if (!examDate) {
      setEl('st-exam-target', 'Not set');
      setEl('st-exam-days',   'Set in Study Settings');
    } else {
      const daysLeft = Math.ceil((new Date(examDate) - new Date()) / 86400000);
      const examD    = new Date(examDate);
      setEl('st-exam-target', examD.toLocaleDateString('en-AG', { month:'short', year:'numeric' }));
      setEl('st-exam-days',   daysLeft > 0 ? daysLeft + ' days to go' : 'exam passed');
    }

    countVaultNotes();
  }

  async function countVaultNotes() {
    if (window.electronAPI?.countVaultNotes) {
      const count = await window.electronAPI.countVaultNotes();
      setEl('st-notes-count', count || 0);
      setEl('st-vault-total', count || 0);
      setEl('st-vault-sync',  new Date().toLocaleTimeString('en-AG', { hour:'2-digit', minute:'2-digit' }));
    } else {
      const lessons = Store.getAll('study_lessons');
      setEl('st-notes-count', lessons.length);
    }
  }

  /* ── Today's study plan ── */
  function renderPlan() {
    const el = document.getElementById('study-plan-list');
    if (!el) return;

    const tasks = Store.getAll('study_plan_tasks')
      .filter(t => t.plan_date === today())
      .filter(t => _activeCourse === 'all' || t.course === _activeCourse)
      .sort((a,b) => (a.start_time||'').localeCompare(b.start_time||''));

    if (!tasks.length) {
      const hint = _activeCourse === 'all' ? 'no tasks planned for today — add one above' : `no ${courseLabel(_activeCourse)} tasks today — add one above`;
      el.innerHTML = `<div class="task-empty">${hint}</div>`;
      return;
    }

    el.innerHTML = tasks.map(t => {
      const cCls   = courseCls(t.course);
      const cLabel = courseLabel(t.course);
      const timeStr     = t.start_time && t.end_time
        ? `${t.start_time} – ${t.end_time}`
        : t.duration_mins ? `${t.duration_mins} min` : '';

      return `
        <div class="study-plan-row ${t.done ? 'task-done' : ''}">
          <div class="task-check ${t.done ? 'checked' : ''}" onclick="Study.togglePlanTask(${t.id})">
            ${t.done ? '<i class="ti ti-check"></i>' : ''}
          </div>
          <div class="study-plan-body">
            <div class="study-plan-title">${escapeHtml(t.title)}</div>
            ${timeStr ? `<div class="study-plan-time fg3">${timeStr}</div>` : ''}
          </div>
          <span class="task-badge ${cCls}">${cLabel}</span>
          <button class="pom-start-btn" onclick="Pomodoro.startForTask('${escapeHtml(t.title).replace(/'/g, "\\'")}', ${_settings.pom_work||25})" title="Start Pomodoro for this task">
            <i class="ti ti-player-play"></i>
          </button>
          <button class="task-del" onclick="Study.deletePlanTask(${t.id})">
            <i class="ti ti-x"></i>
          </button>
        </div>`;
    }).join('');
  }

  function showPlanForm() {
    document.getElementById('study-plan-form')?.classList.remove('hidden');
    syncFormCourseSelects();
    document.getElementById('sp-title')?.focus();
  }
  function hidePlanForm() {
    document.getElementById('study-plan-form')?.classList.add('hidden');
    ['sp-title','sp-start','sp-end','sp-duration'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  }
  function savePlanTask() {
    const title = document.getElementById('sp-title')?.value.trim();
    if (!title) { document.getElementById('sp-title')?.focus(); return; }
    Store.insert('study_plan_tasks', {
      title,
      course:        document.getElementById('sp-course')?.value || 'acca',
      plan_date:     today(),
      start_time:    document.getElementById('sp-start')?.value    || '',
      end_time:      document.getElementById('sp-end')?.value      || '',
      duration_mins: parseInt(document.getElementById('sp-duration')?.value) || 0,
      done:          false,
    });
    hidePlanForm();
    renderPlan();
  }
  function togglePlanTask(id) {
    const t = Store.getAll('study_plan_tasks').find(x => x.id === id);
    if (!t) return;
    Store.update('study_plan_tasks', id, { done: !t.done });
    renderPlan();
    if (!t.done && t.duration_mins > 0) {
      Store.insert('study_sessions', {
        topic:         t.title,
        course:        t.course,
        session_date:  today(),
        duration_mins: t.duration_mins,
        source:        'Plan',
        notes:         '',
      });
      renderSessions();
      renderMetrics();
    }
  }
  function deletePlanTask(id) { Store.delete('study_plan_tasks', id); renderPlan(); }

  /* ── Study schedule chart ── */
  function renderSchedule() {
    const el = document.getElementById('study-schedule-chart');
    if (!el) return;

    const allSessions = Store.getAll('study_sessions');
    const sessions    = _activeCourse === 'all' ? allSessions : allSessions.filter(s => s.course === _activeCourse);
    const days     = [];
    const base     = new Date();
    base.setDate(base.getDate() - base.getDay() + 1 + _weekOffset * 7);

    for (let i = 0; i < 7; i++) {
      const d       = new Date(base);
      d.setDate(base.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const label   = d.toLocaleDateString('en-AG', { weekday:'short' });
      const dayNum  = d.toLocaleDateString('en-AG', { day:'numeric' });
      const month   = d.toLocaleDateString('en-AG', { month:'short' });
      const mins    = sessions
        .filter(s => s.session_date === dateStr)
        .reduce((s,x) => s + (parseInt(x.duration_mins)||0), 0);
      const isToday = dateStr === today();
      days.push({ label, dayNum, month, hrs: parseFloat((mins / 60).toFixed(1)), isToday });
    }

    setEl('st-week-label', _weekOffset === 0 ? 'This Week' : _weekOffset === -1 ? 'Last Week' : `Week of ${days[0].dayNum} ${days[0].month}`);

    const maxHrs  = Math.max(...days.map(d => d.hrs), 1);
    const goalHrs = _settings.daily_goal_hrs || 3;

    el.innerHTML = `
      <div class="schedule-bars">
        ${days.map(d => {
          const heightPct = Math.round(d.hrs / maxHrs * 100);
          const atGoal    = d.hrs >= goalHrs;
          return `
            <div class="schedule-col">
              <div class="schedule-hrs">${d.hrs > 0 ? d.hrs + 'h' : '—'}</div>
              <div class="schedule-bar-wrap">
                <div class="schedule-bar ${d.isToday ? 'schedule-bar-today' : ''} ${atGoal ? 'schedule-bar-goal' : ''}" style="height:${heightPct}%">
                  ${d.hrs === 0 ? '<div class="schedule-bar-empty"></div>' : ''}
                </div>
              </div>
              <div class="schedule-label ${d.isToday ? 'green' : 'fg3'}">${d.label}</div>
              <div class="schedule-day fg3">${d.dayNum} ${d.month}</div>
            </div>`;
        }).join('')}
      </div>`;
  }

  function prevWeek() { _weekOffset--; renderSchedule(); }
  function nextWeek() { _weekOffset++; renderSchedule(); }

  /* ── Topics progress ── */
  function renderTopics() {
    const el = document.getElementById('study-topics-list');
    if (!el) return;

    const topics = Store.getAll('study_topics')
      .filter(t => _activeCourse === 'all' || t.course === _activeCourse)
      .sort((a,b) => (a.course + a.name).localeCompare(b.course + b.name));

    if (!topics.length) {
      const hint = _activeCourse === 'all' ? 'no topics yet — add one above' : `no ${courseLabel(_activeCourse)} topics yet — add one above`;
      el.innerHTML = `<div class="task-empty">${hint}</div>`;
      return;
    }

    const colours = ['var(--purple)','var(--cyan)','var(--green)','var(--amber)','var(--red)'];

    el.innerHTML = topics.map((t, i) => {
      const pct = t.total > 0 ? Math.round(t.completed / t.total * 100) : 0;
      const col = colours[i % 5];
      return `
        <div class="topic-row">
          <div class="topic-num fg3">${i + 1}.</div>
          <div class="topic-name">
            ${escapeHtml(t.name)}
            ${_activeCourse === 'all' ? `<span class="task-badge ${courseCls(t.course)}" style="margin-left:6px;font-size:8px">${escapeHtml(courseLabel(t.course))}</span>` : ''}
          </div>
          <div class="topic-bar-wrap">
            <div class="topic-bar-fill" style="width:${pct}%;background:${col}"></div>
          </div>
          <div class="topic-pct" style="color:${col}">${pct}%</div>
          <button class="task-del" onclick="Study.incrementTopic(${t.id})" title="+1 completed" style="color:var(--green)">
            <i class="ti ti-plus"></i>
          </button>
          <button class="task-del" onclick="Study.deleteTopic(${t.id})">
            <i class="ti ti-x"></i>
          </button>
        </div>`;
    }).join('');
  }

  function showTopicForm()  { document.getElementById('study-topic-form')?.classList.remove('hidden'); syncFormCourseSelects(); document.getElementById('st-topic-name')?.focus(); }
  function hideTopicForm()  { document.getElementById('study-topic-form')?.classList.add('hidden'); ['st-topic-name','st-topic-total','st-topic-done'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); }
  function saveTopic() {
    const name = document.getElementById('st-topic-name')?.value.trim();
    if (!name) return;
    Store.insert('study_topics', {
      name,
      course:    document.getElementById('st-topic-course')?.value || 'acca',
      total:     parseInt(document.getElementById('st-topic-total')?.value) || 0,
      completed: parseInt(document.getElementById('st-topic-done')?.value)  || 0,
    });
    hideTopicForm();
    renderTopics();
    renderMetrics();
  }
  function incrementTopic(id) {
    const t = Store.getAll('study_topics').find(x => x.id === id);
    if (!t) return;
    const newDone = Math.min((parseInt(t.completed)||0) + 1, parseInt(t.total) || 999);
    Store.update('study_topics', id, { completed: newDone });
    renderTopics();
    renderMetrics();
  }
  function deleteTopic(id) { Store.delete('study_topics', id); renderTopics(); renderMetrics(); }

  /* ── Study sessions ── */
  function renderSessions() {
    const tbody = document.getElementById('study-sessions-tbody');
    if (!tbody) return;

    const sessions = Store.getAll('study_sessions')
      .filter(s => _activeCourse === 'all' || s.course === _activeCourse)
      .sort((a,b) => b.session_date.localeCompare(a.session_date))
      .slice(0, 10);

    if (!sessions.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="blem-empty">no sessions logged yet</td></tr>';
      return;
    }

    const sourceCls = { Obsidian:'badge-study', Textbook:'badge-biz', Video:'badge-blueport', 'Practice Qs':'badge-work', Pomodoro:'badge-gym', Plan:'badge-work' };

    tbody.innerHTML = sessions.map(s => `
      <tr>
        <td class="fg3" style="font-size:10px;white-space:nowrap">${formatDate(s.session_date)}</td>
        <td class="${courseCls(s.course)}" style="font-size:11px">${escapeHtml(s.topic)}</td>
        <td class="amber num">${s.duration_mins}m</td>
        <td><span class="task-badge ${sourceCls[s.source]||'badge-biz'}">${escapeHtml(s.source||'Other')}</span></td>
        <td class="fg3" style="font-size:10px">${escapeHtml(s.notes||'—')}</td>
        <td><button class="task-del" onclick="Study.deleteSession(${s.id})"><i class="ti ti-x"></i></button></td>
      </tr>`).join('');
  }

  function showSessionForm() {
    document.getElementById('study-session-form')?.classList.remove('hidden');
    syncFormCourseSelects();
    const d = document.getElementById('ss-date'); if (d && !d.value) d.value = today();
    document.getElementById('ss-topic')?.focus();
  }
  function hideSessionForm() {
    document.getElementById('study-session-form')?.classList.add('hidden');
    ['ss-topic','ss-date','ss-duration','ss-notes'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  }
  function saveSession() {
    const topic = document.getElementById('ss-topic')?.value.trim();
    if (!topic) return;
    Store.insert('study_sessions', {
      topic,
      course:        document.getElementById('ss-course')?.value   || _activeCourse || 'other',
      session_date:  document.getElementById('ss-date')?.value     || today(),
      duration_mins: parseInt(document.getElementById('ss-duration')?.value) || 0,
      source:        document.getElementById('ss-source')?.value   || 'Other',
      notes:         document.getElementById('ss-notes')?.value    || '',
    });
    hideSessionForm();
    renderSessions();
    renderMetrics();
  }
  function deleteSession(id) { Store.delete('study_sessions', id); renderSessions(); renderMetrics(); }

  /* ── Vault tree ── */
  async function renderVaultTree() {
    const el = document.getElementById('study-vault-tree');
    if (!el) return;

    if (!window.electronAPI?.getVaultTree) {
      el.innerHTML = '<div class="task-empty">vault browser requires desktop app</div>';
      return;
    }

    el.innerHTML = '<div class="task-empty fg3">loading vault...</div>';
    const data = await window.electronAPI.getVaultTree();
    const { rootFiles = [], folders = [] } = data || {};

    if (!folders.length && !rootFiles.length) {
      el.innerHTML = '<div class="task-empty">vault is empty</div>';
      return;
    }

    function fileRow(f) {
      const age = f.modified ? relativeTime(f.modified) : '';
      return `
        <div class="vault-note-row">
          <i class="ti ti-file-text" aria-hidden="true"></i>
          <span class="vault-note-name">${escapeHtml(f.name)}</span>
          <span class="vault-note-date fg3">${age}</span>
        </div>`;
    }

    function subfolderBlock(sf) {
      const hasFiles = sf.files?.length || sf.noteCount > 0;
      return `
        <div class="vault-folder" onclick="event.stopPropagation();this.classList.toggle('open')">
          <div class="vault-folder-row" style="padding-left:4px">
            <i class="ti ti-chevron-right vault-chevron" aria-hidden="true"></i>
            <i class="ti ti-folder vault-folder-icon" aria-hidden="true"></i>
            <span class="vault-folder-name">${escapeHtml(sf.name)}</span>
            ${sf.noteCount ? `<span class="vault-note-count">${sf.noteCount} note${sf.noteCount !== 1 ? 's' : ''}</span>` : ''}
          </div>
          ${sf.files?.length ? `<div class="vault-children">${sf.files.map(fileRow).join('')}</div>` : ''}
        </div>`;
    }

    const html = [];

    // Root .md files
    if (rootFiles.length) {
      html.push(`<div class="vault-children" style="display:block;padding-left:0">${rootFiles.map(fileRow).join('')}</div>`);
    }

    // Top-level folders
    folders.forEach(f => {
      const hasContent = f.files?.length || f.subfolders?.length;
      html.push(`
        <div class="vault-folder" onclick="this.classList.toggle('open')">
          <div class="vault-folder-row">
            <i class="ti ti-chevron-right vault-chevron" aria-hidden="true"></i>
            <i class="ti ti-folder vault-folder-icon" aria-hidden="true"></i>
            <span class="vault-folder-name">${escapeHtml(f.name)}</span>
            ${f.noteCount ? `<span class="vault-note-count">${f.noteCount} note${f.noteCount !== 1 ? 's' : ''}</span>` : ''}
          </div>
          ${hasContent ? `
            <div class="vault-children">
              ${(f.files || []).map(fileRow).join('')}
              ${(f.subfolders || []).map(subfolderBlock).join('')}
            </div>` : ''}
        </div>`);
    });

    el.innerHTML = html.join('');
  }

  function relativeTime(isoStr) {
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return 'just now';
    if (mins < 60)  return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7)   return `${days}d ago`;
    return new Date(isoStr).toLocaleDateString('en-AG', { day:'numeric', month:'short' });
  }

  /* ── AI Knowledge Hub ── */
  async function askAI() {
    const input    = document.getElementById('study-ai-input');
    const question = input?.value.trim();
    if (!question) return;
    input.value = '';

    const history = document.getElementById('study-ai-history');
    if (history) {
      history.querySelector('.ai-welcome')?.remove();
      const userMsg = document.createElement('div');
      userMsg.className = 'ai-message ai-user';
      userMsg.innerHTML = `<div class="ai-msg-role">you</div><div class="ai-msg-body">${escapeHtml(question)}</div>`;
      history.appendChild(userMsg);
    }

    if (!window.electronAPI?.aiQuery) {
      if (history) {
        const aiMsg = document.createElement('div');
        aiMsg.className = 'ai-message ai-assistant';
        aiMsg.innerHTML = `<div class="ai-msg-role">sion os</div><div class="ai-msg-body">AI integration requires Electron with Claude API configured.</div>`;
        history.appendChild(aiMsg);
        history.scrollTop = history.scrollHeight;
      }
      return;
    }

    const storeData = {};
    ['study_lessons','study_sessions','study_topics','study_plan_tasks']
      .forEach(t => { storeData[t] = Store.getAll(t); });

    const result = await window.electronAPI.aiQuery(`[Study context] ${question}`, storeData);

    if (history && result.success) {
      const aiMsg = document.createElement('div');
      aiMsg.className = 'ai-message ai-assistant';
      aiMsg.innerHTML = `<div class="ai-msg-role">sion os</div><div class="ai-msg-body">${escapeHtml(result.response)}</div>`;
      history.appendChild(aiMsg);
      history.scrollTop = history.scrollHeight;
    }
  }

  function askQuick(q) {
    const input = document.getElementById('study-ai-input');
    if (input) { input.value = q; askAI(); }
  }

  /* ── Open in Obsidian ── */
  function openInObsidian() {
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal('obsidian://open');
    }
  }

  function setEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

  function renderAll() {
    renderCourseTabs();
    renderMetrics();
    renderPlan();
    renderSchedule();
    renderTopics();
    renderSessions();
    renderVaultTree();
  }

  function init() {
    loadSettings();
    renderAll();
    setInterval(renderMetrics, 60000);
  }

  return {
    init, renderAll, renderMetrics, renderSessions,
    saveSettings, toggleSettings, loadSettings,
    setActiveCourse, toggleAddCourseForm, saveNewCourse, deleteCourse,
    showPlanForm, hidePlanForm, savePlanTask, togglePlanTask, deletePlanTask,
    prevWeek, nextWeek,
    showTopicForm, hideTopicForm, saveTopic, incrementTopic, deleteTopic,
    showSessionForm, hideSessionForm, saveSession, deleteSession,
    askAI, askQuick,
    openInObsidian,
  };

})();

document.addEventListener('DOMContentLoaded', Study.init);
