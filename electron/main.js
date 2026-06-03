/* ============================================
   SION OS — electron/main.js
   v2.2.0 — Phase 2 / Sprint 10
   Tray polish, native notifications,
   morning briefing, live tray menu,
   auto-refresh
   ============================================ */

const { app, BrowserWindow, Tray, Menu, nativeImage,
        shell, ipcMain, Notification } = require('electron');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

// ── SQLite WASM flags ──
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');

// ── References ──
let mainWindow    = null;
let tray          = null;
let briefingTimer = null;
let refreshTimer  = null;

const isDev    = process.argv.includes('--dev');
const dataDir  = path.join(os.homedir(), 'SionOS');
const iconPath = path.join(__dirname, 'assets', 'icon.png');
const iconPathTemplate = path.join(__dirname, 'assets', 'icon-template.png');

// ── Ensure data directory exists ──
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ── Single instance lock ──
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

/* ── Create main window ── */
function createWindow() {
  mainWindow = new BrowserWindow({
    width:            1280,
    height:           820,
    minWidth:         900,
    minHeight:        600,
    title:            'Sion OS',
    backgroundColor:  '#080808',
    titleBarStyle:    'hiddenInset',
    trafficLightPosition: { x: 16, y: 14 },
    vibrancy:         'under-window',
    visualEffectState: 'active',
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      preload:          path.join(__dirname, 'preload.js'),
      additionalArguments: ['--enable-features=SharedArrayBuffer'],
    },
    icon: iconPath,
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
    // Start auto-refresh
    startAutoRefresh();
  });

  // Minimise to tray on close
  mainWindow.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      mainWindow.hide();
      // Show "minimised to tray" notification once
      if (!global.shownTrayHint) {
        showNotification('Sion OS', 'Running in the background. Click the menu bar icon to reopen.');
        global.shownTrayHint = true;
      }
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

/* ── Build tray icon ── */
function buildTrayIcon() {
  let icon;
  try {
    const raw = nativeImage.createFromPath(iconPath);
    if (!raw.isEmpty()) {
      icon = raw.resize({ width: 18, height: 18 });
      icon.setTemplateImage(true); // Mac auto dark/light
    } else throw new Error('empty');
  } catch {
    // Fallback: create a minimal 1x1 image
    icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    );
  }
  return icon;
}

/* ── Get live stats from renderer ── */
async function getLiveStats() {
  if (!mainWindow) return null;
  try {
    return await mainWindow.webContents.executeJavaScript(`
      (() => {
        try {
          const blemJobs    = Store.getAll('blem_jobs');
          const yClients    = Store.getAll('younity_clients');
          const bpTasks     = Store.getAll('blueport_tasks');
          const income      = Store.getAll('income');
          const now         = new Date();
          const thisMonth   = r => {
            const d = new Date(r.received_date || r.created_at || '');
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          };
          return {
            blemActive:    blemJobs.filter(j => j.status !== 'Complete').length,
            blemRevenue:   blemJobs.filter(j => thisMonth(j)).reduce((s,j) => s+(parseFloat(j.amount_paid_xcd)||0), 0),
            younityActive: yClients.filter(c => c.stage==='Active'||c.stage==='Retained').length,
            bpPct:         bpTasks.length ? Math.round(bpTasks.filter(t=>t.done).length/bpTasks.length*100) : 0,
            incomeMonth:   income.filter(i => thisMonth(i)).reduce((s,i) => s+(parseFloat(i.amount_xcd)||0), 0),
          };
        } catch(e) { return null; }
      })()
    `);
  } catch { return null; }
}

/* ── Build live tray menu ── */
async function buildTrayMenu() {
  const stats = await getLiveStats();

  const blemLabel    = stats ? `Blem Tuned  —  ${stats.blemActive} active · $${stats.blemRevenue.toLocaleString()} this month` : 'Blem Tuned';
  const younityLabel = stats ? `Younity  —  ${stats.younityActive} active client${stats.younityActive !== 1 ? 's' : ''}` : 'Younity';
  const bpLabel      = stats ? `Blueport  —  ${stats.bpPct}% launch progress` : 'Blueport';

  const template = [
    {
      label:   '🖥  Open Sion OS',
      click:   () => { mainWindow?.show(); mainWindow?.focus(); }
    },
    { type: 'separator' },
    {
      label:   '📋  Dashboard',
      click:   () => openModule('dashboard')
    },
    {
      label:   `🔧  ${blemLabel}`,
      click:   () => openModule('blem')
    },
    {
      label:   `👥  ${younityLabel}`,
      click:   () => openModule('younity')
    },
    {
      label:   `🚢  ${bpLabel}`,
      click:   () => openModule('blueport')
    },
    {
      label:   '💰  Finance',
      click:   () => openModule('finance')
    },
    { type: 'separator' },
    {
      label:   '💾  Export data backup',
      click:   () => {
        mainWindow?.show();
        mainWindow?.webContents.executeJavaScript(`App.exportData()`);
      }
    },
    {
      label:   '🔄  Refresh dashboard',
      click:   () => {
        mainWindow?.webContents.executeJavaScript(`Dashboard.renderAll()`);
      }
    },
    { type: 'separator' },
    {
      label:   '⚙️  Preferences',
      enabled: false,
      label:   `Sion OS v2.2.0  ·  antigua 🇦🇬`,
    },
    { type: 'separator' },
    {
      label: '✕  Quit Sion OS',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ];

  return Menu.buildFromTemplate(template);
}

function openModule(name) {
  mainWindow?.show();
  mainWindow?.focus();
  mainWindow?.webContents.executeJavaScript(
    `navigate('${name}', document.querySelector('[data-module="${name}"]'))`
  );
}

/* ── Create tray ── */
async function createTray() {
  const icon = buildTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('Sion OS');

  const menu = await buildTrayMenu();
  tray.setContextMenu(menu);

  // Rebuild menu with live data every 5 minutes
  setInterval(async () => {
    if (tray) {
      const updated = await buildTrayMenu();
      tray.setContextMenu(updated);
    }
  }, 5 * 60 * 1000);

  // Left click toggles window
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
}

/* ── Native notifications ── */
function showNotification(title, body, urgent = false) {
  if (!Notification.isSupported()) return;
  const n = new Notification({
    title,
    body,
    silent:  !urgent,
    icon:    iconPath,
  });
  n.show();
}

/* ── Morning briefing ── */
function scheduleMorningBriefing() {
  if (briefingTimer) clearTimeout(briefingTimer);

  const now    = new Date();
  const target = new Date();
  target.setHours(7, 0, 0, 0); // 7:00 AM

  // If already past 7am today, schedule for tomorrow
  if (now >= target) target.setDate(target.getDate() + 1);

  const msUntil = target - now;

  briefingTimer = setTimeout(async () => {
    await sendMorningBriefing();
    // Reschedule for next day
    scheduleMorningBriefing();
  }, msUntil);

  console.log(`[SionOS] Morning briefing scheduled for ${target.toLocaleTimeString()}`);
}

async function sendMorningBriefing() {
  const stats = await getLiveStats();
  if (!stats) return;

  const daysToLaunch = Math.ceil((new Date('2026-09-01') - new Date()) / 86400000);
  const daysToDMax   = Math.ceil((new Date('2026-08-01') - new Date()) / 86400000);

  let body = '';
  if (daysToDMax > 0) body += `D-Max in ${daysToDMax} days. `;
  if (stats.blemActive > 0) body += `${stats.blemActive} Blem job${stats.blemActive > 1 ? 's' : ''} active. `;
  if (stats.younityActive > 0) body += `${stats.younityActive} Younity client${stats.younityActive > 1 ? 's' : ''} active. `;
  body += `Blueport ${stats.bpPct}% to launch.`;

  showNotification('Good morning, Sion.', body || 'Have a productive day.', false);
}

/* ── Auto-refresh dashboard every 5 minutes ── */
function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    mainWindow?.webContents.executeJavaScript(
      `if(typeof Dashboard !== 'undefined') Dashboard.renderAll()`
    ).catch(() => {});
  }, 5 * 60 * 1000);
}

/* ── Alert checker — runs every hour ── */
function startAlertChecker() {
  setInterval(async () => {
    const stats = await getLiveStats();
    if (!stats) return;

    // D-Max coverage alert
    const coverage = stats.incomeMonth / 3414.83 * 100;
    if (coverage < 100 && stats.incomeMonth > 0) {
      showNotification(
        '⚠️ D-Max coverage low',
        `Coverage at ${Math.round(coverage)}% — income below $3,414.83 this month`,
        true
      );
    }
  }, 60 * 60 * 1000); // every hour
}

/* ── IPC handlers ── */
ipcMain.on('open-external', (_, url) => shell.openExternal(url));

ipcMain.on('notify', (_, { title, body, urgent }) => {
  showNotification(title, body, urgent);
});

ipcMain.handle('get-data-dir', () => dataDir);

ipcMain.on('refresh-tray', async () => {
  if (tray) {
    const updated = await buildTrayMenu();
    tray.setContextMenu(updated);
  }
});

/* ── Mac login item ── */
function setLoginItem() {
  app.setLoginItemSettings({
    openAtLogin:  true,
    openAsHidden: true,
    path:         app.getPath('exe'),
  });
}

/* ── App lifecycle ── */
app.whenReady().then(async () => {
  createWindow();
  await createTray();
  setLoginItem();
  scheduleMorningBriefing();
  startAlertChecker();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  app.isQuiting = true;
  if (briefingTimer) clearTimeout(briefingTimer);
  if (refreshTimer)  clearInterval(refreshTimer);
});
