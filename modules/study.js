/* ============================================
   SION OS — study.js
   v0.7.0 — Sprint 6
   US-014: Course progress + knowledge base
   US-015: Business tagging per lesson
   ============================================ */

const Study = (() => {

  const TRACKS = {
    gpm:  { label: 'Google PM Foundations', unit: 'lesson'  },
    acca: { label: 'ACCA FOA',              unit: 'chapter' },
    trw:  { label: 'TRW AI Campus',         unit: 'lesson'  },
  };

  const APPLY_CLS = {
    'Blem Tuned': 'badge-biz',
    'Younity':    'badge-biz',
    'Blueport':   'badge-blueport',
    'All':        'badge-work',
    'Personal':   'badge-study',
    'N/A':        '',
  };

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function getLessons(track) {
    return Store.getAll('study_lessons').filter(l => l.course === track);
  }

  /* ── Render metrics ── */
  function renderMetrics() {
    const all = Store.getAll('study_lessons');

    Object.keys(TRACKS).forEach(track => {
      const lessons  = all.filter(l => l.course === track);
      const done     = lessons.filter(l => l.status === 'Complete').length;
      const total    = lessons.length;
      const pct      = total > 0 ? Math.round(done / total * 100) : 0;
      const unit     = TRACKS[track].unit;

      setEl(`st-${track}-pct`, pct + '%');
      setEl(`st-${track}-sub`, total + ' ' + unit + (total !== 1 ? 's' : '') + ' · ' + done + ' done');

      const bar = document.getElementById(`st-${track}-bar`);
      if (bar) bar.style.width = pct + '%';
    });

    // Study ROI
    const tagged = all.filter(l =>
      l.status === 'Complete' && l.apply_to && l.apply_to !== 'N/A' && l.apply_to !== 'Personal'
    ).length;
    const completed = all.filter(l => l.status === 'Complete').length;
    const roi = completed > 0 ? Math.round(tagged / completed * 100) : 0;
    setEl('st-roi', roi + '%');
  }

  /* ── Render track list ── */
  function renderTrack(track) {
    const el = document.getElementById(`st-${track}-list`);
    if (!el) return;

    const lessons = getLessons(track);
    if (!lessons.length) {
      el.innerHTML = '<div class="task-empty">no lessons yet — add one above</div>';
      return;
    }

    el.innerHTML = lessons.map(l => {
      const isDone   = l.status === 'Complete';
      const applyCls = APPLY_CLS[l.apply_to] || '';
      return `
        <div class="task-row ${isDone ? 'task-done' : ''}">
          <div class="task-check ${isDone ? 'checked' : ''}"
               onclick="Study.toggleLesson(${l.id})"
               role="checkbox" aria-checked="${isDone}">
            ${isDone ? '<i class="ti ti-check" aria-hidden="true"></i>' : ''}
          </div>
          <div class="work-task-body">
            <div class="work-task-title">${escapeHtml(l.title)}</div>
            <div class="work-task-meta">
              ${l.apply_to && l.apply_to !== 'N/A'
                ? `<span class="task-badge ${applyCls}">${escapeHtml(l.apply_to)}</span>` : ''}
              ${l.key_concepts
                ? `<span class="work-note-preview">${escapeHtml(l.key_concepts)}</span>` : ''}
            </div>
          </div>
          <button class="task-del" onclick="Study.deleteLesson(${l.id})" aria-label="Delete">
            <i class="ti ti-x" aria-hidden="true"></i>
          </button>
        </div>`;
    }).join('');
  }

  /* ── Render skills index ── */
  function renderSkills() {
    const el      = document.getElementById('st-skills-grid');
    const countEl = document.getElementById('st-skills-count');
    if (!el) return;

    const completed = Store.getAll('study_lessons')
      .filter(l => l.status === 'Complete')
      .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

    if (countEl) countEl.textContent = completed.length + ' skills logged';

    if (!completed.length) {
      el.innerHTML = '<div class="task-empty">complete lessons to build your skills index</div>';
      return;
    }

    el.innerHTML = completed.map(l => {
      const trackLabel = {
        gpm:  'Google PM',
        acca: 'ACCA FOA',
        trw:  'TRW AI',
      }[l.course] || l.course;

      const trackCls = {
        gpm:  'badge-work',
        acca: 'badge-biz',
        trw:  'badge-study',
      }[l.course] || '';

      return `
        <div class="skill-card">
          <div class="skill-title">${escapeHtml(l.title)}</div>
          <div class="skill-meta">
            <span class="task-badge ${trackCls}">${trackLabel}</span>
            ${l.apply_to && l.apply_to !== 'N/A'
              ? `<span class="task-badge ${APPLY_CLS[l.apply_to] || ''}">${escapeHtml(l.apply_to)}</span>` : ''}
          </div>
          ${l.key_concepts
            ? `<div class="skill-concepts">${escapeHtml(l.key_concepts)}</div>` : ''}
        </div>`;
    }).join('');
  }

  /* ── Toggle lesson ── */
  function toggleLesson(id) {
    const lesson = Store.getAll('study_lessons').find(l => l.id === id);
    if (!lesson) return;
    const newStatus = lesson.status === 'Complete' ? 'Not Started' : 'Complete';
    Store.update('study_lessons', id, {
      status:       newStatus,
      completed_at: newStatus === 'Complete' ? new Date().toISOString().split('T')[0] : null,
    });
    renderAll();
  }

  /* ── Delete lesson ── */
  function deleteLesson(id) {
    const lesson = Store.getAll('study_lessons').find(l => l.id === id);
    if (!lesson) return;
    Store.delete('study_lessons', id);
    renderAll();
  }

  /* ── Lesson forms ── */
  function showLessonForm(track) {
    hideLessonForm(track);
    const form = document.getElementById(`st-${track}-form`);
    if (form) { form.classList.remove('hidden'); }
    document.getElementById(`sl-${track}-title`)?.focus();
  }

  function hideLessonForm(track) {
    const form = document.getElementById(`st-${track}-form`);
    if (form) form.classList.add('hidden');
    const titleEl    = document.getElementById(`sl-${track}-title`);
    const conceptsEl = document.getElementById(`sl-${track}-concepts`);
    if (titleEl)    titleEl.value    = '';
    if (conceptsEl) conceptsEl.value = '';
  }

  function saveLesson(track) {
    const title = document.getElementById(`sl-${track}-title`)?.value.trim();
    if (!title) { document.getElementById(`sl-${track}-title`)?.focus(); return; }

    Store.insert('study_lessons', {
      course:       track,
      title,
      status:       'Not Started',
      key_concepts: document.getElementById(`sl-${track}-concepts`)?.value.trim() || '',
      apply_to:     document.getElementById(`sl-${track}-apply`)?.value || 'N/A',
      practice_done: false,
      completed_at: null,
    });

    hideLessonForm(track);
    renderAll();
  }

  function setEl(id, val) {
    const el = document.getElementById(id); if (el) el.textContent = val;
  }

  function renderAll() {
    renderMetrics();
    Object.keys(TRACKS).forEach(renderTrack);
    renderSkills();
  }

  function init() { renderAll(); }

  return {
    init, renderAll,
    toggleLesson, deleteLesson,
    showLessonForm, hideLessonForm, saveLesson,
  };

})();

document.addEventListener('DOMContentLoaded', Study.init);
