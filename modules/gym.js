/* ============================================
   SION OS — gym.js
   v0.7.0 — Sprint 6
   US-016: Daily weight log + progress
   US-017: Workout log + food + calorie surplus
   ============================================ */

const Gym = (() => {

  const WEIGHT_START  = 137;
  const WEIGHT_TARGET = 160;
  const CALORIE_TARGET = 2500;

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
    const current  = entries.length > 0 ? parseFloat(entries[entries.length-1].weight_lbs) : WEIGHT_START;
    const pct      = Math.min(100, Math.max(0,
      Math.round((current - WEIGHT_START) / (WEIGHT_TARGET - WEIGHT_START) * 100)
    ));
    const remaining = Math.max(0, WEIGHT_TARGET - current).toFixed(1);

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
  }

  /* ── Render weight table ── */
  function renderWeightTable() {
    const tbody = document.getElementById('gym-weight-tbody');
    if (!tbody) return;

    const entries = Store.getAll('gym_weight')
      .sort((a,b) => new Date(b.logged_date) - new Date(a.logged_date));

    if (!entries.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="blem-empty">no weight entries yet — log your first one above</td></tr>';
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
        <td>
          <button class="task-del" onclick="Gym.deleteWeight(${e.id})" aria-label="Delete">
            <i class="ti ti-x" aria-hidden="true"></i>
          </button>
        </td>
      </tr>`;
    }).join('');
  }

  /* ── Log weight ── */
  function logWeight() {
    const input   = document.getElementById('gym-weight-input');
    const dateEl  = document.getElementById('gym-weight-date');
    const weight  = parseFloat(input?.value);
    const date    = dateEl?.value || new Date().toISOString().split('T')[0];

    if (!weight || weight < 50 || weight > 400) {
      if (input) input.focus();
      return;
    }

    Store.insert('gym_weight', {
      weight_lbs:  weight,
      logged_date: date,
      notes:       '',
      source:      'direct',
    });

    if (input)  input.value  = '';
    renderAll();

    // Update dashboard weight milestone
    const milestones = Store.getAll('milestones');
    const weightMs   = milestones.find(m => m.name === 'Weight goal');
    if (weightMs) Store.update('milestones', weightMs.id, { current_value: weight });
  }

  function deleteWeight(id) {
    Store.delete('gym_weight', id);
    renderAll();
  }

  /* ── Render sessions ── */
  function renderSessions() {
    const el      = document.getElementById('gym-session-list');
    const countEl = document.getElementById('gym-sessions-this-week');
    if (!el) return;

    const sessions = Store.getAll('gym_sessions')
      .sort((a,b) => new Date(b.session_date) - new Date(a.session_date));

    const thisWeek = sessions.filter(s => isThisWeek(s.session_date)).length;
    if (countEl) countEl.textContent = thisWeek + ' of 4 target this week';

    if (!sessions.length) {
      el.innerHTML = '<div class="task-empty">no sessions logged yet</div>';
      return;
    }

    const energyColour = { '5':'green','4':'cyan','3':'amber','2':'amber','1':'red' };
    const typeBadge = {
      'Upper Push': 'badge-work', 'Upper Pull': 'badge-work',
      'Lower':      'badge-biz',  'Full Body':  'badge-blueport',
      'Cardio':     'badge-gym',  'Rest':       '',
    };

    el.innerHTML = sessions.slice(0, 10).map(s => `
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
        <button class="task-del" onclick="Gym.deleteSession(${s.id})" aria-label="Delete">
          <i class="ti ti-x" aria-hidden="true"></i>
        </button>
      </div>`).join('');
  }

  /* ── Session form ── */
  function showSessionForm() {
    document.getElementById('gym-session-form')?.classList.remove('hidden');
    const dateEl = document.getElementById('gs-date');
    if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
    document.getElementById('gs-name')?.focus();
  }
  function hideSessionForm() {
    document.getElementById('gym-session-form')?.classList.add('hidden');
    ['gs-name','gs-date','gs-mins','gs-exercises'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const en = document.getElementById('gs-energy');
    if (en) en.value = '3';
  }
  function saveSession() {
    const name = document.getElementById('gs-name')?.value.trim();
    if (!name) { document.getElementById('gs-name')?.focus(); return; }
    Store.insert('gym_sessions', {
      name,
      session_type:  document.getElementById('gs-type')?.value      || 'Full Body',
      session_date:  document.getElementById('gs-date')?.value      || new Date().toISOString().split('T')[0],
      duration_mins: parseInt(document.getElementById('gs-mins')?.value) || 0,
      energy_level:  parseInt(document.getElementById('gs-energy')?.value) || 3,
      exercises:     document.getElementById('gs-exercises')?.value || '',
      source:        'direct',
    });
    hideSessionForm();
    renderSessions();
  }
  function deleteSession(id) {
    Store.delete('gym_sessions', id);
    renderSessions();
  }

  /* ── Food log ── */
  function renderFood() {
    const el       = document.getElementById('gym-food-list');
    const countEl  = document.getElementById('gym-calorie-today');
    const bar      = document.getElementById('gym-cal-bar');
    if (!el) return;

    const today  = new Date().toISOString().split('T')[0];
    const allFood = Store.getAll('food_log')
      .sort((a,b) => new Date(b.log_date) - new Date(a.log_date));
    const todayFood = allFood.filter(f => f.log_date === today);
    const totalCals = todayFood.reduce((s,f) => s + (parseInt(f.calories) || 0), 0);
    const surplus   = totalCals - CALORIE_TARGET;
    const pct       = Math.min(100, Math.round(totalCals / CALORIE_TARGET * 100));

    if (countEl) {
      countEl.textContent = totalCals + ' / ' + CALORIE_TARGET + ' kcal today · '
        + (surplus >= 0 ? '+' : '') + surplus + ' surplus';
    }
    if (bar) {
      bar.style.width      = pct + '%';
      bar.style.background = pct >= 100 ? 'var(--green)' : pct >= 70 ? 'var(--amber)' : 'var(--red)';
    }

    if (!allFood.length) {
      el.innerHTML = '<div class="task-empty">no meals logged yet</div>';
      return;
    }

    const mealCls = { Breakfast:'badge-study', Lunch:'badge-biz', Dinner:'badge-gym', Snack:'badge-work' };

    el.innerHTML = allFood.slice(0, 15).map(f => `
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
        <button class="task-del" onclick="Gym.deleteFood(${f.id})" aria-label="Delete">
          <i class="ti ti-x" aria-hidden="true"></i>
        </button>
      </div>`).join('');
  }

  function showFoodForm() {
    document.getElementById('gym-food-form')?.classList.remove('hidden');
    const dateEl = document.getElementById('gf-date');
    if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
    document.getElementById('gf-meal')?.focus();
  }
  function hideFoodForm() {
    document.getElementById('gym-food-form')?.classList.add('hidden');
    ['gf-meal','gf-cals','gf-protein','gf-carbs','gf-fat','gf-date'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
  }
  function saveFood() {
    const meal = document.getElementById('gf-meal')?.value.trim();
    if (!meal) { document.getElementById('gf-meal')?.focus(); return; }
    Store.insert('food_log', {
      meal_name: meal,
      meal_type: document.getElementById('gf-type')?.value    || 'Other',
      calories:  parseInt(document.getElementById('gf-cals')?.value)    || 0,
      protein_g: parseFloat(document.getElementById('gf-protein')?.value) || 0,
      carbs_g:   parseFloat(document.getElementById('gf-carbs')?.value)   || 0,
      fat_g:     parseFloat(document.getElementById('gf-fat')?.value)     || 0,
      log_date:  document.getElementById('gf-date')?.value    || new Date().toISOString().split('T')[0],
      source:    'direct',
    });
    hideFoodForm();
    renderFood();
  }
  function deleteFood(id) {
    Store.delete('food_log', id);
    renderFood();
  }

  function setEl(id, val) {
    const el = document.getElementById(id); if (el) el.textContent = val;
  }

  function renderAll() {
    renderWeightHero();
    renderWeightTable();
    renderSessions();
    renderFood();
  }

  function init() {
    // Default date fields to today
    const today = new Date().toISOString().split('T')[0];
    const wDate = document.getElementById('gym-weight-date');
    if (wDate) wDate.value = today;
    renderAll();
  }

  return {
    init, renderAll,
    logWeight, deleteWeight,
    showSessionForm, hideSessionForm, saveSession, deleteSession,
    showFoodForm, hideFoodForm, saveFood, deleteFood,
  };

})();

document.addEventListener('DOMContentLoaded', Gym.init);
