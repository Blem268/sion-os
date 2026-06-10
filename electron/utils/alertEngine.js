/* ============================================
   SION OS — alertEngine.js
   Sprint 19A
   Rule-based alert evaluation engine
   Runs on schedule + on data change
   ============================================ */

const logger = require('./logger');

/* ── Default system rules — installed on first run ── */
const SYSTEM_RULES = [

  // Finance — commitments coverage
  {
    source:    'system',
    module:    'finance',
    rule_type: 'threshold',
    label:     'Commitments coverage below 100%',
    condition: { table: 'commitments', check: 'coverage_below', threshold: 100 },
    level:     'amber',
    enabled:   true,
  },
  {
    source:    'system',
    module:    'finance',
    rule_type: 'threshold',
    label:     'Commitments coverage critically low (below 50%)',
    condition: { table: 'commitments', check: 'coverage_below', threshold: 50 },
    level:     'red',
    enabled:   true,
  },

  // Finance — subscriptions
  {
    source:    'system',
    module:    'finance',
    rule_type: 'threshold',
    label:     'Subscription renewing within 3 days',
    condition: { table: 'subscriptions', check: 'renewing_within_days', days: 3 },
    level:     'amber',
    enabled:   true,
  },

  // Service business — inactivity
  {
    source:    'system',
    module:    'blem',
    rule_type: 'inactivity',
    label:     'No service job logged in 14 days',
    condition: { table: 'blem_jobs', check: 'no_entry_within_days', days: 14 },
    level:     'amber',
    enabled:   true,
  },

  // Project business — overdue tasks
  {
    source:    'system',
    module:    'younity',
    rule_type: 'threshold',
    label:     'Younity tasks overdue',
    condition: { table: 'younity_tasks', check: 'overdue_count_above', threshold: 0 },
    level:     'amber',
    enabled:   true,
  },

  // Logistics — overdue tasks
  {
    source:    'system',
    module:    'blueport',
    rule_type: 'threshold',
    label:     'Blueport tasks overdue',
    condition: { table: 'blueport_tasks', check: 'overdue_count_above', threshold: 0 },
    level:     'amber',
    enabled:   true,
  },

  // Health — weight logging gap
  {
    source:    'system',
    module:    'gym',
    rule_type: 'inactivity',
    label:     'Weight not logged in 3 days',
    condition: { table: 'gym_weight', check: 'no_entry_within_days', days: 3 },
    level:     'gray',
    enabled:   true,
  },

  // Study — exam proximity
  {
    source:    'system',
    module:    'study',
    rule_type: 'threshold',
    label:     'Exam within 30 days',
    condition: { check: 'exam_within_days', days: 30 },
    level:     'amber',
    enabled:   true,
  },

];

/* ── Evaluate all enabled rules against a plain data object ── */
function evaluate(data) {
  const rules = (data.alert_rules || []).filter(r => r.enabled);
  const today = new Date();
  const alerts = [];

  rules.forEach(rule => {
    try {
      const result = evaluateRule(rule, data, today);
      if (result) {
        alerts.push({
          rule_id:   rule.id,
          source:    rule.source,
          module:    rule.module,
          level:     result.level,
          message:   result.message,
          detail:    result.detail || null,
          action:    result.action || null,
          fired_at:  today.toISOString(),
          read:      false,
          dismissed: false,
        });
      }
    } catch(e) {
      logger.warn('[AlertEngine] Rule failed:', rule.label, e.message);
    }
  });

  logger.info('[AlertEngine] Evaluated', rules.length, 'rules —', alerts.length, 'active alerts');
  return alerts;
}

/* ── Single rule evaluator — receives plain data object ── */
function evaluateRule(rule, data, today) {
  const { condition, level } = rule;

  switch(condition.check) {

    case 'coverage_below': {
      const commits = data.commitments || [];
      const total   = commits.reduce((s, c) => s + (parseFloat(c.monthly_xcd) || 0), 0);
      if (total === 0) return null; // No commitments — rule not applicable
      const income = (data.income || [])
        .filter(i => isThisMonth(i.received_date, today))
        .reduce((s, i) => s + (parseFloat(i.amount_xcd) || 0), 0);
      const coverage = Math.round(income / total * 100);
      if (coverage < condition.threshold) {
        return {
          level,
          message: `Commitments coverage ${coverage}% — XCD $${(total - income).toLocaleString()} short this month`,
          detail:  `Total commitments: XCD $${total.toLocaleString()}/mo. Income logged: XCD $${income.toLocaleString()}.`,
          action:  'Log income in Finance to update coverage',
        };
      }
      return null;
    }

    case 'renewing_within_days': {
      const subs = (data.subscriptions || []).filter(s => {
        if (!s.renewal_date) return false;
        const days = Math.ceil((new Date(s.renewal_date) - today) / 86400000);
        return days >= 0 && days <= condition.days;
      });
      if (!subs.length) return null;
      return {
        level,
        message: subs.map(s => s.name).join(', ') + ` renew${subs.length === 1 ? 's' : ''} within ${condition.days} days`,
        action: 'Review subscriptions in Finance',
      };
    }

    case 'no_entry_within_days': {
      const rows = data[condition.table] || [];
      if (!rows.length) return null;
      const latest = rows
        .map(r => new Date(r.created_at || r.logged_date || r.session_date || 0))
        .sort((a, b) => b - a)[0];
      const days = Math.floor((today - latest) / 86400000);
      if (days >= condition.days) {
        return {
          level,
          message: `No ${condition.table.replace('_', ' ')} entry in ${days} days`,
          action:  'Log activity to clear this alert',
        };
      }
      return null;
    }

    case 'overdue_count_above': {
      const rows = (data[condition.table] || []).filter(r => {
        const due  = r.due_date;
        const done = r.done || r.status === 'Done' || r.status === 'Complete';
        return !done && due && new Date(due) < today;
      });
      if (rows.length > condition.threshold) {
        return {
          level,
          message: `${rows.length} ${condition.table.replace('_', ' ')} overdue`,
          action:  'Review and update task statuses',
        };
      }
      return null;
    }

    case 'exam_within_days': {
      const settings = data.study_settings || {};
      if (!settings.exam_date) return null;
      const days = Math.ceil((new Date(settings.exam_date) - today) / 86400000);
      if (days > 0 && days <= condition.days) {
        return {
          level,
          message: `Exam in ${days} days — ${settings.exam_date}`,
          action:  'Review study progress in Study tab',
        };
      }
      return null;
    }

    case 'balance_below': {
      const accounts = data.bank_accounts || [];
      const account  = condition.account_name
        ? accounts.find(a => a.name?.toLowerCase().includes(condition.account_name.toLowerCase()))
        : accounts[0];
      if (!account) return null;
      const balance = parseFloat(account.balance) || 0;
      if (balance < condition.threshold) {
        return {
          level,
          message: `${account.name} balance (XCD $${balance.toLocaleString()}) is below XCD $${condition.threshold.toLocaleString()}`,
          action:  'Review account in Finance',
        };
      }
      return null;
    }

    default:
      return null;
  }
}

function isThisMonth(dateStr, now) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

module.exports = { evaluate, evaluateRule, SYSTEM_RULES };
