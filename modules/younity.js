/* ============================================
   SION OS — younity.js
   v0.5.0 — Sprint 4
   US-008: $2K/month revenue target
   US-009: 6-stage CRM pipeline
   ============================================ */

const Younity = (() => {

  const TARGET    = 2000;
  const STAGES    = ['Lead','Proposal Sent','Onboarding','Active','Delivered','Retained','Lost'];
  const STAGE_CLS = {
    'Lead':           'stage-lead',
    'Proposal Sent':  'stage-proposal',
    'Onboarding':     'stage-onboard',
    'Active':         'stage-active',
    'Delivered':      'stage-delivered',
    'Retained':       'stage-retained',
    'Lost':           'stage-lost',
  };

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function isOverdue(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr + 'T00:00:00') < new Date();
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr + 'T00:00:00')
      .toLocaleDateString('en-AG', { day:'numeric', month:'short' });
  }

  /* ── Metrics ── */
  function renderMetrics() {
    const clients  = Store.getAll('younity_clients');
    const active   = clients.filter(c => c.stage === 'Active' || c.stage === 'Retained');
    const pipeline = clients.reduce((s,c) => s + (parseFloat(c.contract_value_xcd) || 0), 0);
    const revenue  = active.reduce((s,c) => s + (parseFloat(c.contract_value_xcd) || 0), 0);
    const gap      = Math.max(0, TARGET - revenue);
    const leads    = clients.filter(c => c.stage === 'Lead').length;

    setEl('y-active',   active.length);
    setEl('y-pipeline', '$' + pipeline.toLocaleString());
    setEl('y-client-count', clients.length + ' total · ' + leads + ' leads');

    const gapEl  = document.getElementById('y-gap');
    const subEl  = document.getElementById('y-gap-sub');
    if (gapEl) {
      gapEl.textContent = gap > 0 ? '$' + gap.toLocaleString() : '$0';
      gapEl.className   = 'mc-val ' + (gap === 0 ? 'green' : gap < TARGET/2 ? 'amber' : 'amber');
    }
    if (subEl) {
      subEl.textContent = gap === 0
        ? 'target hit!'
        : revenue > 0
          ? '$' + revenue.toLocaleString() + ' active of $2,000 target'
          : 'no active revenue yet';
    }
  }

  /* ── Pipeline board ── */
  function renderPipeline() {
    const el = document.getElementById('y-pipeline-board');
    if (!el) return;
    const clients = Store.getAll('younity_clients');
    const visibleStages = STAGES.filter(s => s !== 'Lost');

    el.innerHTML = visibleStages.map(stage => {
      const stageClients = clients.filter(c => c.stage === stage);
      return `
        <div class="y-stage">
          <div class="y-stage-header">
            <span class="y-stage-name ${STAGE_CLS[stage]}">${stage}</span>
            <span class="y-stage-count">${stageClients.length}</span>
          </div>
          <div class="y-stage-cards">
            ${stageClients.length === 0
              ? `<div class="y-empty-stage">—</div>`
              : stageClients.map(c => {
                  const overdue = isOverdue(c.next_action_date);
                  return `
                    <div class="y-client-card ${overdue ? 'y-card-overdue' : ''}">
                      <div class="y-card-name">${escapeHtml(c.name)}</div>
                      <div class="y-card-biz">${escapeHtml(c.business || '')}</div>
                      ${c.contract_value_xcd
                        ? `<div class="y-card-value amber">$${parseFloat(c.contract_value_xcd).toLocaleString()} XCD</div>`
                        : ''}
                      ${c.next_action
                        ? `<div class="y-card-action ${overdue ? 'red' : 'fg3'}">
                             <i class="ti ti-arrow-right" aria-hidden="true"></i>
                             ${escapeHtml(c.next_action)}
                             ${c.next_action_date ? `<span class="y-card-date">${formatDate(c.next_action_date)}</span>` : ''}
                           </div>`
                        : ''}
                      <div class="y-card-actions">
                        <select class="y-stage-select" onchange="Younity.changeStage(${c.id}, this.value)">
                          ${STAGES.map(s => `<option value="${s}" ${c.stage===s?'selected':''}>${s}</option>`).join('')}
                        </select>
                        <button class="task-del" onclick="Younity.deleteClient(${c.id})" aria-label="Delete">
                          <i class="ti ti-x" aria-hidden="true"></i>
                        </button>
                      </div>
                    </div>`;
                }).join('')
            }
          </div>
        </div>`;
    }).join('');
  }

  /* ── Client table ── */
  function renderTable() {
    const tbody = document.getElementById('y-client-tbody');
    if (!tbody) return;
    const clients = Store.getAll('younity_clients');
    if (!clients.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="blem-empty">no clients yet</td></tr>';
      return;
    }
    tbody.innerHTML = clients.map(c => {
      const overdue  = isOverdue(c.next_action_date);
      const stageCls = STAGE_CLS[c.stage] || '';
      return `<tr>
        <td class="white">${escapeHtml(c.name)}</td>
        <td class="fg2">${escapeHtml(c.business || '—')}</td>
        <td><span class="y-stage-pill ${stageCls}">${c.stage}</span></td>
        <td class="fg2" style="font-size:10px">${escapeHtml(c.service || '—')}</td>
        <td class="amber num">${c.contract_value_xcd ? '$'+parseFloat(c.contract_value_xcd).toLocaleString() : '—'}</td>
        <td class="fg2" style="font-size:10px;max-width:140px">${escapeHtml(c.next_action || '—')}</td>
        <td class="${overdue ? 'red' : 'fg3'}" style="font-size:10px;white-space:nowrap">
          ${c.next_action_date ? formatDate(c.next_action_date) : '—'}
          ${overdue ? '<i class="ti ti-alert-triangle" style="font-size:10px" aria-hidden="true"></i>' : ''}
        </td>
        <td>
          <button class="task-del" onclick="Younity.deleteClient(${c.id})" aria-label="Delete">
            <i class="ti ti-x" aria-hidden="true"></i>
          </button>
        </td>
      </tr>`;
    }).join('');
  }

  /* ── Change stage ── */
  function changeStage(id, stage) {
    Store.update('younity_clients', id, { stage });
    renderAll();
  }

  /* ── Delete client ── */
  function deleteClient(id) {
    Store.delete('younity_clients', id);
    renderAll();
  }

  /* ── Client form ── */
  function showClientForm() {
    clearForm();
    document.getElementById('y-client-form')?.classList.remove('hidden');
    document.getElementById('yc-name')?.focus();
  }

  function hideClientForm() {
    document.getElementById('y-client-form')?.classList.add('hidden');
    clearForm();
  }

  function clearForm() {
    ['yc-name','yc-biz','yc-value','yc-next-action','yc-next-date','yc-country','yc-referred']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const st = document.getElementById('yc-stage');
    const sv = document.getElementById('yc-service');
    if (st) st.value = 'Lead';
    if (sv) sv.value = 'AI Systems Audit';
  }

  function saveClient() {
    const name = document.getElementById('yc-name')?.value.trim();
    if (!name) { document.getElementById('yc-name')?.focus(); return; }
    Store.insert('younity_clients', {
      name,
      business:            document.getElementById('yc-biz')?.value.trim()         || '',
      stage:               document.getElementById('yc-stage')?.value              || 'Lead',
      service:             document.getElementById('yc-service')?.value            || '',
      contract_value_xcd:  parseFloat(document.getElementById('yc-value')?.value)  || 0,
      next_action:         document.getElementById('yc-next-action')?.value.trim() || '',
      next_action_date:    document.getElementById('yc-next-date')?.value          || null,
      country:             document.getElementById('yc-country')?.value.trim()     || '',
      referred_by:         document.getElementById('yc-referred')?.value.trim()    || '',
    });
    hideClientForm();
    renderAll();
  }

  function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function renderAll() {
    renderMetrics();
    renderPipeline();
    renderTable();
  }

  function init() { renderAll(); }

  return { init, renderAll, changeStage, deleteClient, showClientForm, hideClientForm, saveClient };

})();

document.addEventListener('DOMContentLoaded', Younity.init);
