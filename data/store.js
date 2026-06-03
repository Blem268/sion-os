/* ============================================
   SION OS — Data store (localStorage layer)
   v0.2.0 — Sprint 1
   All modules read/write through this API.
   ============================================ */

const Store = (() => {

  const PREFIX = 'sionos_';

  function key(name) { return PREFIX + name; }

  function get(name) {
    try {
      const raw = localStorage.getItem(key(name));
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  }

  function set(name, value) {
    try { localStorage.setItem(key(name), JSON.stringify(value)); return true; }
    catch(e) { return false; }
  }

  function getAll(table) { return get(table) || []; }

  function saveAll(table, rows) { return set(table, rows); }

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
    const idx  = rows.findIndex(r => r.id === id);
    if (idx === -1) return null;
    rows[idx] = { ...rows[idx], ...changes, updated_at: new Date().toISOString() };
    saveAll(table, rows);
    return rows[idx];
  }

  function remove_row(table, id) {
    saveAll(table, getAll(table).filter(r => r.id !== id));
    return true;
  }

  function find(table, predicate) { return getAll(table).filter(predicate); }

  function exportJSON() {
    const tables = [
      'tasks','milestones','blem_clients','blem_jobs','younity_clients',
      'blueport_tasks','income','expenses','commitments','study_lessons',
      'gym_weight','gym_sessions','food_log','whatsapp_log'
    ];
    const data = {};
    tables.forEach(t => { data[t] = getAll(t); });
    data.exported_at = new Date().toISOString();
    return JSON.stringify(data, null, 2);
  }

  function importJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      Object.keys(data).forEach(t => { if (t !== 'exported_at') saveAll(t, data[t]); });
      return true;
    } catch(e) { return false; }
  }

  return { get, set, getAll, saveAll, insert, update, delete: remove_row, find, exportJSON, importJSON };

})();
