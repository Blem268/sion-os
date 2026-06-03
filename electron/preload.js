/* ============================================
   SION OS — electron/preload.js
   v2.2.0 — Sprint 10
   ============================================ */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  platform:   process.platform,
  isElectron: true,
  version:    '2.2.0',

  // Open links in default browser
  openExternal: (url) => ipcRenderer.send('open-external', url),

  // Native notifications
  notify: (title, body, urgent = false) =>
    ipcRenderer.send('notify', { title, body, urgent }),

  // Data directory path
  getDataDir: () => ipcRenderer.invoke('get-data-dir'),

  // Trigger tray menu refresh with live data
  refreshTray: () => ipcRenderer.send('refresh-tray'),

});
