/* ============================================
   SION OS — habits.js
   Dedicated habit score page — life section
   ============================================ */

const Habits = (() => {

  const DEFAULT_HABITS = [
    { id: 'exercise',  name: 'Exercise',     icon: 'ti-barbell', enabled: true  },
    { id: 'study',     name: 'Study',        icon: 'ti-book',    enabled: true  },
    { id: 'nutrition', name: 'Nutrition',    icon: 'ti-salad',   enabled: true  },
    { id: 'sleep',     name: 'Sleep 8h+',    icon: 'ti-moon',    enabled: true  },
    { id: 'deepwork',  name: 'Deep work',    icon: 'ti-brain',   enabled: true  },
    { id: 'nojunk',    name: 'No junk food', icon: 'ti-leaf',    enabled: false },
  ];

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _todayKey() { return new Date().toISOString().split('T')[0]; }
  function _getLog()   { return Store.get('habits_log') || {}; }

  const ICON_OPTIONS = [
    'ti-barbell','ti-book','ti-salad','ti-moon','ti-brain','ti-leaf',
    'ti-run','ti-droplets','ti-pencil','ti-heart','ti-sun','ti-music',
    'ti-device-mobile-off','ti-coffee','ti-flame','ti-star',
    'ti-walk','ti-yoga','ti-dumbbell','ti-apple',
  ];

  let _newHabitIcon = 'ti-star';

  function getHabits() {
    const saved = Store.get('habits_config');
    if (!saved || !saved.length) {
      // First time — seed and persist
      const seeded = DEFAULT_HABITS.map(h => ({ ...h }));
      Store.set('habits_config', seeded);
      return seeded;
    }
    // Legacy format (no name field) — migrate once
    if (!saved[0].name) {
      const savedMap = {};
      saved.forEach(h => { savedMap[h.id] = h; });
      const merged = DEFAULT_HABITS.map(def => ({ ...def, ...(savedMap[def.id] || {}) }));
      Store.set('habits_config', merged);
      return merged;
    }
    return saved;
  }

  function _streak(habits, log) {
    const total = habits.length;
    if (!total) return 0;
    let streak = 0;
    for (let i = 1; i <= 365; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      if ((log[key] || []).length >= total) streak++;
      else break;
    }
    return streak;
  }

  function _bestStreak(habits, log) {
    const total = habits.length;
    if (!total) return 0;
    let best = 0, cur = 0;
    Object.keys(log).sort().forEach(k => {
      if ((log[k] || []).length >= total) { cur++; if (cur > best) best = cur; }
      else cur = 0;
    });
    return best;
  }

  /* ── Metric cards ── */
  function renderMetrics() {
    const el = document.getElementById('habits-metrics');
    if (!el) return;
    const habits   = getHabits().filter(h => h.enabled);
    const log      = _getLog();
    const todayLog = log[_todayKey()] || [];
    const score    = todayLog.length;
    const total    = habits.length;
    const streak   = _streak(habits, log);
    const best     = _bestStreak(habits, log);

    let completeDays = 0, trackedDays = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = d.toISOString().split('T')[0];
      if (log[k] !== undefined) {
        trackedDays++;
        if ((log[k] || []).length >= total && total > 0) completeDays++;
      }
    }
    const avg30 = trackedDays > 0 ? Math.round(completeDays / trackedDays * 100) : 0;
    const scoreCls = score === total && total > 0 ? 'green' : score >= Math.ceil(total / 2) ? 'amber' : 'red';

    el.innerHTML = `
      <div class="metric-card ${scoreCls}-accent">
        <div class="mc-label">today's score</div>
        <div class="mc-val ${scoreCls}">${score} / ${total}</div>
        <div class="mc-sub">habits completed today</div>
      </div>
      <div class="metric-card ${streak > 0 ? 'amber-accent' : ''}">
        <div class="mc-label">current streak</div>
        <div class="mc-val ${streak > 0 ? 'amber' : 'fg3'}">${streak}d</div>
        <div class="mc-sub">consecutive perfect days</div>
      </div>
      <div class="metric-card ${avg30 >= 80 ? 'green-accent' : avg30 >= 50 ? 'amber-accent' : 'red-accent'}">
        <div class="mc-label">30-day rate</div>
        <div class="mc-val ${avg30 >= 80 ? 'green' : avg30 >= 50 ? 'amber' : 'red'}">${avg30}%</div>
        <div class="mc-sub">perfect days last month</div>
      </div>
      <div class="metric-card ${best > 0 ? 'cyan-accent' : ''}">
        <div class="mc-label">best streak</div>
        <div class="mc-val ${best > 0 ? 'cyan' : 'fg3'}">${best}d</div>
        <div class="mc-sub">all-time record</div>
      </div>`;
  }

  /* ── Today's habit grid ── */
  function renderToday() {
    const el = document.getElementById('habits-today');
    if (!el) return;
    const habits   = getHabits().filter(h => h.enabled);
    const todayLog = _getLog()[_todayKey()] || [];
    const score    = todayLog.length;
    const total    = habits.length;
    const scoreEl  = document.getElementById('habits-today-score');
    if (scoreEl) {
      const cls = score === total && total > 0 ? 'green' : score >= Math.ceil(total / 2) ? 'amber' : 'red';
      scoreEl.innerHTML = `<span class="${cls}">${score}/${total}</span>`;
    }
    if (!habits.length) {
      el.innerHTML = '<div class="task-empty">no habits enabled — use manage above</div>';
      return;
    }
    el.innerHTML = `<div class="habit-grid">
      ${habits.map(h => {
        const done = todayLog.includes(h.id);
        return `<div class="habit-card${done ? ' done' : ''}" onclick="Habits.toggleHabit('${h.id}')">
          <i class="ti ${h.icon}" style="font-size:15px;color:${done ? 'var(--green)' : 'var(--fg3)'}"></i>
          <span class="habit-name">${escapeHtml(h.name)}</span>
          <div class="habit-check">${done ? '<i class="ti ti-check" style="font-size:9px;color:#000"></i>' : ''}</div>
        </div>`;
      }).join('')}
    </div>`;
  }

  /* ── 30-day calendar ── */
  function renderCalendar() {
    const el = document.getElementById('habits-calendar');
    if (!el) return;
    const habits = getHabits().filter(h => h.enabled);
    const total  = habits.length;
    const log    = _getLog();
    const today  = _todayKey();

    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d   = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const done = (log[key] || []).length;
      const pct  = total > 0 ? done / total : 0;
      days.push({
        key,
        label:   d.toLocaleDateString('en-AG', { weekday: 'short' }).charAt(0),
        date:    d.getDate(),
        month:   d.toLocaleDateString('en-AG', { month: 'short' }),
        pct, done,
        isToday: key === today,
      });
    }

    el.innerHTML = `<div class="habits-cal-grid">
      ${days.map(d => {
        const color   = d.pct >= 1 ? 'var(--green)' : d.pct >= 0.6 ? 'var(--amber)' : d.pct > 0 ? 'var(--cyan)' : 'var(--border2)';
        const title   = `${d.key}: ${d.done}/${total}`;
        return `<div class="habit-cal-cell${d.isToday ? ' hcc-today' : ''}" title="${title}">
          <div class="hcc-day">${d.label}</div>
          <div class="hcc-dot" style="background:${color}"></div>
          <div class="hcc-date">${d.date}</div>
        </div>`;
      }).join('')}
    </div>`;
  }

  /* ── Per-habit stats table ── */
  function renderStats() {
    const el = document.getElementById('habits-stats');
    if (!el) return;
    const habits = getHabits().filter(h => h.enabled);
    const log    = _getLog();
    if (!habits.length) { el.innerHTML = '<div class="task-empty">no habits enabled</div>'; return; }

    const stats = habits.map(h => {
      let count = 0, tracked = 0;
      for (let i = 0; i < 30; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const k = d.toISOString().split('T')[0];
        if (log[k] !== undefined) { tracked++; if (log[k].includes(h.id)) count++; }
      }
      const rate = tracked > 0 ? Math.round(count / tracked * 100) : 0;
      return { ...h, count, tracked, rate };
    }).sort((a, b) => b.rate - a.rate);

    el.innerHTML = `<div class="blem-table-wrap"><table class="blem-table">
      <thead><tr><th>habit</th><th>completed</th><th>rate</th><th></th></tr></thead>
      <tbody>
        ${stats.map(s => {
          const cls = s.rate >= 80 ? 'green' : s.rate >= 50 ? 'amber' : 'red';
          return `<tr>
            <td>
              <i class="ti ${s.icon}" style="font-size:12px;color:var(--fg3);margin-right:6px"></i>
              <span class="white">${escapeHtml(s.name)}</span>
            </td>
            <td class="fg3" style="font-size:10px">${s.count} / ${s.tracked} days</td>
            <td class="num ${cls}">${s.rate}%</td>
            <td style="width:120px">
              <div class="prog-track"><div class="prog-fill ${cls}-fill" style="width:${s.rate}%"></div></div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
  }

  /* ── Mutations ── */
  function toggleHabit(id) {
    const log  = _getLog();
    const key  = _todayKey();
    const done = log[key] || [];
    const idx  = done.indexOf(id);
    if (idx === -1) done.push(id); else done.splice(idx, 1);
    log[key] = done;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    Object.keys(log).forEach(k => { if (new Date(k) < cutoff) delete log[k]; });
    Store.set('habits_log', log);
    renderAll();
    if (typeof Dashboard !== 'undefined') Dashboard.renderHabits?.();
  }

  function toggleSettings() {
    const panel = document.getElementById('habits-settings-panel');
    if (!panel) return;
    if (panel.classList.contains('hidden')) { renderSettingsPanel(); panel.classList.remove('hidden'); }
    else panel.classList.add('hidden');
  }

  function renderSettingsPanel() {
    const el = document.getElementById('habits-settings-inner');
    if (!el) return;
    _newHabitIcon = 'ti-star';

    el.innerHTML = `
      <div class="hs-habit-list">
        ${getHabits().map(h => `
          <div class="hs-habit-row">
            <label class="hs-habit-label">
              <input type="checkbox" ${h.enabled ? 'checked' : ''} onchange="Habits.toggleHabitEnabled('${h.id}', this.checked)" />
              <i class="ti ${escapeHtml(h.icon)}" style="font-size:13px;color:var(--fg3)"></i>
              <span>${escapeHtml(h.name)}</span>
            </label>
            <button class="hs-delete-btn" onclick="Habits.removeHabit('${h.id}')" title="Remove habit">
              <i class="ti ti-x"></i>
            </button>
          </div>`).join('')}
      </div>

      <div class="hs-add-section">
        <div class="hs-add-title">add new habit</div>
        <div class="hs-add-row">
          <input class="t-input" id="hs-new-name" placeholder="habit name" style="flex:1"
            onkeydown="if(event.key==='Enter') Habits.submitAddHabit()" />
          <button class="t-btn" onclick="Habits.submitAddHabit()">add</button>
        </div>
        <div class="hs-icon-grid" id="hs-icon-grid">
          ${ICON_OPTIONS.map(ic => `
            <button class="hs-icon-btn${ic === _newHabitIcon ? ' selected' : ''}"
              onclick="Habits.selectIcon('${ic}')" title="${ic.replace('ti-','')}">
              <i class="ti ${ic}"></i>
            </button>`).join('')}
        </div>
      </div>`;
  }

  function selectIcon(icon) {
    _newHabitIcon = icon;
    document.querySelectorAll('.hs-icon-btn').forEach((btn, i) => {
      btn.classList.toggle('selected', ICON_OPTIONS[i] === icon);
    });
  }

  function submitAddHabit() {
    const nameEl = document.getElementById('hs-new-name');
    const name   = nameEl?.value.trim();
    if (!name) { nameEl?.focus(); return; }
    addHabit(name, _newHabitIcon);
    if (nameEl) nameEl.value = '';
    _newHabitIcon = 'ti-star';
  }

  function addHabit(name, icon) {
    const habits = getHabits();
    habits.push({ id: 'custom_' + Date.now(), name, icon: icon || 'ti-star', enabled: true });
    Store.set('habits_config', habits);
    renderAll();
    renderSettingsPanel();
    if (typeof Dashboard !== 'undefined') Dashboard.renderHabits?.();
    window.dispatchEvent(new CustomEvent('habits-changed'));
  }

  function removeHabit(id) {
    const habits = getHabits().filter(h => h.id !== id);
    Store.set('habits_config', habits);
    const log = _getLog();
    Object.keys(log).forEach(k => { log[k] = (log[k] || []).filter(hid => hid !== id); });
    Store.set('habits_log', log);
    renderAll();
    renderSettingsPanel();
    if (typeof Dashboard !== 'undefined') Dashboard.renderHabits?.();
    window.dispatchEvent(new CustomEvent('habits-changed'));
  }

  function toggleHabitEnabled(id, enabled) {
    const habits = getHabits();
    const h = habits.find(x => x.id === id);
    if (h) h.enabled = enabled;
    Store.set('habits_config', habits);
    renderAll();
    if (typeof Dashboard !== 'undefined') Dashboard.renderHabits?.();
  }

  function renderAll() {
    renderMetrics();
    renderToday();
    renderCalendar();
    renderStats();
  }

  function init() {
    renderAll();
    window.addEventListener('habits-changed', renderAll);
  }

  return { init, renderAll, toggleHabit, toggleHabitEnabled, toggleSettings, selectIcon, submitAddHabit, addHabit, removeHabit };

})();

document.addEventListener('DOMContentLoaded', Habits.init);
