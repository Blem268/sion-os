/* ============================================
   SION OS — data/store.js
   v2.1.0 — Sprint 9
   SQLite via @sqlite.org/sqlite-wasm
   Falls back to localStorage if WASM unavailable
   All modules use this API unchanged.
   ============================================ */

const Store = (() => {

  /* ── State ── */
  let _db       = null;
  let _ready    = false;
  let _useWasm  = false;
  const PREFIX  = 'sionos_';
  const DB_NAME = 'sionos';

  const TABLES = [
    'tasks', 'milestones', 'work_tasks', 'blem_clients', 'blem_jobs',
    'younity_projects', 'younity_tasks', 'blueport_tasks',
    'income', 'expenses', 'commitments', 'subscriptions',
    'bank_accounts', 'account_transfers',
    'study_lessons', 'study_sessions', 'study_plan_tasks', 'study_topics',
    'gym_weight', 'gym_sessions',
    'food_log', 'whatsapp_log', 'dashboard_widgets', 'user_prefs',
    'journal_entries',
    'calendar_events', 'focus_blocks', 'deadlines', 'calendar_settings',
    'email_cache', 'email_labels', 'email_tasks', 'email_settings',
    'alert_rules', 'alerts'
  ];

  /* ── SQLite WASM bootstrap ── */
  async function initWasm() {
    try {
      // Load sqlite-wasm from CDN
      await loadScript('https://cdn.jsdelivr.net/npm/@sqlite.org/sqlite-wasm@3.46.1-build1/sqlite-wasm/jswasm/sqlite3.js');

      if (typeof sqlite3InitModule === 'undefined') throw new Error('sqlite3InitModule not found');

      const sqlite3 = await sqlite3InitModule({ print: ()=>{}, printErr: ()=>{} });

      // Use OPFS via SAHPool for persistence — works in Electron with proper headers
      // SAHPool is the correct OPFS API that works on the main thread
      if (sqlite3.installOpfsSAHPoolVfs) {
        try {
          const poolUtil = await sqlite3.installOpfsSAHPoolVfs({ clearOnClose: false });
          _db = new poolUtil.OpfsSAHPoolDb('/sionos.db');
          console.log('[Store] Using OPFS SAHPool SQLite — persistent file storage');
        } catch(opfsErr) {
          console.warn('[Store] OPFS SAHPool failed, using in-memory:', opfsErr.message);
          _db = new sqlite3.oo1.DB(':memory:');
        }
      } else if (sqlite3.oo1.OpfsDb && typeof Atomics !== 'undefined') {
        try {
          _db = new sqlite3.oo1.OpfsDb('/sionos.db');
          console.log('[Store] Using OPFS SQLite database');
        } catch(opfsErr) {
          console.warn('[Store] OPFS failed, using in-memory:', opfsErr.message);
          _db = new sqlite3.oo1.DB(':memory:');
        }
      } else {
        // In-memory with localStorage mirror — fully functional fallback
        _db = new sqlite3.oo1.DB(':memory:');
        console.log('[Store] Using in-memory SQLite + localStorage mirror');
      }

      createTables();
      migrateFromLocalStorage();
      _useWasm  = true;
      _ready    = true;
      console.log('[Store] SQLite WASM ready');
      return true;
    } catch(e) {
      console.warn('[Store] SQLite WASM failed, falling back to localStorage:', e.message);
      _useWasm = false;
      _ready   = true;
      return false;
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s  = document.createElement('script');
      s.src    = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  /* ── Create SQLite tables ── */
  function createTables() {
    if (!_db) return;
    // Generic key-value store table — mirrors localStorage approach
    // Each "table" is a row with a json blob. Simple and schema-free.
    _db.exec(`
      CREATE TABLE IF NOT EXISTS kv_store (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  /* ── Migrate existing localStorage data into SQLite ── */
  function migrateFromLocalStorage() {
    if (!_db) return;
    let migrated = 0;
    TABLES.forEach(table => {
      const lsKey = PREFIX + table;
      const raw   = localStorage.getItem(lsKey);
      if (raw) {
        // Check if already in SQLite
        const existing = _db.exec({
          sql: 'SELECT value FROM kv_store WHERE key = ?',
          bind: [table],
          returnValue: 'resultRows',
        });
        if (!existing.length) {
          _db.exec({
            sql: 'INSERT INTO kv_store (key, value) VALUES (?, ?)',
            bind: [table, raw],
          });
          migrated++;
        }
      }
    });
    // Also migrate theme and last_module settings
    ['theme', 'last_module'].forEach(k => {
      const val = localStorage.getItem(PREFIX + k) || localStorage.getItem('sionos_' + k);
      if (val) {
        const existing = _db.exec({
          sql: 'SELECT value FROM kv_store WHERE key = ?',
          bind: [k],
          returnValue: 'resultRows',
        });
        if (!existing.length) {
          _db.exec({
            sql: 'INSERT INTO kv_store (key, value) VALUES (?, ?)',
            bind: [k, val],
          });
          migrated++;
        }
      }
    });
    if (migrated > 0) console.log('[Store] Migrated ' + migrated + ' tables from localStorage to SQLite');
  }

  /* ── SQLite read/write ── */
  function sqlGet(key) {
    if (!_db) return null;
    try {
      const rows = _db.exec({
        sql: 'SELECT value FROM kv_store WHERE key = ?',
        bind: [key],
        returnValue: 'resultRows',
      });
      return rows.length > 0 ? rows[0][0] : null;
    } catch(e) { return null; }
  }

  function sqlSet(key, value) {
    if (!_db) return false;
    try {
      _db.exec({
        sql: 'INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        bind: [key, value],
      });
      return true;
    } catch(e) { return false; }
  }

  /* ── localStorage fallback ── */
  function lsGet(key) {
    try { const r = localStorage.getItem(PREFIX + key); return r ? r : null; }
    catch(e) { return null; }
  }

  function lsSet(key, value) {
    try { localStorage.setItem(PREFIX + key, value); return true; }
    catch(e) { return false; }
  }

  /* ── Unified API ── */
  function get(name) {
    try {
      const raw = _useWasm ? sqlGet(name) : lsGet(name);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  }

  function set(name, value) {
    const str = JSON.stringify(value);
    const ok  = _useWasm ? sqlSet(name, str) : lsSet(name, str);
    // Always mirror to localStorage as backup
    try { localStorage.setItem(PREFIX + name, str); } catch(e) {}
    return ok;
  }

  function getAll(table) { return get(table) || []; }

  function saveAll(table, rows) { return set(table, rows); }

  function insert(table, record) {
    const rows = getAll(table);
    const id   = rows.length > 0
      ? rows.reduce((max, r) => Math.max(max, r.id || 0), 0) + 1
      : 1;
    const row  = { id, created_at: new Date().toISOString(), ...record };
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

  /* ── Export all data as JSON ── */
  function exportJSON() {
    const data = {};
    TABLES.forEach(t => { data[t] = getAll(t); });
    data.exported_at = new Date().toISOString();
    data.store_mode  = _useWasm ? 'sqlite-wasm' : 'localStorage';
    return JSON.stringify(data, null, 2);
  }

  /* ── Import from JSON backup ── */
  function importJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      Object.keys(data).forEach(t => {
        if (t !== 'exported_at' && t !== 'store_mode') saveAll(t, data[t]);
      });
      return true;
    } catch(e) { return false; }
  }

  /* ── Status ── */
  function status() {
    return {
      ready:    _ready,
      mode:     _useWasm ? 'sqlite-wasm' : 'localStorage',
      tables:   TABLES.length,
    };
  }

  /* ── Init ── */
  async function init() {
    await initWasm();
    // Dispatch event so app knows store is ready
    window.dispatchEvent(new CustomEvent('store-ready', { detail: status() }));
  }

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    get, set,
    getAll, saveAll, insert, update,
    delete: remove_row, find,
    exportJSON, importJSON, status,
    isReady: () => _ready,
    isWasm:  () => _useWasm,
  };

})();
