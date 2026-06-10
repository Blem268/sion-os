/* ============================================
   SION OS — pomodoro.js
   v2.7.0 — Sprint 15B
   Pomodoro timer with auto-session logging
   ============================================ */

const Pomodoro = (() => {

  const CIRCUMFERENCE = 339.3; // 2π × 54

  let _mode        = 'work';
  let _running     = false;
  let _interval    = null;
  let _remaining   = 25 * 60;
  let _total       = 25 * 60;
  let _sessions    = 0;
  let _currentTask = null;

  let _durations = { work: 25, short: 5, long: 15 };

  const MODE_LABELS = { work: 'Focus Session', short: 'Short Break', long: 'Long Break' };

  function applySettings(settings) {
    _durations.work  = settings.pom_work  || 25;
    _durations.short = settings.pom_short || 5;
    _durations.long  = settings.pom_long  || 15;
    if (!_running) {
      _remaining = _durations[_mode] * 60;
      _total     = _remaining;
      updateDisplay();
    }
  }

  function setMode(mode) {
    if (_running) return;
    _mode        = mode;
    _remaining   = _durations[mode] * 60;
    _total       = _remaining;
    _currentTask = null;
    updateDisplay();
    updateModeButtons();
  }

  function startForTask(taskName, workMins) {
    _currentTask = taskName;
    _mode        = 'work';
    _remaining   = (workMins || _durations.work) * 60;
    _total       = _remaining;
    updateModeButtons();
    start();
    document.getElementById('study-pomodoro-card')?.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }

  function toggle() {
    if (_running) pause();
    else          start();
  }

  function start() {
    if (_running) return;
    _running  = true;
    _interval = setInterval(tick, 1000);
    const btn = document.getElementById('pom-toggle');
    if (btn) btn.innerHTML = '<i class="ti ti-player-pause" aria-hidden="true"></i> Pause';
  }

  function pause() {
    _running = false;
    clearInterval(_interval);
    const btn = document.getElementById('pom-toggle');
    if (btn) btn.innerHTML = '<i class="ti ti-player-play" aria-hidden="true"></i> Resume';
  }

  function reset() {
    pause();
    _remaining   = _durations[_mode] * 60;
    _total       = _remaining;
    _currentTask = null;
    const btn = document.getElementById('pom-toggle');
    if (btn) btn.innerHTML = '<i class="ti ti-player-play" aria-hidden="true"></i> Start';
    updateDisplay();
  }

  function tick() {
    if (_remaining <= 0) { complete(); return; }
    _remaining--;
    updateDisplay();
  }

  function complete() {
    pause();
    _remaining = 0;
    updateDisplay();

    if (window.electronAPI?.notify) {
      if (_mode === 'work') {
        window.electronAPI.notify('Pomodoro complete! 🍅', `${_currentTask || 'Focus session'} done — take a break.`, false);
      } else {
        window.electronAPI.notify('Break over', 'Time to get back to work.', false);
      }
    }

    if (_mode === 'work') {
      _sessions++;
      const mins = _durations.work;
      Store.insert('study_sessions', {
        topic:         _currentTask || 'Pomodoro session',
        course:        'other',
        session_date:  new Date().toISOString().split('T')[0],
        duration_mins: mins,
        source:        'Pomodoro',
        notes:         'Auto-logged by Pomodoro timer',
      });
      if (typeof Study !== 'undefined') {
        Study.renderSessions();
        Study.renderMetrics();
      }
      setEl('pom-sessions-today', _sessions);

      const nextMode = _sessions % 4 === 0 ? 'long' : 'short';
      setEl('pom-next-label', `switching to ${nextMode} break...`);
      setTimeout(() => { setMode(nextMode); }, 2000);
    } else {
      setEl('pom-next-label', 'break done — ready to focus');
      setTimeout(() => { setMode('work'); }, 2000);
    }
  }

  function updateDisplay() {
    const mins    = Math.floor(_remaining / 60);
    const secs    = _remaining % 60;
    setEl('pom-time', `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`);
    setEl('pom-session-label', MODE_LABELS[_mode]);
    setEl('pom-current-task', _currentTask || 'no task selected');

    const pct    = _total > 0 ? (_total - _remaining) / _total : 0;
    const offset = CIRCUMFERENCE * (1 - pct);
    const ring   = document.getElementById('pom-ring');
    if (ring) {
      ring.style.strokeDashoffset = offset;
      ring.style.stroke = { work:'var(--green)', short:'var(--cyan)', long:'var(--purple)' }[_mode];
    }

    const nextMode = _sessions % 4 === 3 ? 'long break' : _mode === 'work' ? 'short break' : 'focus';
    if (!document.getElementById('pom-next-label')?.textContent.includes('switching') &&
        !document.getElementById('pom-next-label')?.textContent.includes('done')) {
      setEl('pom-next-label', `next: ${nextMode}`);
    }
  }

  function updateModeButtons() {
    ['work','short','long'].forEach(m => {
      const btn = document.getElementById(`pom-btn-${m}`);
      if (btn) btn.style.color = m === _mode ? 'var(--green)' : '';
    });
  }

  function setEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

  function init() {
    const savedSettings = Store.get('study_settings');
    if (savedSettings) applySettings(savedSettings);

    const todayStr = new Date().toISOString().split('T')[0];
    _sessions = Store.getAll('study_sessions')
      .filter(s => s.session_date === todayStr && s.source === 'Pomodoro').length;
    setEl('pom-sessions-today', _sessions);
    updateDisplay();
    updateModeButtons();
  }

  return { init, toggle, reset, setMode, startForTask, applySettings };

})();

document.addEventListener('DOMContentLoaded', Pomodoro.init);
