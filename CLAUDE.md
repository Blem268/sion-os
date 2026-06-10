# Sion OS — Project Context for Claude Code

## What this is
A terminal-aesthetic personal Life OS built for Sion Looby-Martinez, Antigua.
No subscriptions. No cloud. Runs as a native Mac desktop app via Electron.
Data stored in SQLite WASM with localStorage mirror.

## Owner
- **Name:** Sion Looby-Martinez
- **Location:** Antigua 🇦🇬
- **Currency:** XCD (Eastern Caribbean Dollar)

---

## Current version: v2.9.3

## Tech stack
- **Frontend:** HTML + CSS + Vanilla JavaScript (no framework)
- **Desktop:** Electron v31 (Mac, Apple Silicon arm64)
- **Database:** SQLite WASM (@sqlite.org/sqlite-wasm) + localStorage mirror
- **Font:** JetBrains Mono
- **Icons:** Tabler Icons (CDN)
- **Charts:** Chart.js v4 (CDN)
- **Environment:** dotenv (.env file — never commit)
- **Hot reload:** electron-reload (dev mode only)
- **Logging:** ~/Sion-os/logs/sionos.log
- **Backups:** ~/Sion-os/backups/ (daily at midnight)

## Run commands
```bash
npm run dev    # development — hot reload active
npm start      # production mode
bash build.sh  # package as .app
bash install.sh # install to /Applications
```

---

## File structure
```
sion-os/
├── index.html              # Main shell — all 8 module sections
├── style.css               # All styles — dark theme + light mode
├── app.js                  # Navigation, clock, theme toggle, Cmd+K
├── data/
│   ├── store.js            # SQLite WASM data layer — ALL reads/writes go here
│   └── config.js           # Single source of truth for financial constants
├── modules/
│   ├── dashboard.js        # Morning view — customisable widgets, alerts, tasks
│   ├── work.js             # Silcomm Engineering + NovaTrust task management
│   ├── blem.js             # Blem Tuned — jobs, clients, payments, auto-income
│   ├── younity.js          # Younity — project + task manager (NOT a CRM)
│   ├── blueport.js         # Blueport Agency — launch checklist + PM
│   ├── finance.js          # Income, expenses, accounts, subscriptions, transfers
│   ├── study.js            # Google PM + ACCA FOA + TRW AI Campus
│   └── gym.js              # Weight log, workouts, food/calorie tracker
├── components/
│   ├── ui.js               # Reusable UI components (MetricCard, TaskRow, Badge etc.)
│   └── charts.js           # Chart.js wrappers (weight, calories, Blem revenue, net income)
├── electron/
│   ├── main.js             # Electron main process — window, tray, notifications, backup
│   ├── preload.js          # Secure IPC bridge
│   └── utils/
│       ├── logger.js       # File logger → ~/Sion-os/logs/
│       └── backup.js       # Daily JSON backup → ~/Sion-os/backups/
├── .env                    # API keys — NEVER commit (in .gitignore)
├── package.json            # Electron + dotenv + electron-reload
├── build.sh                # Build .app
├── install.sh              # Install to /Applications
└── new-sprint.sh           # Create git branch for new sprint

```

---

## Database tables (via Store API)
All data goes through `Store` in `data/store.js`. Never use localStorage directly.

| Table | Purpose |
|-------|---------|
| tasks | Dashboard task queue |
| milestones | Custom goals + countdowns |
| work_tasks | Silcomm + NovaTrust tasks |
| blem_clients | Blem Tuned client records |
| blem_jobs | Blem Tuned job log + payments |
| younity_projects | Younity project records |
| younity_tasks | Tasks per Younity project |
| blueport_tasks | Blueport launch checklist |
| income | All income entries (linked to bank accounts) |
| expenses | All expense entries |
| commitments | Fixed monthly obligations (D-Max, Sagicor etc.) |
| subscriptions | Subscriptions with auto-renewal |
| bank_accounts | Bank account records + balances |
| account_transfers | Transfer log between accounts |
| study_lessons | Lessons across 3 courses |
| gym_weight | Daily weight entries |
| gym_sessions | Workout sessions |
| food_log | Daily food + calorie tracking |
| dashboard_widgets | Widget on/off preferences |
| user_prefs | User config preferences |

## Store API
```javascript
Store.getAll('table_name')           // get all records
Store.insert('table_name', {...})    // insert, returns record with id
Store.update('table_name', id, {...}) // update by id
Store.delete('table_name', id)       // delete by id
Store.get('key')                     // get raw key-value
Store.set('key', value)              // set raw key-value
Store.exportJSON()                   // export all data as JSON string
```

## Config API (data/config.js)
Single source of truth — reads from commitments table:
```javascript
Config.dmaxMonthly()    // D-Max monthly payment (XCD)
Config.dmaxStartDate()  // D-Max start date
Config.weightStart()    // Starting weight (lbs)
Config.weightTarget()   // Target weight (lbs)
Config.calorieTarget()  // Daily calorie target
Config.younityTarget()  // Younity monthly revenue target (XCD)
Config.fmt(amount)      // Format as currency string
Config.refresh()        // Re-read from DB (call after commitments change)
```
**Never hardcode financial values. Always use Config.**

---

## Key business context

### Sion's income sources
1. Silcomm Engineering — day job, Senior Admin
2. NovaTrust — day job, Pre-license / CRM Admin
3. Blem Tuned — automotive electricals business
4. Younity Consultancy — AI-assisted business systems
5. Blueport Agency — shipping company (launching Sep 2026)

### Critical financial facts
- D-Max (2025 Isuzu D-Max): XCD $160,000 loan at 7% over 7 years
- Monthly debt service: from commitments table (default XCD $3,414.83)
- Sagicor Life Insurance: XCD $360/month from April 2026
- Total fixed commitments: ~XCD $3,774.83/month
- Younity revenue target: XCD $2,000/month

### Blem Tuned job refs
Auto-generated as BT-001, BT-002 etc.
When a job is paid, it auto-creates an income entry in Finance and updates the linked bank account.

### Younity
This is a PROJECT MANAGER — not a CRM.
Younity's standalone tool handles clients.
The OS manages projects and tasks only.

---

## Design system
```css
/* Dark theme (default) */
--bg:     #080808   /* main background */
--bg1:    #111111   /* cards, sidebar */
--bg2:    #181818   /* inputs, hover */
--fg:     #e8e8e8   /* primary text */
--fg2:    #999999   /* secondary text */
--fg3:    #555555   /* muted text */
--green:  #00ff88   /* success, income, active */
--amber:  #ffc040   /* warning, pending */
--red:    #ff5566   /* danger, expense, overdue */
--cyan:   #00d4ff   /* info, work, blueport */
--purple: #c4a0ff   /* study, tags */
--mono:   'JetBrains Mono', monospace
```

Light mode toggled via `:root.light` class on `<html>`.
Theme stored in localStorage key `sionos_theme`.

---

## Current phase: Phase 2 complete, pre-Phase 3

### Phase 3 plans (not yet built)
- Claude API integration (natural language queries on live data)
- WhatsApp via Twilio (log jobs, check balances, mark tasks by message)
- Calendar sync (Google + Apple)
- Morning briefing via WhatsApp

### Messaging decision pending
Still deciding between WhatsApp (Twilio) and alternatives for Phase 3.

---

## Rules for Claude Code

1. **Never hardcode financial values** — always use `Config.*`
2. **Never use localStorage directly** — always use `Store.*`
3. **No frameworks** — vanilla JS only
4. **No npm packages without asking** — keep dependencies minimal
5. **All new modules follow the IIFE pattern:** `const ModuleName = (() => { ... })()`
6. **All modules auto-init:** `document.addEventListener('DOMContentLoaded', ModuleName.init)`
7. **Escape all HTML** before inserting into DOM — use `escapeHtml(str)`
8. **Config.refresh()** must be called after any commitments change
9. **Light mode** — all new CSS must have `:root.light` overrides
10. **Mobile** — all new CSS must have `@media (max-width: 640px)` rules
11. **Module CSS class must never set `display:flex`** — module-specific CSS classes (e.g. `.email-module`, `.cal-module`) must **not** include `display:flex` or `display:block`. Module visibility is controlled exclusively by `.module { display:none }` and `.module.active { display:flex }` in the base styles. Adding `display:flex` to a module-specific class overrides `display:none` and causes the module to bleed into all other views. Only use the module class for layout overrides like `gap` that don't affect visibility.
12. **NEVER hardcode personal data** — all financial values, goals, targets, dates, and personal metrics must come from the database via `Store.getAll()` or `Config.*`. If a value has not been entered by the user yet, the UI shows `$0`, `0`, or a prompt to enter it — never a default dollar amount or personal figure. This applies to:
    - D-Max loan amount and start date → read from `commitments` table
    - Weight start and target → read from `user_prefs` or `gym_weight`
    - Calorie target → read from `user_prefs`
    - Younity revenue target → read from `user_prefs`
    - Sagicor or any insurance amount → read from `commitments` table
    - Any other personal financial value → read from `commitments` or `user_prefs`
    - AI system prompts → must not contain hardcoded dollar amounts or personal targets
    - Tray menu stats → must read from database, fallback to `0` not a hardcoded amount

---

## How to add a new module
1. Create `modules/newmodule.js` following IIFE pattern
2. Add `<section id="mod-newmodule" class="module">` in `index.html`
3. Add nav button in sidebar
4. Add `<script src="modules/newmodule.js">` before `</body>`
5. Register page title in `navigate()` in `app.js`
6. Add new tables to `TABLES` array in `data/store.js`

---

*Last updated: June 2026 — v2.5.0*
*Built sprint by sprint with PM discipline.*
