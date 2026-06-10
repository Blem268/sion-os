/* ============================================
   SION OS — electron/utils/logger.js
   v2.3.0
   Writes logs to ~/Sion-os/logs/sionos.log
   ============================================ */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const logDir  = path.join(os.homedir(), 'Sion-os', 'logs');
const logFile = path.join(logDir, 'sionos.log');

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function timestamp() {
  return new Date().toISOString();
}

function write(level, ...args) {
  const msg    = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  const line   = `[${timestamp()}] [${level}] ${msg}\n`;
  // Write to file
  try { fs.appendFileSync(logFile, line); } catch(e) {}
  // Also write to console
  if (level === 'ERROR') console.error(line.trim());
  else if (level === 'WARN') console.warn(line.trim());
  else console.log(line.trim());
}

// Rotate log if over 5MB
function rotateIfNeeded() {
  try {
    const stats = fs.statSync(logFile);
    if (stats.size > 5 * 1024 * 1024) {
      const archived = logFile.replace('.log', `-${Date.now()}.log`);
      fs.renameSync(logFile, archived);
      write('INFO', 'Log rotated to', archived);
    }
  } catch(e) {}
}

rotateIfNeeded();

module.exports = {
  info:  (...a) => write('INFO',  ...a),
  warn:  (...a) => write('WARN',  ...a),
  error: (...a) => write('ERROR', ...a),
  debug: (...a) => write('DEBUG', ...a),
  logFile,
};
