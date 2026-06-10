/* ============================================
   SION OS — components/charts.js
   v2.3.0 — Recommendation 5
   Chart.js wrappers for weight, calories,
   Blem revenue, Finance net income
   ============================================ */

const Charts = (() => {

  let _loaded    = false;
  const _charts  = {};

  /* ── Load Chart.js from CDN ── */
  function load() {
    return new Promise((resolve, reject) => {
      if (_loaded || typeof Chart !== 'undefined') { _loaded = true; resolve(); return; }
      const s   = document.createElement('script');
      s.src     = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      s.onload  = () => { _loaded = true; resolve(); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  /* ── Destroy existing chart on canvas ── */
  function destroy(id) {
    if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
  }

  /* ── Theme colours ── */
  function colors() {
    const s = getComputedStyle(document.documentElement);
    return {
      green:  s.getPropertyValue('--green').trim()  || '#00ff88',
      amber:  s.getPropertyValue('--amber').trim()  || '#ffb830',
      red:    s.getPropertyValue('--red').trim()     || '#ff4455',
      cyan:   s.getPropertyValue('--cyan').trim()    || '#00d4ff',
      purple: s.getPropertyValue('--purple').trim()  || '#b388ff',
      fg3:    s.getPropertyValue('--fg3').trim()     || '#333333',
      bg2:    s.getPropertyValue('--bg2').trim()     || '#141414',
    };
  }

  /* ── Default chart options ── */
  function baseOptions(title) {
    const c = colors();
    return {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title:  { display: false },
        tooltip: {
          backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg2').trim()     || '#1a1a1a',
          borderColor:     getComputedStyle(document.documentElement).getPropertyValue('--border').trim()  || '#2a2a2a',
          borderWidth:     0.5,
          titleColor:      getComputedStyle(document.documentElement).getPropertyValue('--fg').trim()      || '#e8e8e8',
          bodyColor:       getComputedStyle(document.documentElement).getPropertyValue('--fg2').trim()     || '#999',
          padding:         8,
          cornerRadius:    4,
        }
      },
      scales: {
        x: {
          grid:  { color: '#1e1e1e', drawBorder: false },
          ticks: { color: c.fg3, font: { family: "'JetBrains Mono', monospace", size: 10 } }
        },
        y: {
          grid:  { color: '#1e1e1e', drawBorder: false },
          ticks: { color: c.fg3, font: { family: "'JetBrains Mono', monospace", size: 10 } }
        }
      }
    };
  }

  /* ── Weight line chart ── */
  async function renderWeightChart(canvasId, startDate, endDate) {
    await load();
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const c       = colors();
    const today   = new Date().toISOString().split('T')[0];
    const s       = startDate || '2020-01-01';
    const e       = endDate   || today;

    const entries = Store.getAll('gym_weight')
      .filter(w => w.logged_date >= s && w.logged_date <= e)
      .sort((a,b) => new Date(a.logged_date) - new Date(b.logged_date));

    if (entries.length < 2) {
      canvas.parentElement.innerHTML = '<div class="chart-empty">log at least 2 weight entries to see chart</div>';
      return;
    }

    const labels = entries.map(w => {
      const d = new Date(w.logged_date + 'T00:00:00');
      return d.toLocaleDateString('en-AG', { day:'numeric', month:'short' });
    });
    const data      = entries.map(w => parseFloat(w.weight_lbs));
    const wtTarget  = (typeof Config !== 'undefined' && Config.weightTarget) ? Config.weightTarget() : 160;
    const target    = Array(labels.length).fill(wtTarget);

    const opts = baseOptions('Weight');
    opts.scales.y.min = Math.min(...data) - 2;
    opts.scales.y.max = wtTarget + 2;

    _charts[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label:           'Weight (lbs)',
            data,
            borderColor:     c.green,
            backgroundColor: c.green + '18',
            borderWidth:     2,
            pointRadius:     3,
            pointBackgroundColor: c.green,
            tension:         0.3,
            fill:            true,
          },
          {
            label:       'Target (' + wtTarget + 'lb)',
            data:        target,
            borderColor: c.amber,
            borderWidth: 1,
            borderDash:  [4, 4],
            pointRadius: 0,
            fill:        false,
          }
        ]
      },
      options: opts,
    });
  }

  /* ── Calorie bar chart ── */
  async function renderCalorieChart(canvasId, startDate, endDate) {
    await load();
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const c          = colors();
    const calTarget  = (typeof Config !== 'undefined' && Config.calorieTarget) ? Config.calorieTarget() : 2500;
    const today      = new Date().toISOString().split('T')[0];
    const s          = startDate || new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
    const e          = endDate   || today;
    const allFood    = Store.getAll('food_log');

    // Build day list; cap at 30 days (take the last 30 if range is larger)
    const startMs = new Date(s + 'T00:00:00').getTime();
    const endMs   = new Date(e + 'T00:00:00').getTime();
    const totalDays = Math.round((endMs - startMs) / 86400000) + 1;
    const capStart  = totalDays > 30
      ? new Date(endMs - 29 * 86400000).toISOString().split('T')[0]
      : s;

    const labels     = [];
    const data       = [];
    const colors_arr = [];
    const useShortLabel = totalDays <= 7;

    let cur = new Date(capStart + 'T00:00:00');
    const endDate_ = new Date(e + 'T00:00:00');
    while (cur <= endDate_) {
      const dateStr = cur.toISOString().split('T')[0];
      const label   = useShortLabel
        ? cur.toLocaleDateString('en-AG', { weekday: 'short' })
        : cur.toLocaleDateString('en-AG', { day: 'numeric', month: 'short' });
      const total   = allFood
        .filter(f => f.log_date === dateStr)
        .reduce((s,f) => s + (parseInt(f.calories) || 0), 0);
      labels.push(label);
      data.push(total);
      colors_arr.push(total >= calTarget ? c.green + 'cc' : total >= calTarget * 0.7 ? c.amber + 'cc' : c.red + 'cc');
      cur.setDate(cur.getDate() + 1);
    }

    const opts = baseOptions('Calories');
    opts.scales.y.min = 0;

    _charts[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label:           'Calories',
          data,
          backgroundColor: colors_arr,
          borderRadius:    3,
          borderSkipped:   false,
        }, {
          label:       'Target (' + calTarget + ')',
          data:        Array(labels.length).fill(calTarget),
          type:        'line',
          borderColor: c.amber,
          borderWidth: 1,
          borderDash:  [4,4],
          pointRadius: 0,
          fill:        false,
        }]
      },
      options: opts,
    });
  }

  /* ── Blem revenue bar chart (last 6 months) ── */
  async function renderBlemRevenueChart(canvasId) {
    await load();
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const c      = colors();
    const jobs   = Store.getAll('blem_jobs');
    const months = [];
    const labels = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key   = d.toISOString().slice(0,7); // YYYY-MM
      const label = d.toLocaleDateString('en-AG', { month:'short' });
      const total = jobs
        .filter(j => (j.created_at || '').startsWith(key))
        .reduce((s,j) => s + (parseFloat(j.amount_paid_xcd) || 0), 0);
      labels.push(label);
      months.push(total);
    }

    _charts[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label:           'Revenue (XCD)',
          data:            months,
          backgroundColor: c.amber + 'cc',
          borderRadius:    3,
          borderSkipped:   false,
        }]
      },
      options: baseOptions('Blem Revenue'),
    });
  }

  /* ── Net income line chart (last 6 months) ── */
  async function renderNetIncomeChart(canvasId) {
    await load();
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const c       = colors();
    const income  = Store.getAll('income');
    const expenses = Store.getAll('expenses');
    const dmaxAmt = (typeof Config !== 'undefined' && Config.dmaxMonthly)
      ? Config.dmaxMonthly()
      : 0;

    const labels  = [];
    const netData = [];
    const dmaxLine = [];

    for (let i = 5; i >= 0; i--) {
      const d     = new Date();
      d.setMonth(d.getMonth() - i);
      const key   = d.toISOString().slice(0,7);
      const label = d.toLocaleDateString('en-AG', { month:'short' });
      const inc   = income
        .filter(r => (r.received_date || '').startsWith(key))
        .reduce((s,r) => s + (parseFloat(r.amount_xcd) || 0), 0);
      const exp   = expenses
        .filter(r => (r.expense_date || '').startsWith(key))
        .reduce((s,r) => s + (parseFloat(r.amount_xcd) || 0), 0);
      labels.push(label);
      netData.push(inc - exp);
      dmaxLine.push(dmaxAmt);
    }

    const opts = baseOptions('Net Income');

    _charts[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label:           'Net Income (XCD)',
            data:            netData,
            borderColor:     c.green,
            backgroundColor: c.green + '18',
            borderWidth:     2,
            pointRadius:     4,
            pointBackgroundColor: c.green,
            tension:         0.3,
            fill:            true,
          },
          {
            label:       dmaxAmt > 0
              ? 'Fixed costs (XCD $' + dmaxAmt.toLocaleString() + ')'
              : 'Fixed costs',
            data:        dmaxLine,
            borderColor: c.red,
            borderWidth: 1,
            borderDash:  [4,4],
            pointRadius: 0,
            fill:        false,
          }
        ]
      },
      options: opts,
    });
  }

  /* ── Destroy all charts (on theme switch) ── */
  function destroyAll() {
    Object.keys(_charts).forEach(id => {
      if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
    });
  }

  return {
    renderWeightChart,
    renderCalorieChart,
    renderBlemRevenueChart,
    renderNetIncomeChart,
    destroyAll,
    load,
  };

})();
