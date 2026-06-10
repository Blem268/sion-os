/* ============================================
   SION OS — modules/ai.js
   v2.6.0 — Sprint 14
   Renderer-side AI chat controller
   All API calls go through IPC to main process
   ============================================ */

const AI = (() => {

  let _thinking = false;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Collect full OS data snapshot ── */
  function collectStoreData() {
    const tables = [
      'tasks', 'milestones', 'work_tasks', 'blem_clients', 'blem_jobs',
      'younity_projects', 'younity_tasks', 'blueport_tasks',
      'income', 'expenses', 'commitments', 'subscriptions',
      'bank_accounts', 'account_transfers',
      'study_lessons', 'study_sessions', 'study_topics',
      'study_plan_tasks', 'gym_weight', 'gym_sessions', 'food_log',
      'journal_entries', 'user_prefs',
      'alerts', 'alert_rules',
    ];
    const data = {};
    tables.forEach(t => { data[t] = Store.getAll(t); });
    return data;
  }

  /* ── Execute write-back actions from Claude ── */
  function executeActions(actions) {
    if (!actions || !actions.length) return [];
    const results = [];
    actions.forEach(action => {
      try {
        if (action.type === 'insert' && action.table && action.data) {
          const record = Store.insert(action.table, action.data);
          results.push(`✓ Created ${action.table} entry (id: ${record.id})`);
          refreshModule(action.table);
        } else if (action.type === 'update' && action.table && action.id && action.data) {
          Store.update(action.table, action.id, action.data);
          results.push(`✓ Updated ${action.table} id:${action.id}`);
          refreshModule(action.table);
        } else if (action.type === 'delete' && action.table && action.id) {
          Store.delete(action.table, action.id);
          results.push(`✓ Deleted ${action.table} id:${action.id}`);
          refreshModule(action.table);
        }
      } catch(e) {
        results.push(`✗ Action failed: ${e.message}`);
      }
    });
    return results;
  }

  /* ── Refresh module after write-back ── */
  function refreshModule(table) {
    const moduleMap = {
      tasks:            () => typeof Dashboard !== 'undefined' && Dashboard.renderTasks(),
      milestones:       () => typeof Dashboard !== 'undefined' && Dashboard.renderMilestones(),
      income:           () => typeof Finance   !== 'undefined' && Finance.renderAll(),
      expenses:         () => typeof Finance   !== 'undefined' && Finance.renderAll(),
      bank_accounts:    () => typeof Finance   !== 'undefined' && Finance.renderAll(),
      blem_jobs:        () => typeof Blem      !== 'undefined' && Blem.renderAll(),
      blem_clients:     () => typeof Blem      !== 'undefined' && Blem.renderAll(),
      work_tasks:       () => typeof Work      !== 'undefined' && Work.renderAll(),
      younity_projects: () => typeof Younity   !== 'undefined' && Younity.renderAll(),
      younity_tasks:    () => typeof Younity   !== 'undefined' && Younity.renderAll(),
      blueport_tasks:   () => typeof Blueport  !== 'undefined' && Blueport.renderAll(),
      subscriptions:    () => typeof Finance   !== 'undefined' && Finance.renderAll(),
      commitments:      () => typeof Finance   !== 'undefined' && Finance.renderAll(),
      account_transfers:() => typeof Finance   !== 'undefined' && Finance.renderAll(),
      gym_weight:       () => typeof Gym       !== 'undefined' && Gym.renderAll(),
      gym_sessions:     () => typeof Gym       !== 'undefined' && Gym.renderAll(),
      food_log:         () => typeof Gym       !== 'undefined' && Gym.renderAll(),
      study_sessions:   () => typeof Study     !== 'undefined' && Study.renderSessions(),
      study_topics:     () => typeof Study     !== 'undefined' && Study.renderTopics(),
      study_plan_tasks: () => typeof Study     !== 'undefined' && Study.renderPlan(),
      journal_entries:  () => typeof Journal   !== 'undefined' && Journal.renderAll(),
      alert_rules:      () => typeof Dashboard !== 'undefined' && Dashboard.renderAlerts(),
      alerts:           () => typeof Dashboard !== 'undefined' && Dashboard.renderAlerts(),
    };
    const fn = moduleMap[table];
    if (fn) try { fn(); } catch(e) { /* silent */ }
    if (typeof Dashboard !== 'undefined') Dashboard.renderMetrics();
  }

  /* ── Append message to chat history ── */
  function appendMessage(role, content, actionResults) {
    const history = document.getElementById('ai-chat-history');
    if (!history) return;

    const welcome = history.querySelector('.ai-welcome');
    if (welcome) welcome.remove();

    const msg = document.createElement('div');
    msg.className = `ai-message ai-${role}`;

    const formatted = escapeHtml(content)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    msg.innerHTML = `
      <div class="ai-msg-role">${role === 'user' ? 'you' : 'sion os'}</div>
      <div class="ai-msg-body">${formatted}</div>
      ${actionResults && actionResults.length ? `
        <div class="ai-actions-taken">
          ${actionResults.map(r => `<div class="ai-action-result">${escapeHtml(r)}</div>`).join('')}
        </div>` : ''}`;

    history.appendChild(msg);
    history.scrollTop = history.scrollHeight;
  }

  /* ── Show thinking indicator ── */
  function showThinking() {
    const history = document.getElementById('ai-chat-history');
    if (!history) return;
    const el = document.createElement('div');
    el.className = 'ai-message ai-assistant ai-thinking';
    el.id = 'ai-thinking-indicator';
    el.innerHTML = `
      <div class="ai-msg-role">sion os</div>
      <div class="ai-msg-body">
        <span class="ai-dot"></span>
        <span class="ai-dot"></span>
        <span class="ai-dot"></span>
      </div>`;
    history.appendChild(el);
    history.scrollTop = history.scrollHeight;
  }

  function hideThinking() {
    document.getElementById('ai-thinking-indicator')?.remove();
  }

  /* ── Send message ── */
  async function send() {
    if (_thinking) return;
    const input = document.getElementById('ai-input');
    const question = input?.value.trim();
    if (!question) return;

    if (!window.electronAPI?.aiQuery) {
      appendMessage('assistant', 'AI not available — running in browser mode. Open with npm run dev.');
      return;
    }

    input.value = '';
    _thinking = true;

    const sendBtn  = document.getElementById('ai-send-btn');
    const statusEl = document.getElementById('ai-status');
    if (sendBtn)  sendBtn.disabled = true;
    if (statusEl) statusEl.textContent = 'thinking...';

    appendMessage('user', question);
    showThinking();

    const storeData = collectStoreData();
    const result    = await window.electronAPI.aiQuery(question, storeData);

    hideThinking();
    _thinking = false;
    if (sendBtn)  sendBtn.disabled = false;

    if (result.success) {
      const actionResults = executeActions(result.actions);
      appendMessage('assistant', result.response, actionResults);
      if (statusEl) statusEl.textContent = 'claude sonnet · ready';
    } else {
      appendMessage('assistant', `Error: ${result.error}. Check your ANTHROPIC_API_KEY in .env`);
      if (statusEl) statusEl.textContent = 'error — check .env';
    }
  }

  function sendQuick(question) {
    const input = document.getElementById('ai-input');
    if (input) { input.value = question; send(); }
  }

  function init() {
    const input = document.getElementById('ai-input');
    if (input) {
      input.addEventListener('focus', () => {
        const sugg = document.getElementById('ai-suggestions');
        if (sugg) sugg.style.display = 'none';
      });
    }
  }

  return { send, sendQuick, init };

})();

document.addEventListener('DOMContentLoaded', AI.init);
