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
    study: 'Sion OS — Study',        gym: 'Sion OS — Gym'
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

document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    const input = document.getElementById('dash-quick-add');
    if (input) { navigate('dashboard', document.querySelector('[data-module="dashboard"]')); input.focus(); }
  }
});

console.log('%c SION OS v0.3.0 ', 'background:#00ff88;color:#080808;font-weight:bold;font-family:monospace;padding:2px 8px;');
console.log('%c Sprint 2 — Work module online. ', 'color:#666;font-family:monospace;');
