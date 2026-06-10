/* ============================================
   SION OS — data/config.js
   CR-001: Single source of truth
   All financial constants read from the
   commitments table — change once, updates
   everywhere. No hardcoded personal values.
   ============================================ */

const Config = (() => {

  /* ── D-Max loan (reads from commitments table) ── */
  function dmaxMonthly() {
    const dmax = Store.getAll('commitments')
      .find(c => c.type === 'Loan' && c.name.toLowerCase().includes('d-max'));
    return dmax ? parseFloat(dmax.monthly_xcd) || 0 : 0;
  }

  function dmaxStartDate() {
    const dmax = Store.getAll('commitments')
      .find(c => c.type === 'Loan' && c.name.toLowerCase().includes('d-max'));
    return dmax ? dmax.start_date : null;
  }

  /* ── User prefs (gym, nutrition, business) ── */
  function weightStart() {
    const prefs = Store.get('user_prefs') || {};
    return parseFloat(prefs.weight_start) || 0;
  }

  function weightTarget() {
    const prefs = Store.get('user_prefs') || {};
    return parseFloat(prefs.weight_target) || 0;
  }

  function calorieTarget() {
    const prefs = Store.get('user_prefs') || {};
    return parseInt(prefs.calorie_target) || 0;
  }

  function younityTarget() {
    const prefs = Store.get('user_prefs') || {};
    return parseFloat(prefs.younity_target) || 0;
  }

  function currency() {
    const prefs = Store.get('user_prefs') || {};
    return prefs.currency || 'XCD';
  }

  /* ── Format currency ── */
  function fmt(amount) {
    return currency() + ' $' + (parseFloat(amount) || 0).toLocaleString('en-AG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /* ── Update user preference ── */
  function set(key, value) {
    const prefs = Store.get('user_prefs') || {};
    prefs[key]  = value;
    Store.set('user_prefs', prefs);
    window.dispatchEvent(new CustomEvent('config-changed', { detail: { key, value } }));
  }

  /* ── Refresh — signals all modules to re-render ── */
  function refresh() {
    window.dispatchEvent(new CustomEvent('config-changed'));
  }

  /* ── All current values (for debugging) ── */
  function all() {
    return {
      dmaxMonthly:   dmaxMonthly(),
      dmaxStartDate: dmaxStartDate(),
      weightStart:   weightStart(),
      weightTarget:  weightTarget(),
      calorieTarget: calorieTarget(),
      younityTarget: younityTarget(),
      currency:      currency(),
    };
  }

  /* ── Re-signal when commitments change ── */
  window.addEventListener('commitments-changed', () => refresh());

  return {
    dmaxMonthly,
    dmaxStartDate,
    weightStart,
    weightTarget,
    calorieTarget,
    younityTarget,
    currency,
    fmt,
    set,
    refresh,
    all,
  };

})();
