/* ============================================
   SION OS — electron/utils/backup.js
   v2.3.0
   Automated daily backup to ~/Sion-os/backups/
   ============================================ */

const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const logger = require('./logger');

const backupDir = path.join(os.homedir(), 'Sion-os', 'backups');

// Ensure backup directory exists
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

let backupTimer    = null;
let mainWindowRef  = null;

/* ── Trigger a backup by asking renderer for data ── */
async function runBackup(mainWindow) {
  if (!mainWindow) return;
  try {
    const json = await mainWindow.webContents.executeJavaScript(`Store.exportJSON()`);
    if (!json) throw new Error('No data returned from Store');

    const date     = new Date().toISOString().split('T')[0];
    const time     = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `sionos-backup-${date}-${time}.json`;
    const filepath = path.join(backupDir, filename);

    fs.writeFileSync(filepath, json, 'utf8');
    logger.info('Backup saved:', filepath);

    // Keep only last 30 backups
    pruneOldBackups();

    return filepath;
  } catch(e) {
    logger.error('Backup failed:', e.message);
    return null;
  }
}

/* ── Remove backups older than 30 days ── */
function pruneOldBackups() {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('sionos-backup-') && f.endsWith('.json'))
      .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtime }))
      .sort((a, b) => b.time - a.time);

    // Keep newest 30, delete the rest
    files.slice(30).forEach(f => {
      fs.unlinkSync(path.join(backupDir, f.name));
      logger.info('Pruned old backup:', f.name);
    });
  } catch(e) {
    logger.warn('Prune failed:', e.message);
  }
}

/* ── Schedule daily backup at midnight ── */
function scheduleBackup(mainWindow) {
  mainWindowRef = mainWindow;
  if (backupTimer) clearTimeout(backupTimer);

  const now    = new Date();
  const target = new Date();

  // Get configured time from env or default midnight
  const hour   = parseInt(process.env.BACKUP_HOUR   || '0');
  const minute = parseInt(process.env.BACKUP_MINUTE || '0');
  target.setHours(hour, minute, 0, 0);

  // If already past today's backup time, schedule for tomorrow
  if (now >= target) target.setDate(target.getDate() + 1);

  const msUntil = target - now;
  logger.info(`Next backup scheduled for ${target.toLocaleString()}`);

  backupTimer = setTimeout(async () => {
    if (process.env.BACKUP_ENABLED !== 'false') {
      await runBackup(mainWindowRef);
    }
    // Reschedule for next day
    scheduleBackup(mainWindowRef);
  }, msUntil);
}

/* ── List all backups ── */
function listBackups() {
  try {
    return fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        size: fs.statSync(path.join(backupDir, f)).size,
        date: fs.statSync(path.join(backupDir, f)).mtime,
      }));
  } catch(e) { return []; }
}

module.exports = { runBackup, scheduleBackup, listBackups, backupDir };
