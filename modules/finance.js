/* ============================================
   SION OS — finance.js
   v0.6.0 — Sprint 5
   US-012: Income tracker — 5 sources
   US-013: D-Max milestones + commitments
   ============================================ */

const Finance = (() => {

  const DMAX_MONTHLY = 3414.83;

  const AMORT_MILESTONES = [
    { label: 'First payment',   date: 'Aug 2026',   balance: 158185  },
    { label: 'Year 1 complete', date: 'Jul 2027',   balance: 143500  },
    { label: '25% paid off',    date: '~2029',      balance: 120000  },
    { label: 'Halfway point',   date: '~2030',      balance: 80000,  highlight: true },
    { label: 'Loan cleared',    date: 'Jul 2033',   balance: 0,      highlight: true },
  ];

  /* ── Seed commitments ── */
  function seedCommitments() {
    if (Store.getAll('commitments').length > 0) return;
    Store.insert('commitments', {
      name:        'D-Max Vehicle Loan',
      type:        'Loan',
      monthly_xcd: 3414.83,
      start_date:  '2026-08-01',
      end_date:    '2033-07-01',
      provider:    'Bank (Antigua)',
    });
    Store.insert('commitments', {
      name:        'Sagicor Life Insurance',
      type:        'Insurance',
      monthly_xcd: 360,
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

  /* ── Render metrics ── */
  function renderMetrics() {
    const income   = Store.getAll('income');
    const expenses = Store.getAll('expenses');

    const totalIncome  = income
      .filter(i => isThisMonth(i.received_date))
      .reduce((s, i) => s + (parseFloat(i.amount_xcd) || 0), 0);

    const totalExpenses = expenses
      .filter(e => isThisMonth(e.expense_date))
      .reduce((s, e) => s + (parseFloat(e.amount_xcd) || 0), 0);

    const net      = totalIncome - totalExpenses;
    const coverage = DMAX_MONTHLY > 0
      ? Math.round(net / DMAX_MONTHLY * 100) : 0;

    setEl('fin-income',   '$' + totalIncome.toLocaleString());
    setEl('fin-expenses', '$' + totalExpenses.toLocaleString());

    const netEl = document.getElementById('fin-net');
    if (netEl) {
      netEl.textContent = (net >= 0 ? '$' : '-$') + Math.abs(net).toLocaleString();
      netEl.className   = 'mc-val ' + (net >= 0 ? 'green' : 'red');
    }

    const covEl   = document.getElementById('fin-coverage');
    const covCard = document.getElementById('fin-coverage-card');
    if (covEl) {
      covEl.textContent = coverage + '%';
      covEl.className   = 'mc-val ' + (coverage >= 120 ? 'green' : coverage >= 100 ? 'amber' : 'red');
    }
    if (covCard) {
      covCard.className = 'metric-card ' +
        (coverage >= 120 ? 'green-accent' : coverage >= 100 ? 'amber-accent' : 'red-accent');
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

    const rows = Store.getAll('expenses').slice().reverse();
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="blem-empty">no expenses logged yet</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(e => `
      <tr>
        <td class="white">${escapeHtml(e.item || '—')}</td>
        <td class="fg2" style="font-size:10px">${escapeHtml(e.category || '—')}</td>
        <td class="num red">$${parseFloat(e.amount_xcd || 0).toLocaleString()}</td>
        <td class="fg3" style="font-size:10px;white-space:nowrap">${formatDate(e.expense_date)}</td>
        <td>
          ${e.is_dmax_loan  ? '<span class="pill pill-red"  style="font-size:8px">D-Max</span>' : ''}
          ${e.is_business   ? '<span class="pill pill-cyan" style="font-size:8px">Biz</span>'   : ''}
        </td>
        <td>
          <button class="task-del" onclick="Finance.deleteExpense(${e.id})" aria-label="Delete">
            <i class="ti ti-x" aria-hidden="true"></i>
          </button>
        </td>
      </tr>`).join('');
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
    Store.insert('commitments', {
      name,
      type:        document.getElementById('fc-type')?.value     || 'Other',
      monthly_xcd: parseFloat(document.getElementById('fc-amount')?.value) || 0,
      start_date:  document.getElementById('fc-start')?.value    || null,
      end_date:    document.getElementById('fc-end')?.value      || null,
      provider:    document.getElementById('fc-provider')?.value || '',
    });
    hideCommitForm();
    renderCommitments();
    renderMetrics();
  }
  function deleteCommitment(id) {
    Store.delete('commitments', id);
    renderCommitments();
    renderMetrics();
  }

  /* ── Income form ── */
  function showIncomeForm() {
    document.getElementById('fin-income-form')?.classList.remove('hidden');
    // Default date to today
    const dateEl = document.getElementById('fi-date');
    if (dateEl && !dateEl.value) {
      dateEl.value = new Date().toISOString().split('T')[0];
    }
    document.getElementById('fi-amount')?.focus();
  }
  function hideIncomeForm() {
    document.getElementById('fin-income-form')?.classList.add('hidden');
    ['fi-amount','fi-date','fi-notes'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
  }
  function saveIncome() {
    const amount = parseFloat(document.getElementById('fi-amount')?.value) || 0;
    if (!amount) { document.getElementById('fi-amount')?.focus(); return; }
    Store.insert('income', {
      source:        document.getElementById('fi-source')?.value   || 'Other',
      category:      document.getElementById('fi-category')?.value || 'Other',
      amount_xcd:    amount,
      received_date: document.getElementById('fi-date')?.value     || new Date().toISOString().split('T')[0],
      notes:         document.getElementById('fi-notes')?.value    || '',
    });
    hideIncomeForm();
    renderIncome();
    renderMetrics();
  }
  function deleteIncome(id) {
    Store.delete('income', id);
    renderIncome();
    renderMetrics();
  }

  /* ── Expense form ── */
  function showExpenseForm() {
    document.getElementById('fin-expense-form')?.classList.remove('hidden');
    const dateEl = document.getElementById('fe-date');
    if (dateEl && !dateEl.value) {
      dateEl.value = new Date().toISOString().split('T')[0];
    }
    document.getElementById('fe-item')?.focus();
  }
  function hideExpenseForm() {
    document.getElementById('fin-expense-form')?.classList.add('hidden');
    ['fe-item','fe-amount','fe-date','fe-notes'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const dm = document.getElementById('fe-is-dmax');
    const bz = document.getElementById('fe-is-biz');
    if (dm) dm.checked = false;
    if (bz) bz.checked = false;
  }
  function saveExpense() {
    const item = document.getElementById('fe-item')?.value.trim();
    if (!item) { document.getElementById('fe-item')?.focus(); return; }
    Store.insert('expenses', {
      item,
      category:     document.getElementById('fe-category')?.value || 'Other',
      amount_xcd:   parseFloat(document.getElementById('fe-amount')?.value) || 0,
      expense_date: document.getElementById('fe-date')?.value     || new Date().toISOString().split('T')[0],
      notes:        document.getElementById('fe-notes')?.value    || '',
      is_dmax_loan: document.getElementById('fe-is-dmax')?.checked || false,
      is_business:  document.getElementById('fe-is-biz')?.checked  || false,
    });
    hideExpenseForm();
    renderExpenses();
    renderMetrics();
  }
  function deleteExpense(id) {
    Store.delete('expenses', id);
    renderExpenses();
    renderMetrics();
  }

  function setEl(id, val) {
    const el = document.getElementById(id); if (el) el.textContent = val;
  }

  function renderAll() {
    renderMetrics();
    renderCommitments();
    renderIncome();
    renderExpenses();
    renderAmort();
  }

  function init() {
    seedCommitments();
    renderAll();
  }

  return {
    init, renderAll,
    showCommitForm, hideCommitForm, saveCommitment, deleteCommitment,
    showIncomeForm, hideIncomeForm, saveIncome, deleteIncome,
    showExpenseForm, hideExpenseForm, saveExpense, deleteExpense,
  };

})();

document.addEventListener('DOMContentLoaded', Finance.init);
