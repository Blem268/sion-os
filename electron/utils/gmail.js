/* ============================================
   SION OS — electron/utils/gmail.js
   v2.9.0 — Sprint 18
   Gmail API integration — main process only
   OAuth2 with token persistence
   ============================================ */

const { google }   = require('googleapis');
const fs           = require('fs');
const path         = require('path');
const http         = require('http');
const { shell }    = require('electron');
const logger       = require('./logger');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
];

let _oauth2Client = null;
let _gmail        = null;
let _calendar     = null;
let _authed       = false;

/* ── Initialise OAuth2 client ── */
function init() {
  const credsPath = process.env.GMAIL_CREDENTIALS_PATH;
  if (!credsPath || !fs.existsSync(credsPath)) {
    logger.warn('[Gmail] credentials.json not found at', credsPath);
    return false;
  }
  try {
    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    const { client_secret, client_id } = creds.installed || creds.web;
    _oauth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3000/oauth2callback');
    // Load saved token
    const tokenPath = process.env.GMAIL_TOKEN_PATH;
    if (tokenPath && fs.existsSync(tokenPath)) {
      const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
      _oauth2Client.setCredentials(token);
      _authed   = true;
      _gmail    = google.gmail({ version: 'v1', auth: _oauth2Client });
      _calendar = google.calendar({ version: 'v3', auth: _oauth2Client });
      logger.info('[Gmail] Authenticated from saved token');
    }
    // Auto-refresh token on expiry
    _oauth2Client.on('tokens', tokens => {
      const tPath = process.env.GMAIL_TOKEN_PATH;
      if (tPath) {
        const existing = fs.existsSync(tPath)
          ? JSON.parse(fs.readFileSync(tPath, 'utf8')) : {};
        fs.writeFileSync(tPath, JSON.stringify({ ...existing, ...tokens }));
        logger.info('[Gmail] Token refreshed and saved');
      }
    });
    return true;
  } catch(e) {
    logger.error('[Gmail] Init failed:', e.message);
    return false;
  }
}

/* ── OAuth2 flow — opens browser for user consent ── */
async function authenticate() {
  if (!_oauth2Client) {
    throw new Error(
      'Gmail not initialised — check GMAIL_CREDENTIALS_PATH in .env'
    );
  }
  return new Promise((resolve, reject) => {
    const authUrl = _oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope:       SCOPES,
      prompt:      'consent',
    });
    shell.openExternal(authUrl);
    const server = http.createServer(async (req, res) => {
      try {
        const url  = new URL(req.url, 'http://localhost:3000');
        const code = url.searchParams.get('code');
        if (!code) { res.end('No code received'); return; }
        res.end('<h2>Sion OS — Gmail connected. You can close this tab.</h2>');
        server.close();
        const { tokens } = await _oauth2Client.getToken(code);
        _oauth2Client.setCredentials(tokens);
        const tokenPath = process.env.GMAIL_TOKEN_PATH;
        if (tokenPath) fs.writeFileSync(tokenPath, JSON.stringify(tokens));
        _authed   = true;
        _gmail    = google.gmail({ version: 'v1', auth: _oauth2Client });
        _calendar = google.calendar({ version: 'v3', auth: _oauth2Client });
        logger.info('[Gmail] OAuth2 flow complete, token saved');
        resolve(true);
      } catch(e) { reject(e); }
    }).listen(3000, () => {
      logger.info('[Gmail] OAuth callback server listening on port 3000');
    }).on('error', err => {
      server.close();
      reject(new Error(
        'Port 3000 is in use — close any app using it and try again. ' + err.message
      ));
    });
    logger.info('[Gmail] Auth URL opened:', authUrl.slice(0, 60) + '...');
  });
}

/* ── Check auth status ── */
function isAuthed() { return _authed; }

/* ── Fetch email list ── */
async function listEmails({ folder = 'INBOX', maxResults = 20, query = '' } = {}) {
  if (!_authed || !_gmail) throw new Error('Not authenticated');
  const q = [folder === 'INBOX' ? 'in:inbox' : `in:${folder}`, query].filter(Boolean).join(' ');
  const res = await _gmail.users.messages.list({
    userId:     'me',
    maxResults,
    q,
    labelIds:   folder === 'STARRED' ? ['STARRED'] : undefined,
  });
  const messages = res.data.messages || [];
  const emails   = await Promise.all(messages.map(m => getEmailMeta(m.id)));
  return emails.filter(Boolean);
}

/* ── Get email metadata (no body) ── */
async function getEmailMeta(id) {
  try {
    const res = await _gmail.users.messages.get({
      userId:          'me',
      id,
      format:          'metadata',
      metadataHeaders: ['From', 'To', 'Subject', 'Date'],
    });
    const msg     = res.data;
    const headers = {};
    (msg.payload?.headers || []).forEach(h => { headers[h.name] = h.value; });
    return {
      id:        msg.id,
      threadId:  msg.threadId,
      subject:   headers['Subject'] || '(no subject)',
      from:      headers['From']    || '',
      to:        headers['To']      || '',
      date:      headers['Date']    || '',
      snippet:   msg.snippet        || '',
      labelIds:  msg.labelIds       || [],
      isRead:    !msg.labelIds?.includes('UNREAD'),
      isStarred: msg.labelIds?.includes('STARRED'),
    };
  } catch(e) {
    logger.warn('[Gmail] Failed to get meta for', id, e.message);
    return null;
  }
}

/* ── Get full email body (prefers HTML, falls back to plain text) ── */
async function getEmailBody(id) {
  if (!_authed || !_gmail) throw new Error('Not authenticated');
  const res = await _gmail.users.messages.get({ userId: 'me', id, format: 'full' });
  const msg = res.data;
  const headers = {};
  (msg.payload?.headers || []).forEach(h => { headers[h.name] = h.value; });

  let body     = '';
  let htmlBody = '';

  function extractBody(part) {
    if (!part) return;
    if (part.mimeType === 'text/plain' && part.body?.data) {
      body += Buffer.from(part.body.data, 'base64').toString('utf8');
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      htmlBody += Buffer.from(part.body.data, 'base64').toString('utf8');
    } else if (part.parts) {
      part.parts.forEach(extractBody);
    }
  }
  extractBody(msg.payload);
  if (!body && !htmlBody && msg.payload?.body?.data) {
    const data = Buffer.from(msg.payload.body.data, 'base64').toString('utf8');
    if (msg.payload.mimeType === 'text/html') {
      htmlBody = data;
    } else {
      body = data;
    }
  }

  const attachments = [];
  function extractAttachments(part) {
    if (!part) return;
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename:     part.filename,
        mimeType:     part.mimeType,
        attachmentId: part.body.attachmentId,
        size:         part.body.size,
      });
    }
    if (part.parts) part.parts.forEach(extractAttachments);
  }
  extractAttachments(msg.payload);

  const finalBody = htmlBody || body;

  return {
    id,
    subject:     headers['Subject'] || '(no subject)',
    from:        headers['From']    || '',
    to:          headers['To']      || '',
    date:        headers['Date']    || '',
    body:        finalBody.slice(0, 8000),
    isHtml:      !!htmlBody,
    attachments,
    labelIds:    msg.labelIds || [],
    isRead:      !msg.labelIds?.includes('UNREAD'),
    isStarred:   msg.labelIds?.includes('STARRED'),
  };
}

/* ── Fetch email list with pagination support ── */
async function listEmailsPaged({ folder = 'INBOX', maxResults = 20, query = '', pageToken = null } = {}) {
  if (!_authed || !_gmail) throw new Error('Not authenticated');
  const q = [folder === 'INBOX' ? 'in:inbox' : `in:${folder}`, query].filter(Boolean).join(' ');
  const res = await _gmail.users.messages.list({
    userId:     'me',
    maxResults,
    q,
    labelIds:   folder === 'STARRED' ? ['STARRED'] : undefined,
    pageToken:  pageToken || undefined,
  });
  const messages      = res.data.messages || [];
  const nextPageToken = res.data.nextPageToken || null;
  const emails        = await Promise.all(messages.map(m => getEmailMeta(m.id)));
  return { emails: emails.filter(Boolean), nextPageToken };
}

/* ── Get unread counts for key labels ── */
async function getLabelCounts() {
  if (!_authed || !_gmail) return {};
  try {
    const res    = await _gmail.users.labels.list({ userId: 'me' });
    const counts = {};
    const targets = ['INBOX', 'STARRED', 'DRAFT', 'SPAM'];
    for (const label of (res.data.labels || [])) {
      if (targets.includes(label.id)) {
        const detail = await _gmail.users.labels.get({ userId: 'me', id: label.id });
        counts[label.id] = detail.data.messagesUnread || 0;
      }
    }
    return counts;
  } catch(e) { return {}; }
}

/* ── Mark as read ── */
async function markRead(id) {
  if (!_authed || !_gmail) return;
  await _gmail.users.messages.modify({
    userId: 'me', id,
    requestBody: { removeLabelIds: ['UNREAD'] },
  });
}

/* ── Star / unstar ── */
async function toggleStar(id, starred) {
  if (!_authed || !_gmail) return;
  await _gmail.users.messages.modify({
    userId: 'me', id,
    requestBody: starred
      ? { addLabelIds: ['STARRED'] }
      : { removeLabelIds: ['STARRED'] },
  });
}

/* ── Archive ── */
async function archive(id) {
  if (!_authed || !_gmail) return;
  await _gmail.users.messages.modify({
    userId: 'me', id,
    requestBody: { removeLabelIds: ['INBOX'] },
  });
}

/* ── Trash ── */
async function trash(id) {
  if (!_authed || !_gmail) return;
  await _gmail.users.messages.trash({ userId: 'me', id });
}

/* ── Get unread count ── */
async function getUnreadCount() {
  if (!_authed || !_gmail) return 0;
  try {
    const res = await _gmail.users.labels.get({ userId: 'me', id: 'INBOX' });
    return res.data.messagesUnread || 0;
  } catch(e) { return 0; }
}

/* ── Search emails ── */
async function searchEmails(query) {
  return listEmails({ query, maxResults: 20 });
}

module.exports = {
  init, authenticate, isAuthed,
  listEmails, listEmailsPaged, getEmailMeta, getEmailBody,
  markRead, toggleStar, archive, trash,
  getUnreadCount, searchEmails, getLabelCounts,
};
