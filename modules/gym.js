/* ============================================
   SION OS — gym.js
   v0.7.0 — Sprint 6
   US-016: Daily weight log + progress
   US-017: Workout log + food + calorie surplus
   ============================================ */

const Gym = (() => {

  // CR-001: Constants from Config
  function WEIGHT_START()   { return Config.weightStart(); }
  function WEIGHT_TARGET()  { return Config.weightTarget(); }
  function CALORIE_TARGET() { return Config.calorieTarget(); }

  let _editWeightId  = null;
  let _editSessionId = null;
  let _editFoodId    = null;
  let _filter = {
    mode:  'month',
    month: new Date().toISOString().slice(0, 7),
    day:   new Date().toISOString().split('T')[0],
    start: '',
    end:   '',
  };

  function _inRange(dateStr) {
    if (!dateStr) return false;
    const { mode, month, day, start, end } = _filter;
    if (mode === 'month') return dateStr.startsWith(month);
    if (mode === 'day')   return dateStr === day;
    if (start && dateStr < start) return false;
    if (end   && dateStr > end)   return false;
    return true;
  }

  function _filterDateRange() {
    const { mode, month, day, start, end } = _filter;
    const today = new Date().toISOString().split('T')[0];
    if (mode === 'day')   return { start: day, end: day };
    if (mode === 'range') return { start: start || '2020-01-01', end: end || today };
    const [y, m] = month.split('-').map(Number);
    return { start: `${month}-01`, end: new Date(y, m, 0).toISOString().split('T')[0] };
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr + 'T00:00:00')
      .toLocaleDateString('en-AG', { weekday:'short', day:'numeric', month:'short' });
  }

  function isThisWeek(dateStr) {
    if (!dateStr) return false;
    const d     = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const day   = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0,0,0,0);
    return d >= monday;
  }

  function isToday(dateStr) {
    if (!dateStr) return false;
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  }

  /* ── Render weight hero + bar ── */
  function renderWeightHero() {
    const entries  = Store.getAll('gym_weight').sort((a,b) => new Date(a.logged_date) - new Date(b.logged_date));
    const current  = entries.length > 0 ? parseFloat(entries[entries.length-1].weight_lbs) : WEIGHT_START();
    const pct      = Math.min(100, Math.max(0,
      Math.round((current - WEIGHT_START()) / (WEIGHT_TARGET() - WEIGHT_START()) * 100)
    ));
    const remaining = Math.max(0, WEIGHT_TARGET() - current).toFixed(1);

    // Streak: consecutive days logged
    let streak = 0;
    if (entries.length > 0) {
      const sorted = [...entries].sort((a,b) => new Date(b.logged_date) - new Date(a.logged_date));
      let checkDate = new Date();
      for (const e of sorted) {
        const d = new Date(e.logged_date + 'T00:00:00');
        checkDate.setHours(0,0,0,0);
        if (d.toDateString() === checkDate.toDateString()) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else break;
      }
    }

    setEl('gym-weight-display', current % 1 === 0 ? current : current.toFixed(1));
    setEl('gym-pct',       pct + '%');
    setEl('gym-remaining', remaining + 'lb');
    setEl('gym-streak',    streak);

    const bar    = document.getElementById('gym-weight-bar');
    const barPct = document.getElementById('gym-weight-bar-pct');
    if (bar)    bar.style.width = pct + '%';
    if (barPct) barPct.textContent = pct + '%';

    const targetEl = document.getElementById('gym-weight-target-display');
    if (targetEl) targetEl.textContent = Config.weightTarget() || '—';
  }

  /* ── Render weight table ── */
  function renderWeightTable() {
    const tbody = document.getElementById('gym-weight-tbody');
    if (!tbody) return;

    const entries = Store.getAll('gym_weight')
      .filter(e => _inRange(e.logged_date))
      .sort((a,b) => new Date(b.logged_date) - new Date(a.logged_date));

    if (!entries.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="blem-empty">no weight entries for this period</td></tr>';
      return;
    }

    tbody.innerHTML = entries.map((e, i) => {
      const prev   = entries[i + 1];
      const change = prev
        ? (parseFloat(e.weight_lbs) - parseFloat(prev.weight_lbs)).toFixed(1)
        : null;
      const changeCls = change === null ? '' : parseFloat(change) >= 0 ? 'green' : 'red';
      const changeStr = change === null ? '—'
        : (parseFloat(change) >= 0 ? '+' : '') + change + 'lb';

      return `<tr>
        <td class="fg2" style="white-space:nowrap">${formatDate(e.logged_date)}</td>
        <td class="white num">${parseFloat(e.weight_lbs).toFixed(1)} lb</td>
        <td class="num ${changeCls}">${changeStr}</td>
        <td class="fg3" style="font-size:10px">${escapeHtml(e.notes || '—')}</td>
        <td style="display:flex;gap:2px">
          <button class="task-edit" onclick="Gym.editWeight(${e.id})" aria-label="Edit">
            <i class="ti ti-pencil" aria-hidden="true"></i>
          </button>
          <button class="task-del" onclick="Gym.deleteWeight(${e.id})" aria-label="Delete">
            <i class="ti ti-x" aria-hidden="true"></i>
          </button>
        </td>
      </tr>`;
    }).join('');
  }

  /* ── Log weight ── */
  function logWeight() {
    const input  = document.getElementById('gym-weight-input');
    const dateEl = document.getElementById('gym-weight-date');
    const weight = parseFloat(input?.value);
    const date   = dateEl?.value || new Date().toISOString().split('T')[0];

    if (!weight || weight < 50 || weight > 400) {
      if (input) input.focus();
      return;
    }

    if (_editWeightId) {
      Store.update('gym_weight', _editWeightId, { weight_lbs: weight, logged_date: date });
      _editWeightId = null;
      _setWeightBtnMode(false);
    } else {
      Store.insert('gym_weight', { weight_lbs: weight, logged_date: date, notes: '', source: 'direct' });
    }

    if (input)  input.value  = '';
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    renderAll();

    const milestones = Store.getAll('milestones');
    const weightMs   = milestones.find(m => m.name === 'Weight goal');
    if (weightMs) Store.update('milestones', weightMs.id, { current_value: weight });
  }

  function editWeight(id) {
    const entry = Store.getAll('gym_weight').find(e => e.id === id);
    if (!entry) return;
    _editWeightId = id;
    const input  = document.getElementById('gym-weight-input');
    const dateEl = document.getElementById('gym-weight-date');
    if (input)  { input.value  = parseFloat(entry.weight_lbs); input.focus(); }
    if (dateEl)   dateEl.value = entry.logged_date;
    _setWeightBtnMode(true);
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function cancelEditWeight() {
    _editWeightId = null;
    const input  = document.getElementById('gym-weight-input');
    const dateEl = document.getElementById('gym-weight-date');
    if (input)  input.value  = '';
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    _setWeightBtnMode(false);
  }

  function _setWeightBtnMode(editing) {
    const btn    = document.getElementById('gym-weight-log-btn');
    const cancel = document.getElementById('gym-weight-cancel-btn');
    if (btn)    btn.textContent = editing ? 'update' : 'log';
    if (cancel) cancel.style.display = editing ? '' : 'none';
  }

  function deleteWeight(id) {
    if (_editWeightId === id) cancelEditWeight();
    Store.delete('gym_weight', id);
    renderAll();
  }

  /* ── Render sessions ── */
  function renderSessions() {
    const el      = document.getElementById('gym-session-list');
    const countEl = document.getElementById('gym-sessions-this-week');
    if (!el) return;

    const allSessions = Store.getAll('gym_sessions')
      .sort((a,b) => new Date(b.session_date) - new Date(a.session_date));
    const sessions = allSessions.filter(s => _inRange(s.session_date));

    const thisWeek     = allSessions.filter(s => isThisWeek(s.session_date)).length;
    const prefs        = Store.get('user_prefs') || {};
    const weeklyTarget = parseInt(prefs.weekly_session_target) || 0;
    const targetLabel  = weeklyTarget > 0
      ? 'of ' + weeklyTarget + ' target this week'
      : 'this week';
    if (countEl) countEl.textContent = thisWeek + ' ' + targetLabel;

    if (!sessions.length) {
      el.innerHTML = '<div class="task-empty">no sessions logged for this period</div>';
      return;
    }

    const energyColour = { '5':'green','4':'cyan','3':'amber','2':'amber','1':'red' };
    const typeBadge = {
      'Upper Push': 'badge-work', 'Upper Pull': 'badge-work',
      'Lower':      'badge-biz',  'Full Body':  'badge-blueport',
      'Cardio':     'badge-gym',  'Rest':       '',
    };

    el.innerHTML = sessions.map(s => `
      <div class="task-row">
        <div class="work-task-body">
          <div class="work-task-title">${escapeHtml(s.name || s.session_type)}</div>
          <div class="work-task-meta">
            <span class="task-badge ${typeBadge[s.session_type] || 'badge-gym'}">${s.session_type}</span>
            ${s.duration_mins ? `<span class="fg3" style="font-size:10px">${s.duration_mins}min</span>` : ''}
            <span class="${energyColour[String(s.energy_level)] || 'fg3'}" style="font-size:10px">energy ${s.energy_level}/5</span>
            <span class="fg3" style="font-size:10px;white-space:nowrap">${formatDate(s.session_date)}</span>
          </div>
        </div>
        <div style="display:flex;gap:2px">
          <button class="task-edit" onclick="Gym.editSession(${s.id})" aria-label="Edit">
            <i class="ti ti-pencil" aria-hidden="true"></i>
          </button>
          <button class="task-del" onclick="Gym.deleteSession(${s.id})" aria-label="Delete">
            <i class="ti ti-x" aria-hidden="true"></i>
          </button>
        </div>
      </div>`).join('');
  }

  /* ── Session form ── */
  function showSessionForm() {
    _editSessionId = null;
    _setSessionFormMode(false);
    document.getElementById('gym-session-form')?.classList.remove('hidden');
    const dateEl = document.getElementById('gs-date');
    if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
    document.getElementById('gs-name')?.focus();
  }

  function editSession(id) {
    const s = Store.getAll('gym_sessions').find(x => x.id === id);
    if (!s) return;
    _editSessionId = id;
    const f = (eid, val) => { const el = document.getElementById(eid); if (el) el.value = val ?? ''; };
    f('gs-name',      s.name || '');
    f('gs-type',      s.session_type  || 'Full Body');
    f('gs-date',      s.session_date  || '');
    f('gs-mins',      s.duration_mins || '');
    f('gs-energy',    s.energy_level  || 3);
    f('gs-exercises', s.exercises     || '');
    _setSessionFormMode(true);
    document.getElementById('gym-session-form')?.classList.remove('hidden');
    document.getElementById('gs-name')?.focus();
    document.getElementById('gym-session-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function _setSessionFormMode(editing) {
    const title = document.getElementById('gs-form-title');
    const btn   = document.getElementById('gs-save-btn');
    if (title) title.textContent = editing ? 'edit session' : 'log workout session';
    if (btn)   btn.textContent   = editing ? 'update session' : 'save session';
  }

  function hideSessionForm() {
    _editSessionId = null;
    document.getElementById('gym-session-form')?.classList.add('hidden');
    ['gs-name','gs-date','gs-mins','gs-exercises'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const en = document.getElementById('gs-energy');
    if (en) en.value = '3';
    _setSessionFormMode(false);
  }

  function saveSession() {
    const name = document.getElementById('gs-name')?.value.trim();
    if (!name) { document.getElementById('gs-name')?.focus(); return; }
    const data = {
      name,
      session_type:  document.getElementById('gs-type')?.value      || 'Full Body',
      session_date:  document.getElementById('gs-date')?.value      || new Date().toISOString().split('T')[0],
      duration_mins: parseInt(document.getElementById('gs-mins')?.value) || 0,
      energy_level:  parseInt(document.getElementById('gs-energy')?.value) || 3,
      exercises:     document.getElementById('gs-exercises')?.value || '',
    };
    if (_editSessionId) {
      Store.update('gym_sessions', _editSessionId, data);
    } else {
      Store.insert('gym_sessions', { ...data, source: 'direct' });
    }
    hideSessionForm();
    renderSessions();
  }

  function deleteSession(id) {
    if (_editSessionId === id) hideSessionForm();
    Store.delete('gym_sessions', id);
    renderSessions();
  }

  /* ── Food log ── */
  function renderFood() {
    const el       = document.getElementById('gym-food-list');
    const countEl  = document.getElementById('gym-calorie-today');
    const bar      = document.getElementById('gym-cal-bar');
    if (!el) return;

    const today   = new Date().toISOString().split('T')[0];
    const allFood = Store.getAll('food_log')
      .sort((a,b) => new Date(b.log_date) - new Date(a.log_date));
    const filteredFood = allFood.filter(f => _inRange(f.log_date));

    // Calorie bar reflects the selected day (day mode), today (month mode), or avg/day (range mode)
    let barCals, barPct, barLabel;
    if (_filter.mode === 'day') {
      const dayFood = allFood.filter(f => f.log_date === _filter.day);
      barCals  = dayFood.reduce((s,f) => s + (parseInt(f.calories) || 0), 0);
      const surplus = barCals - CALORIE_TARGET();
      barLabel = barCals + ' / ' + CALORIE_TARGET() + ' kcal — ' + formatDate(_filter.day)
        + ' · ' + (surplus >= 0 ? '+' : '') + surplus + ' surplus';
      barPct   = Math.min(100, Math.round(barCals / CALORIE_TARGET() * 100));
    } else if (_filter.mode === 'range') {
      const totalCals  = filteredFood.reduce((s,f) => s + (parseInt(f.calories) || 0), 0);
      const rs = _filter.start || '2020-01-01';
      const re = _filter.end   || today;
      const days = Math.max(1, Math.round((new Date(re) - new Date(rs)) / 86400000) + 1);
      const avg  = Math.round(totalCals / days);
      barCals  = avg;
      barLabel = totalCals + ' kcal total · avg ' + avg + '/day · ' + days + ' days';
      barPct   = Math.min(100, Math.round(avg / CALORIE_TARGET() * 100));
    } else {
      // month mode — always show today
      const todayFood = allFood.filter(f => f.log_date === today);
      barCals  = todayFood.reduce((s,f) => s + (parseInt(f.calories) || 0), 0);
      const surplus = barCals - CALORIE_TARGET();
      barLabel = barCals + ' / ' + CALORIE_TARGET() + ' kcal today · '
        + (surplus >= 0 ? '+' : '') + surplus + ' surplus';
      barPct   = Math.min(100, Math.round(barCals / CALORIE_TARGET() * 100));
    }

    if (countEl) countEl.textContent = barLabel;
    if (bar) {
      bar.style.width      = barPct + '%';
      bar.style.background = barPct >= 100 ? 'var(--green)' : barPct >= 70 ? 'var(--amber)' : 'var(--red)';
    }

    if (!filteredFood.length) {
      el.innerHTML = '<div class="task-empty">no meals logged for this period</div>';
      return;
    }

    const mealCls = { Breakfast:'badge-study', Lunch:'badge-biz', Dinner:'badge-gym', Snack:'badge-work' };

    el.innerHTML = filteredFood.map(f => `
      <div class="task-row">
        <div class="work-task-body">
          <div class="work-task-title">${escapeHtml(f.meal_name)}</div>
          <div class="work-task-meta">
            <span class="task-badge ${mealCls[f.meal_type] || ''}">${f.meal_type}</span>
            <span class="amber" style="font-size:10px">${f.calories} kcal</span>
            ${f.protein_g ? `<span class="fg3" style="font-size:10px">P:${f.protein_g}g</span>` : ''}
            ${f.carbs_g   ? `<span class="fg3" style="font-size:10px">C:${f.carbs_g}g</span>`   : ''}
            ${f.fat_g     ? `<span class="fg3" style="font-size:10px">F:${f.fat_g}g</span>`     : ''}
            <span class="fg3" style="font-size:10px;white-space:nowrap">${formatDate(f.log_date)}</span>
          </div>
        </div>
        <div style="display:flex;gap:2px">
          <button class="task-edit" onclick="Gym.editFood(${f.id})" aria-label="Edit">
            <i class="ti ti-pencil" aria-hidden="true"></i>
          </button>
          <button class="task-del" onclick="Gym.deleteFood(${f.id})" aria-label="Delete">
            <i class="ti ti-x" aria-hidden="true"></i>
          </button>
        </div>
      </div>`).join('');

    const calEl = document.getElementById('gym-calorie-target-display');
    if (calEl) {
      const target = Config.calorieTarget();
      calEl.textContent = target > 0
        ? target.toLocaleString() + ' kcal target'
        : 'Set calorie target in settings';
    }
  }

  function showFoodForm() {
    _editFoodId = null;
    _setFoodFormMode(false);
    document.getElementById('gym-food-form')?.classList.remove('hidden');
    const dateEl = document.getElementById('gf-date');
    if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
    document.getElementById('gf-meal')?.focus();
  }

  function editFood(id) {
    const f = Store.getAll('food_log').find(x => x.id === id);
    if (!f) return;
    _editFoodId = id;
    const set = (eid, val) => { const el = document.getElementById(eid); if (el) el.value = val ?? ''; };
    set('gf-meal',    f.meal_name || '');
    set('gf-type',    f.meal_type || 'Other');
    set('gf-cals',    f.calories  || '');
    set('gf-protein', f.protein_g || '');
    set('gf-carbs',   f.carbs_g   || '');
    set('gf-fat',     f.fat_g     || '');
    set('gf-date',    f.log_date  || '');
    _setFoodFormMode(true);
    document.getElementById('gym-food-form')?.classList.remove('hidden');
    document.getElementById('gf-meal')?.focus();
    document.getElementById('gym-food-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function _setFoodFormMode(editing) {
    const title = document.getElementById('gf-form-title');
    const btn   = document.getElementById('gf-save-btn');
    if (title) title.textContent = editing ? 'edit meal' : 'log meal';
    if (btn)   btn.textContent   = editing ? 'update meal' : 'save meal';
  }

  function hideFoodForm() {
    _editFoodId = null;
    document.getElementById('gym-food-form')?.classList.add('hidden');
    ['gf-meal','gf-cals','gf-protein','gf-carbs','gf-fat','gf-date'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    _setFoodFormMode(false);
  }

  function saveFood() {
    const meal = document.getElementById('gf-meal')?.value.trim();
    if (!meal) { document.getElementById('gf-meal')?.focus(); return; }
    const data = {
      meal_name: meal,
      meal_type: document.getElementById('gf-type')?.value               || 'Other',
      calories:  parseInt(document.getElementById('gf-cals')?.value)     || 0,
      protein_g: parseFloat(document.getElementById('gf-protein')?.value) || 0,
      carbs_g:   parseFloat(document.getElementById('gf-carbs')?.value)   || 0,
      fat_g:     parseFloat(document.getElementById('gf-fat')?.value)     || 0,
      log_date:  document.getElementById('gf-date')?.value               || new Date().toISOString().split('T')[0],
    };
    if (_editFoodId) {
      Store.update('food_log', _editFoodId, data);
    } else {
      Store.insert('food_log', { ...data, source: 'direct' });
    }
    hideFoodForm();
    renderFood();
  }

  function deleteFood(id) {
    if (_editFoodId === id) hideFoodForm();
    Store.delete('food_log', id);
    renderFood();
  }

  function setFilterMode(mode) {
    _filter.mode = mode;
    _syncFilterUI();
    renderAll();
  }

  function setMonth(val) {
    _filter.month = val;
    renderAll();
  }

  function setDay(val) {
    _filter.day = val;
    renderAll();
  }

  function setRange() {
    _filter.start = document.getElementById('gym-range-start')?.value || '';
    _filter.end   = document.getElementById('gym-range-end')?.value   || '';
    renderAll();
  }

  function _syncFilterUI() {
    const { mode } = _filter;
    document.querySelectorAll('.gym-fmode-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.mode === mode)
    );
    const monthPanel = document.getElementById('gym-filter-month');
    const dayPanel   = document.getElementById('gym-filter-day');
    const rangePanel = document.getElementById('gym-filter-range');
    if (monthPanel) monthPanel.style.display = mode === 'month' ? 'flex' : 'none';
    if (dayPanel)   dayPanel.style.display   = mode === 'day'   ? 'flex' : 'none';
    if (rangePanel) rangePanel.style.display = mode === 'range' ? 'flex' : 'none';
    const dayInput = document.getElementById('gym-day-filter');
    if (dayInput && !dayInput.value) dayInput.value = _filter.day;
    if (mode === 'month') _populateMonthFilter();
  }

  function _populateMonthFilter() {
    const sel = document.getElementById('gym-month-filter');
    if (!sel) return;
    const allDates = [
      ...Store.getAll('gym_weight').map(e => e.logged_date),
      ...Store.getAll('gym_sessions').map(s => s.session_date),
      ...Store.getAll('food_log').map(f => f.log_date),
    ].filter(Boolean);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const months = [...new Set([currentMonth, ...allDates.map(d => d.slice(0, 7))])].sort().reverse();
    sel.innerHTML = months.map(m => {
      const [y, mo] = m.split('-');
      const label = new Date(parseInt(y), parseInt(mo) - 1, 1)
        .toLocaleDateString('en-AG', { month: 'long', year: 'numeric' });
      return `<option value="${m}"${m === _filter.month ? ' selected' : ''}>${label}</option>`;
    }).join('');
  }

  function setEl(id, val) {
    const el = document.getElementById(id); if (el) el.textContent = val;
  }

  function renderAll() {
    _syncFilterUI();
    renderWeightHero();
    renderWeightTable();
    renderSessions();
    renderFood();
    if (typeof Charts !== 'undefined') {
      const { start, end } = _filterDateRange();
      Charts.renderWeightChart('chart-weight', start, end);
      Charts.renderCalorieChart('chart-calories', start, end);
    }
  }

  /* ── Gym settings ── */
  function toggleGymSettings() {
    const panel = document.getElementById('gym-settings-panel');
    if (!panel) return;
    const hidden = panel.classList.toggle('hidden');
    if (!hidden) {
      const prefs = Store.get('user_prefs') || {};
      const el = document.getElementById('gym-weekly-target');
      if (el) el.value = prefs.weekly_session_target || '';
    }
  }

  function saveGymSettings() {
    const prefs = Store.get('user_prefs') || {};
    prefs.weekly_session_target = parseInt(document.getElementById('gym-weekly-target')?.value) || 0;
    Store.set('user_prefs', prefs);
    toggleGymSettings();
    renderSessions();
  }

  function getStats() {
    const entries = Store.getAll('gym_weight').sort((a, b) => new Date(b.logged_date) - new Date(a.logged_date));
    const curWeight = entries.length ? parseFloat(entries[0].weight_lbs) : Config.weightStart();
    return {
      currentWeight: curWeight,
      targetWeight:  Config.weightTarget(),
      toGoLbs:       Math.max(0, Config.weightTarget() - curWeight),
    };
  }

  function init() {
    const today = new Date().toISOString().split('T')[0];
    const wDate = document.getElementById('gym-weight-date');
    if (wDate) wDate.value = today;
    renderAll();
  }

  return {
    init, renderAll, getStats,
    setFilterMode, setMonth, setDay, setRange,
    logWeight, editWeight, cancelEditWeight, deleteWeight,
    showSessionForm, editSession, hideSessionForm, saveSession, deleteSession,
    showFoodForm, editFood, hideFoodForm, saveFood, deleteFood,
    toggleGymSettings, saveGymSettings,
  };

})();

document.addEventListener('DOMContentLoaded', Gym.init);
