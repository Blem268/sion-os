/* ============================================
   SION OS — finance.js
   v0.6.0 — Sprint 5
   US-012: Income tracker — 5 sources
   ============================================ */

const Finance = (() => {

  const DEFAULT_WIDGETS = ['income_month', 'expenses_month', 'net_income', 'bank_total'];

  const WIDGET_OPTIONS = [
    {
      key: 'income_month',
      label: 'income this month',
      sub: 'XCD collected',
      accent: 'green-accent',
      valClass: () => 'green',
      value: d => '$' + d.totalIncome.toLocaleString(),
    },
    {
      key: 'expenses_month',
      label: 'expenses this month',
      sub: 'XCD spent',
      accent: 'red-accent',
      valClass: () => 'red',
      value: d => '$' + d.totalExpenses.toLocaleString(),
    },
    {
      key: 'net_income',
      label: 'net income',
      sub: 'income − expenses',
      accent: d => d.net >= 0 ? 'green-accent' : 'red-accent',
      valClass: d => d.net >= 0 ? 'green' : 'red',
      value: d => (d.net >= 0 ? '$' : '-$') + Math.abs(d.net).toLocaleString(),
    },
    {
      key: 'bank_total',
      label: 'total bank balance',
      sub: 'all accounts XCD',
      accent: 'cyan-accent',
      valClass: d => d.bankTotal >= 0 ? 'cyan' : 'red',
      value: d => '$' + d.bankTotal.toLocaleString(),
    },
    {
      key: 'sub_monthly',
      label: 'subscriptions',
      sub: 'XCD / mo equiv.',
      accent: 'amber-accent',
      valClass: () => 'amber',
      value: d => '$' + d.subMonthly.toFixed(0),
    },
    {
      key: 'commitments_total',
      label: 'fixed commitments',
      sub: 'XCD / mo total',
      accent: 'red-accent',
      valClass: () => 'red',
      value: d => '$' + d.commitmentsTotal.toLocaleString(),
    },
    {
      key: 'savings_rate',
      label: 'savings rate',
      sub: 'of income this month',
      accent: d => d.savingsRate >= 20 ? 'green-accent' : d.savingsRate >= 10 ? 'amber-accent' : 'red-accent',
      valClass: d => d.savingsRate >= 20 ? 'green' : d.savingsRate >= 10 ? 'amber' : 'red',
      value: d => d.savingsRate + '%',
    },
    {
      key: 'blem_month',
      label: 'blem revenue',
      sub: 'XCD this month',
      accent: 'amber-accent',
      valClass: () => 'amber',
      value: d => '$' + d.blemMonth.toLocaleString(),
    },
    {
      key: 'younity_month',
      label: 'younity revenue',
      sub: 'XCD this month',
      accent: 'green-accent',
      valClass: () => 'green',
      value: d => '$' + d.younityMonth.toLocaleString(),
    },
  ];

  /* ── Seed commitments ── */
  function seedCommitments() {
    if (Store.getAll('commitments').length > 0) return;
    Store.insert('commitments', {
      name:        'Sagicor Life Insurance',
      type:        'Insurance',
      monthly_xcd: 0,
      start_date:  '2026-04-01',
      end_date:    null,
      provider:    'Sagicor',
    });
  }

  /* ── This month helper ── */
  function isThisMonth(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-AG', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Widget prefs ── */
  function getWidgetPrefs() {
    const saved = Store.get('fin_widget_prefs');
    if (saved) { try { return JSON.parse(saved); } catch(e) {} }
    return [...DEFAULT_WIDGETS];
  }

  function toggleWidgetPanel() {
    const panel = document.getElementById('fin-widget-panel');
    if (!panel) return;
    if (panel.classList.contains('hidden')) {
      renderWidgetPanel();
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  }

  function renderWidgetPanel() {
    const prefs     = getWidgetPrefs();
    const container = document.getElementById('fin-widget-settings');
    if (!container) return;
    const labels = ['top left', 'top right', 'bottom left', 'bottom right'];
    container.innerHTML = prefs.map((key, i) => `
      <div style="display:flex;flex-direction:column;gap:4px">
        <label style="font-size:10px;color:var(--fg3);text-transform:uppercase;letter-spacing:.06em">${labels[i]}</label>
        <select class="t-input" id="fin-widget-sel-${i}">
          ${WIDGET_OPTIONS.map(o => `<option value="${escapeHtml(o.key)}"${o.key===key?' selected':''}>${escapeHtml(o.label)}</option>`).join('')}
        </select>
      </div>`).join('');
  }

  function saveWidgetPrefs() {
    const prefs = [0,1,2,3].map(i => {
      const sel = document.getElementById('fin-widget-sel-' + i);
      return sel ? sel.value : DEFAULT_WIDGETS[i];
    });
    Store.set('fin_widget_prefs', JSON.stringify(prefs));
    document.getElementById('fin-widget-panel')?.classList.add('hidden');
    renderMetrics();
  }

  /* ── Render metrics ── */
  function renderMetrics() {
    const income   = Store.getAll('income');
    const expenses = Store.getAll('expenses');
    const accounts = Store.getAll('bank_accounts');
    const subs     = Store.getAll('subscriptions');
    const commits  = Store.getAll('commitments');

    const totalIncome   = income.filter(i => isThisMonth(i.received_date)).reduce((s,i) => s+(parseFloat(i.amount_xcd)||0), 0);
    const totalExpenses = expenses.filter(e => isThisMonth(e.expense_date)).reduce((s,e) => s+(parseFloat(e.amount_xcd)||0), 0);
    const net           = totalIncome - totalExpenses;
    const bankTotal     = accounts.reduce((s,a) => s+(parseFloat(a.balance)||0), 0);
    const subMonthly    = subs.reduce((s,sub) => {
      const cost = parseFloat(sub.cost)||0;
      if (sub.cycle==='Annual')    return s+cost/12;
      if (sub.cycle==='Weekly')    return s+cost*4.33;
      if (sub.cycle==='Quarterly') return s+cost/3;
      return s+cost;
    }, 0);
    const commitmentsTotal = commits.reduce((s,c) => s+(parseFloat(c.monthly_xcd)||0), 0);
    const savingsRate   = totalIncome > 0 ? Math.round(net/totalIncome*100) : 0;
    const blemMonth     = income.filter(i => isThisMonth(i.received_date) && i.source==='Blem Tuned').reduce((s,i)=>s+(parseFloat(i.amount_xcd)||0), 0);
    const younityMonth  = income.filter(i => isThisMonth(i.received_date) && i.source==='Younity Consultancy').reduce((s,i)=>s+(parseFloat(i.amount_xcd)||0), 0);

    const data = { totalIncome, totalExpenses, net, bankTotal, subMonthly, commitmentsTotal, savingsRate, blemMonth, younityMonth };

    const prefs = getWidgetPrefs();
    for (let i = 0; i < 4; i++) {
      const card = document.getElementById('fin-widget-card-' + i);
      if (!card) continue;
      const opt      = WIDGET_OPTIONS.find(o => o.key === prefs[i]) || WIDGET_OPTIONS[0];
      const accent   = typeof opt.accent   === 'function' ? opt.accent(data)  : opt.accent;
      const valClass = typeof opt.valClass === 'function' ? opt.valClass(data) : opt.valClass;
      card.className = 'metric-card' + (accent ? ' ' + accent : '');
      card.innerHTML = `
        <div class="mc-label">${opt.label}</div>
        <div class="mc-val ${valClass}">${opt.value(data)}</div>
        <div class="mc-sub">${opt.sub}</div>`;
    }
  }

  /* ── Render commitments ── */
  function renderCommitments() {
    const el      = document.getElementById('fin-commit-list');
    const totalEl = document.getElementById('fin-commit-total');
    if (!el) return;

    const commits = Store.getAll('commitments');
    const total   = commits.reduce((s, c) => s + (parseFloat(c.monthly_xcd) || 0), 0);
    if (totalEl) totalEl.textContent = '$' + total.toLocaleString() + ' XCD / mo total';

    if (!commits.length) {
      el.innerHTML = '<div class="task-empty">no commitments — add one above</div>';
      return;
    }

    el.innerHTML = commits.map(c => {
      const typeCls = {
        Loan:         'pill-red',
        Insurance:    'pill-amber',
        Subscription: 'pill-cyan',
        Other:        'pill-gray',
      }[c.type] || 'pill-gray';

      return `
        <div class="task-row">
          <div class="work-task-body">
            <div class="work-task-title">${escapeHtml(c.name)}</div>
            <div class="work-task-meta">
              <span class="pill ${typeCls}">${c.type}</span>
              ${c.provider ? `<span class="fg3" style="font-size:10px">${escapeHtml(c.provider)}</span>` : ''}
              ${c.start_date ? `<span class="fg3" style="font-size:10px">from ${formatDate(c.start_date)}</span>` : ''}
              ${c.end_date   ? `<span class="fg3" style="font-size:10px">until ${formatDate(c.end_date)}</span>` : '<span class="fg3" style="font-size:10px">ongoing</span>'}
            </div>
          </div>
          <span class="mc-val red" style="font-size:16px">$${parseFloat(c.monthly_xcd).toLocaleString()}</span>
          <span class="fg3" style="font-size:9px">/mo</span>
          <button class="task-del" onclick="Finance.editCommitment(${c.id})" aria-label="Edit">
            <i class="ti ti-pencil" aria-hidden="true"></i>
          </button>
          <button class="task-del" onclick="Finance.deleteCommitment(${c.id})" aria-label="Delete">
            <i class="ti ti-x" aria-hidden="true"></i>
          </button>
        </div>`;
    }).join('');
  }

  /* ── Render income table ── */
  function renderIncome() {
    const tbody = document.getElementById('fin-income-tbody');
    if (!tbody) return;

    const rows = Store.getAll('income').slice().reverse();
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="blem-empty">no income logged yet</td></tr>';
      return;
    }

    const sourceCls = {
      'Silcomm Engineering':  'pill-cyan',
      'NovaTrust':            'pill-cyan',
      'Blem Tuned':           'pill-amber',
      'Younity Consultancy':  'pill-green',
      'Blueport Agency':      'pill-cyan',
      'OS Builder':           'pill-green',
      'Other':                'pill-gray',
    };

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><span class="pill ${sourceCls[r.source] || 'pill-gray'}">${escapeHtml(r.source)}</span></td>
        <td class="fg2" style="font-size:10px">${escapeHtml(r.category || '—')}</td>
        <td class="num green">$${parseFloat(r.amount_xcd || 0).toLocaleString()}</td>
        <td class="fg3" style="font-size:10px;white-space:nowrap">${formatDate(r.received_date)}</td>
        <td class="fg3" style="font-size:10px">${escapeHtml(r.notes || '—')}</td>
        <td>
          <button class="task-del" onclick="Finance.deleteIncome(${r.id})" aria-label="Delete">
            <i class="ti ti-x" aria-hidden="true"></i>
          </button>
        </td>
      </tr>`).join('');
  }

  /* ── Render expense table ── */
  function renderExpenses() {
    const tbody = document.getElementById('fin-expense-tbody');
    if (!tbody) return;

    const rows     = Store.getAll('expenses').slice().reverse();
    const accounts = Store.getAll('bank_accounts');
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="blem-empty">no expenses logged yet</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(e => {
      const acct = e.account_id ? accounts.find(a => a.id === parseInt(e.account_id)) : null;
      return `
      <tr>
        <td class="white">${escapeHtml(e.item || '—')}</td>
        <td class="fg2" style="font-size:10px">${escapeHtml(e.category || '—')}</td>
        <td class="num red">$${parseFloat(e.amount_xcd || 0).toLocaleString()}</td>
        <td class="fg3" style="font-size:10px;white-space:nowrap">${formatDate(e.expense_date)}</td>
        <td class="fg3" style="font-size:10px">${acct ? escapeHtml(acct.name) : '—'}</td>
        <td>
          ${e.is_business ? '<span class="pill pill-cyan" style="font-size:8px">Biz</span>' : ''}
        </td>
        <td style="white-space:nowrap">
          <button class="task-del" onclick="Finance.editExpense(${e.id})" aria-label="Edit">
            <i class="ti ti-pencil" aria-hidden="true"></i>
          </button>
          <button class="task-del" onclick="Finance.deleteExpense(${e.id})" aria-label="Delete">
            <i class="ti ti-x" aria-hidden="true"></i>
          </button>
        </td>
      </tr>`;
    }).join('');
  }

  /* ── Render amortisation table ── */
  function renderAmort() {
    const tbody = document.getElementById('fin-amort-tbody');
    if (!tbody) return;

    const now = new Date();
    const launchPassed = now > new Date('2026-08-01');

    tbody.innerHTML = AMORT_MILESTONES.map(m => {
      const isFirst   = m.date === 'Aug 2026';
      const isPast    = isFirst && launchPassed;
      const statusPill = isPast
        ? '<span class="pill pill-green">reached</span>'
        : m.balance === 0
          ? '<span class="pill pill-green">target</span>'
          : m.highlight
            ? '<span class="pill pill-cyan">milestone</span>'
            : isFirst
              ? '<span class="pill pill-amber">upcoming</span>'
              : '<span class="pill pill-gray">future</span>';

      return `<tr class="${m.highlight ? 'fin-highlight-row' : ''}">
        <td class="${m.highlight ? 'green' : 'white'}">${escapeHtml(m.label)}</td>
        <td class="fg2">${escapeHtml(m.date)}</td>
        <td class="num ${m.balance === 0 ? 'green' : m.highlight ? 'cyan' : 'amber'}">
          ${m.balance === 0 ? '$0 — cleared' : '$' + m.balance.toLocaleString()}
        </td>
        <td>${statusPill}</td>
      </tr>`;
    }).join('');
  }

  /* ── Commitment form ── */
  function showCommitForm() {
    document.getElementById('fin-commit-form')?.classList.remove('hidden');
    document.getElementById('fc-name')?.focus();
  }
  function hideCommitForm() {
    document.getElementById('fin-commit-form')?.classList.add('hidden');
    ['fc-name','fc-amount','fc-start','fc-end','fc-provider'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
  }
  function saveCommitment() {
    const name = document.getElementById('fc-name')?.value.trim();
    if (!name) { document.getElementById('fc-name')?.focus(); return; }
    const form   = document.getElementById('fin-commit-form');
    const editId = form?.dataset.editId ? parseInt(form.dataset.editId) : null;
    const data   = {
      name,
      type:        document.getElementById('fc-type')?.value     || 'Other',
      monthly_xcd: parseFloat(document.getElementById('fc-amount')?.value) || 0,
      start_date:  document.getElementById('fc-start')?.value    || null,
      end_date:    document.getElementById('fc-end')?.value      || null,
      provider:    document.getElementById('fc-provider')?.value || '',
    };
    if (editId) Store.update('commitments', editId, data);
    else Store.insert('commitments', data);
    if (form) form.dataset.editId = '';
    const title = document.querySelector('#fin-commit-form .form-title');
    if (title) title.textContent = 'add commitment';
    hideCommitForm();
    renderCommitments();
    renderMetrics();
    Config.refresh();
    window.dispatchEvent(new CustomEvent('commitments-changed'));
  }
  function deleteCommitment(id) {
    Store.delete('commitments', id);
    renderCommitments();
    renderMetrics();
  }

  /* ── Edit commitment ── */
  function editCommitment(id) {
    const c = Store.getAll('commitments').find(x=>x.id===id);
    if (!c) return;
    document.getElementById('fc-name').value     = c.name||'';
    document.getElementById('fc-type').value     = c.type||'Other';
    document.getElementById('fc-amount').value   = c.monthly_xcd||'';
    document.getElementById('fc-start').value    = c.start_date||'';
    document.getElementById('fc-end').value      = c.end_date||'';
    document.getElementById('fc-provider').value = c.provider||'';
    document.getElementById('fin-commit-form').dataset.editId = id;
    document.getElementById('fin-commit-form').classList.remove('hidden');
    document.getElementById('fc-name').focus();
    const title = document.querySelector('#fin-commit-form .form-title');
    if (title) title.textContent = 'edit commitment';
  }

  /* ── Income form ── */
  function showIncomeForm() {
    // Populate account dropdown
    const acctSel = document.getElementById('fi-account');
    if (acctSel) {
      const accounts = Store.getAll('bank_accounts');
      acctSel.innerHTML = '<option value="">no linked account</option>' +
        accounts.map(a=>`<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
    }
    document.getElementById('fin-income-form')?.classList.remove('hidden');
    const dateEl = document.getElementById('fi-date');
    if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
    document.getElementById('fi-amount')?.focus();
  }
  function hideIncomeForm() {
    document.getElementById('fin-income-form')?.classList.add('hidden');
    ['fi-amount','fi-date','fi-notes'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
  }
  function saveIncome() {
    const amount    = parseFloat(document.getElementById('fi-amount')?.value) || 0;
    if (!amount) { document.getElementById('fi-amount')?.focus(); return; }
    const accountId = document.getElementById('fi-account')?.value || null;
    Store.insert('income', {
      source:        document.getElementById('fi-source')?.value   || 'Other',
      category:      document.getElementById('fi-category')?.value || 'Other',
      amount_xcd:    amount,
      received_date: document.getElementById('fi-date')?.value     || new Date().toISOString().split('T')[0],
      notes:         document.getElementById('fi-notes')?.value    || '',
      account_id:    accountId,
    });
    // Update bank account balance
    if (accountId) {
      const accounts = Store.getAll('bank_accounts');
      const acct     = accounts.find(a => a.id === parseInt(accountId));
      if (acct) Store.update('bank_accounts', acct.id, { balance: (parseFloat(acct.balance)||0) + amount });
    }
    hideIncomeForm();
    renderIncome();
    renderAccounts();
    renderMetrics();
  }
  function deleteIncome(id) {
    Store.delete('income', id);
    renderIncome();
    renderMetrics();
  }

  /* ── Expense form ── */
  function showExpenseForm() {
    const acctSel = document.getElementById('fe-account');
    if (acctSel) {
      const accounts = Store.getAll('bank_accounts');
      acctSel.innerHTML = '<option value="">no linked account</option>' +
        accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
    }
    document.getElementById('fin-expense-form')?.classList.remove('hidden');
    const dateEl = document.getElementById('fe-date');
    if (dateEl && !dateEl.value) {
      dateEl.value = new Date().toISOString().split('T')[0];
    }
    document.getElementById('fe-item')?.focus();
  }
  function hideExpenseForm() {
    const form = document.getElementById('fin-expense-form');
    if (form) { form.classList.add('hidden'); form.dataset.editId = ''; }
    ['fe-item','fe-amount','fe-date','fe-notes'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const acctSel = document.getElementById('fe-account');
    if (acctSel) acctSel.value = '';
    const bz = document.getElementById('fe-is-biz');
    if (bz) bz.checked = false;
    const title = document.querySelector('#fin-expense-form .form-title');
    if (title) title.textContent = 'log expense';
  }
  function saveExpense() {
    const item = document.getElementById('fe-item')?.value.trim();
    if (!item) { document.getElementById('fe-item')?.focus(); return; }
    const form      = document.getElementById('fin-expense-form');
    const editId    = form?.dataset.editId ? parseInt(form.dataset.editId) : null;
    const accountId = document.getElementById('fe-account')?.value || null;
    const amount    = parseFloat(document.getElementById('fe-amount')?.value) || 0;
    const data = {
      item,
      category:     document.getElementById('fe-category')?.value || 'Other',
      amount_xcd:   amount,
      expense_date: document.getElementById('fe-date')?.value     || new Date().toISOString().split('T')[0],
      notes:        document.getElementById('fe-notes')?.value    || '',
      is_business:  document.getElementById('fe-is-biz')?.checked  || false,
      account_id:   accountId,
    };

    if (editId) {
      const old = Store.getAll('expenses').find(x => x.id === editId);
      // Reverse the old account deduction (only if it was set by this feature)
      if (old?.account_id) {
        const oldAcct = Store.getAll('bank_accounts').find(a => a.id === parseInt(old.account_id));
        if (oldAcct) Store.update('bank_accounts', oldAcct.id, { balance: (parseFloat(oldAcct.balance) || 0) + (parseFloat(old.amount_xcd) || 0) });
      }
      Store.update('expenses', editId, data);
    } else {
      Store.insert('expenses', data);
    }

    // Deduct from selected account
    if (accountId) {
      const accounts = Store.getAll('bank_accounts');
      const acct     = accounts.find(a => a.id === parseInt(accountId));
      if (acct) Store.update('bank_accounts', acct.id, { balance: (parseFloat(acct.balance) || 0) - amount });
    }

    hideExpenseForm();
    renderExpenses();
    renderAccounts();
    renderMetrics();
  }
  function editExpense(id) {
    const e = Store.getAll('expenses').find(x => x.id === id);
    if (!e) return;
    // Populate account dropdown before setting value
    const acctSel = document.getElementById('fe-account');
    if (acctSel) {
      const accounts = Store.getAll('bank_accounts');
      acctSel.innerHTML = '<option value="">no linked account</option>' +
        accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
      acctSel.value = e.account_id || '';
    }
    document.getElementById('fe-item').value     = e.item || '';
    document.getElementById('fe-category').value = e.category || 'Other';
    document.getElementById('fe-amount').value   = e.amount_xcd || '';
    document.getElementById('fe-date').value     = e.expense_date || '';
    document.getElementById('fe-notes').value    = e.notes || '';
    const bz = document.getElementById('fe-is-biz');
    if (bz) bz.checked = !!e.is_business;
    const form = document.getElementById('fin-expense-form');
    if (form) { form.dataset.editId = id; form.classList.remove('hidden'); }
    const title = document.querySelector('#fin-expense-form .form-title');
    if (title) title.textContent = 'edit expense';
    document.getElementById('fe-item')?.focus();
  }
  function deleteExpense(id) {
    Store.delete('expenses', id);
    renderExpenses();
    renderMetrics();
  }

  function setEl(id, val) {
    const el = document.getElementById(id); if (el) el.textContent = val;
  }

  /* ── Bank accounts ── */
  function renderAccounts() {
    const el      = document.getElementById('fin-account-list');
    const worthEl = document.getElementById('fin-net-worth');
    if (!el) return;

    const accounts = Store.getAll('bank_accounts');
    const total    = accounts.reduce((s,a) => s + (parseFloat(a.balance)||0), 0);
    const debt     = Store.getAll('commitments').reduce((s,c) => {
      if (c.type === 'Loan') {
        const months = Math.ceil((new Date(c.end_date||'2033-07-01') - new Date()) / (30*86400000));
        return s + (parseFloat(c.monthly_xcd)||0) * Math.max(0, months);
      }
      return s;
    }, 0);

    if (worthEl) worthEl.textContent = 'total: $' + total.toLocaleString() + ' XCD';

    // Populate subscription account dropdown
    const subSelect = document.getElementById('fs-account');
    if (subSelect) {
      const opts = accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
      subSelect.innerHTML = '<option value="">No linked account</option>' + opts;
    }

    if (!accounts.length) {
      el.innerHTML = '<div class="task-empty">no accounts yet — add one above</div>';
      return;
    }

    el.innerHTML = accounts.map(a => {
      const bal    = parseFloat(a.balance) || 0;
      const balCls = bal >= 0 ? 'green' : 'red';
      const typePill = { Chequing:'pill-cyan', Savings:'pill-green', Business:'pill-amber', 'Credit Card':'pill-red', Other:'pill-gray' }[a.type] || 'pill-gray';
      return `
        <div class="task-row">
          <div class="work-task-body">
            <div class="work-task-title">${escapeHtml(a.name)}</div>
            <div class="work-task-meta">
              <span class="pill ${typePill}">${a.type}</span>
              <span class="fg3" style="font-size:10px">${escapeHtml(a.bank||'')}</span>
              <span class="fg3" style="font-size:10px">${a.currency || 'XCD'}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="mc-val ${balCls}" style="font-size:18px">$${bal.toLocaleString()}</span>
            <button class="task-del t-btn" style="font-size:9px;padding:3px 8px" onclick="Finance.openAccountDetail(${a.id})" title="View account detail">
              <i class="ti ti-eye" aria-hidden="true"></i>
            </button>
            <button class="task-del t-btn" style="font-size:9px;padding:3px 8px" onclick="Finance.updateBalance(${a.id})" title="Update balance">
              <i class="ti ti-refresh" aria-hidden="true"></i>
            </button>
            <button class="task-del" onclick="Finance.deleteAccount(${a.id})" aria-label="Delete account">
              <i class="ti ti-x" aria-hidden="true"></i>
            </button>
          </div>
        </div>`;
    }).join('');
  }

  function showAccountForm() {
    document.getElementById('fin-account-form')?.classList.remove('hidden');
    document.getElementById('fa-name')?.focus();
  }
  function hideAccountForm() {
    document.getElementById('fin-account-form')?.classList.add('hidden');
    ['fa-name','fa-bank','fa-balance'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  }
  function saveAccount() {
    const name    = document.getElementById('fa-name')?.value.trim();
    if (!name) { document.getElementById('fa-name')?.focus(); return; }
    const initial = parseFloat(document.getElementById('fa-balance')?.value) || 0;
    Store.insert('bank_accounts', {
      name,
      bank:            document.getElementById('fa-bank')?.value.trim() || '',
      balance:         initial,
      opening_balance: initial,
      type:            document.getElementById('fa-type')?.value     || 'Chequing',
      currency:        document.getElementById('fa-currency')?.value || 'XCD',
    });
    hideAccountForm();
    renderAccounts();
    renderMetrics();
  }
  function updateBalance(id) {
    const current = Store.getAll('bank_accounts').find(a => a.id === id);
    if (!current) return;
    const val = prompt(`Update balance for ${current.name}:`, current.balance);
    if (val === null) return;
    const amount = parseFloat(val);
    if (isNaN(amount)) return;
    Store.update('bank_accounts', id, { balance: amount, last_updated: new Date().toISOString() });
    renderAccounts();
    renderMetrics();
  }
  function deleteAccount(id) {
    Store.delete('bank_accounts', id);
    renderAccounts();
    renderMetrics();
  }

  /* ── CR-011: Account transfers ── */
  function showTransferForm() {
    // Populate from/to dropdowns
    const accounts = Store.getAll('bank_accounts');
    const opts = accounts.map(a=>`<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
    const fromSel = document.getElementById('ft-from');
    const toSel   = document.getElementById('ft-to');
    if (fromSel) fromSel.innerHTML = '<option value="">from account...</option>' + opts;
    if (toSel)   toSel.innerHTML   = '<option value="">to account...</option>'   + opts;
    document.getElementById('fin-transfer-form')?.classList.remove('hidden');
  }
  function hideTransferForm() {
    document.getElementById('fin-transfer-form')?.classList.add('hidden');
    ['ft-amount','ft-note'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  }
  function saveTransfer() {
    const fromId = parseInt(document.getElementById('ft-from')?.value);
    const toId   = parseInt(document.getElementById('ft-to')?.value);
    const amount = parseFloat(document.getElementById('ft-amount')?.value)||0;
    const note   = document.getElementById('ft-note')?.value.trim()||'';
    const date   = new Date().toISOString().split('T')[0];
    if (!fromId||!toId||!amount||fromId===toId) return;

    const accounts = Store.getAll('bank_accounts');
    const from = accounts.find(a=>a.id===fromId);
    const to   = accounts.find(a=>a.id===toId);
    if (!from||!to) return;

    // Debit from-account
    Store.update('bank_accounts', fromId, { balance: (parseFloat(from.balance)||0)-amount });
    // Credit to-account
    Store.update('bank_accounts', toId,   { balance: (parseFloat(to.balance)||0)+amount });

    // Log transfer
    Store.insert('account_transfers', {
      from_id:    fromId,
      to_id:      toId,
      amount,
      date,
      note,
      from_name:  from.name,
      to_name:    to.name,
    });

    if (window.electronAPI?.notify) {
      window.electronAPI.notify('Transfer complete', `$${amount.toLocaleString()} from ${from.name} to ${to.name}`, false);
    }

    hideTransferForm();
    renderAccounts();
    renderMetrics();
  }

  /* ── Account detail helpers ── */
  function _buildLedger(id) {
    const income    = Store.getAll('income').filter(i => parseInt(i.account_id) === id);
    const expenses  = Store.getAll('expenses').filter(e => parseInt(e.account_id) === id);
    const transfers = Store.getAll('account_transfers').filter(t => t.from_id === id || t.to_id === id);
    const subs      = Store.getAll('subscriptions').filter(s => parseInt(s.account_id) === id);
    const ledger    = [];

    income.forEach(i => ledger.push({
      date: i.received_date || (i.created_at || '').split('T')[0] || '',
      label: i.source + (i.notes ? ' — ' + i.notes : ''),
      amount: parseFloat(i.amount_xcd) || 0,
      type: 'credit', srcType: 'income', srcId: i.id,
    }));
    expenses.forEach(e => ledger.push({
      date: e.expense_date || (e.created_at || '').split('T')[0] || '',
      label: e.item || '—',
      amount: -(parseFloat(e.amount_xcd) || 0),
      type: 'debit', srcType: 'expense', srcId: e.id,
    }));
    transfers.forEach(t => {
      if (t.to_id === id) {
        ledger.push({ date: t.date, label: 'Transfer from ' + t.from_name + (t.note ? ' · ' + t.note : ''), amount: parseFloat(t.amount) || 0, type: 'credit', srcType: 'transfer', srcId: t.id });
      } else {
        ledger.push({ date: t.date, label: 'Transfer to ' + t.to_name + (t.note ? ' · ' + t.note : ''), amount: -(parseFloat(t.amount) || 0), type: 'debit', srcType: 'transfer', srcId: t.id });
      }
    });
    subs.forEach(s => ledger.push({
      date: s.last_processed || '',
      label: s.name + ' (subscription)',
      amount: -(parseFloat(s.cost) || 0),
      type: 'debit', srcType: 'subscription', srcId: s.id,
    }));

    ledger.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    });
    return ledger;
  }

  function _getOpeningBalance(account, ledger) {
    if (account.opening_balance != null) return parseFloat(account.opening_balance) || 0;
    const totalMovements = ledger.reduce((s, r) => s + r.amount, 0);
    return (parseFloat(account.balance) || 0) - totalMovements;
  }

  function _genMonthOptions(selectedKey) {
    const now  = new Date();
    const opts = [];
    for (let i = -36; i <= 6; i++) {
      const d   = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = d.toISOString().substring(0, 7);
      const lbl = d.toLocaleDateString('en-AG', { month: 'long', year: 'numeric' });
      opts.push(`<option value="${key}"${key === selectedKey ? ' selected' : ''}>${lbl}</option>`);
    }
    return opts.join('');
  }

  /* ── Account overview modal (month filter) ── */
  function openAccountDetail(id, selectedMonth) {
    const account = Store.getAll('bank_accounts').find(a => a.id === id);
    if (!account) return;

    const currentKey = new Date().toISOString().substring(0, 7);
    const month      = selectedMonth || currentKey;
    const ledger     = _buildLedger(id);
    const openBal    = _getOpeningBalance(account, ledger);

    const balAtStart = openBal + ledger
      .filter(r => r.date && r.date.substring(0, 7) < month)
      .reduce((s, r) => s + r.amount, 0);

    const filtered = ledger.filter(r => r.date && r.date.substring(0, 7) === month);

    let running = balAtStart;
    const rows = filtered.map(row => {
      running += row.amount;
      const cls     = row.amount >= 0 ? 'green' : 'red';
      const sign    = row.amount >= 0 ? '+' : '';
      const dateStr = new Date(row.date + 'T00:00:00').toLocaleDateString('en-AG', { day: 'numeric', month: 'short', year: 'numeric' });
      return `<tr>
        <td class="fg3" style="font-size:10px;white-space:nowrap">${dateStr}</td>
        <td class="fg" style="font-size:11px">${escapeHtml(row.label)}</td>
        <td class="num ${cls}" style="white-space:nowrap">${sign}$${Math.abs(row.amount).toLocaleString()}</td>
        <td class="num white" style="white-space:nowrap">$${running.toLocaleString()}</td>
      </tr>`;
    }).join('');

    const monthLabel = new Date(month + '-01T00:00:00').toLocaleDateString('en-AG', { month: 'long', year: 'numeric' });
    const bal        = parseFloat(account.balance) || 0;

    let modal = document.getElementById('account-detail-modal');
    if (!modal) {
      modal           = document.createElement('div');
      modal.id        = 'account-detail-modal';
      modal.className = 'account-modal';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="account-modal-inner">
        <div class="account-modal-header">
          <div>
            <div style="font-size:16px;font-weight:500;color:var(--fg)">${escapeHtml(account.name)}</div>
            <div style="font-size:11px;color:var(--fg3)">${escapeHtml(account.bank || '')} · ${account.type} · ${account.currency || 'XCD'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <div style="text-align:right">
              <div style="font-size:9px;color:var(--fg3);text-transform:uppercase;letter-spacing:.08em">current balance</div>
              <div style="font-size:24px;font-weight:700;color:${bal >= 0 ? 'var(--green)' : 'var(--red)'}">\$${bal.toLocaleString()}</div>
            </div>
            <button class="task-del" onclick="document.getElementById('account-detail-modal').classList.add('hidden')" style="font-size:18px">
              <i class="ti ti-x" aria-hidden="true"></i>
            </button>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;padding:10px 20px;border-bottom:0.5px solid var(--border);flex-wrap:wrap">
          <span style="font-size:10px;color:var(--fg3);text-transform:uppercase;letter-spacing:.06em">month</span>
          <select class="t-input" style="width:170px" onchange="Finance.openAccountDetail(${id}, this.value)">
            ${_genMonthOptions(month)}
          </select>
          <button class="t-btn" style="font-size:10px;padding:4px 14px;margin-left:auto"
            onclick="document.getElementById('account-detail-modal').classList.add('hidden');Finance.openAccountPage(${id})">
            see all transactions →
          </button>
        </div>
        <div style="padding:8px 20px;font-size:10px;color:var(--fg3)">
          opening balance — ${monthLabel}: <span style="color:var(--fg)">$${balAtStart.toLocaleString()} XCD</span>
        </div>
        <div class="blem-table-wrap" style="max-height:340px;overflow-y:auto">
          <table class="blem-table">
            <thead><tr><th>date</th><th>description</th><th>amount (xcd)</th><th>balance (xcd)</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="4" class="blem-empty">no transactions in ${monthLabel}</td></tr>`}</tbody>
          </table>
        </div>
      </div>`;
    modal.classList.remove('hidden');
  }

  /* ── Full-page account view ── */
  function openAccountPage(id) {
    const account = Store.getAll('bank_accounts').find(a => a.id === id);
    if (!account) return;

    const currentKey = new Date().toISOString().substring(0, 7);
    const typePill   = { Chequing:'pill-cyan', Savings:'pill-green', Business:'pill-amber', 'Credit Card':'pill-red', Other:'pill-gray' }[account.type] || 'pill-gray';
    const bal        = parseFloat(account.balance) || 0;

    let page = document.getElementById('account-page-overlay');
    if (!page) {
      page           = document.createElement('div');
      page.id        = 'account-page-overlay';
      page.className = 'acct-page hidden';
      document.body.appendChild(page);
    }

    page.innerHTML = `
      <div class="acct-page-inner">
        <div class="acct-page-header">
          <div style="display:flex;align-items:center;gap:14px">
            <button class="task-del" onclick="Finance.closeAccountPage()" style="font-size:20px" title="Back">
              <i class="ti ti-arrow-left" aria-hidden="true"></i>
            </button>
            <div>
              <div style="font-size:18px;font-weight:600;color:var(--fg)">${escapeHtml(account.name)}</div>
              <div style="font-size:11px;color:var(--fg3);display:flex;align-items:center;gap:6px;margin-top:3px">
                <span class="pill ${typePill}">${account.type}</span>
                ${account.bank ? `<span>${escapeHtml(account.bank)}</span>` : ''}
                <span>${account.currency || 'XCD'}</span>
              </div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:9px;color:var(--fg3);text-transform:uppercase;letter-spacing:.08em">current balance</div>
            <div style="font-size:28px;font-weight:700;color:${bal >= 0 ? 'var(--green)' : 'var(--red)'}">\$${bal.toLocaleString()} <span style="font-size:13px;font-weight:400;color:var(--fg3)">${account.currency || 'XCD'}</span></div>
          </div>
        </div>
        <div class="acct-page-toolbar">
          <span style="font-size:10px;color:var(--fg3);text-transform:uppercase;letter-spacing:.06em">from</span>
          <select class="t-input" id="acct-from-month" style="width:160px">${_genMonthOptions(currentKey)}</select>
          <span style="font-size:10px;color:var(--fg3)">to</span>
          <select class="t-input" id="acct-to-month" style="width:160px">${_genMonthOptions(currentKey)}</select>
          <button class="t-btn" style="font-size:10px;padding:4px 14px" onclick="Finance.applyAccountPageFilter(${id})">apply</button>
          <button class="t-btn-ghost" style="font-size:10px;padding:4px 14px" onclick="Finance.applyAccountPageFilter(${id}, true)">all time</button>
          <button class="t-btn" style="font-size:10px;padding:4px 14px;margin-left:auto;color:var(--green);border-color:var(--green)" onclick="Finance.showAccountPageTxnForm()">+ new transaction</button>
        </div>
        <div class="hidden" id="acct-page-new-txn" style="background:var(--bg1);border-bottom:.5px solid var(--border);padding:12px 20px">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <select class="t-input" id="anew-type" style="width:110px" onchange="Finance.toggleAccountPageTxnType()">
              <option value="income">income</option>
              <option value="expense">expense</option>
            </select>
            <div id="anew-income-fields" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <select class="t-input" id="anew-source" style="width:160px">
                <option>Silcomm Engineering</option>
                <option>NovaTrust</option>
                <option>Blem Tuned</option>
                <option>Younity Consultancy</option>
                <option>Blueport Agency</option>
                <option>OS Builder</option>
                <option>Other</option>
              </select>
            </div>
            <div id="anew-expense-fields" style="display:none;align-items:center;gap:8px;flex-wrap:wrap">
              <input class="t-input" id="anew-item" placeholder="item description" style="width:180px" />
              <select class="t-input" id="anew-category" style="width:130px">
                <option>Insurance</option><option>Fuel</option><option>Food</option>
                <option>Utilities</option><option>Business Expense</option>
                <option>Study</option><option>Gym</option><option>Personal</option><option>Other</option>
              </select>
            </div>
            <input class="t-input" id="anew-amount" type="number" placeholder="amount (XCD)" style="width:130px" />
            <input class="t-input" id="anew-date" type="date" style="width:140px" />
            <input class="t-input" id="anew-notes" placeholder="notes" style="width:160px" />
            <button class="t-btn" style="font-size:10px;padding:4px 14px" onclick="Finance.saveAccountPageTxn(${id})">save</button>
            <button class="t-btn-ghost" style="font-size:10px;padding:4px 12px" onclick="Finance.hideAccountPageTxnForm()">cancel</button>
          </div>
        </div>
        <div class="blem-table-wrap" style="flex:1;overflow-y:auto;padding:0" id="acct-page-table-wrap"></div>
      </div>`;

    page.classList.remove('hidden');
    renderAccountPageTable(id, currentKey, currentKey);
  }

  function renderAccountPageTable(id, fromKey, toKey) {
    const account = Store.getAll('bank_accounts').find(a => a.id === id);
    if (!account) return;

    const ledger  = _buildLedger(id);
    const openBal = _getOpeningBalance(account, ledger);

    const balAtStart = !fromKey ? openBal : openBal + ledger
      .filter(r => r.date && r.date.substring(0, 7) < fromKey)
      .reduce((s, r) => s + r.amount, 0);

    const filtered = ledger.filter(r => {
      if (!r.date) return false;
      const m = r.date.substring(0, 7);
      if (fromKey && m < fromKey) return false;
      if (toKey   && m > toKey)   return false;
      return true;
    });

    const fromLabel = fromKey
      ? new Date(fromKey + '-01T00:00:00').toLocaleDateString('en-AG', { month: 'short', year: 'numeric' })
      : 'All time';

    let running = balAtStart;
    const rows = filtered.map(row => {
      running += row.amount;
      const cls     = row.amount >= 0 ? 'green' : 'red';
      const sign    = row.amount >= 0 ? '+' : '';
      const dateStr = row.date
        ? new Date(row.date + 'T00:00:00').toLocaleDateString('en-AG', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—';
      return `<tr id="acct-txn-row-${row.srcType}-${row.srcId}">
        <td class="fg3" style="font-size:10px;white-space:nowrap">${dateStr}</td>
        <td class="fg" style="font-size:11px">${escapeHtml(row.label)}</td>
        <td style="font-size:9px"><span class="pill ${row.type === 'credit' ? 'pill-green' : 'pill-red'}">${row.srcType}</span></td>
        <td class="num ${cls}" style="white-space:nowrap">${sign}$${Math.abs(row.amount).toLocaleString()}</td>
        <td class="num white" style="white-space:nowrap">$${running.toLocaleString()}</td>
        <td style="white-space:nowrap">
          <button class="task-del" onclick="Finance.editAccountTxn('${row.srcType}',${row.srcId},${id})" aria-label="Edit"><i class="ti ti-pencil"></i></button>
        </td>
      </tr>`;
    }).join('');

    const wrap = document.getElementById('acct-page-table-wrap');
    if (!wrap) return;

    wrap.innerHTML = `
      <table class="blem-table">
        <thead>
          <tr><th>date</th><th>description</th><th>type</th><th>amount (xcd)</th><th>balance (xcd)</th><th></th></tr>
        </thead>
        <tbody>
          <tr class="acct-opening-row" id="acct-txn-row-opening-${id}">
            <td class="fg3" style="font-size:10px">—</td>
            <td style="font-size:11px;font-style:italic;color:var(--fg3)">Opening balance (${fromLabel})</td>
            <td><span class="pill pill-gray" style="font-size:8px">opening</span></td>
            <td class="num white">$${openBal.toLocaleString()}</td>
            <td class="num white">$${balAtStart.toLocaleString()}</td>
            <td style="white-space:nowrap">
              <button class="task-del" onclick="Finance.editAccountTxn('opening',${id},${id})" aria-label="Edit opening balance"><i class="ti ti-pencil"></i></button>
            </td>
          </tr>
          ${rows || '<tr><td colspan="6" class="blem-empty">no transactions in this period</td></tr>'}
        </tbody>
      </table>`;
  }

  function applyAccountPageFilter(id, allTime) {
    const from = allTime ? null : (document.getElementById('acct-from-month')?.value || null);
    const to   = allTime ? null : (document.getElementById('acct-to-month')?.value   || null);
    if (from && to && from > to) {
      renderAccountPageTable(id, to, from);
    } else {
      renderAccountPageTable(id, from, to);
    }
  }

  function showAccountPageTxnForm() {
    const form = document.getElementById('acct-page-new-txn');
    if (!form) return;
    form.classList.remove('hidden');
    const dateEl = document.getElementById('anew-date');
    if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
    document.getElementById('anew-amount')?.focus();
  }

  function hideAccountPageTxnForm() {
    const form = document.getElementById('acct-page-new-txn');
    if (form) form.classList.add('hidden');
    ['anew-amount','anew-date','anew-notes','anew-item'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const typeEl = document.getElementById('anew-type');
    if (typeEl) { typeEl.value = 'income'; toggleAccountPageTxnType(); }
  }

  function toggleAccountPageTxnType() {
    const type      = document.getElementById('anew-type')?.value;
    const incFields = document.getElementById('anew-income-fields');
    const expFields = document.getElementById('anew-expense-fields');
    if (incFields) incFields.style.display = type === 'income'  ? 'flex' : 'none';
    if (expFields) expFields.style.display = type === 'expense' ? 'flex' : 'none';
  }

  function saveAccountPageTxn(accountId) {
    const type   = document.getElementById('anew-type')?.value;
    const amount = parseFloat(document.getElementById('anew-amount')?.value) || 0;
    const date   = document.getElementById('anew-date')?.value || new Date().toISOString().split('T')[0];
    const notes  = document.getElementById('anew-notes')?.value.trim() || '';
    if (!amount) { document.getElementById('anew-amount')?.focus(); return; }

    if (type === 'income') {
      const source = document.getElementById('anew-source')?.value || 'Other';
      Store.insert('income', { source, category: 'Other', amount_xcd: amount, received_date: date, notes, account_id: accountId });
      const acct = Store.getAll('bank_accounts').find(a => a.id === accountId);
      if (acct) Store.update('bank_accounts', accountId, { balance: (parseFloat(acct.balance)||0) + amount });
    } else {
      const item     = document.getElementById('anew-item')?.value.trim() || 'Expense';
      const category = document.getElementById('anew-category')?.value || 'Other';
      Store.insert('expenses', { item, category, amount_xcd: amount, expense_date: date, notes, account_id: accountId });
      const acct = Store.getAll('bank_accounts').find(a => a.id === accountId);
      if (acct) Store.update('bank_accounts', accountId, { balance: (parseFloat(acct.balance)||0) - amount });
    }

    hideAccountPageTxnForm();
    const from = document.getElementById('acct-from-month')?.value || null;
    const to   = document.getElementById('acct-to-month')?.value   || null;
    renderAccountPageTable(accountId, from, to);
    renderAccounts();
    renderIncome();
    renderExpenses();
    renderMetrics();

    // Refresh balance in page header
    const account = Store.getAll('bank_accounts').find(a => a.id === accountId);
    if (account) {
      const bal    = parseFloat(account.balance) || 0;
      const balDiv = document.querySelector('#account-page-overlay [style*="font-size:28px"]');
      if (balDiv) balDiv.innerHTML = `\$${bal.toLocaleString()} <span style="font-size:13px;font-weight:400;color:var(--fg3)">${account.currency || 'XCD'}</span>`;
    }
  }

  function closeAccountPage() {
    document.getElementById('account-page-overlay')?.classList.add('hidden');
  }

  function editAccountTxn(srcType, srcId, accountId) {
    document.querySelectorAll('.acct-txn-edit-row').forEach(r => r.remove());
    const row = document.getElementById(`acct-txn-row-${srcType}-${srcId}`);
    if (!row) return;

    let fields = '';
    if (srcType === 'income') {
      const rec = Store.getAll('income').find(r => r.id === srcId);
      if (!rec) return;
      const sources = ['Silcomm Engineering','NovaTrust','Blem Tuned','Younity Consultancy','Blueport Agency','OS Builder','Other'];
      fields = `<td colspan="6"><div class="acct-edit-form">
        <select class="t-input" id="atxn-source" style="flex:0 0 auto">
          ${sources.map(s => `<option value="${s}"${rec.source===s?' selected':''}>${s}</option>`).join('')}
        </select>
        <input class="t-input" id="atxn-amount" type="number" value="${rec.amount_xcd||''}" placeholder="amount" style="width:110px" />
        <input class="t-input" id="atxn-date" type="date" value="${rec.received_date||''}" style="width:140px" />
        <input class="t-input" id="atxn-notes" placeholder="notes" value="${escapeHtml(rec.notes||'')}" style="flex:1;min-width:80px" />
        <button class="t-btn" style="font-size:10px;padding:4px 12px" onclick="Finance.saveAccountTxn('income',${srcId},${accountId})">save</button>
        <button class="t-btn-ghost" style="font-size:10px;padding:4px 10px" onclick="Finance.cancelAccountTxnEdit()">cancel</button>
      </div></td>`;
    } else if (srcType === 'expense') {
      const rec  = Store.getAll('expenses').find(r => r.id === srcId);
      if (!rec) return;
      const cats = ['Insurance','Fuel','Food','Utilities','Business Expense','Study','Gym','Personal','Other'];
      fields = `<td colspan="6"><div class="acct-edit-form">
        <input class="t-input" id="atxn-item" placeholder="item" value="${escapeHtml(rec.item||'')}" style="flex:2;min-width:100px" />
        <select class="t-input" id="atxn-category" style="flex:0 0 auto">
          ${cats.map(c => `<option value="${c}"${rec.category===c?' selected':''}>${c}</option>`).join('')}
        </select>
        <input class="t-input" id="atxn-amount" type="number" value="${rec.amount_xcd||''}" placeholder="amount" style="width:110px" />
        <input class="t-input" id="atxn-date" type="date" value="${rec.expense_date||''}" style="width:140px" />
        <input class="t-input" id="atxn-notes" placeholder="notes" value="${escapeHtml(rec.notes||'')}" style="flex:1;min-width:80px" />
        <button class="t-btn" style="font-size:10px;padding:4px 12px" onclick="Finance.saveAccountTxn('expense',${srcId},${accountId})">save</button>
        <button class="t-btn-ghost" style="font-size:10px;padding:4px 10px" onclick="Finance.cancelAccountTxnEdit()">cancel</button>
      </div></td>`;
    } else if (srcType === 'transfer') {
      const rec = Store.getAll('account_transfers').find(r => r.id === srcId);
      if (!rec) return;
      const dir = rec.to_id === accountId ? `from ${escapeHtml(rec.from_name)}` : `to ${escapeHtml(rec.to_name)}`;
      fields = `<td colspan="6"><div class="acct-edit-form">
        <span style="font-size:10px;color:var(--fg3)">transfer ${dir}</span>
        <input class="t-input" id="atxn-amount" type="number" value="${rec.amount||''}" placeholder="amount" style="width:120px" />
        <input class="t-input" id="atxn-notes" placeholder="note" value="${escapeHtml(rec.note||'')}" style="flex:1;min-width:80px" />
        <button class="t-btn" style="font-size:10px;padding:4px 12px" onclick="Finance.saveAccountTxn('transfer',${srcId},${accountId})">save</button>
        <button class="t-btn-ghost" style="font-size:10px;padding:4px 10px" onclick="Finance.cancelAccountTxnEdit()">cancel</button>
      </div></td>`;
    } else if (srcType === 'subscription') {
      const rec = Store.getAll('subscriptions').find(r => r.id === srcId);
      if (!rec) return;
      fields = `<td colspan="6"><div class="acct-edit-form">
        <input class="t-input" id="atxn-sub-name" placeholder="subscription name" value="${escapeHtml(rec.name||'')}" style="flex:2;min-width:100px" />
        <input class="t-input" id="atxn-amount" type="number" value="${rec.cost||''}" placeholder="cost" style="width:110px" />
        <input class="t-input" id="atxn-date" type="date" value="${rec.renewal_date||''}" placeholder="next renewal" style="width:140px" />
        <button class="t-btn" style="font-size:10px;padding:4px 12px" onclick="Finance.saveAccountTxn('subscription',${srcId},${accountId})">save</button>
        <button class="t-btn-ghost" style="font-size:10px;padding:4px 10px" onclick="Finance.cancelAccountTxnEdit()">cancel</button>
      </div></td>`;
    } else if (srcType === 'opening') {
      // srcId == accountId for opening balance
      const account = Store.getAll('bank_accounts').find(a => a.id === srcId);
      if (!account) return;
      const ledger  = _buildLedger(srcId);
      const openBal = _getOpeningBalance(account, ledger);
      fields = `<td colspan="6"><div class="acct-edit-form">
        <span style="font-size:10px;color:var(--fg3)">account opening balance</span>
        <input class="t-input" id="atxn-opening" type="number" value="${openBal}" placeholder="opening balance (XCD)" style="width:180px" />
        <button class="t-btn" style="font-size:10px;padding:4px 12px" onclick="Finance.saveAccountTxn('opening',${srcId},${accountId})">save</button>
        <button class="t-btn-ghost" style="font-size:10px;padding:4px 10px" onclick="Finance.cancelAccountTxnEdit()">cancel</button>
      </div></td>`;
    }

    if (fields) {
      const editRow       = document.createElement('tr');
      editRow.className   = 'acct-txn-edit-row';
      editRow.innerHTML   = fields;
      row.after(editRow);
      editRow.querySelector('.t-input')?.focus();
    }
  }

  function saveAccountTxn(srcType, srcId, accountId) {
    const amount = parseFloat(document.getElementById('atxn-amount')?.value) || 0;
    const date   = document.getElementById('atxn-date')?.value || '';
    const notes  = document.getElementById('atxn-notes')?.value || '';

    if (srcType === 'income') {
      const old    = Store.getAll('income').find(r => r.id === srcId);
      if (!old) return;
      const source = document.getElementById('atxn-source')?.value || old.source;
      if (old.account_id) {
        const acct = Store.getAll('bank_accounts').find(a => a.id === parseInt(old.account_id));
        if (acct) Store.update('bank_accounts', acct.id, { balance: (parseFloat(acct.balance)||0) - (parseFloat(old.amount_xcd)||0) });
      }
      Store.update('income', srcId, { source, amount_xcd: amount, received_date: date, notes });
      if (old.account_id) {
        const acct = Store.getAll('bank_accounts').find(a => a.id === parseInt(old.account_id));
        if (acct) Store.update('bank_accounts', acct.id, { balance: (parseFloat(acct.balance)||0) + amount });
      }
    } else if (srcType === 'expense') {
      const old      = Store.getAll('expenses').find(r => r.id === srcId);
      if (!old) return;
      const item     = document.getElementById('atxn-item')?.value.trim() || old.item;
      const category = document.getElementById('atxn-category')?.value || old.category;
      if (old.account_id) {
        const acct = Store.getAll('bank_accounts').find(a => a.id === parseInt(old.account_id));
        if (acct) Store.update('bank_accounts', acct.id, { balance: (parseFloat(acct.balance)||0) + (parseFloat(old.amount_xcd)||0) });
      }
      Store.update('expenses', srcId, { item, category, amount_xcd: amount, expense_date: date, notes });
      if (old.account_id) {
        const acct = Store.getAll('bank_accounts').find(a => a.id === parseInt(old.account_id));
        if (acct) Store.update('bank_accounts', acct.id, { balance: (parseFloat(acct.balance)||0) - amount });
      }
    } else if (srcType === 'transfer') {
      const t = Store.getAll('account_transfers').find(r => r.id === srcId);
      if (!t) return;
      const newAmount = parseFloat(document.getElementById('atxn-amount')?.value) || 0;
      const newNote   = document.getElementById('atxn-notes')?.value || '';
      const oldAmount = parseFloat(t.amount) || 0;
      // Reverse old balance effects on both accounts
      let accts = Store.getAll('bank_accounts');
      const fromA = accts.find(a => a.id === t.from_id);
      const toA   = accts.find(a => a.id === t.to_id);
      if (fromA) Store.update('bank_accounts', fromA.id, { balance: (parseFloat(fromA.balance)||0) + oldAmount });
      if (toA)   Store.update('bank_accounts', toA.id,   { balance: (parseFloat(toA.balance)||0)   - oldAmount });
      Store.update('account_transfers', srcId, { amount: newAmount, note: newNote });
      // Apply new balance effects
      accts = Store.getAll('bank_accounts');
      const fromB = accts.find(a => a.id === t.from_id);
      const toB   = accts.find(a => a.id === t.to_id);
      if (fromB) Store.update('bank_accounts', fromB.id, { balance: (parseFloat(fromB.balance)||0) - newAmount });
      if (toB)   Store.update('bank_accounts', toB.id,   { balance: (parseFloat(toB.balance)||0)   + newAmount });
    } else if (srcType === 'subscription') {
      const rec  = Store.getAll('subscriptions').find(r => r.id === srcId);
      if (!rec) return;
      const name = document.getElementById('atxn-sub-name')?.value.trim() || rec.name;
      const cost = parseFloat(document.getElementById('atxn-amount')?.value) || 0;
      const renewal = document.getElementById('atxn-date')?.value || rec.renewal_date;
      Store.update('subscriptions', srcId, { name, cost, renewal_date: renewal });
    } else if (srcType === 'opening') {
      // srcId == accountId
      const account = Store.getAll('bank_accounts').find(a => a.id === srcId);
      if (!account) return;
      const newOpenBal     = parseFloat(document.getElementById('atxn-opening')?.value) || 0;
      const ledger         = _buildLedger(srcId);
      const totalMovements = ledger.reduce((s, r) => s + r.amount, 0);
      Store.update('bank_accounts', srcId, { opening_balance: newOpenBal, balance: newOpenBal + totalMovements });
    }

    cancelAccountTxnEdit();
    const from = document.getElementById('acct-from-month')?.value || null;
    const to   = document.getElementById('acct-to-month')?.value   || null;
    renderAccountPageTable(accountId, from, to);
    renderAccounts();
    renderIncome();
    renderExpenses();
    renderSubscriptions();
    renderMetrics();
  }

  function cancelAccountTxnEdit() {
    document.querySelectorAll('.acct-txn-edit-row').forEach(r => r.remove());
  }

  /* ── Subscriptions ── */
  function renderSubscriptions() {
    const tbody   = document.getElementById('fin-sub-tbody');
    const totalEl = document.getElementById('fin-sub-total');
    if (!tbody) return;

    const subs     = Store.getAll('subscriptions');
    const accounts = Store.getAll('bank_accounts');
    const monthly  = subs.reduce((s,sub) => {
      const cost = parseFloat(sub.cost) || 0;
      if (sub.cycle === 'Annual')    return s + cost/12;
      if (sub.cycle === 'Weekly')    return s + cost*4.33;
      if (sub.cycle === 'Quarterly') return s + cost/3;
      return s + cost;
    }, 0);

    if (totalEl) totalEl.textContent = '$' + monthly.toFixed(2) + ' XCD/mo equiv.';

    if (!subs.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="blem-empty">no subscriptions yet</td></tr>';
      return;
    }

    tbody.innerHTML = subs.map(sub => {
      const days    = sub.renewal_date ? Math.ceil((new Date(sub.renewal_date+'T00:00:00') - new Date()) / 86400000) : null;
      const urgent  = days !== null && days <= 3 && days >= 0;
      const overdue = days !== null && days < 0;
      const acct    = accounts.find(a => a.id === parseInt(sub.account_id));
      const dayCls  = overdue ? 'red' : urgent ? 'amber' : 'fg2';
      const dayStr  = days === null ? '—' : overdue ? 'overdue' : days === 0 ? 'today' : days + 'd';

      return `<tr class="${urgent||overdue ? 'fin-highlight-row' : ''}">
        <td class="white">${escapeHtml(sub.name)}</td>
        <td class="amber num">$${parseFloat(sub.cost||0).toLocaleString()}</td>
        <td class="fg2" style="font-size:10px">${sub.cycle}</td>
        <td class="${dayCls}" style="font-size:10px;white-space:nowrap">
          ${sub.renewal_date ? formatDate(sub.renewal_date) + ' · ' + dayStr : '—'}
        </td>
        <td class="fg3" style="font-size:10px">${acct ? escapeHtml(acct.name) : '—'}</td>
        <td style="font-size:10px"><span class="pill pill-gray">${sub.category||'Other'}</span></td>
        <td>
          <button class="task-del" onclick="Finance.deleteSub(${sub.id})" aria-label="Delete">
            <i class="ti ti-x" aria-hidden="true"></i>
          </button>
        </td>
      </tr>`;
    }).join('');
  }

  function showSubForm() {
    renderAccounts(); // populate account dropdown
    document.getElementById('fin-sub-form')?.classList.remove('hidden');
    document.getElementById('fs-name')?.focus();
  }
  function hideSubForm() {
    document.getElementById('fin-sub-form')?.classList.add('hidden');
    ['fs-name','fs-cost','fs-renewal'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  }
  function _advanceDate(d, cycle) {
    if (cycle === 'Monthly')    d.setMonth(d.getMonth() + 1);
    else if (cycle === 'Annual')     d.setFullYear(d.getFullYear() + 1);
    else if (cycle === 'Weekly')     d.setDate(d.getDate() + 7);
    else if (cycle === 'Quarterly')  d.setMonth(d.getMonth() + 3);
  }

  function saveSub() {
    const name = document.getElementById('fs-name')?.value.trim();
    if (!name) { document.getElementById('fs-name')?.focus(); return; }
    const cycle        = document.getElementById('fs-cycle')?.value || 'Monthly';
    const renewalInput = document.getElementById('fs-renewal')?.value || null;
    const today        = new Date().toISOString().split('T')[0];

    let renewal_date   = renewalInput;
    let last_processed = null;

    // If the entered renewal date is today or already past, advance it to the next
    // future occurrence so checkRenewals() doesn't fire the moment it's entered.
    if (renewalInput && renewalInput <= today) {
      const d = new Date(renewalInput + 'T00:00:00');
      let guard = 0;
      do { _advanceDate(d, cycle); guard++; } while (d.toISOString().split('T')[0] <= today && guard < 60);
      renewal_date   = d.toISOString().split('T')[0];
      last_processed = today;
    }

    Store.insert('subscriptions', {
      name,
      cost:         parseFloat(document.getElementById('fs-cost')?.value) || 0,
      cycle,
      renewal_date,
      last_processed,
      account_id:   document.getElementById('fs-account')?.value || null,
      category:     document.getElementById('fs-category')?.value || 'Other',
    });
    hideSubForm();
    renderSubscriptions();
    renderMetrics();
  }
  function deleteSub(id) {
    Store.delete('subscriptions', id);
    renderSubscriptions();
    renderMetrics();
  }

  /* ── Auto-renewal checker ── */
  function checkRenewals() {
    const subs     = Store.getAll('subscriptions');
    const accounts = Store.getAll('bank_accounts');
    const today    = new Date().toISOString().split('T')[0];

    subs.forEach(sub => {
      if (!sub.renewal_date) return;
      const days = Math.ceil((new Date(sub.renewal_date+'T00:00:00') - new Date()) / 86400000);

      // 3-day warning
      if (days === 3 || days === 1) {
        if (window.electronAPI?.notify) {
          window.electronAPI.notify(
            '🔔 Subscription renewing soon',
            `${sub.name} — $${sub.cost} XCD renews in ${days} day${days>1?'s':''}`,
            false
          );
        }
      }

      // Auto-process on renewal date
      if (days <= 0 && sub.renewal_date <= today && !sub.last_processed?.startsWith(today)) {
        // Create expense entry
        Store.insert('expenses', {
          item:         sub.name + ' subscription',
          category:     sub.category || 'Subscription',
          amount_xcd:   sub.cost,
          expense_date: today,
          notes:        'Auto-created by subscription renewal',
          is_business:  sub.category === 'Business',
        });

        // Deduct from linked bank account
        if (sub.account_id) {
          const acct = accounts.find(a => a.id === parseInt(sub.account_id));
          if (acct) {
            Store.update('bank_accounts', acct.id, {
              balance: (parseFloat(acct.balance)||0) - (parseFloat(sub.cost)||0)
            });
          }
        }

        // Advance renewal date
        const nextDate = new Date(sub.renewal_date+'T00:00:00');
        if (sub.cycle === 'Monthly')    nextDate.setMonth(nextDate.getMonth() + 1);
        if (sub.cycle === 'Annual')     nextDate.setFullYear(nextDate.getFullYear() + 1);
        if (sub.cycle === 'Weekly')     nextDate.setDate(nextDate.getDate() + 7);
        if (sub.cycle === 'Quarterly')  nextDate.setMonth(nextDate.getMonth() + 3);

        Store.update('subscriptions', sub.id, {
          renewal_date:   nextDate.toISOString().split('T')[0],
          last_processed: today,
        });

        // Notify
        if (window.electronAPI?.notify) {
          window.electronAPI.notify(
            '💳 Subscription renewed',
            `${sub.name} — $${sub.cost} XCD charged. Next renewal: ${nextDate.toLocaleDateString('en-AG',{day:'numeric',month:'short',year:'numeric'})}`,
            false
          );
        }
      }
    });

    renderSubscriptions();
    renderAccounts();
    renderExpenses();
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr+'T00:00:00').toLocaleDateString('en-AG',{day:'numeric',month:'short',year:'numeric'});
  }

  function renderAll() {
    renderMetrics();
    renderCommitments();
    renderIncome();
    renderExpenses();
    renderAccounts();
    renderSubscriptions();
    if (typeof Charts !== 'undefined') {
      Charts.renderNetIncomeChart('chart-net-income');
    }
  }

  function getStats() {
    const now = new Date();
    const thisMonth = d => { if (!d) return false; const x = new Date(d); return x.getMonth() === now.getMonth() && x.getFullYear() === now.getFullYear(); };
    const income   = Store.getAll('income').filter(i => thisMonth(i.received_date)).reduce((s, i) => s + (parseFloat(i.amount_xcd) || 0), 0);
    const expenses = Store.getAll('expenses').filter(e => thisMonth(e.expense_date)).reduce((s, e) => s + (parseFloat(e.amount_xcd) || 0), 0);
    const accounts = Store.getAll('bank_accounts');
    const bankTotal = accounts.reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);
    return { income, expenses, net: income - expenses, bankTotal, accountCount: accounts.length };
  }

  function init() {
    seedCommitments();
    renderAll();
    checkRenewals();
    setInterval(checkRenewals, 60 * 60 * 1000);
    window.addEventListener('config-changed', renderAll);
    window.addEventListener('commitments-changed', () => { Config.refresh(); renderAll(); });
  }

  return {
    init, renderAll, getStats,
    showCommitForm, hideCommitForm, saveCommitment, deleteCommitment, editCommitment,
    showIncomeForm, hideIncomeForm, saveIncome, deleteIncome,
    showExpenseForm, hideExpenseForm, saveExpense, editExpense, deleteExpense,
    showAccountForm, hideAccountForm, saveAccount, updateBalance, deleteAccount,
    openAccountDetail, openAccountPage, closeAccountPage,
    showAccountPageTxnForm, hideAccountPageTxnForm, toggleAccountPageTxnType, saveAccountPageTxn,
    renderAccountPageTable, applyAccountPageFilter,
    editAccountTxn, saveAccountTxn, cancelAccountTxnEdit,
    showTransferForm, hideTransferForm, saveTransfer,
    showSubForm, hideSubForm, saveSub, deleteSub,
    checkRenewals,
    toggleWidgetPanel, saveWidgetPrefs,
  };

})();

document.addEventListener('DOMContentLoaded', Finance.init);
