/* ============================================
   SION OS — electron/preload.js
   v2.9.3
   ============================================ */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  platform:   process.platform,
  isElectron: true,
  version:    '3.0.1',

  // Open links in default browser
  openExternal: (url) => ipcRenderer.send('open-external', url),

  // Native notifications
  notify: (title, body, urgent = false) =>
    ipcRenderer.send('notify', { title, body, urgent }),

  // Data directory path
  getDataDir: () => ipcRenderer.invoke('get-data-dir'),

  // Trigger tray menu refresh with live data
  refreshTray: () => ipcRenderer.send('refresh-tray'),

  // Write a markdown note to the Obsidian vault
  writeVaultNote: (relativePath, frontmatter, body) =>
    ipcRenderer.invoke('vault-write', { relativePath, frontmatter, body }),

  // Claude AI — sends question + data snapshot, returns answer + actions
  aiQuery: (question, storeData) =>
    ipcRenderer.invoke('ai-query', { question, storeData }),

  // Count .md files in Obsidian vault for study metrics
  countVaultNotes: () => ipcRenderer.invoke('count-vault-notes'),

  // Get vault folder tree for Knowledge Library
  getVaultTree: () => ipcRenderer.invoke('get-vault-tree'),

  // Gmail
  gmailStatus:      ()           => ipcRenderer.invoke('gmail-status'),
  gmailAuth:        ()           => ipcRenderer.invoke('gmail-auth'),
  gmailList:        (opts)       => ipcRenderer.invoke('gmail-list', opts),
  gmailOpen:        (id)         => ipcRenderer.invoke('gmail-open', id),
  gmailAction:      (action, id) => ipcRenderer.invoke('gmail-action', { action, id }),
  gmailSearch:      (query)      => ipcRenderer.invoke('gmail-search', query),
  gmailUnread:      ()           => ipcRenderer.invoke('gmail-unread'),
  gmailLabelCounts: ()           => ipcRenderer.invoke('gmail-label-counts'),

  // Backup
  triggerBackup: () => ipcRenderer.invoke('trigger-backup'),
  listBackups:   () => ipcRenderer.invoke('list-backups'),

  // Alert engine
  getAlerts:       ()   => ipcRenderer.invoke('get-alerts'),
  dismissAlert:    (id) => ipcRenderer.invoke('dismiss-alert', id),
  getAlertRules:   ()   => ipcRenderer.invoke('get-alert-rules'),
  toggleAlertRule: (id) => ipcRenderer.invoke('toggle-alert-rule', id),
  runAlertEval:    ()   => ipcRenderer.invoke('run-alert-eval'),

});
