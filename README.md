# Sion OS

> A terminal-aesthetic Life OS built for Sion Looby-Martinez, Antigua. No subscriptions. No cloud. Yours.

## What this is

A web-based personal operating system that tracks work, business, finances, study, and health — all in one terminal-style interface. Built from scratch, sprint by sprint.

## Project status

| Sprint | Module | Status | Target date |
|--------|--------|--------|-------------|
| 0 | Shell + deploy | ✅ Done | 9–13 Jun 2026 |
| 1 | Dashboard + Milestones | ✅ Done | 16–20 Jun 2026 |
| 2 | Work (Silcomm + NovaTrust) | 🔜 Next | 23–27 Jun 2026 |
| 3 | Blem Tuned | ⏳ Planned | 30 Jun–4 Jul 2026 |
| 4 | Younity + Blueport | ⏳ Planned | 7–11 Jul 2026 |
| 5 | Finance | ⏳ Planned | 14–18 Jul 2026 |
| 6 | Study + Gym | ⏳ Planned | 21–25 Jul 2026 |
| 7 | Integration + Polish | ⏳ Planned | 28 Jul–1 Aug 2026 |

**Phase 1 ships: 1 August 2026**

## Tech stack

- HTML + CSS + Vanilla JavaScript
- JetBrains Mono (Google Fonts)
- Tabler Icons
- localStorage (Phase 1) → SQLite via Electron (Phase 2)
- Hosted on GitHub Pages

## Live URL

[https://blem268.github.io/sion-os](https://blem268.github.io/sion-os)

## File structure

```
sion-os/
├── index.html          Main shell
├── style.css           Terminal theme
├── app.js              Navigation + clock
├── data/
│   └── store.js        localStorage abstraction (all reads/writes go here)
├── modules/
│   ├── dashboard.js    Sprint 1
│   ├── work.js         Sprint 2
│   ├── blem.js         Sprint 3
│   ├── younity.js      Sprint 4
│   ├── blueport.js     Sprint 4
│   ├── finance.js      Sprint 5
│   ├── study.js        Sprint 6
│   └── gym.js          Sprint 6
└── README.md
```

## How to run locally

No build step. No npm. Just open `index.html` in your browser.

```bash
git clone https://github.com/blem268/sion-os.git
cd sion-os
open index.html
```

## How to add a module (for future sprints)

1. Create `modules/yourmodule.js`
2. Add a `<section id="mod-yourmodule" class="module">` in `index.html`
3. Add a nav button in the sidebar
4. Add a `<script src="modules/yourmodule.js">` before `</body>`
5. Register the title in `app.js` navigate() titles map

## Project documents

All planning docs live in the project folder:

- `sion_os_user_stories.md` — 35 user stories (US-001 to US-035)
- `sion_os_tech_stack.md` — Technology decisions and rationale
- `sion_os_information_architecture.md` — 14 database tables + ERD
- `sion_os_sprint_plan.md` — Sprint plan, Phase 1

## Roadmap

- **Phase 2** — Electron desktop app + SQLite local database
- **Phase 3** — Claude API + WhatsApp integration via Twilio
- **Phase 4** — OS builder for others (Younity product)

---

Built with discipline. Shipped without a subscription.
