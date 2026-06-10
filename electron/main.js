/* ============================================
   SION OS — electron/main.js
   v2.3.0 — Infrastructure upgrade
   electron-reload, dotenv, logger,
   automated backup, git branches ready
   ============================================ */

// ── Load environment variables first ──
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { app, BrowserWindow, Tray, Menu, nativeImage,
        shell, ipcMain, Notification } = require('electron');
const path   = require('path');
const os     = require('os');
const fs     = require('fs');
const logger      = require('./utils/logger');
const backup      = require('./utils/backup');
const vault       = require('./utils/vault');
const ai          = require('./utils/ai');
const gmail       = require('./utils/gmail');
const emailAI     = require('./utils/emailAI');
const alertEngine = require('./utils/alertEngine');

// ── Hot reload in dev mode ──
const isDev = process.argv.includes('--dev');
if (isDev) {
  try {
    require('electron-reload')(__dirname, {
      electron: require(`${__dirname}/../node_modules/.bin/electron`),
      hardResetMethod: 'exit',
      watched: [
        path.join(__dirname, '..', 'index.html'),
        path.join(__dirname, '..', 'style.css'),
        path.join(__dirname, '..', 'app.js'),
        path.join(__dirname, '..', 'data', 'store.js'),
        path.join(__dirname, '..', 'modules'),
        path.join(__dirname, '..', 'components'),
      ]
    });
    logger.info('Hot reload enabled — watching files');
  } catch(e) {
    logger.warn('electron-reload not available:', e.message);
  }
}

// ── SQLite WASM + OPFS flags ──
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');
// Note: --harmony-sharedarraybuffer removed — not supported in Node 24

// ── References ──
let mainWindow    = null;
let tray          = null;
let briefingTimer = null;
let refreshTimer  = null;

// isDev defined above
const dataDir  = path.join(os.homedir(), 'Sion-os');
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

  // Inject COOP/COEP headers required for SharedArrayBuffer + Atomics
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Cross-Origin-Opener-Policy':   ['same-origin'],
        'Cross-Origin-Embedder-Policy': ['require-corp'],
      }
    });
  });

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
          const yClients    = Store.getAll('younity_projects');
          const bpTasks     = Store.getAll('blueport_tasks');
          const income      = Store.getAll('income');
          const now         = new Date();
          const thisMonth   = r => {
            const d = new Date(r.received_date || r.created_at || '');
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          };
          const dmax = Store.getAll('commitments').find(c => c.name?.toLowerCase().includes('d-max') || c.name?.toLowerCase().includes('dmax'));
          return {
            blemActive:    blemJobs.filter(j => j.status !== 'Complete').length,
            blemRevenue:   blemJobs.filter(j => thisMonth(j)).reduce((s,j) => s+(parseFloat(j.amount_paid_xcd)||0), 0),
            younityActive: yClients.filter(c => c.stage==='Active'||c.stage==='Retained').length,
            bpPct:         bpTasks.length ? Math.round(bpTasks.filter(t=>t.done).length/bpTasks.length*100) : 0,
            incomeMonth:   income.filter(i => thisMonth(i)).reduce((s,i) => s+(parseFloat(i.amount_xcd)||0), 0),
            dmaxMonthly:   dmax ? parseFloat(dmax.monthly_xcd) || 0 : 0,
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
      label:   `Sion OS v3.0.1  ·  antigua 🇦🇬`,
      enabled: false,
    },
    {
      label:   '⚙️  Preferences',
      enabled: false,
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

  logger.info(`[SionOS] Morning briefing scheduled for ${target.toLocaleTimeString()}`);
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

/* ── Alert engine — collect data from renderer, evaluate, write back ── */
async function runAlertEvaluation() {
  if (!mainWindow) return [];
  try {
    const data = await mainWindow.webContents.executeJavaScript(`
      JSON.parse(JSON.stringify((() => ({
        alert_rules:    Store.getAll('alert_rules'),
        alerts:         Store.getAll('alerts'),
        commitments:    Store.getAll('commitments'),
        income:         Store.getAll('income'),
        subscriptions:  Store.getAll('subscriptions'),
        blem_jobs:      Store.getAll('blem_jobs'),
        younity_tasks:  Store.getAll('younity_tasks'),
        blueport_tasks: Store.getAll('blueport_tasks'),
        gym_weight:     Store.getAll('gym_weight'),
        bank_accounts:  Store.getAll('bank_accounts'),
        study_settings: Store.get('study_settings'),
      }))())
    `);

    // Seed system rules on first run
    if (!data.alert_rules || data.alert_rules.length === 0) {
      const seeded = alertEngine.SYSTEM_RULES.map((rule, i) => ({
        id: i + 1, created_at: new Date().toISOString(), ...rule,
      }));
      await mainWindow.webContents.executeJavaScript(
        `Store.set('alert_rules', ${JSON.stringify(seeded)}); null`
      );
      data.alert_rules = seeded;
      logger.info('[AlertEngine] Seeded', seeded.length, 'system rules');
    }

    const newAlerts    = alertEngine.evaluate(data);
    const dismissed    = (data.alerts || []).filter(a => a.dismissed);
    const maxId        = (data.alerts || []).reduce((m, a) => Math.max(m, a.id || 0), 0);
    const alertsWithId = newAlerts.map((a, i) => ({ id: maxId + i + 1, ...a }));
    const allAlerts    = [...dismissed, ...alertsWithId];

    await mainWindow.webContents.executeJavaScript(
      `Store.set('alerts', ${JSON.stringify(allAlerts)}); null`
    );
    return alertsWithId;
  } catch(e) {
    logger.warn('[AlertEngine] Evaluation failed:', e.message);
    return [];
  }
}

/* ── IPC handlers ── */

// Claude AI query — main process only, API key never touches renderer
ipcMain.handle('ai-query', async (_, { question, storeData }) => {
  try {
    logger.info('[AI] Query received:', question.slice(0, 60));
    const response = await ai.callClaude(question, storeData);
    const actions  = ai.parseActions(response);
    const display  = ai.cleanResponse(response);
    logger.info('[AI] Response length:', display.length, '| Actions:', actions.length);
    return { success: true, response: display, actions };
  } catch(e) {
    logger.error('[AI] Query failed:', e.message);
    return { success: false, error: e.message };
  }
});

// Alert engine IPC
ipcMain.handle('get-alerts', async () => {
  try {
    if (!mainWindow) return { alerts: [] };
    const alerts = await mainWindow.webContents.executeJavaScript(
      `JSON.parse(JSON.stringify(Store.getAll('alerts').filter(a => !a.dismissed)))`
    );
    return { alerts: alerts || [] };
  } catch(e) { return { alerts: [] }; }
});

ipcMain.handle('dismiss-alert', async (_, id) => {
  try {
    if (!mainWindow) return { success: false };
    await mainWindow.webContents.executeJavaScript(
      `Store.update('alerts', ${parseInt(id)}, { dismissed: true }); null`
    );
    return { success: true };
  } catch(e) { return { success: false }; }
});

ipcMain.handle('get-alert-rules', async () => {
  try {
    if (!mainWindow) return { rules: [] };
    const rules = await mainWindow.webContents.executeJavaScript(
      `JSON.parse(JSON.stringify(Store.getAll('alert_rules')))`
    );
    return { rules: rules || [] };
  } catch(e) { return { rules: [] }; }
});

ipcMain.handle('toggle-alert-rule', async (_, id) => {
  try {
    if (!mainWindow) return { success: false };
    await mainWindow.webContents.executeJavaScript(`
      (function() {
        const rule = Store.getAll('alert_rules').find(r => r.id === ${parseInt(id)});
        if (rule) Store.update('alert_rules', ${parseInt(id)}, { enabled: !rule.enabled });
      })()
    `);
    return { success: true };
  } catch(e) { return { success: false }; }
});

ipcMain.handle('run-alert-eval', async () => {
  try {
    const alerts = await runAlertEvaluation();
    return { alerts };
  } catch(e) { return { alerts: [] }; }
});

ipcMain.handle('vault-write', (_, { relativePath, frontmatter, body }) => {
  try {
    vault.writeNote(relativePath, frontmatter, body);
    return { success: true };
  } catch(e) {
    logger.error('vault-write failed:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.on('open-external', (_, url) => shell.openExternal(url));

// Manual backup trigger from renderer
ipcMain.handle('trigger-backup', async () => {
  const result = await backup.runBackup(mainWindow);
  return result ? { success: true, path: result } : { success: false };
});

// List backups
ipcMain.handle('list-backups', () => backup.listBackups());

ipcMain.on('notify', (_, { title, body, urgent }) => {
  showNotification(title, body, urgent);
});

ipcMain.handle('get-data-dir', () => dataDir);

// Count vault .md files for study metrics
ipcMain.handle('count-vault-notes', () => {
  try {
    const vaultRoot = path.join(os.homedir(), 'Sion-os', 'vault');
    let count = 0;
    function countMd(dir) {
      if (!fs.existsSync(dir)) return;
      fs.readdirSync(dir).forEach(f => {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory() && !f.startsWith('.')) countMd(full);
        else if (f.endsWith('.md')) count++;
      });
    }
    countMd(vaultRoot);
    return count;
  } catch(e) { return 0; }
});

// Return vault folder tree for Knowledge Library display
ipcMain.handle('get-vault-tree', () => {
  try {
    const vaultRoot = path.join(os.homedir(), 'Sion-os', 'vault');
    if (!fs.existsSync(vaultRoot)) return [];

    function countAllMd(dir) {
      let n = 0;
      fs.readdirSync(dir).forEach(f => {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory() && !f.startsWith('.')) n += countAllMd(full);
        else if (f.endsWith('.md')) n++;
      });
      return n;
    }

    const entries = fs.readdirSync(vaultRoot).sort();
    const result  = [];

    // Root-level .md files first
    const rootFiles = entries
      .filter(f => f.endsWith('.md') && !f.startsWith('.'))
      .map(f => ({ name: f.replace(/\.md$/, ''), modified: fs.statSync(path.join(vaultRoot, f)).mtime.toISOString() }));

    // Top-level folders
    entries
      .filter(f => !f.startsWith('.') && !f.endsWith('.md'))
      .forEach(f => {
        const full = path.join(vaultRoot, f);
        if (!fs.statSync(full).isDirectory()) return;
        const noteCount = countAllMd(full);
        // Direct .md files in this folder
        const files = fs.readdirSync(full)
          .filter(c => c.endsWith('.md') && !c.startsWith('.'))
          .sort()
          .map(c => ({ name: c.replace(/\.md$/, ''), modified: fs.statSync(path.join(full, c)).mtime.toISOString() }));
        // Subfolders
        const subfolders = fs.readdirSync(full)
          .filter(c => !c.startsWith('.') && !c.endsWith('.md'))
          .filter(c => fs.statSync(path.join(full, c)).isDirectory())
          .sort()
          .map(c => {
            const subFull  = path.join(full, c);
            const subCount = countAllMd(subFull);
            const subFiles = fs.readdirSync(subFull)
              .filter(s => s.endsWith('.md') && !s.startsWith('.'))
              .sort()
              .map(s => ({ name: s.replace(/\.md$/, ''), modified: fs.statSync(path.join(subFull, s)).mtime.toISOString() }));
            return { name: c, noteCount: subCount, files: subFiles };
          });
        result.push({ name: f, noteCount, files, subfolders });
      });

    return { rootFiles, folders: result };
  } catch(e) { logger.error('get-vault-tree:', e.message); return { rootFiles: [], folders: [] }; }
});

ipcMain.on('refresh-tray', async () => {
  if (tray) {
    const updated = await buildTrayMenu();
    tray.setContextMenu(updated);
  }
});


// Gmail auth status
ipcMain.handle('gmail-status', () => ({
  authed: gmail.isAuthed(),
  email:  process.env.GMAIL_USER || '',
}));

// Trigger OAuth flow
ipcMain.handle('gmail-auth', async () => {
  try {
    await gmail.authenticate();
    return { success: true };
  } catch(e) {
    logger.error('[Gmail] Auth failed:', e.message);
    return { success: false, error: e.message };
  }
});

// List emails (with pagination)
ipcMain.handle('gmail-list', async (_, opts) => {
  try {
    const result = await gmail.listEmailsPaged(opts);
    return { success: true, emails: result.emails, nextPageToken: result.nextPageToken };
  } catch(e) {
    return { success: false, error: e.message, emails: [] };
  }
});

// Get full email + AI analysis
// NOTE: finance insert is NOT done here — renderer handles it after checking email_cache
ipcMain.handle('gmail-open', async (_, id) => {
  try {
    const email    = await gmail.getEmailBody(id);
    await gmail.markRead(id);
    const analysis = await emailAI.analyseEmail(email);
    // Return the detected finance type so the renderer can decide whether to insert
    const financeCreated = (analysis.isFinanceAlert && analysis.financeData?.type && analysis.financeData.type !== 'null')
      ? analysis.financeData.type
      : null;
    return { success: true, email, analysis, financeCreated };
  } catch(e) {
    logger.error('[Gmail] Open failed:', e.message);
    return { success: false, error: e.message };
  }
});

// Actions: star, archive, trash
ipcMain.handle('gmail-action', async (_, { action, id }) => {
  try {
    if (action === 'star')    await gmail.toggleStar(id, true);
    if (action === 'unstar')  await gmail.toggleStar(id, false);
    if (action === 'archive') await gmail.archive(id);
    if (action === 'trash')   await gmail.trash(id);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

// Search
ipcMain.handle('gmail-search', async (_, query) => {
  try {
    const emails = await gmail.searchEmails(query);
    return { success: true, emails };
  } catch(e) {
    return { success: false, error: e.message, emails: [] };
  }
});

// Unread count
ipcMain.handle('gmail-unread', async () => {
  try {
    const count = await gmail.getUnreadCount();
    return { count };
  } catch(e) { return { count: 0 }; }
});

// Label unread counts
ipcMain.handle('gmail-label-counts', async () => {
  try { return await gmail.getLabelCounts(); }
  catch(e) { return {}; }
});

/* ── Mac login item ── */
function setLoginItem() {
  app.setLoginItemSettings({
    openAtLogin:  true,
    openAsHidden: true,
    path:         app.getPath('exe'),
  });
}

/* ── Daily vault note ── */
function createDailyNote() {
  const date = vault.today();
  const relativePath = `daily/${date}.md`;
  if (vault.noteExists(relativePath)) return;
  vault.writeNote(relativePath, {
    date,
    type: 'daily',
    status: 'active',
    tags: '["daily"]',
  }, `# ${date}\n\n## Focus for today\n<!-- pulled from dashboard task queue -->\n\n## Decisions made\n\n## What I learned\n\n## Blem Tuned activity\n\n## Reflections\n`);
  logger.info('Daily note created:', relativePath);
}

/* ── App lifecycle ── */
app.whenReady().then(async () => {
  vault.initVault();
  logger.info('Vault initialised at', vault.VAULT_ROOT);
  createDailyNote();
  gmail.init();
  logger.info('[Gmail] Init complete, authed:', gmail.isAuthed());
  createWindow();
  await createTray();
  setLoginItem();
  scheduleMorningBriefing();
  // Re-evaluate alerts every 30 minutes
  setInterval(() => { runAlertEvaluation().catch(() => {}); }, 30 * 60 * 1000);
  backup.scheduleBackup(mainWindow);
  logger.info('Sion OS v3.0.1 started');

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
