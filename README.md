# Sion OS

> A terminal-aesthetic Life OS. No subscriptions. No cloud. Yours.

## Status

| Sprint | Module | Status | Date |
|--------|--------|--------|------|
| 0 | Shell + deploy | ✅ Done | 9–13 Jun 2026 |
| 1 | Dashboard + Milestones | ✅ Done | 16–20 Jun 2026 |
| 2 | Work | ✅ Done | 23–27 Jun 2026 |
| 3 | Blem Tuned | ✅ Done | 30 Jun–4 Jul 2026 |
| 4 | Younity + Blueport | ✅ Done | 7–11 Jul 2026 |
| 5 | Finance | ✅ Done | 14–18 Jul 2026 |
| 6 | Study + Gym | ✅ Done | 21–25 Jul 2026 |
| 7 | Polish + Ship | ✅ Done | 28 Jul–1 Aug 2026 |

## Live URL
[https://blem268.github.io/sion-os](https://blem268.github.io/sion-os)

## Run locally
No build step. Open `index.html` in any browser.

## Stack
- HTML + CSS + Vanilla JS
- JetBrains Mono · Tabler Icons
- localStorage → SQLite (Phase 2)
- GitHub Pages

---

## v1.0.0 — Shipped

All 8 modules live. Dashboard pulls real data from every module.
Smart alerts. Light/dark theme. JSON data export. Cmd+K quick-add.

**Phase 2 next:** Electron desktop app + SQLite local database.

---

## Phase 2 — Desktop app (v2.0.0)

### Run as desktop app

```bash
cd ~/sion-os
npm install
npm start
```

### What Phase 2 adds
- Native Mac window via Electron
- System tray icon — always one click away
- Minimise to tray instead of closing
- Opens at Mac startup (hidden to tray)
- Right-click tray menu: Dashboard, Blem Tuned, Finance, Export, Quit
- Native Mac notifications for alerts

### Phase 2 sprint plan
| Sprint | Feature | Status |
|--------|---------|--------|
| 8 | Electron shell + tray + startup | 🔜 Building |
| 9 | SQLite local database migration | ⏳ |
| 10 | System tray polish + notifications | ⏳ |
| 11 | Package as .app bundle | ⏳ |

---

## Phase 2 complete — v2.2.0

### Build as Mac .app

```bash
cd ~/Sion-os
bash build.sh
```

This:
1. Converts the iconset to `.icns`
2. Packages everything into `dist/mac-arm64/Sion OS.app`
3. Opens the dist folder in Finder

### Install to Applications

```bash
bash install.sh
```

Then launch from Spotlight: `Cmd+Space` → `Sion OS`

### Phase 2 sprints complete

| Sprint | Feature | Status |
|--------|---------|--------|
| 8  | Electron desktop app | ✅ |
| 9  | SQLite WASM database | ✅ |
| 10 | Tray + notifications | ✅ |
| 11 | .app bundle + install | ✅ |

### Phase 3 next
- Claude API integration
- WhatsApp via Twilio
- Calendar sync
- Morning briefing via WhatsApp
