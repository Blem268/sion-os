/* ============================================
   SION OS — app.js
   v0.1.0 — Sprint 0
   Navigation, clock, module routing.
   ============================================ */

/* ── Clock & date ── */
function updateClock() {
  const now = new Date();
  const time = now.toLocaleTimeString('en-AG', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const date = now.toLocaleDateString('en-AG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const clockEl = document.getElementById('clock');
  const dateEl  = document.getElementById('today-date');
  if (clockEl) clockEl.textContent = time;
  if (dateEl)  dateEl.textContent  = date;
}

updateClock();
setInterval(updateClock, 1000);

/* ── Navigation ── */
function navigate(moduleId, btn) {
  // Hide all modules
  document.querySelectorAll('.module').forEach(m => {
    m.classList.remove('active');
  });

  // Deactivate all nav items
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.remove('active');
  });

  // Show target module
  const target = document.getElementById('mod-' + moduleId);
  if (target) target.classList.add('active');

  // Activate nav button
  if (btn) btn.classList.add('active');

  // Update page title
  const titles = {
    dashboard: 'Sion OS — Dashboard',
    work:      'Sion OS — Work',
    blem:      'Sion OS — Blem Tuned',
    younity:   'Sion OS — Younity',
    blueport:  'Sion OS — Blueport',
    finance:   'Sion OS — Finance',
    study:     'Sion OS — Study',
    gym:       'Sion OS — Gym'
  };
  document.title = titles[moduleId] || 'Sion OS';

  // Persist last active module
  Store.set('last_module', moduleId);
}

/* ── Restore last module on load ── */
(function restoreModule() {
  const last = Store.get('last_module');
  if (last) {
    const btn = document.querySelector(`[data-module="${last}"]`);
    if (btn) navigate(last, btn);
  }
})();

/* ── Keyboard shortcut: Cmd+K / Ctrl+K (quick nav placeholder) ── */
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    // Sprint 1+: open quick-add prompt
    console.log('[SionOS] Cmd+K — quick-add coming in Sprint 1');
  }
});

console.log('%c SION OS v0.2.0 ', 'background:#00ff88;color:#080808;font-weight:bold;font-family:monospace;padding:2px 8px;');
console.log('%c Sprint 1 — Dashboard + Milestones online. ', 'color:#666;font-family:monospace;');
