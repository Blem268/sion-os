/* ============================================
   SION OS — dashboard.js
   v2.5.0
   CR-007: Customisable widget system
   Toggle on/off + choose bank account
   ============================================ */

const Dashboard = (() => {

  let _taskTab = 'All';

  /* ── Card slot system — 4 configurable positions ── */
  const CARD_OPTIONS = [
    { id: 'cash_position',     label: 'Cash Position'       },
    { id: 'habit_score',       label: 'Habit Score'         },
    { id: 'priority_load',     label: 'Priority Load'       },
    { id: 'monthly_income',    label: 'Monthly Income'      },
    { id: 'monthly_expenses',  label: 'Monthly Expenses'    },
    { id: 'net_cash',          label: 'Net Cash'            },
    { id: 'blueport_progress', label: 'Blueport Progress'   },
    { id: 'weight_goal',       label: 'Weight Goal'         },
    { id: 'bank_total',        label: 'Total Bank Balance'  },
    { id: 'blem_revenue',      label: 'Blem Revenue'        },
    { id: 'younity_revenue',   label: 'Younity Revenue'     },
    { id: 'blem_jobs',         label: 'Active Blem Jobs'    },
  ];

  const DEFAULT_CARD_SLOTS = ['cash_position', 'net_cash', 'habit_score', 'priority_load'];

  function getCardSlots() {
    const saved = Store.get('dash_card_slots');
    return (saved && saved.length === 4) ? saved : [...DEFAULT_CARD_SLOTS];
  }

  function setCardSlot(slotIndex, optionId) {
    const slots = getCardSlots();
    slots[slotIndex] = optionId;
    Store.set('dash_card_slots', slots);
    closeCardMenu();
    renderMetrics();
  }

  function openCardMenu(event, slotIndex) {
    event.stopPropagation();
    document.querySelectorAll('.card-menu-dropdown').forEach(el => el.remove());
    const btn  = event.currentTarget;
    const rect = btn.getBoundingClientRect();
    const current = getCardSlots()[slotIndex];

    const dropdown = document.createElement('div');
    dropdown.className = 'card-menu-dropdown';
    dropdown.style.top   = (rect.bottom + 4) + 'px';
    dropdown.style.right = Math.max(4, window.innerWidth - rect.right) + 'px';

    dropdown.innerHTML = CARD_OPTIONS.map(opt => `
      <div class="cmd-option${opt.id === current ? ' cmd-active' : ''}"
        onclick="Dashboard.setCardSlot(${slotIndex},'${opt.id}')">
        ${opt.id === current ? '<i class="ti ti-check" style="font-size:9px;color:var(--green)"></i>' : '<span style="display:inline-block;width:14px"></span>'}
        ${escapeHtml(opt.label)}
      </div>`).join('');

    document.body.appendChild(dropdown);
    setTimeout(() => document.addEventListener('click', closeCardMenu, { once: true }), 0);
  }

  function closeCardMenu() {
    document.querySelectorAll('.card-menu-dropdown').forEach(el => el.remove());
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function daysUntil(dateStr) {
    const target = new Date(dateStr);
    const today  = new Date();
    today.setHours(0,0,0,0);
    target.setHours(0,0,0,0);
    return Math.ceil((target - today) / 86400000);
  }

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function isThisMonth(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr), n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }

  /* ── Gather all data via module getters (with Store fallbacks) ── */
  function _collectData() {
    const now = new Date();
    const thisMonth = d => { if (!d) return false; const x = new Date(d); return x.getMonth() === now.getMonth() && x.getFullYear() === now.getFullYear(); };

    const finStats = (typeof Finance !== 'undefined' && Finance.getStats)
      ? Finance.getStats()
      : (() => {
          const inc  = Store.getAll('income').filter(i => thisMonth(i.received_date)).reduce((s,i) => s+(parseFloat(i.amount_xcd)||0), 0);
          const exp  = Store.getAll('expenses').filter(e => thisMonth(e.expense_date)).reduce((s,e) => s+(parseFloat(e.amount_xcd)||0), 0);
          const accs = Store.getAll('bank_accounts');
          return { income: inc, expenses: exp, net: inc-exp, bankTotal: accs.reduce((s,a)=>s+(parseFloat(a.balance)||0),0), accountCount: accs.length };
        })();

    const blemStats = (typeof Blem !== 'undefined' && Blem.getStats)
      ? Blem.getStats()
      : (() => {
          const jobs = Store.getAll('blem_jobs');
          return { activeJobs: jobs.filter(j=>j.status!=='Complete').length, revenue: jobs.filter(j=>thisMonth(j.created_at)).reduce((s,j)=>s+(parseFloat(j.amount_paid_xcd)||0),0) };
        })();

    const younityStats = (typeof Younity !== 'undefined' && Younity.getStats)
      ? Younity.getStats()
      : (() => {
          const tasks = Store.getAll('younity_tasks');
          const rev   = Store.getAll('income').filter(i=>thisMonth(i.received_date)&&i.source==='Younity Consultancy').reduce((s,i)=>s+(parseFloat(i.amount_xcd)||0),0);
          return { openTasks: tasks.filter(t=>t.status!=='Done').length, revenue: rev };
        })();

    const bpStats = (typeof Blueport !== 'undefined' && Blueport.getStats)
      ? Blueport.getStats()
      : (() => {
          const tasks = Store.getAll('blueport_tasks');
          const done  = tasks.filter(t=>t.done).length;
          return { total: tasks.length, done, pct: tasks.length ? Math.round(done/tasks.length*100) : 0, daysToLaunch: Math.ceil((new Date('2026-09-01')-now)/86400000) };
        })();

    const gymStats = (typeof Gym !== 'undefined' && Gym.getStats)
      ? Gym.getStats()
      : (() => {
          const entries = Store.getAll('gym_weight').sort((a,b)=>new Date(b.logged_date)-new Date(a.logged_date));
          const w = entries.length ? parseFloat(entries[0].weight_lbs) : Config.weightStart();
          return { currentWeight: w, targetWeight: Config.weightTarget(), toGoLbs: Math.max(0,Config.weightTarget()-w) };
        })();

    const habits   = getHabits().filter(h => h.enabled);
    const todayLog = (_getLog()[_todayKey()] || []);
    const habitPct = habits.length > 0 ? Math.round(todayLog.length / habits.length * 100) : 0;

    const openTasks = Store.getAll('tasks').filter(t=>!t.done).length
      + Store.getAll('work_tasks').filter(t=>t.status!=='Done').length
      + younityStats.openTasks + blemStats.activeJobs
      + (bpStats.total - bpStats.done);

    const { income, expenses, net, bankTotal, accountCount } = finStats;

    return { income, expenses, net, bankTotal, accountCount, habitPct, todayLog, habits, openTasks, blemStats, younityStats, bpStats, gymStats };
  }

  /* ── SVG ring helper ── */
  function _ring(pct, color, size = 52) {
    const r    = size / 2 - 5;
    const circ = 2 * Math.PI * r;
    const off  = circ * (1 - Math.min(100, Math.max(0, pct)) / 100);
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="flex-shrink:0">
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--bg3)" stroke-width="4"/>
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="4"
        stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
        stroke-linecap="round" transform="rotate(-90 ${size/2} ${size/2})"/>
    </svg>`;
  }

  /* ── Render 4 configurable metric cards ── */
  function renderMetrics() {
    const grid = document.getElementById('dash-metrics');
    if (!grid) return;
    const slots = getCardSlots();
    const d     = _collectData();
    grid.innerHTML = slots.map((slotId, i) =>
      `<div class="metric-card mc-new" style="position:relative">${_renderSlotCard(slotId, i, d)}</div>`
    ).join('');
  }

  function _renderSlotCard(slotId, idx, d) {
    const { income, expenses, net, bankTotal, accountCount,
            habitPct, todayLog, habits,
            openTasks, blemStats, younityStats, bpStats, gymStats } = d;

    const menuBtn = `<button class="mc-dots-btn" onclick="Dashboard.openCardMenu(event,${idx})" title="Change metric"><i class="ti ti-dots"></i></button>`;

    const habitCol = habitPct >= 80 ? 'var(--green)' : habitPct >= 50 ? 'var(--amber)' : 'var(--cyan)';
    const habitCls = habitPct >= 80 ? 'green' : habitPct >= 50 ? 'amber' : 'fg2';

    switch (slotId) {
      case 'cash_position':
        return `<div class="mc-new-header"><span class="mc-new-label">CASH POSITION</span>${menuBtn}</div>
          <div class="mc-new-body"><div>
            <div class="mc-new-val ${income>0?'green':'fg2'}">$${income.toLocaleString()}</div>
            <div class="mc-new-sub">collected this month</div>
            <div class="mc-new-sub2">net: $${net.toLocaleString()}</div>
          </div><i class="ti ti-building-bank" style="font-size:30px;color:var(--fg3);opacity:0.35"></i></div>`;

      case 'habit_score':
        return `<div class="mc-new-header"><span class="mc-new-label">HABIT SCORE</span>${menuBtn}</div>
          <div class="mc-new-body"><div>
            <div class="mc-new-val ${habitCls}">${todayLog.length} / ${habits.length}</div>
            <div class="mc-new-sub">${habitPct}% completed</div><div class="mc-new-sub2">today</div>
          </div>${_ring(habitPct, habitCol)}</div>`;

      case 'priority_load':
        return `<div class="mc-new-header"><span class="mc-new-label">PRIORITY LOAD</span>${menuBtn}</div>
          <div class="mc-new-body"><div>
            <div class="mc-new-val cyan">${openTasks}</div>
            <div class="mc-new-sub">open tasks</div><div class="mc-new-sub2">across all areas</div>
          </div><i class="ti ti-clipboard-list" style="font-size:30px;color:var(--cyan);opacity:0.35"></i></div>`;

      case 'monthly_income':
        return `<div class="mc-new-header"><span class="mc-new-label">MONTHLY INCOME</span>${menuBtn}</div>
          <div class="mc-new-body"><div>
            <div class="mc-new-val ${income>0?'green':'fg2'}">$${income.toLocaleString()}</div>
            <div class="mc-new-sub">XCD collected</div><div class="mc-new-sub2">this month</div>
          </div><i class="ti ti-trending-up" style="font-size:30px;color:var(--green);opacity:0.35"></i></div>`;

      case 'monthly_expenses':
        return `<div class="mc-new-header"><span class="mc-new-label">MONTHLY EXPENSES</span>${menuBtn}</div>
          <div class="mc-new-body"><div>
            <div class="mc-new-val ${expenses>0?'red':'fg2'}">$${expenses.toLocaleString()}</div>
            <div class="mc-new-sub">XCD spent</div><div class="mc-new-sub2">this month</div>
          </div><i class="ti ti-trending-down" style="font-size:30px;color:var(--red);opacity:0.35"></i></div>`;

      case 'net_cash': {
        const cls = net > 0 ? 'green' : net < 0 ? 'red' : 'fg2';
        return `<div class="mc-new-header"><span class="mc-new-label">NET CASH</span>${menuBtn}</div>
          <div class="mc-new-body"><div>
            <div class="mc-new-val ${cls}">$${net.toLocaleString()}</div>
            <div class="mc-new-sub">income minus expenses</div><div class="mc-new-sub2">this month</div>
          </div><i class="ti ti-scale" style="font-size:30px;color:var(--${cls});opacity:0.35"></i></div>`;
      }
      case 'blueport_progress':
        return `<div class="mc-new-header"><span class="mc-new-label">BLUEPORT PROGRESS</span>${menuBtn}</div>
          <div class="mc-new-body"><div>
            <div class="mc-new-val cyan">${bpStats.pct}%</div>
            <div class="mc-new-sub">${bpStats.done}/${bpStats.total} tasks</div>
            <div class="mc-new-sub2">${bpStats.daysToLaunch > 0 ? bpStats.daysToLaunch+'d to launch' : 'launched!'}</div>
          </div>${_ring(bpStats.pct,'var(--cyan)')}</div>`;

      case 'weight_goal': {
        const { currentWeight, targetWeight, toGoLbs } = gymStats;
        const wPct = Math.min(100, Math.max(0, Math.round((currentWeight - Config.weightStart()) / (targetWeight - Config.weightStart()) * 100)));
        return `<div class="mc-new-header"><span class="mc-new-label">WEIGHT GOAL</span>${menuBtn}</div>
          <div class="mc-new-body"><div>
            <div class="mc-new-val white">${currentWeight.toFixed(1)}<span style="font-size:13px;color:var(--fg3)"> lb</span></div>
            <div class="mc-new-sub">${toGoLbs.toFixed(1)} lb to go</div><div class="mc-new-sub2">target: ${targetWeight} lb</div>
          </div>${_ring(wPct,'var(--green)')}</div>`;
      }
      case 'bank_total': {
        const cls = bankTotal >= 0 ? 'green' : 'red';
        return `<div class="mc-new-header"><span class="mc-new-label">TOTAL BANK BALANCE</span>${menuBtn}</div>
          <div class="mc-new-body"><div>
            <div class="mc-new-val ${cls}">$${bankTotal.toLocaleString()}</div>
            <div class="mc-new-sub">${accountCount} account${accountCount!==1?'s':''}</div><div class="mc-new-sub2">XCD total</div>
          </div><i class="ti ti-wallet" style="font-size:30px;color:var(--${cls});opacity:0.35"></i></div>`;
      }
      case 'blem_revenue':
        return `<div class="mc-new-header"><span class="mc-new-label">BLEM REVENUE</span>${menuBtn}</div>
          <div class="mc-new-body"><div>
            <div class="mc-new-val amber">$${blemStats.revenue.toLocaleString()}</div>
            <div class="mc-new-sub">this month</div><div class="mc-new-sub2">${blemStats.activeJobs} active job${blemStats.activeJobs!==1?'s':''}</div>
          </div><i class="ti ti-tool" style="font-size:30px;color:var(--amber);opacity:0.35"></i></div>`;

      case 'younity_revenue': {
        const yPct = Config.younityTarget() > 0 ? Math.min(100, Math.round(younityStats.revenue / Config.younityTarget() * 100)) : 0;
        return `<div class="mc-new-header"><span class="mc-new-label">YOUNITY REVENUE</span>${menuBtn}</div>
          <div class="mc-new-body"><div>
            <div class="mc-new-val green">$${younityStats.revenue.toLocaleString()}</div>
            <div class="mc-new-sub">to $${Config.younityTarget().toLocaleString()} target</div>
            <div class="mc-new-sub2">${younityStats.openTasks} open tasks</div>
          </div>${_ring(yPct,'var(--green)')}</div>`;
      }
      case 'blem_jobs':
        return `<div class="mc-new-header"><span class="mc-new-label">BLEM JOBS</span>${menuBtn}</div>
          <div class="mc-new-body"><div>
            <div class="mc-new-val amber">${blemStats.activeJobs}</div>
            <div class="mc-new-sub">active jobs</div><div class="mc-new-sub2">$${blemStats.revenue.toLocaleString()} this month</div>
          </div><i class="ti ti-car" style="font-size:30px;color:var(--amber);opacity:0.35"></i></div>`;

      default:
        return `<div class="mc-new-header"><span class="mc-new-label">—</span>${menuBtn}</div><div class="mc-new-body"><div class="mc-new-val fg3">—</div></div>`;
    }
  }

  /* ── Seeds ── */
  function seedTasks() {
    if (Store.getAll('tasks').length > 0) return;
    [
      { title: 'Silcomm — inbox zero & filing sweep',    badge: 'work',     done: false },
      { title: 'ACCA FOA — chapter reading',             badge: 'study',    done: false },
      { title: 'Gym — log today\'s workout',             badge: 'gym',      done: false },
      { title: 'Younity — review open tasks',            badge: 'biz',      done: false },
    ].forEach(t => Store.insert('tasks', t));
  }

  function seedMilestones() {
    if (Store.getAll('milestones').length > 0) return;
    [
      { name: 'Weight goal',     target_date: null, target_value: Config.weightTarget(), current_value: Config.weightStart(), unit: 'lbs' },
      { name: 'Blueport launch', target_date: '2026-09-01', target_value: null, current_value: null, unit: null },
    ].forEach(m => Store.insert('milestones', m));
  }

  /* ── Progress panel ── */
  function renderProgress() {
    const el = document.getElementById('dash-progress-panel');
    if (!el) return;

    const weightEntries = Store.getAll('gym_weight').sort((a,b)=>new Date(b.logged_date)-new Date(a.logged_date));
    const curWeight  = weightEntries.length ? parseFloat(weightEntries[0].weight_lbs) : Config.weightStart();
    const wStart     = Config.weightStart(), wTarget = Config.weightTarget();
    const weightPct  = Math.min(100, Math.max(0, Math.round((curWeight - wStart) / (wTarget - wStart) * 100)));

    const bpTasks = Store.getAll('blueport_tasks');
    const bpDone  = bpTasks.filter(t => t.done).length;
    const bpPct   = bpTasks.length ? Math.round(bpDone / bpTasks.length * 100) : 0;

    const income     = Store.getAll('income').filter(i=>isThisMonth(i.received_date)).reduce((s,i)=>s+(parseFloat(i.amount_xcd)||0),0);
    const yTarget    = Config.younityTarget();
    const yIncome    = Store.getAll('income').filter(i=>isThisMonth(i.received_date)&&i.source==='Younity Consultancy').reduce((s,i)=>s+(parseFloat(i.amount_xcd)||0),0);
    const yPct       = yTarget > 0 ? Math.min(100, Math.round(yIncome / yTarget * 100)) : 0;

    const studyLessons = Store.getAll('study_lessons');
    const studyDone    = studyLessons.filter(l => l.status === 'Done' || l.done).length;
    const studyPct     = studyLessons.length ? Math.round(studyDone / studyLessons.length * 100) : 0;

    function progRow(label, pct, cls, sub) {
      return `<div class="dash-prog-row">
        <span class="dash-prog-label">${label}</span>
        <div class="prog-track" style="flex:1"><div class="prog-fill ${cls}-fill" style="width:${pct}%"></div></div>
        <div class="dash-prog-right">
          <div class="dash-prog-pct ${cls}">${pct}%</div>
          <div class="dash-prog-sub">${sub}</div>
        </div>
      </div>`;
    }

    el.innerHTML = [
      progRow('Weight Goal',     weightPct, 'green',  `${curWeight.toFixed(1)} / ${wTarget} lb`),
      progRow('Blueport Launch', bpPct,     'cyan',   `${bpDone} / ${bpTasks.length} tasks`),
      progRow('Younity $2K Goal',yPct,      'amber',  `$${yIncome.toLocaleString()} / $${yTarget.toLocaleString()}`),
      studyLessons.length ? progRow('ACCA Progress',  studyPct,  'purple', `${studyDone} / ${studyLessons.length} topics`) : '',
    ].join('');
  }

  function setBar(barId, pctId, pct, label) {
    const bar = document.getElementById(barId);
    const lbl = document.getElementById(pctId);
    if (bar) bar.style.width = pct + '%';
    if (lbl) lbl.textContent = label;
  }

  /* ── Business Pulse panel ── */
  function renderBusinessPulse() {
    const el = document.getElementById('dash-biz-pulse');
    if (!el) return;

    const blemJobs    = Store.getAll('blem_jobs');
    const blemActive  = blemJobs.filter(j => j.status !== 'Complete').length;
    const blemRevenue = blemJobs.filter(j => isThisMonth(j.created_at)).reduce((s,j) => s + (parseFloat(j.amount_paid_xcd)||0), 0);

    const yIncome = Store.getAll('income').filter(i => isThisMonth(i.received_date) && i.source === 'Younity Consultancy').reduce((s,i) => s + (parseFloat(i.amount_xcd)||0), 0);
    const yTasks  = Store.getAll('younity_tasks').filter(t => t.status !== 'Done').length;
    const yTarget = Config.younityTarget();

    const bpTasks = Store.getAll('blueport_tasks');
    const bpPct   = bpTasks.length ? Math.round(bpTasks.filter(t => t.done).length / bpTasks.length * 100) : 0;
    const bpDone  = bpTasks.filter(t => t.done).length;

    el.innerHTML = `<div class="dash-biz-grid">
      <div class="dash-biz-mini">
        <div class="dbm-label">Blem Tuned</div>
        <div class="dbm-val amber">$${blemRevenue.toLocaleString()}</div>
        <div class="dbm-sub">this month</div>
        <div class="dbm-stats">
          <div class="dbm-stat"><i class="ti ti-tool" style="font-size:10px"></i> <span class="dbm-stat-val">${blemActive}</span> active jobs</div>
        </div>
      </div>
      <div class="dash-biz-mini">
        <div class="dbm-label">Younity</div>
        <div class="dbm-val green">$${yIncome.toLocaleString()}</div>
        <div class="dbm-sub">to $${yTarget.toLocaleString()} target</div>
        <div class="dbm-stats">
          <div class="dbm-stat"><i class="ti ti-users" style="font-size:10px"></i> <span class="dbm-stat-val">${yTasks}</span> open tasks</div>
        </div>
      </div>
      <div class="dash-biz-mini">
        <div class="dbm-label">Blueport</div>
        <div class="dbm-val cyan">${bpPct}%</div>
        <div class="dbm-sub">launch progress</div>
        <div class="dbm-stats">
          <div class="dbm-stat"><i class="ti ti-ship" style="font-size:10px"></i> <span class="dbm-stat-val">${bpDone}/${bpTasks.length}</span> tasks</div>
        </div>
      </div>
    </div>`;
  }

  /* ── Milestones mini panel ── */
  function renderMilestonesMini() {
    const el = document.getElementById('dash-milestones-mini');
    if (!el) return;
    const milestones = Store.getAll('milestones')
      .filter(m => m.target_date)
      .sort((a, b) => new Date(a.target_date) - new Date(b.target_date))
      .slice(0, 4);

    if (!milestones.length) {
      el.innerHTML = '<div class="task-empty">no upcoming milestones</div>';
      return;
    }

    const icons = { 'Weight goal':'ti-barbell', 'Blueport launch':'ti-ship', 'ACCA':'ti-book' };
    const getIcon = name => {
      for (const [key, ico] of Object.entries(icons)) if (name.includes(key)) return ico;
      return 'ti-flag';
    };

    el.innerHTML = milestones.map(m => {
      const days = Math.ceil((new Date(m.target_date) - new Date()) / 86400000);
      const cls  = days < 0 ? 'red' : days <= 30 ? 'amber' : 'cyan';
      const lbl  = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'today' : `${days}d away`;
      const dateStr = new Date(m.target_date + 'T00:00:00').toLocaleDateString('en-AG', { day:'numeric', month:'short', year:'numeric' });
      return `<div class="dash-ms-row">
        <i class="ti ${getIcon(m.name)} dash-ms-icon fg3"></i>
        <span class="dash-ms-name">${escapeHtml(m.name)}</span>
        <div class="dash-ms-meta">
          <div class="dash-ms-days ${cls}">${lbl}</div>
          <div class="dash-ms-date">${dateStr}</div>
        </div>
      </div>`;
    }).join('');
  }

  /* ── Morning briefing ── */
  function generateBriefing() {
    const el = document.getElementById('dash-briefing-content');
    if (!el) return;

    const d        = _collectData();
    const { income, expenses, net, habits, todayLog, habitPct, openTasks, gymStats } = d;
    const toGoLbs = gymStats.toGoLbs.toFixed(1);
    const bullets = [];

    if (income === 0) {
      bullets.push('No income logged this month yet — focus on income generation today.');
    } else if (net < 0) {
      bullets.push(`Cash position: $${income.toLocaleString()} income, $${expenses.toLocaleString()} expenses — net is negative ($${net.toLocaleString()}).`);
    } else {
      bullets.push(`Cash position looks healthy at $${income.toLocaleString()} XCD income, net $${net.toLocaleString()} this month.`);
    }

    if (openTasks === 0) {
      bullets.push('No open tasks. Add items to the command queue to stay on track.');
    } else {
      bullets.push(`You have ${openTasks} open task${openTasks > 1 ? 's' : ''} across all areas. Prioritise high-impact items.`);
    }

    if (habitPct === 100) {
      bullets.push(`Habits: ${habitPct}% today — perfect day. Keep the streak alive.`);
    } else if (habitPct >= 50) {
      bullets.push(`Habits: ${habitPct}% today (${todayLog.length}/${habits.length}). Good start — finish strong.`);
    } else {
      bullets.push(`Habits: ${habitPct}% today. ${todayLog.length} of ${habits.length} done. Stay consistent.`);
    }

    if (parseFloat(toGoLbs) > 0) {
      bullets.push(`Weight: ${gymStats.currentWeight.toFixed(1)} lbs — ${toGoLbs} lbs from goal.`);
    }

    el.innerHTML = bullets.map(b => `<div class="dash-briefing-item">${escapeHtml(b)}</div>`).join('');
  }

  /* ── Alerts ── */
  async function renderAlerts() {
    const el = document.getElementById('dash-alerts');
    if (!el) return;

    // Read from alerts table (populated by alert engine in main process)
    let alerts = Store.getAll('alerts').filter(a => !a.dismissed);

    // Trigger a fresh evaluation via IPC (main process evaluates + writes back)
    if (window.electronAPI?.runAlertEval) {
      try {
        const result = await window.electronAPI.runAlertEval();
        if (result && result.alerts) alerts = result.alerts.filter(a => !a.dismissed);
      } catch(e) { /* fall through to cached results */ }
    }

    if (!alerts.length) {
      el.innerHTML = '<div class="alert-ok"><i class="ti ti-circle-check" aria-hidden="true"></i> All systems clear</div>';
      return;
    }

    el.innerHTML = alerts.map(a => `
      <div class="alert-item alert-${a.level}">
        <i class="ti ti-alert-triangle" aria-hidden="true"></i>
        <div class="alert-body">
          <div class="alert-msg">${escapeHtml(a.message)}</div>
          ${a.action ? `<div class="alert-action">${escapeHtml(a.action)}</div>` : ''}
        </div>
        <button class="alert-dismiss" onclick="Dashboard.dismissAlert(${a.id})" title="Dismiss">
          <i class="ti ti-x" aria-hidden="true"></i>
        </button>
      </div>`).join('');
  }

  async function dismissAlert(id) {
    if (window.electronAPI?.dismissAlert) {
      await window.electronAPI.dismissAlert(id);
    } else {
      Store.update('alerts', id, { dismissed: true });
    }
    renderAlerts();
  }

  /* ── Alert rules management ── */
  async function renderAlertRules() {
    const el = document.getElementById('alert-rules-list');
    if (!el) return;
    const rules = Store.getAll('alert_rules');
    if (!rules.length) {
      el.innerHTML = '<div class="task-empty">no rules — evaluating on first load</div>';
      return;
    }
    el.innerHTML = rules.map(r => `
      <div class="widget-setting-row">
        <label class="widget-toggle">
          <input type="checkbox" ${r.enabled ? 'checked' : ''}
            onchange="Dashboard.toggleAlertRule(${r.id})" />
          <span class="widget-toggle-label">${escapeHtml(r.label)}</span>
        </label>
        <span class="pill pill-${r.source === 'ai' ? 'cyan' : r.source === 'user' ? 'green' : 'gray'}"
          style="font-size:8px">${escapeHtml(r.source)}</span>
        ${r.source !== 'system' ? `<button class="task-del" onclick="Dashboard.deleteAlertRule(${r.id})"><i class="ti ti-x"></i></button>` : ''}
      </div>`).join('');
  }

  async function toggleAlertRule(id) {
    if (window.electronAPI?.toggleAlertRule) {
      await window.electronAPI.toggleAlertRule(id);
    } else {
      const rule = Store.getAll('alert_rules').find(r => r.id === id);
      if (rule) Store.update('alert_rules', id, { enabled: !rule.enabled });
    }
    renderAlerts();
    renderAlertRules();
  }

  function deleteAlertRule(id) {
    Store.delete('alert_rules', id);
    renderAlertRules();
    renderAlerts();
  }

  function toggleAlertRules() {
    const panel = document.getElementById('alert-rules-panel');
    if (!panel) return;
    panel.classList.toggle('hidden');
    renderAlertRules();
  }

  /* ── Unified task system ── */
  const TASK_TABS = ['All', 'Work', 'Blem Tuned', 'Younity', 'Blueport', 'Life', 'Today'];

  function renderTaskTabs() {
    const el = document.getElementById('dash-task-tabs');
    if (!el) return;
    el.innerHTML = TASK_TABS.map(t => `
      <button class="dash-task-tab${t === _taskTab ? ' active' : ''}"
        onclick="Dashboard.switchTaskTab('${t}')">${t}</button>`).join('');
  }

  function switchTaskTab(tab) {
    _taskTab = tab;
    renderTaskTabs();
    renderTasks();
  }

  function _getUnifiedItems() {
    const today    = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const items    = [];

    Store.getAll('tasks').filter(t => !t.done).forEach(t => {
      items.push({ id: t.id, srcType: 'task', title: t.title, badge: t.badge || 'biz',
        dueDate: t.due_date || null, priority: t.priority || 'med', area: _badgeArea(t.badge) });
    });
    Store.getAll('work_tasks').filter(t => t.status !== 'Done').forEach(t => {
      items.push({ id: t.id, srcType: 'work_task', title: t.title, badge: 'work',
        dueDate: t.due_date || null, priority: t.priority === 'High' ? 'high' : t.priority === 'Low' ? 'low' : 'med', area: 'work' });
    });
    Store.getAll('blem_jobs').filter(j => j.status !== 'Complete').forEach(j => {
      items.push({ id: j.id, srcType: 'blem_job', title: j.vehicle || j.job_ref || 'Blem job',
        badge: 'blem', dueDate: null, priority: 'med', area: 'blem' });
    });
    Store.getAll('younity_tasks').filter(t => t.status !== 'Done').forEach(t => {
      items.push({ id: t.id, srcType: 'younity_task', title: t.title, badge: 'younity',
        dueDate: t.due_date || null, priority: 'med', area: 'younity' });
    });
    Store.getAll('blueport_tasks').filter(t => !t.done).forEach(t => {
      items.push({ id: t.id, srcType: 'blueport_task', title: t.title, badge: 'blueport',
        dueDate: t.due_date || null, priority: 'med', area: 'blueport' });
    });
    return items;
  }

  function _badgeArea(badge) {
    return { work:'work', blem:'blem', younity:'younity', blueport:'blueport',
             study:'life', gym:'life' }[badge] || 'other';
  }

  function renderTasks() {
    const el      = document.getElementById('dash-task-list');
    const countEl = document.getElementById('dash-task-count');
    if (!el) return;

    const today    = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    let items = _getUnifiedItems();

    if (_taskTab === 'Work')       items = items.filter(i => i.area === 'work');
    if (_taskTab === 'Blem Tuned') items = items.filter(i => i.area === 'blem');
    if (_taskTab === 'Younity')    items = items.filter(i => i.area === 'younity');
    if (_taskTab === 'Blueport')   items = items.filter(i => i.area === 'blueport');
    if (_taskTab === 'Life')       items = items.filter(i => i.area === 'life');
    if (_taskTab === 'Today')      items = items.filter(i => i.dueDate === today);

    if (countEl) countEl.textContent = items.length + ' open';
    if (!items.length) {
      el.innerHTML = '<div class="task-empty">no tasks for this filter</div>';
      return;
    }

    const badgeCls = { work:'badge-work', blem:'badge-biz', younity:'badge-biz',
      blueport:'badge-cyan', study:'badge-study', gym:'badge-gym', biz:'badge-biz' };
    const badgeLbl = { work:'WORK', blem:'BLEM', younity:'YOUNITY',
      blueport:'BLUEPORT', study:'STUDY', gym:'GYM', biz:'BIZ' };

    el.innerHTML = items.map(item => {
      const priColor = item.priority === 'high' ? 'var(--red)' : item.priority === 'low' ? 'var(--fg3)' : 'var(--amber)';
      let dueStr = '', dueCls = 'fg3';
      if (item.dueDate) {
        if (item.dueDate === today)     { dueStr = 'Today';    dueCls = 'amber'; }
        else if (item.dueDate === tomorrow) { dueStr = 'Tomorrow'; dueCls = 'fg2'; }
        else if (item.dueDate < today)  { dueStr = 'Overdue';  dueCls = 'red'; }
        else { dueStr = new Date(item.dueDate + 'T00:00:00').toLocaleDateString('en-AG', {day:'numeric',month:'short'}); }
      }
      const bc = badgeCls[item.badge] || 'badge-biz';
      const bl = badgeLbl[item.badge] || item.badge.toUpperCase();
      return `<div class="dash-task-row">
        <div class="dash-task-check" onclick="Dashboard.toggleUnifiedTask('${item.srcType}',${item.id})"
          role="checkbox" aria-checked="false"></div>
        <span class="dash-task-title">${escapeHtml(item.title)}</span>
        <span class="task-badge ${bc}" style="font-size:8px">${bl}</span>
        ${dueStr ? `<span class="dash-task-due ${dueCls}">${dueStr}</span>` : ''}
        <span class="dash-task-dot" style="background:${priColor}"></span>
      </div>`;
    }).join('');
  }

  function toggleUnifiedTask(srcType, id) {
    if (srcType === 'task') {
      const t = Store.getAll('tasks').find(t => t.id === id);
      if (t) Store.update('tasks', id, { done: true });
    } else if (srcType === 'work_task') {
      Store.update('work_tasks', id, { status: 'Done' });
    } else if (srcType === 'blem_job') {
      Store.update('blem_jobs', id, { status: 'Complete' });
    } else if (srcType === 'younity_task') {
      Store.update('younity_tasks', id, { status: 'Done' });
    } else if (srcType === 'blueport_task') {
      Store.update('blueport_tasks', id, { done: true });
    }
    renderTasks();
  }

  function toggleTask(id) {
    const task = Store.getAll('tasks').find(t => t.id === id);
    if (!task) return;
    Store.update('tasks', id, { done: !task.done });
    renderTasks();
  }

  function deleteTask(id) { Store.delete('tasks', id); renderTasks(); }

  function quickAddTask() {
    const input = document.getElementById('dash-quick-add');
    const badge = document.getElementById('dash-quick-badge');
    const title = input?.value.trim();
    if (!title) return;
    Store.insert('tasks', { title, badge: badge?.value || 'work', done: false });
    input.value = '';
    renderTasks();
    input.focus();
  }

  function showTaskForm() {
    document.getElementById('dash-task-form')?.classList.remove('hidden');
    const d = new Date().toISOString().split('T')[0];
    const due = document.getElementById('dtf-due');
    if (due && !due.value) due.value = d;
    document.getElementById('dtf-title')?.focus();
  }

  function hideTaskForm() {
    document.getElementById('dash-task-form')?.classList.add('hidden');
    ['dtf-title','dtf-due'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  }

  function saveTaskFromForm() {
    const title    = document.getElementById('dtf-title')?.value.trim();
    if (!title) { document.getElementById('dtf-title')?.focus(); return; }
    const badge    = document.getElementById('dtf-badge')?.value    || 'work';
    const due_date = document.getElementById('dtf-due')?.value      || null;
    const priority = document.getElementById('dtf-priority')?.value || 'med';
    Store.insert('tasks', { title, badge, done: false, due_date, priority });
    hideTaskForm();
    renderTasks();
  }

  /* ── Habit tracker ── */
  const DEFAULT_HABITS = [
    { id: 'exercise',  name: 'Exercise',     icon: 'ti-barbell', enabled: true  },
    { id: 'study',     name: 'Study',        icon: 'ti-book',    enabled: true  },
    { id: 'nutrition', name: 'Nutrition',    icon: 'ti-salad',   enabled: true  },
    { id: 'sleep',     name: 'Sleep 8h+',    icon: 'ti-moon',    enabled: true  },
    { id: 'deepwork',  name: 'Deep work',    icon: 'ti-brain',   enabled: true  },
    { id: 'nojunk',    name: 'No junk food', icon: 'ti-leaf',    enabled: false },
  ];

  function getHabits() {
    const saved = Store.get('habits_config');
    if (!saved) return [...DEFAULT_HABITS];
    const savedMap = {};
    saved.forEach(h => { savedMap[h.id] = h; });
    return DEFAULT_HABITS.map(def => ({ ...def, ...(savedMap[def.id] || {}) }));
  }

  function _todayKey() { return new Date().toISOString().split('T')[0]; }

  function _getLog() { return Store.get('habits_log') || {}; }

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
    renderHabits();
    window.dispatchEvent(new CustomEvent('habits-changed'));
  }

  function _habitStreak(habits, log) {
    const total = habits.length;
    if (!total) return 0;
    let streak = 0;
    for (let i = 1; i <= 60; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      if ((log[key] || []).length >= total) streak++;
      else break;
    }
    return streak;
  }

  function renderHabits() {
    const el = document.getElementById('dash-habit-list');
    if (!el) return;
    const habits   = getHabits().filter(h => h.enabled);
    const todayLog = (_getLog()[_todayKey()] || []);
    const score    = todayLog.length;
    const total    = habits.length;
    const pct      = total > 0 ? Math.round(score / total * 100) : 0;
    const pctColor = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--cyan)';

    // SVG donut for the panel
    const r    = 30, size = 70, circ = 2 * Math.PI * r;
    const off  = circ * (1 - pct / 100);
    const donut = `<div style="position:relative;flex-shrink:0">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--bg3)" stroke-width="5"/>
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${pctColor}" stroke-width="5"
          stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
          stroke-linecap="round" transform="rotate(-90 ${size/2} ${size/2})"/>
      </svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1">
        <span style="font-size:14px;font-weight:700;color:${pctColor}">${pct}%</span>
        <span style="font-size:8px;color:var(--fg3)">${score}/${total}</span>
      </div>
    </div>`;

    if (!habits.length) {
      el.innerHTML = '<div class="task-empty">no habits — use manage above</div>';
      return;
    }

    el.innerHTML = `<div class="dash-habit-panel-wrap">
      <div class="dash-habit-panel-list">
        ${habits.map(h => {
          const done = todayLog.includes(h.id);
          return `<div class="dhp-row">
            <div class="dhp-check${done ? ' done' : ''}" onclick="Dashboard.toggleHabit('${h.id}')" role="checkbox">
              ${done ? '<i class="ti ti-check" style="font-size:8px;color:#000"></i>' : ''}
            </div>
            <i class="ti ${h.icon}" style="font-size:12px;color:${done?'var(--green)':'var(--fg3)'}"></i>
            <span style="${done?'color:var(--green)':''}">${escapeHtml(h.name)}</span>
          </div>`;
        }).join('')}
      </div>
      ${donut}
    </div>`;
  }

  function toggleHabitSettings() {
    const panel = document.getElementById('dash-habit-settings');
    if (!panel) return;
    if (panel.classList.contains('hidden')) { renderHabitSettings(); panel.classList.remove('hidden'); }
    else panel.classList.add('hidden');
  }

  function renderHabitSettings() {
    const el = document.getElementById('dash-habit-settings-inner');
    if (!el) return;
    el.innerHTML = getHabits().map(h => `
      <label class="widget-setting-row" style="cursor:pointer;display:flex;align-items:center;gap:8px">
        <input type="checkbox" ${h.enabled ? 'checked' : ''} onchange="Dashboard.toggleHabitEnabled('${h.id}', this.checked)" />
        <i class="ti ${h.icon}" style="font-size:13px;color:var(--fg3)"></i>
        <span style="font-size:11px;color:var(--fg2)">${escapeHtml(h.name)}</span>
      </label>`).join('');
  }

  function toggleHabitEnabled(id, enabled) {
    const habits = getHabits();
    const h = habits.find(x => x.id === id);
    if (h) h.enabled = enabled;
    Store.set('habits_config', habits);
    renderHabitSettings();
    renderHabits();
    window.dispatchEvent(new CustomEvent('habits-changed'));
  }

  /* ── Milestones ── */
  function renderMilestones() {
    renderMilestonesMini();
  }

  function showAddMilestone() { clearForm(); document.getElementById('milestone-form').classList.remove('hidden'); document.getElementById('ms-name').focus(); }
  function hideMilestoneForm() { document.getElementById('milestone-form').classList.add('hidden'); clearForm(); }
  function clearForm() {
    ['ms-name','ms-date','ms-target','ms-current','ms-unit'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    document.getElementById('milestone-form').dataset.editId='';
  }
  function saveMilestone() {
    const name=document.getElementById('ms-name').value.trim();
    if (!name) { document.getElementById('ms-name').focus(); return; }
    const editId=document.getElementById('milestone-form').dataset.editId;
    const data={ name, target_date:document.getElementById('ms-date').value||null, target_value:parseFloat(document.getElementById('ms-target').value)||null, current_value:parseFloat(document.getElementById('ms-current').value)||null, unit:document.getElementById('ms-unit').value.trim()||null };
    if (editId) Store.update('milestones',parseInt(editId),data); else Store.insert('milestones',{...data,pinned:false});
    hideMilestoneForm(); renderMilestones(); renderProgress();
    window.dispatchEvent(new CustomEvent('milestones-changed'));
  }
  function editMilestone(id) {
    const m=Store.getAll('milestones').find(x=>x.id===id); if(!m) return;
    document.getElementById('ms-name').value=m.name||'';
    document.getElementById('ms-date').value=m.target_date||'';
    document.getElementById('ms-target').value=m.target_value??'';
    document.getElementById('ms-current').value=m.current_value??'';
    document.getElementById('ms-unit').value=m.unit||'';
    document.getElementById('milestone-form').dataset.editId=id;
    document.getElementById('milestone-form').classList.remove('hidden');
    document.getElementById('ms-name').focus();
  }
  function deleteMilestone(id) {
    Store.delete('milestones', id); renderMilestones();
    window.dispatchEvent(new CustomEvent('milestones-changed'));
  }

  function renderAll() {
    const greeting = document.getElementById('dash-greeting-text');
    if (greeting) greeting.textContent = getGreeting();
    const nameEl = document.getElementById('dash-greeting-name');
    if (nameEl) {
      const name = Store.get('user_prefs')?.name || '';
      nameEl.textContent = name ? name + '.' : '';
    }
    renderMetrics();
    renderAlerts();
    renderTaskTabs();
    renderTasks();
    renderHabits();
    renderProgress();
    renderBusinessPulse();
    renderMilestonesMini();
    generateBriefing();
  }

  function init() {
    Config.refresh();
    seedTasks();
    seedMilestones();
    // Default task tab to 'All'
    _taskTab = 'All';
    renderAll();
    window.addEventListener('config-changed', renderAll);
  }

  return {
    init, renderAll, renderTasks, renderMilestones, renderMilestonesMini, renderMetrics, renderProgress,
    renderBusinessPulse, renderHabits,
    toggleTask, deleteTask, quickAddTask,
    toggleUnifiedTask, switchTaskTab,
    showTaskForm, hideTaskForm, saveTaskFromForm,
    setCardSlot, openCardMenu, closeCardMenu,
    toggleHabit, toggleHabitSettings, toggleHabitEnabled,
    showAddMilestone, hideMilestoneForm, saveMilestone, editMilestone, deleteMilestone,
    dismissAlert, generateBriefing,
    renderAlertRules, toggleAlertRule, deleteAlertRule, toggleAlertRules,
  };

})();

document.addEventListener('DOMContentLoaded', Dashboard.init);
