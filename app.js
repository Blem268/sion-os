/* ============================================
   SION OS — app.js
   v0.2.0 — Sprint 1
   ============================================ */

function updateClock() {
  const now  = new Date();
  const time = now.toLocaleTimeString('en-AG', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
  const date = now.toLocaleDateString('en-AG', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
  const c = document.getElementById('clock');
  const d = document.getElementById('today-date');
  if (c) c.textContent = time;
  if (d) d.textContent = date;
}

updateClock();
setInterval(updateClock, 1000);

function navigate(moduleId, btn) {
  document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const target = document.getElementById('mod-' + moduleId);
  if (target) target.classList.add('active');
  if (btn) btn.classList.add('active');
  const titles = {
    dashboard: 'Sion OS — Dashboard', work: 'Sion OS — Work',
    blem: 'Sion OS — Blem Tuned',    younity: 'Sion OS — Younity',
    blueport: 'Sion OS — Blueport',  finance: 'Sion OS — Finance',
    study: 'Sion OS — Study',        gym: 'Sion OS — Gym',
    habits: 'Sion OS — Habits',      goals: 'Sion OS — Goals',
    journal: 'Sion OS — Journal',    calendar: 'Sion OS — Calendar',
    email: 'Sion OS — Email',        ai: 'Sion OS — AI Companion',
    pomodoro: 'Sion OS — Pomodoro'
  };
  document.title = titles[moduleId] || 'Sion OS';
  Store.set('last_module', moduleId);
}

(function restoreModule() {
  const last = Store.get('last_module');
  if (last) {
    const btn = document.querySelector(`[data-module="${last}"]`);
    if (btn) navigate(last, btn);
  }
})();

/* ── App namespace ── */
const App = (() => {

  function applyTheme(theme) {
    const root   = document.documentElement;
    const icon   = document.getElementById('theme-icon');
    const batBtn = document.getElementById('batman-btn');

    root.classList.remove('light', 'batman');

    if (theme === 'batman') {
      root.classList.add('batman');
      if (icon)   { icon.classList.remove('ti-moon'); icon.classList.add('ti-sun'); }
      if (batBtn) batBtn.classList.add('batman-active');
    } else if (theme === 'light') {
      root.classList.add('light');
      if (icon)   { icon.classList.remove('ti-sun'); icon.classList.add('ti-moon'); }
      if (batBtn) batBtn.classList.remove('batman-active');
    } else {
      if (icon)   { icon.classList.remove('ti-moon'); icon.classList.add('ti-sun'); }
      if (batBtn) batBtn.classList.remove('batman-active');
    }
  }

  function toggleTheme() {
    if (document.documentElement.classList.contains('batman')) return;
    const current = document.documentElement.classList.contains('light') ? 'light' : 'dark';
    const next    = current === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('sionos_theme', next); } catch(e) {}
    applyTheme(next);
  }

  function toggleBatman() {
    const isBatman = document.documentElement.classList.contains('batman');
    let next;
    if (isBatman) {
      try { next = localStorage.getItem('sionos_prev_theme') || 'dark'; } catch(e) { next = 'dark'; }
    } else {
      try {
        const cur = document.documentElement.classList.contains('light') ? 'light' : 'dark';
        localStorage.setItem('sionos_prev_theme', cur);
      } catch(e) {}
      next = 'batman';
    }
    try { localStorage.setItem('sionos_theme', next); } catch(e) {}
    applyTheme(next);
  }

  /* ── Export all data as JSON ── */
  function exportData() {
    try {
      const json     = Store.exportJSON();
      const blob     = new Blob([json], { type: 'application/json' });
      const url      = URL.createObjectURL(blob);
      const a        = document.createElement('a');
      const date     = new Date().toISOString().split('T')[0];
      a.href         = url;
      a.download     = 'sionos-backup-' + date + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch(e) {
      console.error('[SionOS] Export failed:', e);
    }
  }

  function init() {
    let saved = 'dark';
    try { saved = localStorage.getItem('sionos_theme') || 'dark'; } catch(e) {}
    applyTheme(saved);
  }

  return { toggleTheme, toggleBatman, exportData, init };

})();

// Run immediately so theme applies before any render
App.init();

/* ── Store ready handler ── */
window.addEventListener('store-ready', (e) => {
  const { mode } = e.detail;
  const dotEl    = document.getElementById('store-dot');
  const labelEl  = document.getElementById('store-label');
  if (dotEl)   dotEl.className   = 'store-dot ' + (mode === 'sqlite-wasm' ? 'dot-sqlite' : 'dot-ls');
  if (labelEl) labelEl.textContent = mode === 'sqlite-wasm' ? 'sqlite' : 'localstorage';
  console.log('[SionOS] Store mode:', mode);
});

document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    // If on email module, focus the email search instead
    if (document.getElementById('mod-email')?.classList.contains('active')) {
      const emailSearch = document.getElementById('email-search');
      if (emailSearch) { emailSearch.focus(); return; }
    }
    const dashBtn = document.querySelector('[data-module="dashboard"]');
    navigate('dashboard', dashBtn);
    setTimeout(() => {
      const input = document.getElementById('dash-quick-add');
      if (input) input.focus();
    }, 50);
  }
  // Escape closes any open form
  if (e.key === 'Escape') {
    document.querySelectorAll('.form-panel:not(.hidden)').forEach(f => {
      f.classList.add('hidden');
    });
  }
});

console.log('%c SION OS v3.0.1 ', 'background:#00ff88;color:#080808;font-weight:bold;font-family:monospace;padding:2px 8px;');
const _isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;
console.log('%c ' + (_isElectron ? 'Electron desktop app' : 'Web browser') + ' ', 'color:#666;font-family:monospace;');

/* ── Electron-aware notifications ── */
function osNotify(title, body, urgent = false) {
  if (window.electronAPI?.notify) {
    window.electronAPI.notify(title, body, urgent);
    // Also refresh tray menu so live stats update
    window.electronAPI.refreshTray?.();
  } else if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

/* ── Refresh tray after any data change ── */
function refreshTray() {
  if (window.electronAPI?.refreshTray) {
    window.electronAPI.refreshTray();
  }
}
