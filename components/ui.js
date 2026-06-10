/* ============================================
   SION OS — components/ui.js
   v2.3.0 — Recommendation 6
   Reusable UI components — write once, use everywhere
   MetricCard, TaskRow, FormPanel, Badge, ProgressBar
   ============================================ */

const UI = (() => {

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── MetricCard ── */
  function MetricCard({ label, value, sub, accent = '', id = '' }) {
    return `
      <div class="metric-card ${accent}" ${id ? `id="${id}"` : ''}>
        <div class="mc-label">${escapeHtml(label)}</div>
        <div class="mc-val">${value}</div>
        ${sub ? `<div class="mc-sub">${escapeHtml(sub)}</div>` : ''}
      </div>`;
  }

  /* ── TaskRow ── */
  function TaskRow({ id, title, badge, done, onToggle, onDelete, meta = '' }) {
    return `
      <div class="task-row${done ? ' task-done' : ''}">
        <div class="task-check${done ? ' checked' : ''}"
             onclick="${onToggle}"
             role="checkbox" aria-checked="${done}">
          ${done ? '<i class="ti ti-check" aria-hidden="true"></i>' : ''}
        </div>
        <div class="work-task-body">
          <div class="work-task-title">${escapeHtml(title)}</div>
          ${meta ? `<div class="work-task-meta">${meta}</div>` : ''}
        </div>
        ${badge ? `<span class="task-badge badge-${badge}">${escapeHtml(badge)}</span>` : ''}
        ${onDelete ? `
          <button class="task-del" onclick="${onDelete}" aria-label="Delete">
            <i class="ti ti-x" aria-hidden="true"></i>
          </button>` : ''}
      </div>`;
  }

  /* ── Badge ── */
  function Badge(text, type = 'biz') {
    const cls = {
      work:     'badge-work',
      biz:      'badge-biz',
      blueport: 'badge-blueport',
      study:    'badge-study',
      gym:      'badge-gym',
      finance:  'badge-finance',
    }[type] || 'badge-biz';
    return `<span class="task-badge ${cls}">${escapeHtml(text)}</span>`;
  }

  /* ── Pill ── */
  function Pill(text, colour = 'gray') {
    return `<span class="pill pill-${colour}">${escapeHtml(text)}</span>`;
  }

  /* ── ProgressBar ── */
  function ProgressBar({ label, pct, colour = 'green', id = '' }) {
    return `
      <div class="prog-row">
        <span class="prog-label">${escapeHtml(label)}</span>
        <div class="prog-track">
          <div class="prog-fill ${colour}-fill" ${id ? `id="${id}"` : ''} style="width:${pct}%"></div>
        </div>
        <span class="prog-pct ${colour}">${pct}%</span>
      </div>`;
  }

  /* ── SectionLabel ── */
  function SectionLabel(text, sub = '', btnLabel = '', btnAction = '') {
    return `
      <div class="dash-section-label">
        ${escapeHtml(text)}
        ${sub ? `<span class="section-label-sub">${escapeHtml(sub)}</span>` : ''}
        ${btnLabel ? `<button class="section-btn" onclick="${btnAction}">${escapeHtml(btnLabel)}</button>` : ''}
      </div>`;
  }

  /* ── Empty state ── */
  function Empty(msg) {
    return `<div class="task-empty">${escapeHtml(msg)}</div>`;
  }

  /* ── Table row ── */
  function TableRow(cells) {
    return '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
  }

  /* ── Chart container ── */
  function ChartContainer(canvasId, height = 160) {
    return `
      <div class="chart-container" style="position:relative;height:${height}px;margin-bottom:8px;">
        <canvas id="${canvasId}"></canvas>
      </div>`;
  }

  /* ── Chart empty state ── */
  function setupChartEmpty() {
    // Inject chart-empty style if not already present
    if (!document.getElementById('chart-empty-style')) {
      const style = document.createElement('style');
      style.id    = 'chart-empty-style';
      style.textContent = `
        .chart-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          font-size: 10px;
          color: var(--fg3);
          font-family: var(--mono);
          border: 0.5px dashed var(--border2);
          border-radius: var(--radius);
          padding: 10px;
        }
      `;
      document.head.appendChild(style);
    }
  }

  setupChartEmpty();

  return {
    MetricCard,
    TaskRow,
    Badge,
    Pill,
    ProgressBar,
    SectionLabel,
    Empty,
    TableRow,
    ChartContainer,
    escapeHtml,
  };

})();
