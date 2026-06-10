/* ============================================
   SION OS — electron/utils/emailAI.js
   v2.9.0 — Sprint 18
   Claude-powered email intelligence
   Smart summary, classification, action detection
   ============================================ */

const https  = require('https');
const logger = require('./logger');

const MODEL      = 'claude-sonnet-4-6';
const MAX_TOKENS = 800;

/* ── Classify and summarise a single email ── */
async function analyseEmail(email) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const prompt = `You are the AI assistant inside Sion OS, a personal Life OS for Sion Looby-Martinez in Antigua.

Analyse this email and return a JSON object only. No other text.

Email:
From: ${email.from}
Subject: ${email.subject}
Date: ${email.date}
Body: ${email.body?.slice(0, 2000) || email.snippet}

Return this exact JSON structure:
{
  "label": "one of: Work (Silcomm) | Blem Tuned | Younity | Blueport | Finance | Study (ACCA) | Personal",
  "summary": "2-3 sentence plain English summary of what this email is about",
  "isFinanceAlert": true/false,
  "financeData": {
    "type": "income | expense | transfer | null",
    "amount": 0,
    "currency": "XCD",
    "description": "brief description"
  },
  "suggestedActions": [
    { "label": "action label", "type": "create_task | schedule_call | create_event | reply", "detail": "detail" }
  ],
  "priority": "high | normal | low",
  "sentiment": "positive | neutral | negative | urgent"
}

For isFinanceAlert: true if this is a bank notification, payment confirmation, receipt, or any money movement.
For suggestedActions: max 3 actions, only include genuinely useful ones.
If the email mentions a dollar amount from a bank, extract it into financeData.`;

  const body = JSON.stringify({
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    messages:   [{ role: 'user', content: prompt }],
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers:  {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length':    Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text   = parsed.content?.[0]?.text || '{}';
          const clean  = text.replace(/```json|```/g, '').trim();
          const result = JSON.parse(clean);
          resolve(result);
        } catch(e) {
          logger.warn('[EmailAI] Parse failed:', e.message);
          resolve({
            label:            'Personal',
            summary:          email.snippet || 'Unable to summarise.',
            isFinanceAlert:   false,
            financeData:      { type: null },
            suggestedActions: [],
            priority:         'normal',
            sentiment:        'neutral',
          });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Session-level dedup guard (primary dedup is email_cache in the renderer)
const _processedEmailIds = new Set();

/* ── Auto-process finance emails via renderer Store proxy ── */
function processFinanceEmail(financeData, emailSubject, emailId, storeProxy) {
  if (!financeData || !financeData.type || financeData.type === 'null') return null;

  // Guard: skip if this email has already been processed this session
  if (emailId && _processedEmailIds.has(emailId)) {
    logger.info('[EmailAI] Skipping duplicate finance entry for:', emailId);
    return null;
  }

  const today = new Date().toISOString().split('T')[0];
  try {
    if (financeData.type === 'income') {
      storeProxy.insert('income', {
        source:        'Bank Notification',
        category:      'Other',
        amount_xcd:    parseFloat(financeData.amount) || 0,
        received_date: today,
        notes:         emailSubject + ' (auto from email)',
      });
      if (emailId) _processedEmailIds.add(emailId);
      logger.info('[EmailAI] Auto-created income entry:', financeData.amount);
      return 'income';
    } else if (financeData.type === 'expense') {
      storeProxy.insert('expenses', {
        item:         emailSubject,
        category:     'Other',
        amount_xcd:   parseFloat(financeData.amount) || 0,
        expense_date: today,
        notes:        (financeData.description || '') + ' (auto from email)',
      });
      if (emailId) _processedEmailIds.add(emailId);
      logger.info('[EmailAI] Auto-created expense entry:', financeData.amount);
      return 'expense';
    }
  } catch(e) {
    logger.error('[EmailAI] Finance auto-create failed:', e.message);
  }
  return null;
}

module.exports = { analyseEmail, processFinanceEmail };
