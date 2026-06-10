/* ============================================
   SION OS — calendar.js
   v2.8.0 — Sprint 16
   Full calendar: day/week/month/agenda views
   Cross-module auto-population
   Focus blocks, deadlines, tasks right rail
   ============================================ */

const Cal = (() => {

  /* ── Constants ── */
  const CAL_CATEGORIES = {
    Personal:      { colour: '#888888', dim: '#1a1a1a' },
    Work:          { colour: '#00d4ff', dim: '#001e2a' },
    NovaTrust:     { colour: '#7F77DD', dim: '#0f0f2a' },
    'Blem Tuned':  { colour: '#ffc040', dim: '#2a1e00' },
    Younity:       { colour: '#00ff88', dim: '#0a2a1a' },
    Blueport:      { colour: '#378ADD', dim: '#0a1a2a' },
    Study:         { colour: '#c4a0ff', dim: '#1a0a2a' },
    Gym:           { colour: '#ff9944', dim: '#2a1000' },
  };

  let _view        = 'day';
  let _activeDate  = new Date();
  let _miniMonth   = new Date();
  let _filters     = {};
  let _settings    = {};
  let _editEventId = null;

  /* ── Helpers ── */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function dateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function today() { return dateStr(new Date()); }

  function formatDisplayDate(d) {
    return d.toLocaleDateString('en-AG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const ampm   = h >= 12 ? 'PM' : 'AM';
    const h12    = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  function minsFromTime(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }

  function catColour(cat) { return CAL_CATEGORIES[cat]?.colour || '#888'; }
  function catDim(cat)    { return CAL_CATEGORIES[cat]?.dim    || '#1a1a1a'; }

  /* ── Load settings & filters ── */
  function loadSettings() {
    _settings = Store.get('calendar_settings') || { sleep_hrs: 7, day_start: 6, day_end: 22 };
    const saved = Store.get('cal_filters') || {};
    Object.keys(CAL_CATEGORIES).forEach(cat => {
      _filters[cat] = saved[cat] !== undefined ? saved[cat] : true;
    });
  }

  function saveSettings() {
    _settings.sleep_hrs = parseFloat(document.getElementById('cs-sleep')?.value)    || 7;
    _settings.day_start = parseInt(document.getElementById('cs-day-start')?.value)  || 6;
    _settings.day_end   = parseInt(document.getElementById('cs-day-end')?.value)    || 22;
    Store.set('calendar_settings', _settings);
    toggleSettings();
    renderAll();
  }

  function toggleSettings() {
    const p = document.getElementById('cal-settings-panel');
    if (!p) return;
    const hidden = p.classList.toggle('hidden');
    if (!hidden) {
      const s = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      s('cs-sleep',     _settings.sleep_hrs);
      s('cs-day-start', _settings.day_start);
      s('cs-day-end',   _settings.day_end);
    }
  }

  /* ── Collect all events (manual + auto-pulled) ── */
  function getAllEvents() {
    const events = Store.getAll('calendar_events').filter(e => _filters[e.category] !== false);

    // Auto-pull: Blueport tasks with due_date
    Store.getAll('blueport_tasks')
      .filter(t => t.due_date && !t.done)
      .forEach(t => events.push({
        id:         'bp-' + t.id,
        title:       t.title,
        event_date:  t.due_date,
        start_time:  null,
        end_time:    null,
        category:    'Blueport',
        is_all_day:  true,
        is_auto:     true,
        notes:       'Blueport task',
      }));

    // Auto-pull: Younity projects with due_date
    Store.getAll('younity_projects')
      .filter(p => p.due_date && p.status !== 'Complete')
      .forEach(p => events.push({
        id:         'yp-' + p.id,
        title:       p.name + ' deadline',
        event_date:  p.due_date,
        start_time:  null,
        end_time:    null,
        category:    'Younity',
        is_all_day:  true,
        is_auto:     true,
        notes:       'Younity project',
      }));

    // Auto-pull: today's study plan tasks
    Store.getAll('study_plan_tasks')
      .filter(t => t.plan_date === today())
      .forEach(t => events.push({
        id:         'sp-' + t.id,
        title:       t.title,
        event_date:  today(),
        start_time:  t.start_time || null,
        end_time:    t.end_time   || null,
        category:    'Study',
        is_all_day:  !t.start_time,
        is_auto:     true,
        notes:       'Study plan',
      }));

    // Auto-pull: Blem Tuned jobs with a date_in (upcoming/active jobs)
    Store.getAll('blem_jobs')
      .filter(j => j.status !== 'Complete' && j.date_in)
      .forEach(j => events.push({
        id:         'bj-' + j.id,
        title:      (j.job_ref || 'Job') + ' — ' + (j.vehicle || 'Vehicle'),
        event_date: j.date_in,
        start_time: null,
        end_time:   null,
        category:   'Blem Tuned',
        is_all_day: true,
        is_auto:    true,
        notes:      j.job_type || '',
      }));

    // Auto-pull: Work tasks with due dates (both employers)
    Store.getAll('work_tasks')
      .filter(t => !t.done && t.due_date)
      .forEach(t => events.push({
        id:         'wt-' + t.id,
        title:      t.title,
        event_date: t.due_date,
        start_time: null,
        end_time:   null,
        category:   t.employer === 'NovaTrust' ? 'NovaTrust' : 'Work',
        is_all_day: true,
        is_auto:    true,
        notes:      t.employer || '',
      }));

    // Auto-pull: Future study plan tasks (not just today)
    Store.getAll('study_plan_tasks')
      .filter(t => t.plan_date && t.plan_date > today())
      .forEach(t => events.push({
        id:         'sp-future-' + t.id,
        title:      t.title,
        event_date: t.plan_date,
        start_time: t.start_time || null,
        end_time:   t.end_time   || null,
        category:   'Study',
        is_all_day: !t.start_time,
        is_auto:    true,
        notes:      'Study plan',
      }));

    // Auto-pull: focus blocks as events
    Store.getAll('focus_blocks').forEach(b => events.push({
      id:         'fb-' + b.id,
      title:       b.title + ' (Focus)',
      event_date:  b.block_date,
      start_time:  b.start_time,
      end_time:    b.end_time,
      category:    b.category,
      is_all_day:  false,
      is_auto:     true,
      is_focus:    true,
      notes:       b.notes,
    }));

    // Auto-pull: logged gym sessions
    if (_filters['Gym'] !== false) {
      Store.getAll('gym_sessions').forEach(s => events.push({
        id:         'gs-' + s.id,
        title:       s.name || s.session_type,
        event_date:  s.session_date,
        start_time:  null,
        end_time:    null,
        category:    'Gym',
        is_all_day:  true,
        is_auto:     true,
        notes:       s.session_type + (s.duration_mins ? ' · ' + s.duration_mins + 'min' : ''),
      }));
    }

    return events;
  }

  /* ── Metrics ── */
  function renderMetrics() {
    const events    = getAllEvents();
    const todayEvts = events.filter(e => e.event_date === today());
    const meetings  = todayEvts.filter(e => e.is_meeting);
    const blocks    = Store.getAll('focus_blocks').filter(b => b.block_date === today());
    const focusMins = blocks.reduce((s, b) => {
      if (!b.start_time || !b.end_time) return s + (parseInt(b.duration_mins) || 0);
      return s + minsFromTime(b.end_time) - minsFromTime(b.start_time);
    }, 0);
    const scheduledMins = todayEvts
      .filter(e => e.start_time && e.end_time && !e.is_all_day)
      .reduce((s, e) => s + minsFromTime(e.end_time) - minsFromTime(e.start_time), 0);
    const wakeHrs  = 24 - (_settings.sleep_hrs || 7);
    const freeMins = Math.max(0, wakeHrs * 60 - scheduledMins);
    const freePct  = Math.round(freeMins / (wakeHrs * 60) * 100);

    const sevenDays = new Date(); sevenDays.setDate(sevenDays.getDate() + 7);
    const deadlines = [
      ...Store.getAll('deadlines'),
      ...events.filter(e => e.is_all_day && new Date(e.event_date) <= sevenDays && new Date(e.event_date) >= new Date()),
    ];

    setEl('cal-today-count',     todayEvts.length);
    setEl('cal-focus-time',      Math.floor(focusMins / 60) + 'h ' + (focusMins % 60) + 'm');
    setEl('cal-deadlines-count', deadlines.length);
    setEl('cal-meetings-count',  meetings.length);
    setEl('cal-free-time',       Math.floor(freeMins / 60) + 'h ' + (freeMins % 60) + 'm');

    const ring = document.getElementById('cal-donut-fill');
    if (ring) ring.setAttribute('stroke-dasharray', `${freePct} ${100 - freePct}`);

    const h        = new Date().getHours();
    const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const userName = Store.get('user_prefs')?.name || '';
    setEl('cal-greeting', `${greeting}${userName ? ', ' + userName : ''}.`);

    const alerts = buildAlerts();
    setEl('cal-notif-count', alerts.length);
    const badge = document.getElementById('cal-notif-count');
    if (badge) badge.style.display = alerts.length > 0 ? 'flex' : 'none';
  }

  function buildAlerts() {
    const alerts    = [];
    const sevenDays = new Date(); sevenDays.setDate(sevenDays.getDate() + 7);
    Store.getAll('deadlines')
      .filter(d => new Date(d.deadline_date) <= sevenDays)
      .forEach(d => alerts.push({ msg: d.title + ' due ' + d.deadline_date, level: 'amber' }));
    Store.getAll('blueport_tasks')
      .filter(t => !t.done && t.due_date && new Date(t.due_date) < new Date())
      .forEach(t => alerts.push({ msg: 'Blueport: ' + t.title + ' overdue', level: 'red' }));
    Store.getAll('subscriptions')
      .filter(s => s.renewal_date && Math.ceil((new Date(s.renewal_date) - new Date()) / 86400000) <= 3)
      .forEach(s => alerts.push({ msg: s.name + ' renews in 3 days', level: 'amber' }));
    return alerts;
  }

  /* ── Date navigation ── */
  function goToday() { _activeDate = new Date(); renderView(); updateDateLabel(); }
  function prevDay()  { _activeDate.setDate(_activeDate.getDate() - (_view === 'week' ? 7 : 1)); renderView(); updateDateLabel(); }
  function nextDay()  { _activeDate.setDate(_activeDate.getDate() + (_view === 'week' ? 7 : 1)); renderView(); updateDateLabel(); }

  function updateDateLabel() {
    setEl('cal-date-label', formatDisplayDate(_activeDate));
  }

  function setView(view, btn) {
    _view = view;
    document.querySelectorAll('.cal-view-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderView();
  }

  /* ── Main view router ── */
  function renderView() {
    updateDateLabel();
    const el = document.getElementById('cal-view-area');
    if (!el) return;
    if      (_view === 'day')    renderDayView(el);
    else if (_view === 'week')   renderWeekView(el);
    else if (_view === 'month')  renderMonthView(el);
    else if (_view === 'agenda') renderAgendaView(el);
    renderAllDay();
  }

  /* ── All-day strip ── */
  function renderAllDay() {
    const el = document.getElementById('cal-allday-strip');
    if (!el) return;
    const date   = dateStr(_activeDate);
    const events = getAllEvents().filter(e => e.is_all_day && e.event_date === date);
    if (!events.length) { el.innerHTML = ''; el.style.display = 'none'; return; }
    el.style.display = 'flex';
    el.innerHTML = `<span class="cal-allday-label">All-day</span>` +
      events.map(e => `
        <span class="cal-allday-chip" style="background:${catDim(e.category)};border-color:${catColour(e.category)};color:${catColour(e.category)}">
          ${escapeHtml(e.title)}
        </span>`).join('');
  }

  /* ── Day view ── */
  function renderDayView(el) {
    const start  = _settings.day_start || 6;
    const end    = _settings.day_end   || 22;
    const date   = dateStr(_activeDate);
    const events = getAllEvents()
      .filter(e => e.event_date === date && !e.is_all_day && e.start_time)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    const isToday = date === today();

    let html = '<div class="cal-day-view">';
    for (let h = start; h <= end; h++) {
      const timeLabel  = formatTime(`${String(h).padStart(2, '0')}:00`);
      const slotMins   = h * 60;
      const slotEvents = events.filter(e => {
        const eMins = minsFromTime(e.start_time);
        return eMins >= slotMins && eMins < slotMins + 60;
      });

      const nowLine = isToday && nowMins >= slotMins && nowMins < slotMins + 60
        ? `<div class="cal-now-line" style="top:${(nowMins - slotMins) / 60 * 100}%">
             <div class="cal-now-dot"></div>
             <div class="cal-now-label">${formatTime(new Date().toTimeString().slice(0, 5))}</div>
           </div>`
        : '';

      html += `
        <div class="cal-hour-row" onclick="Cal.quickAddAtTime('${String(h).padStart(2, '0')}:00')">
          <div class="cal-hour-label">${timeLabel}</div>
          <div class="cal-hour-slot">
            ${nowLine}
            ${slotEvents.map(e => `
              <div class="cal-event-block"
                style="background:${catDim(e.category)};border-left:3px solid ${catColour(e.category)}"
                onclick="event.stopPropagation();Cal.editEvent('${e.id}')">
                <div class="cal-event-time">${formatTime(e.start_time)}${e.end_time ? ' – ' + formatTime(e.end_time) : ''}</div>
                <div class="cal-event-title">${escapeHtml(e.title)}</div>
                <span class="cal-event-badge" style="background:${catColour(e.category)}20;color:${catColour(e.category)};border:0.5px solid ${catColour(e.category)}40">${escapeHtml(e.category)}</span>
                ${e.is_focus ? '<i class="ti ti-target" style="font-size:10px;margin-left:4px;opacity:.6" aria-hidden="true"></i>' : ''}
              </div>`).join('')}
          </div>
        </div>`;
    }
    html += '</div>';
    el.innerHTML = html;

  }

  /* ── Week view ── */
  function renderWeekView(el) {
    const base = new Date(_activeDate);
    base.setDate(base.getDate() - base.getDay() + 1); // Monday
    const days  = Array.from({ length: 7 }, (_, i) => { const d = new Date(base); d.setDate(base.getDate() + i); return d; });
    const start = _settings.day_start || 6;
    const end   = _settings.day_end   || 22;
    const allEvts = getAllEvents();

    let html = `<div class="cal-week-view">
      <div class="cal-week-header">
        <div class="cal-week-time-col"></div>
        ${days.map(d => `
          <div class="cal-week-day-header ${dateStr(d) === today() ? 'cal-week-today' : ''}">
            <div>${d.toLocaleDateString('en-AG', { weekday: 'short' })}</div>
            <div class="cal-week-day-num ${dateStr(d) === today() ? 'green' : ''}">${d.getDate()}</div>
          </div>`).join('')}
      </div>`;

    for (let h = start; h <= end; h++) {
      html += `<div class="cal-week-row">
        <div class="cal-week-time">${formatTime(String(h).padStart(2, '0') + ':00')}</div>`;
      days.forEach(d => {
        const ds   = dateStr(d);
        const evts = allEvts.filter(e => e.event_date === ds && !e.is_all_day && e.start_time && minsFromTime(e.start_time) >= h * 60 && minsFromTime(e.start_time) < (h + 1) * 60);
        html += `<div class="cal-week-cell ${ds === today() ? 'cal-week-cell-today' : ''}" onclick="Cal.jumpToDay('${ds}')">`;
        html += evts.map(e => `<div class="cal-week-event" style="background:${catColour(e.category)};opacity:0.85" title="${escapeHtml(e.title)}">${escapeHtml(e.title.slice(0, 16))}</div>`).join('');
        html += `</div>`;
      });
      html += `</div>`;
    }
    html += '</div>';
    el.innerHTML = html;
  }

  /* ── Month view ── */
  function renderMonthView(el) {
    const y       = _activeDate.getFullYear();
    const m       = _activeDate.getMonth();
    const first   = new Date(y, m, 1);
    const allEvts = getAllEvents();

    let start = new Date(first);
    const dow = (first.getDay() + 6) % 7;
    start.setDate(start.getDate() - dow);

    let html = `<div class="cal-month-view">
      <div class="cal-month-header">
        ${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => `<div class="cal-month-day-label">${d}</div>`).join('')}
      </div><div class="cal-month-grid">`;

    for (let i = 0; i < 35; i++) {
      const d    = new Date(start); d.setDate(start.getDate() + i);
      const ds   = dateStr(d);
      const evts = allEvts.filter(e => e.event_date === ds).slice(0, 3);
      const isCurrentMonth = d.getMonth() === m;
      const isToday2       = ds === today();
      html += `<div class="cal-month-cell ${!isCurrentMonth ? 'cal-month-other' : ''}" onclick="Cal.jumpToDay('${ds}')">
        <div class="cal-month-cell-num ${isToday2 ? 'cal-month-today-num' : ''}">${d.getDate()}</div>
        ${evts.map(e => `<div class="cal-month-event" style="background:${catColour(e.category)}" title="${escapeHtml(e.title)}">${escapeHtml(e.title.slice(0, 14))}</div>`).join('')}
      </div>`;
    }
    html += '</div></div>';
    el.innerHTML = html;
  }

  /* ── Agenda view ── */
  function renderAgendaView(el) {
    const events = getAllEvents()
      .filter(e => e.event_date >= today())
      .sort((a, b) => {
        const dc = a.event_date.localeCompare(b.event_date);
        if (dc !== 0) return dc;
        return (a.start_time || '').localeCompare(b.start_time || '');
      });

    if (!events.length) { el.innerHTML = '<div class="task-empty">no upcoming events</div>'; return; }

    const groups = {};
    events.forEach(e => {
      if (!groups[e.event_date]) groups[e.event_date] = [];
      groups[e.event_date].push(e);
    });

    el.innerHTML = '<div class="cal-agenda-view">' +
      Object.entries(groups).slice(0, 30).map(([date, evts]) => {
        const d        = new Date(date + 'T00:00:00');
        const isToday2 = date === today();
        const label    = isToday2 ? 'Today' : d.toLocaleDateString('en-AG', { weekday: 'long', day: 'numeric', month: 'long' });
        return `
          <div class="cal-agenda-group">
            <div class="cal-agenda-date ${isToday2 ? 'green' : 'fg3'}">${label}</div>
            ${evts.map(e => `
              <div class="cal-event-block" style="background:${catDim(e.category)};border-left:3px solid ${catColour(e.category)};margin-bottom:4px">
                <div class="cal-event-time">${e.start_time ? formatTime(e.start_time) : ''}</div>
                <div class="cal-event-title">${escapeHtml(e.title)}</div>
                <span class="cal-event-badge" style="background:${catColour(e.category)}20;color:${catColour(e.category)}">${escapeHtml(e.category)}</span>
              </div>`).join('')}
          </div>`;
      }).join('') + '</div>';
  }

  /* ── Mini calendar ── */
  function renderMiniCal() {
    const el = document.getElementById('cal-mini-grid');
    if (!el) return;

    const y       = _miniMonth.getFullYear();
    const m       = _miniMonth.getMonth();
    const first   = new Date(y, m, 1);
    const allEvts = getAllEvents();

    setEl('cal-mini-month', _miniMonth.toLocaleDateString('en-AG', { month: 'long', year: 'numeric' }));

    let start = new Date(first);
    const dow = (first.getDay() + 6) % 7;
    start.setDate(start.getDate() - dow);

    let html = '<div class="mini-cal-header">' +
      ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => `<span>${d}</span>`).join('') +
      '</div><div class="mini-cal-grid">';

    for (let i = 0; i < 35; i++) {
      const d   = new Date(start); d.setDate(start.getDate() + i);
      const ds  = dateStr(d);
      const has = allEvts.some(e => e.event_date === ds);
      const ism = d.getMonth() === m;
      const ist = ds === today();
      const isa = ds === dateStr(_activeDate);
      html += `<span class="mini-cal-day ${!ism ? 'mini-other' : ''} ${ist ? 'mini-today' : ''} ${isa ? 'mini-active' : ''}"
        onclick="Cal.jumpToDay('${ds}')">${d.getDate()}${has && ism ? '<i></i>' : ''}</span>`;
    }
    html += '</div>';
    el.innerHTML = html;
  }

  function miniPrev() { _miniMonth.setMonth(_miniMonth.getMonth() - 1); renderMiniCal(); }
  function miniNext() { _miniMonth.setMonth(_miniMonth.getMonth() + 1); renderMiniCal(); }

  function jumpToDay(ds) {
    _activeDate = new Date(ds + 'T12:00:00');
    if (_view !== 'day') setView('day', document.getElementById('tab-day'));
    else renderView();
    renderMiniCal();
  }

  /* ── Upcoming 7 days ── */
  function renderUpcoming() {
    const el = document.getElementById('cal-upcoming-list');
    if (!el) return;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + 7);
    const events = getAllEvents()
      .filter(e => e.event_date > today() && new Date(e.event_date) <= cutoff)
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
      .slice(0, 8);

    if (!events.length) { el.innerHTML = '<div class="task-empty" style="font-size:10px">nothing in next 7 days</div>'; return; }

    el.innerHTML = events.map(e => {
      const d        = new Date(e.event_date + 'T00:00:00');
      const dayLabel = d.toLocaleDateString('en-AG', { weekday: 'short', day: 'numeric', month: 'short' });
      return `
        <div class="cal-upcoming-row">
          <div class="cal-upcoming-left">
            <div class="cal-upcoming-date fg3">${dayLabel}</div>
            <div class="cal-upcoming-title">${escapeHtml(e.title)}</div>
            ${e.start_time ? `<div class="cal-upcoming-time fg3">${formatTime(e.start_time)}</div>` : ''}
          </div>
          <span class="cal-upcoming-dot" style="background:${catColour(e.category)}"></span>
        </div>`;
    }).join('');
  }

  /* ── Right rail: tasks ── */
  function renderRightTasks() {
    const el = document.getElementById('cal-tasks-list');
    if (!el) return;
    const tasks = Store.getAll('tasks').slice(0, 6);
    if (!tasks.length) { el.innerHTML = '<div class="task-empty" style="font-size:10px">no tasks</div>'; return; }
    el.innerHTML = tasks.map(t => {
      const catMap = { work: 'Work', blueport: 'Blueport', study: 'Study', gym: 'Gym', biz: 'Younity' };
      const cat    = catMap[t.badge] || 'Personal';
      const col    = catColour(cat);
      return `
        <div class="cal-right-task ${t.done ? 'task-done' : ''}">
          <div class="task-check ${t.done ? 'checked' : ''}" onclick="Cal.toggleTask(${t.id})" style="width:14px;height:14px;font-size:9px">
            ${t.done ? '<i class="ti ti-check"></i>' : ''}
          </div>
          <span class="cal-right-task-title">${escapeHtml(t.title)}</span>
          <span class="cal-right-task-badge" style="background:${col}20;color:${col};border:0.5px solid ${col}40">${t.badge || 'task'}</span>
        </div>`;
    }).join('');
  }

  function toggleTask(id) {
    const t = Store.getAll('tasks').find(x => x.id === id);
    if (!t) return;
    Store.update('tasks', id, { done: !t.done });
    renderRightTasks();
    if (typeof Dashboard !== 'undefined') Dashboard.renderTasks?.();
  }

  function openAllTasks() {
    navigate('dashboard', document.querySelector('[data-module="dashboard"]'));
  }

  /* ── Right rail: focus blocks ── */
  function renderFocusBlocks() {
    const el        = document.getElementById('cal-focus-list');
    const plannedEl = document.getElementById('cal-focus-planned');
    if (!el) return;
    const blocks    = Store.getAll('focus_blocks').filter(b => b.block_date === today());
    const totalMins = blocks.reduce((s, b) => s + (parseInt(b.duration_mins) || 0), 0);
    if (plannedEl) plannedEl.textContent = Math.floor(totalMins / 60) + 'h ' + (totalMins % 60) + 'm planned';

    if (!blocks.length) { el.innerHTML = '<div class="task-empty" style="font-size:10px">no focus blocks today</div>'; return; }
    el.innerHTML = blocks.map(b => `
      <div class="cal-focus-block" style="border-left:3px solid ${catColour(b.category)}">
        <div class="cal-focus-title">${escapeHtml(b.title)}</div>
        <div class="cal-focus-time fg3">${b.start_time && b.end_time ? formatTime(b.start_time) + ' – ' + formatTime(b.end_time) : (b.duration_mins + 'min')}</div>
        <button class="pom-start-btn" onclick="typeof Pomodoro !== 'undefined' && Pomodoro.startForTask?.('${escapeHtml(b.title)}', ${b.duration_mins || 25})" title="Start Pomodoro">
          <i class="ti ti-player-play"></i>
        </button>
        <button class="task-del" onclick="Cal.deleteFocusBlock(${b.id})">
          <i class="ti ti-x"></i>
        </button>
      </div>`).join('');
  }

  /* ── Right rail: deadlines ── */
  function renderDeadlines() {
    const el = document.getElementById('cal-deadlines-list');
    if (!el) return;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + 14);
    const manual = Store.getAll('deadlines');
    const auto   = [
      ...Store.getAll('blueport_tasks').filter(t => !t.done && t.due_date).map(t => ({ title: t.title, deadline_date: t.due_date, category: 'Blueport' })),
      ...Store.getAll('younity_projects').filter(p => p.status !== 'Complete' && p.due_date).map(p => ({ title: p.name, deadline_date: p.due_date, category: 'Younity' })),
    ];
    const all = [...manual, ...auto]
      .filter(d => new Date(d.deadline_date) <= cutoff)
      .sort((a, b) => a.deadline_date.localeCompare(b.deadline_date))
      .slice(0, 5);

    if (!all.length) { el.innerHTML = '<div class="task-empty" style="font-size:10px">no upcoming deadlines</div>'; return; }
    el.innerHTML = all.map(d => {
      const days      = Math.ceil((new Date(d.deadline_date) - new Date()) / 86400000);
      const col       = catColour(d.category || 'Personal');
      const daysLabel = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days + ' days';
      const dayCls    = days <= 1 ? 'red' : days <= 3 ? 'amber' : 'fg2';
      return `
        <div class="cal-deadline-row">
          <span class="cal-deadline-dot" style="background:${col}"></span>
          <span class="cal-deadline-title">${escapeHtml(d.title)}</span>
          <span class="task-badge" style="background:${col}20;color:${col};border:0.5px solid ${col}40;font-size:9px">${escapeHtml(d.category || '')}</span>
          <span class="cal-deadline-days ${dayCls}">${daysLabel}</span>
        </div>`;
    }).join('');
  }

  /* ── Filters ── */
  function toggleFilters() {
    document.getElementById('cal-filters-panel')?.classList.toggle('hidden');
    renderFilterList();
  }

  function renderFilterList() {
    const el = document.getElementById('cal-filter-list');
    if (!el) return;
    el.innerHTML = Object.entries(CAL_CATEGORIES).map(([cat, cfg]) => `
      <div class="cal-filter-row">
        <label class="widget-toggle">
          <input type="checkbox" ${_filters[cat] !== false ? 'checked' : ''}
            onchange="Cal.setFilter('${cat}', this.checked)" />
          <span class="cal-filter-dot" style="background:${cfg.colour}"></span>
          <span class="widget-toggle-label">${escapeHtml(cat)}</span>
        </label>
      </div>`).join('');
  }

  function setFilter(cat, on) {
    _filters[cat] = on;
    Store.set('cal_filters', _filters);
    renderAll();
  }

  /* ── Event form ── */
  function showEventForm(date, time) {
    _editEventId = null;
    clearEventForm();
    const dateEl = document.getElementById('ce-date');
    if (dateEl) dateEl.value = date || today();
    const timeEl = document.getElementById('ce-start');
    if (timeEl && time) timeEl.value = time;
    const titleEl = document.getElementById('cal-form-title');
    if (titleEl) titleEl.textContent = 'new event';
    document.getElementById('cal-event-form')?.classList.remove('hidden');
    document.getElementById('ce-title')?.focus();
  }

  function hideEventForm() {
    document.getElementById('cal-event-form')?.classList.add('hidden');
    clearEventForm();
    _editEventId = null;
  }

  function clearEventForm() {
    ['ce-title', 'ce-date', 'ce-start', 'ce-end', 'ce-notes'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const allday  = document.getElementById('ce-allday');
    const meeting = document.getElementById('ce-meeting');
    if (allday)  allday.checked  = false;
    if (meeting) meeting.checked = false;
  }

  function toggleAllDay(cb) {
    const startEl = document.getElementById('ce-start');
    const endEl   = document.getElementById('ce-end');
    if (startEl) startEl.disabled = cb.checked;
    if (endEl)   endEl.disabled   = cb.checked;
  }

  function editEvent(id) {
    const e = Store.getAll('calendar_events').find(x => String(x.id) === String(id));
    if (!e) return;
    _editEventId = e.id;
    const s = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
    s('ce-title',    e.title);
    s('ce-date',     e.event_date);
    s('ce-start',    e.start_time);
    s('ce-end',      e.end_time);
    s('ce-notes',    e.notes);
    s('ce-category', e.category);
    const alldayEl  = document.getElementById('ce-allday');
    const meetingEl = document.getElementById('ce-meeting');
    if (alldayEl)  alldayEl.checked  = !!e.is_all_day;
    if (meetingEl) meetingEl.checked = !!e.is_meeting;
    const titleEl = document.getElementById('cal-form-title');
    if (titleEl) titleEl.textContent = 'edit event — ' + e.title;
    document.getElementById('cal-event-form')?.classList.remove('hidden');
    document.getElementById('ce-title')?.focus();
  }

  function saveEvent() {
    const titleEl = document.getElementById('ce-title');
    const title   = titleEl?.value.trim();
    if (!title) { titleEl?.focus(); return; }
    const data = {
      title,
      event_date:  document.getElementById('ce-date')?.value     || today(),
      start_time:  document.getElementById('ce-start')?.value    || null,
      end_time:    document.getElementById('ce-end')?.value      || null,
      category:    document.getElementById('ce-category')?.value || 'Personal',
      notes:       document.getElementById('ce-notes')?.value    || '',
      is_all_day:  document.getElementById('ce-allday')?.checked  || false,
      is_meeting:  document.getElementById('ce-meeting')?.checked || false,
    };
    if (_editEventId) Store.update('calendar_events', _editEventId, data);
    else              Store.insert('calendar_events', data);
    hideEventForm();
    renderAll();
  }

  function quickAddAtTime(time) {
    showEventForm(dateStr(_activeDate), time);
  }

  /* ── Focus blocks ── */
  function startFocusTime() { showFocusForm(); }

  function showFocusForm() {
    clearFocusForm();
    document.getElementById('cal-focus-form')?.classList.remove('hidden');
    document.getElementById('cf-title')?.focus();
    const dateEl = document.getElementById('cf-date');
    if (dateEl) dateEl.value = today();
  }

  function hideFocusForm() {
    document.getElementById('cal-focus-form')?.classList.add('hidden');
    clearFocusForm();
  }

  function clearFocusForm() {
    ['cf-title', 'cf-date', 'cf-start', 'cf-end', 'cf-duration', 'cf-notes']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  }

  function saveFocusBlock() {
    const title = document.getElementById('cf-title')?.value.trim();
    if (!title) return;
    const start = document.getElementById('cf-start')?.value || '';
    const end   = document.getElementById('cf-end')?.value   || '';
    const dur   = parseInt(document.getElementById('cf-duration')?.value) ||
                  (start && end ? minsFromTime(end) - minsFromTime(start) : 25);
    Store.insert('focus_blocks', {
      title,
      category:      document.getElementById('cf-category')?.value || 'Study',
      block_date:    document.getElementById('cf-date')?.value     || today(),
      start_time:    start || null,
      end_time:      end   || null,
      duration_mins: dur,
      notes:         document.getElementById('cf-notes')?.value    || '',
    });
    hideFocusForm();
    renderAll();
    if (typeof Pomodoro !== 'undefined') Pomodoro.startForTask?.(title, dur);
  }

  function deleteFocusBlock(id) { Store.delete('focus_blocks', id); renderAll(); }

  /* ── Deadlines ── */
  function showDeadlineForm() {
    document.getElementById('cal-deadline-form')?.classList.remove('hidden');
    document.getElementById('cd-title')?.focus();
  }

  function hideDeadlineForm() {
    document.getElementById('cal-deadline-form')?.classList.add('hidden');
    ['cd-title', 'cd-date', 'cd-notes'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  }

  function saveDeadline() {
    const title = document.getElementById('cd-title')?.value.trim();
    if (!title) return;
    Store.insert('deadlines', {
      title,
      category:      document.getElementById('cd-category')?.value || 'Personal',
      deadline_date: document.getElementById('cd-date')?.value     || today(),
      notes:         document.getElementById('cd-notes')?.value    || '',
    });
    hideDeadlineForm();
    renderAll();
  }

  function viewAllDeadlines() {
    setView('agenda', document.getElementById('tab-agenda'));
  }

  /* ── Alerts panel ── */
  function toggleAlerts() {
    const alerts  = buildAlerts();
    const panelId = 'cal-alerts-panel';
    let panel     = document.getElementById(panelId);

    if (!panel) {
      panel = document.createElement('div');
      panel.id        = panelId;
      panel.className = 'cal-filters-panel';
      panel.style.cssText = 'position:absolute;top:60px;right:16px;z-index:100;min-width:280px';
      document.getElementById('mod-calendar')?.appendChild(panel);
    }

    if (!alerts.length) {
      panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:10px;letter-spacing:.08em;color:var(--fg3)">ALERTS</span>
          <button class="task-del" onclick="Cal.toggleAlerts()"><i class="ti ti-x"></i></button>
        </div>
        <div class="task-empty" style="font-size:11px">No active alerts</div>`;
    } else {
      panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:10px;letter-spacing:.08em;color:var(--fg3)">ALERTS (${alerts.length})</span>
          <button class="task-del" onclick="Cal.toggleAlerts()"><i class="ti ti-x"></i></button>
        </div>` +
        alerts.map(a => `
          <div style="padding:6px 0;border-bottom:1px solid var(--bg2);font-size:11px">
            <span class="${a.level === 'red' ? 'red' : 'amber'}" style="margin-right:6px">●</span>
            ${escapeHtml(a.msg)}
          </div>`).join('');
    }

    panel.classList.toggle('hidden');
  }

  /* ── Quick task ── */
  function showQuickTask() {
    navigate('dashboard', document.querySelector('[data-module="dashboard"]'));
    setTimeout(() => document.getElementById('dash-quick-add')?.focus(), 200);
  }

  function setEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

  function renderAll() {
    renderMetrics();
    renderView();
    renderMiniCal();
    renderUpcoming();
    renderRightTasks();
    renderFocusBlocks();
    renderDeadlines();
    renderFilterList();
  }

  function init() {
    loadSettings();
    renderAll();
    setInterval(() => {
      renderMetrics();
      if (_view === 'day') renderView();
    }, 60000);
  }

  return {
    init, renderAll,
    goToday, prevDay, nextDay, setView, jumpToDay,
    miniPrev, miniNext,
    toggleFilters, setFilter,
    showEventForm, hideEventForm, saveEvent, editEvent, quickAddAtTime, toggleAllDay,
    startFocusTime, showFocusForm, hideFocusForm, saveFocusBlock, deleteFocusBlock,
    showDeadlineForm, hideDeadlineForm, saveDeadline, viewAllDeadlines,
    toggleTask, openAllTasks, showQuickTask,
    toggleSettings, saveSettings, toggleAlerts,
  };

})();

document.addEventListener('DOMContentLoaded', Cal.init);
