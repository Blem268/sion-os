/* ============================================
   SION OS — blem.js
   v0.4.0 — Sprint 3
   US-005: Job logging with all fields
   US-006: Auto-calculate balance, profit, margin
   ============================================ */

const Blem = (() => {

  /* ── Generate job ref ── */
  function nextRef() {
    const jobs = Store.getAll('blem_jobs');
    const num  = jobs.length + 1;
    return 'BT-' + String(num).padStart(3, '0');
  }

  /* ── Upsert client record ── */
  function upsertClient(name, phone, vehicle) {
    if (!name) return null;
    const clients = Store.getAll('blem_clients');
    const existing = clients.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      Store.update('blem_clients', existing.id, { phone: phone || existing.phone });
      return existing.id;
    }
    const c = Store.insert('blem_clients', { name, phone: phone || '', vehicle: vehicle || '', rating: 'Regular' });
    return c.id;
  }

  /* ── Computed values ── */
  function computed(job) {
    const quote  = parseFloat(job.quote_xcd)  || 0;
    const parts  = parseFloat(job.parts_cost_xcd) || 0;
    const paid   = parseFloat(job.amount_paid_xcd) || 0;
    const balance = Math.max(0, quote - paid);
    const profit  = quote - parts;
    const margin  = quote > 0 ? Math.round(profit / quote * 100) : 0;
    return { quote, parts, paid, balance, profit, margin };
  }

  /* ── This month helper ── */
  function isThisMonth(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }

  /* ── Render metrics ── */
  function renderMetrics() {
    const jobs = Store.getAll('blem_jobs');
    const active  = jobs.filter(j => j.status !== 'Complete').length;
    const revenue = jobs
      .filter(j => isThisMonth(j.created_at))
      .reduce((s, j) => s + (computed(j).paid), 0);
    const owed    = jobs.reduce((s, j) => s + computed(j).balance, 0);
    const profit  = jobs
      .filter(j => isThisMonth(j.created_at))
      .reduce((s, j) => s + computed(j).profit, 0);

    setEl('blem-active',  active);
    setEl('blem-revenue', '$' + revenue.toLocaleString());
    setEl('blem-owed',    '$' + owed.toLocaleString());
    setEl('blem-profit',  '$' + profit.toLocaleString());
  }

  /* ── Render jobs table ── */
  function renderJobs() {
    const tbody  = document.getElementById('blem-job-tbody');
    const countEl = document.getElementById('blem-job-count');
    if (!tbody) return;

    const jobs = Store.getAll('blem_jobs').slice().reverse();
    if (countEl) countEl.textContent = jobs.length + ' total';

    if (!jobs.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="blem-empty">no jobs logged yet — add one below</td></tr>';
      return;
    }

    tbody.innerHTML = jobs.map(j => {
      const c = computed(j);
      const statusCls = {
        'Complete':             'pill-green',
        'In Progress':          'pill-amber',
        'Awaiting Parts':       'pill-red',
        'Ready for Collection': 'pill-cyan',
      }[j.status] || 'pill-gray';

      const paymentCls = {
        'Paid in Full':  'pill-green',
        'Deposit Paid':  'pill-amber',
        'Unpaid':        'pill-red',
      }[j.payment_status] || 'pill-gray';

      return `<tr class="blem-job-row">
        <td class="blem-ref">${escapeHtml(j.job_ref)}</td>
        <td class="blem-vehicle">
          <div>${escapeHtml(j.vehicle)}</div>
          ${j.client_name ? `<div class="blem-client-sub">${escapeHtml(j.client_name)}</div>` : ''}
        </td>
        <td><span class="blem-type-badge">${escapeHtml(j.job_type)}</span></td>
        <td class="num amber">$${c.quote.toLocaleString()}</td>
        <td class="num">
          $${c.paid.toLocaleString()}
          <span class="blem-pay-pill ${paymentCls}">${j.payment_status}</span>
        </td>
        <td class="num ${c.balance > 0 ? 'red' : 'green'}">$${c.balance.toLocaleString()}</td>
        <td class="num">
          <span class="${c.profit >= 0 ? 'green' : 'red'}">$${c.profit.toLocaleString()}</span>
          <span class="blem-margin">${c.margin}%</span>
        </td>
        <td><span class="pill ${statusCls}">${j.status}</span></td>
        <td style="white-space:nowrap">
          <button class="task-del" onclick="Blem.editJob(${j.id})" title="Edit job" aria-label="Edit job">
            <i class="ti ti-pencil" aria-hidden="true"></i>
          </button>
          <button class="task-del" onclick="Blem.markPaid(${j.id})" title="Mark paid in full" aria-label="Mark paid">
            <i class="ti ti-coin" aria-hidden="true"></i>
          </button>
          <button class="task-del" onclick="Blem.deleteJob(${j.id})" aria-label="Delete job">
            <i class="ti ti-x" aria-hidden="true"></i>
          </button>
        </td>
      </tr>`;
    }).join('');
  }

  /* ── Render clients table ── */
  function renderClients() {
    const tbody   = document.getElementById('blem-client-tbody');
    const countEl = document.getElementById('blem-client-count');
    if (!tbody) return;

    const clients = Store.getAll('blem_clients');
    const jobs    = Store.getAll('blem_jobs');
    if (countEl) countEl.textContent = clients.length + ' total';

    if (!clients.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="blem-empty">clients appear automatically when you log a job</td></tr>';
      return;
    }

    tbody.innerHTML = clients.map(cl => {
      const clientJobs  = jobs.filter(j => j.client_name?.toLowerCase() === cl.name.toLowerCase());
      const totalJobs   = clientJobs.length;
      const totalPaid   = clientJobs.reduce((s, j) => s + computed(j).paid, 0);
      const ratingCls   = cl.rating === 'VIP' ? 'green' : cl.rating === 'Regular' ? 'cyan' : 'fg3';

      return `<tr>
        <td class="white">${escapeHtml(cl.name)}</td>
        <td class="fg2">${escapeHtml(cl.phone || '—')}</td>
        <td class="fg2">${escapeHtml(cl.vehicle || '—')}</td>
        <td class="amber">${totalJobs}</td>
        <td class="green">$${totalPaid.toLocaleString()}</td>
        <td>
          <select class="blem-rating-select" onchange="Blem.updateRating(${cl.id}, this.value)">
            ${['Regular','VIP','One-time'].map(r =>
              `<option value="${r}" ${cl.rating === r ? 'selected' : ''}>${r}</option>`
            ).join('')}
          </select>
        </td>
      </tr>`;
    }).join('');
  }

  /* ── Mark paid in full ── */
  function markPaid(id) {
    const job = Store.getAll('blem_jobs').find(j => j.id === id);
    if (!job) return;
    const c = computed(job);
    Store.update('blem_jobs', id, {
      amount_paid_xcd: c.quote,
      payment_status: 'Paid in Full',
      status: 'Complete',
    });
    renderAll();
  }

  /* ── Delete job ── */
  function deleteJob(id) {
    Store.delete('blem_jobs', id);
    renderAll();
  }

  /* ── Update client rating ── */
  function updateRating(id, rating) {
    Store.update('blem_clients', id, { rating });
    renderClients();
  }

  /* ── Job form ── */
  function showJobForm() {
    clearJobForm();
    // CR-012: Populate account dropdown from bank_accounts
    const acctSel = document.getElementById('bj-account');
    if (acctSel) {
      const accounts = Store.getAll('bank_accounts');
      acctSel.innerHTML = '<option value="">payment account (optional)</option>' +
        accounts.map(a=>`<option value="${a.id}">${a.name}</option>`).join('');
    }
    document.getElementById('blem-job-form')?.classList.remove('hidden');
    document.getElementById('bj-vehicle')?.focus();
  }

  function hideJobForm() {
    document.getElementById('blem-job-form')?.classList.add('hidden');
    clearJobForm();
  }

  /* ── Edit existing job ── */
  function editJob(id) {
    const job = Store.getAll('blem_jobs').find(j => j.id === id);
    if (!job) return;
    clearJobForm();
    const form = document.getElementById('blem-job-form');
    if (!form) return;
    form.dataset.editId = id;
    // Populate fields
    const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
    set('bj-vehicle',        job.vehicle);
    set('bj-type',           job.job_type);
    set('bj-quote',          job.quote_xcd);
    set('bj-parts',          job.parts_cost_xcd);
    set('bj-paid',           job.amount_paid_xcd);
    set('bj-payment-status', job.payment_status);
    set('bj-status',         job.status);
    set('bj-date-in',        job.date_in);
    set('bj-client-name',    job.client_name);
    set('bj-client-phone',   job.client_phone);
    set('bj-notes',          job.notes);
    // Update form title to show editing
    const titleEl = form.querySelector('.form-title');
    if (titleEl) titleEl.textContent = 'edit job — ' + job.job_ref;
    form.classList.remove('hidden');
    document.getElementById('bj-vehicle')?.focus();
  }

  function clearJobForm() {
    ['bj-vehicle','bj-quote','bj-parts','bj-paid','bj-client-name','bj-client-phone','bj-notes','bj-date-in','bj-account']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const ps = document.getElementById('bj-payment-status');
    const st = document.getElementById('bj-status');
    const ty = document.getElementById('bj-type');
    if (ps) ps.value = 'Unpaid';
    if (st) st.value = 'In Progress';
    if (ty) ty.value = 'Wiring';
    const form = document.getElementById('blem-job-form');
    if (form) {
      form.dataset.editId = '';
      const titleEl = form.querySelector('.form-title');
      if (titleEl) titleEl.textContent = 'log new job';
    }
  }

  function saveJob() {
    const vehicle = document.getElementById('bj-vehicle')?.value.trim();
    if (!vehicle) { document.getElementById('bj-vehicle')?.focus(); return; }

    const clientName  = document.getElementById('bj-client-name')?.value.trim()  || '';
    const clientPhone = document.getElementById('bj-client-phone')?.value.trim() || '';
    const quote       = parseFloat(document.getElementById('bj-quote')?.value)   || 0;
    const parts       = parseFloat(document.getElementById('bj-parts')?.value)   || 0;
    const paid        = parseFloat(document.getElementById('bj-paid')?.value)    || 0;
    const form        = document.getElementById('blem-job-form');
    const editId      = form?.dataset.editId ? parseInt(form.dataset.editId) : null;

    upsertClient(clientName, clientPhone, vehicle);

    const jobData = {
      vehicle,
      job_type:        document.getElementById('bj-type')?.value           || 'Other',
      quote_xcd:       quote,
      parts_cost_xcd:  parts,
      amount_paid_xcd: paid,
      payment_status:  document.getElementById('bj-payment-status')?.value || 'Unpaid',
      status:          document.getElementById('bj-status')?.value         || 'In Progress',
      date_in:         document.getElementById('bj-date-in')?.value        || null,
      client_name:     clientName,
      client_phone:    clientPhone,
      notes:           document.getElementById('bj-notes')?.value          || '',
      source:          'direct',
    };

    const accountId = document.getElementById('bj-account')?.value || null;
    jobData.account_id = accountId;

    let jobRecord;
    if (editId) {
      Store.update('blem_jobs', editId, jobData);
      jobRecord = { id: editId, ...jobData };
    } else {
      jobRecord = Store.insert('blem_jobs', { job_ref: nextRef(), ...jobData });
    }

    // CR-012: Auto-create income entry in Finance if payment received
    if (paid > 0 && !editId) {
      const income = Store.insert('income', {
        source:        'Blem Tuned',
        category:      'Business Revenue',
        amount_xcd:    paid,
        received_date: new Date().toISOString().split('T')[0],
        account_id:    accountId,
        notes:         jobRecord.job_ref + ' — ' + (vehicle || ''),
        source_ref:    jobRecord.job_ref,
      });

      // CR-012: Update bank account balance
      if (accountId) {
        const accounts = Store.getAll('bank_accounts');
        const acct     = accounts.find(a => a.id === parseInt(accountId));
        if (acct) {
          Store.update('bank_accounts', acct.id, {
            balance: (parseFloat(acct.balance) || 0) + paid
          });
        }
      }

      if (window.electronAPI?.notify) {
        window.electronAPI.notify(
          'Blem income logged',
          jobRecord.job_ref + ' — $' + paid.toLocaleString() + ' XCD added to Finance',
          false
        );
      }

      if (window.electronAPI?.writeVaultNote) {
        const date = new Date().toISOString().split('T')[0];
        window.electronAPI.writeVaultNote(
          `businesses/blem-tuned/jobs/${jobRecord.job_ref}-${date}.md`,
          { date, type: 'job-note', status: 'active', project: 'blem-tuned', tags: '["blem-tuned", "revenue", "job"]' },
          `# ${jobRecord.job_ref} — ${vehicle}\n\n## Job details\n- **Type:** ${jobData.job_type}\n- **Quote:** XCD $${quote}\n- **Paid:** XCD $${paid}\n- **Client:** ${clientName || 'Walk-in'}\n\n## Notes\n${jobData.notes || 'None'}\n\n## Outcome\n\n`
        );
      }
    }

    hideJobForm();
    renderAll();
  }

  /* ── Helpers ── */
  function renderAll() {
    renderMetrics();
    renderJobs();
    renderClients();
    if (typeof Charts !== 'undefined') {
      Charts.renderBlemRevenueChart('chart-blem-revenue');
    }
  }

  function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Init ── */
  function getStats() {
    const jobs = Store.getAll('blem_jobs');
    const now  = new Date();
    const thisMonth = d => { if (!d) return false; const x = new Date(d); return x.getMonth() === now.getMonth() && x.getFullYear() === now.getFullYear(); };
    return {
      activeJobs: jobs.filter(j => j.status !== 'Complete').length,
      revenue:    jobs.filter(j => thisMonth(j.created_at)).reduce((s, j) => s + (parseFloat(j.amount_paid_xcd) || 0), 0),
    };
  }

  function init() { renderAll(); }

  return {
    init, renderAll, getStats,
    showJobForm, hideJobForm, saveJob, editJob,
    markPaid, deleteJob, updateRating,
  };

})();

document.addEventListener('DOMContentLoaded', Blem.init);
