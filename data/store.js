/* ============================================
   SION OS — Data store (localStorage layer)
   v0.1.0 — Sprint 0
   All modules read/write through this API.
   Replace with SQLite calls in Phase 2.
   ============================================ */

const Store = (() => {

  const PREFIX = 'sionos_';

  function key(name) {
    return PREFIX + name;
  }

  function get(name) {
    try {
      const raw = localStorage.getItem(key(name));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('[Store] get failed:', name, e);
      return null;
    }
  }

  function set(name, value) {
    try {
      localStorage.setItem(key(name), JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('[Store] set failed:', name, e);
      return false;
    }
  }

  function remove(name) {
    try {
      localStorage.removeItem(key(name));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ── Table helpers ── */

  function getAll(table) {
    return get(table) || [];
  }

  function saveAll(table, rows) {
    return set(table, rows);
  }

  function insert(table, record) {
    const rows = getAll(table);
    const id = rows.length > 0 ? Math.max(...rows.map(r => r.id || 0)) + 1 : 1;
    const row = { id, created_at: new Date().toISOString(), ...record };
    rows.push(row);
    saveAll(table, rows);
    return row;
  }

  function update(table, id, changes) {
    const rows = getAll(table);
    const idx = rows.findIndex(r => r.id === id);
    if (idx === -1) return null;
    rows[idx] = { ...rows[idx], ...changes, updated_at: new Date().toISOString() };
    saveAll(table, rows);
    return rows[idx];
  }

  function remove_row(table, id) {
    const rows = getAll(table).filter(r => r.id !== id);
    saveAll(table, rows);
    return true;
  }

  function find(table, predicate) {
    return getAll(table).filter(predicate);
  }

  /* ── Export ── */
  function exportJSON() {
    const data = {};
    const tables = [
      'tasks', 'milestones', 'blem_clients', 'blem_jobs',
      'younity_clients', 'blueport_tasks', 'income', 'expenses',
      'commitments', 'study_lessons', 'gym_weight', 'gym_sessions',
      'food_log', 'whatsapp_log'
    ];
    tables.forEach(t => { data[t] = getAll(t); });
    data.exported_at = new Date().toISOString();
    return JSON.stringify(data, null, 2);
  }

  function importJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      Object.keys(data).forEach(t => {
        if (t !== 'exported_at') saveAll(t, data[t]);
      });
      return true;
    } catch (e) {
      console.error('[Store] import failed:', e);
      return false;
    }
  }

  return {
    get, set, remove,
    getAll, saveAll, insert, update,
    delete: remove_row,
    find,
    exportJSON, importJSON
  };

})();
