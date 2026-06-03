/* ============================================
   SION OS — electron/preload.js
   v2.0.0 — Phase 2 / Sprint 8
   Secure bridge: exposes only what renderer needs
   ============================================ */

const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const os   = require('os');

contextBridge.exposeInMainWorld('electronAPI', {

  // Platform detection
  platform: process.platform,
  isElectron: true,

  // Data directory
  getDataDir: () => ipcRenderer.invoke('get-data-dir'),

  // Open links in default browser
  openExternal: (url) => ipcRenderer.send('open-external', url),

  // Native notifications
  notify: (title, body) => ipcRenderer.send('notify', { title, body }),

  // App version
  version: '2.0.0',

});
