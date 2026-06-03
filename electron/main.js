/* ============================================
   SION OS — electron/main.js
   v2.0.0 — Phase 2 / Sprint 8
   Main process: window, tray, startup
   ============================================ */

const { app, BrowserWindow, Tray, Menu, nativeImage,
        shell, ipcMain, Notification } = require('electron');
const path = require('path');
const os   = require('os');

// ── Keep references alive ──
let mainWindow = null;
let tray       = null;

const isDev    = process.argv.includes('--dev');
const dataDir  = path.join(os.homedir(), 'SionOS');
const iconPath = path.join(__dirname, 'assets', 'icon.png');

// ── Ensure single instance ──
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
    width:           1200,
    height:          800,
    minWidth:        800,
    minHeight:       600,
    title:           'Sion OS',
    backgroundColor: '#080808',
    titleBarStyle:   'hiddenInset',   // Mac traffic lights overlay
    trafficLightPosition: { x: 14, y: 12 },
    webPreferences: {
      nodeIntegration:     false,
      contextIsolation:    true,
      preload:             path.join(__dirname, 'preload.js'),
    },
    icon: iconPath,
    show: false,   // Show only when ready
  });

  // Load the existing web app
  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));

  // Show once DOM is ready — avoids white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools();
  });

  // Minimise to tray instead of closing
  mainWindow.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

/* ── System tray ── */
function createTray() {
  // Use a simple template image if icon not found
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch(e) {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('Sion OS');

  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Sion OS',
      click: () => { mainWindow?.show(); mainWindow?.focus(); }
    },
    { type: 'separator' },
    {
      label: 'Dashboard',
      click: () => {
        mainWindow?.show();
        mainWindow?.webContents.executeJavaScript(
          `navigate('dashboard', document.querySelector('[data-module="dashboard"]'))`
        );
      }
    },
    {
      label: 'Blem Tuned',
      click: () => {
        mainWindow?.show();
        mainWindow?.webContents.executeJavaScript(
          `navigate('blem', document.querySelector('[data-module="blem"]'))`
        );
      }
    },
    {
      label: 'Finance',
      click: () => {
        mainWindow?.show();
        mainWindow?.webContents.executeJavaScript(
          `navigate('finance', document.querySelector('[data-module="finance"]'))`
        );
      }
    },
    { type: 'separator' },
    {
      label: 'Export data backup',
      click: () => {
        mainWindow?.show();
        mainWindow?.webContents.executeJavaScript(`App.exportData()`);
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Sion OS',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(menu);

  // Left click opens app
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
}

/* ── Mac login item (startup) ── */
function setLoginItem() {
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,   // Start minimised to tray
    path: app.getPath('exe'),
  });
}

/* ── IPC handlers ── */

// Open external links in browser, not Electron
ipcMain.on('open-external', (_, url) => {
  shell.openExternal(url);
});

// Native notification from renderer
ipcMain.on('notify', (_, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body, silent: false }).show();
  }
});

// Get data directory path
ipcMain.handle('get-data-dir', () => dataDir);

/* ── App lifecycle ── */
app.whenReady().then(() => {
  createWindow();
  createTray();
  setLoginItem();

  // macOS: re-open window when dock icon clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

// Keep app running when all windows closed (tray app)
app.on('window-all-closed', (e) => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuiting = true;
});
