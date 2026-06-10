/* ============================================
   SION OS — electron/utils/ai.js
   v2.6.0 — Sprint 14
   Claude API integration — main process only
   API key never touches renderer
   ============================================ */

const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const logger  = require('./logger');

const MODEL        = 'claude-sonnet-4-6';
const MAX_TOKENS   = 1024;
const VAULT_ROOT   = path.join(require('os').homedir(), 'Sion-os', 'vault');

/* ── Build system prompt ── */
function buildSystemPrompt() {
  return `You are the internal AI of Sion OS — a personal Life OS built for Sion Looby-Martinez in Antigua.

You have full access to Sion's live data across all modules. You know his businesses, finances, goals, health, study progress, and journal entries.

Sion's context:
- Owner of Blem Tuned (automotive electricals), Younity Consultancy (AI business systems), Blueport Agency (shipping, launching Sep 2026)
- Day jobs: Silcomm Engineering (Senior Admin) + NovaTrust (Pre-license/CRM)
- All financial commitments, goals, and personal targets are in the data snapshot
- Read the commitments, user_prefs, gym_weight, and food sections for current values
- Never assume any dollar amount — always reference the snapshot
- Currency: XCD (Eastern Caribbean Dollar)
- Location: Antigua 🇦🇬

You can:
1. Answer questions about his data in plain English
2. Identify patterns and surface insights
3. Write back to the OS — create tasks, log income, update milestones
4. Reference vault notes for deeper context
5. Give recommendations based on his actual numbers
6. Log meals to the food_log table using insert actions with these exact fields:
   meal_name (string), meal_type (Breakfast/Lunch/Dinner/Snack),
   calories (number), protein_g (number), carbs_g (number),
   fat_g (number), log_date (YYYY-MM-DD format)
7. Read food_log entries to track daily calorie and protein intake
8. Compare daily calories against the user's calorie target from user_prefs
9. Flag if calories are too low given the user's weight_start → weight_target goal from user_prefs
10. Create custom alert rules for the user by inserting to alert_rules table
    Fields: source:'user', module (finance/blem/younity/blueport/gym/study/global), rule_type:'custom',
    label (human-readable name), condition (JSON object), level (red/amber/gray), enabled:true
    Example: "alert me if savings drops below $1000" →
    insert alert_rules with condition: {check:'balance_below', account_name:'savings', threshold:1000}
    Example: "alert me if I have more than 5 overdue tasks" →
    insert alert_rules with condition: {table:'tasks', check:'overdue_count_above', threshold:5}
11. Read active alerts from the alerts section of the data snapshot to surface issues in briefings

When writing back to the OS, respond with a JSON action block at the END of your message:
<action>
{
  "type": "insert" | "update" | "delete",
  "table": "table_name",
  "data": { ... },
  "id": 123  // for update/delete only
}
</action>

You can include multiple <action> blocks.

Rules:
- Be direct and concise. No fluff.
- Use XCD currency always.
- Reference actual numbers from the data snapshot.
- If data is missing or zero, say so honestly.
- Never make up numbers.
- Format financial figures as XCD $X,XXX.XX
- Dates in en-AG format (e.g. 5 Jun 2026)`;
}

/* ── Read vault notes (targeted, not full vault) ── */
function readVaultContext(question) {
  const lq = question.toLowerCase();
  const contexts = [];

  const folderMap = [
    { keywords: ['learn','study','lesson','acca','google pm','trw','course'], folder: 'knowledge' },
    { keywords: ['blem','job','automotive','client','vehicle'], folder: 'businesses/blem-tuned' },
    { keywords: ['younity','project','consultancy'], folder: 'businesses/younity' },
    { keywords: ['blueport','launch','shipping'], folder: 'businesses/blueport' },
    { keywords: ['journal','reflect','week','day','mood'], folder: 'daily' },
    { keywords: ['finance','decision','money','budget'], folder: 'finance' },
    { keywords: ['health','gym','weight','workout'], folder: 'health' },
  ];

  folderMap.forEach(({ keywords, folder }) => {
    if (keywords.some(k => lq.includes(k))) {
      const dir = path.join(VAULT_ROOT, folder);
      if (!fs.existsSync(dir)) return;
      try {
        const files = fs.readdirSync(dir)
          .filter(f => f.endsWith('.md'))
          .map(f => ({ name: f, time: fs.statSync(path.join(dir, f)).mtime }))
          .sort((a,b) => b.time - a.time)
          .slice(0, 5);
        files.forEach(({ name }) => {
          const content = fs.readFileSync(path.join(dir, name), 'utf8');
          contexts.push(`--- vault: ${folder}/${name} ---\n${content.slice(0, 800)}`);
        });
      } catch(e) { /* skip */ }
    }
  });

  return contexts.length ? '\n\n## Vault notes\n' + contexts.join('\n\n') : '';
}

/* ── Format OS data snapshot ── */
function buildDataSnapshot(storeData) {
  const snap = [];
  snap.push('## Live OS data snapshot');
  snap.push(`Generated: ${new Date().toISOString()}`);
  snap.push('');

  const income   = storeData.income   || [];
  const expenses = storeData.expenses || [];
  const now      = new Date();
  const thisMonth = r => {
    const d = new Date(r.received_date || r.expense_date || r.created_at || '');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };
  const monthIncome   = income.filter(thisMonth).reduce((s,i) => s+(parseFloat(i.amount_xcd)||0),0);
  const monthExpenses = expenses.filter(thisMonth).reduce((s,e) => s+(parseFloat(e.amount_xcd)||0),0);
  snap.push(`### Finance`);
  snap.push(`- Income this month: XCD $${monthIncome.toLocaleString()}`);
  snap.push(`- Expenses this month: XCD $${monthExpenses.toLocaleString()}`);
  snap.push(`- Net this month: XCD $${(monthIncome-monthExpenses).toLocaleString()}`);
  const accounts = storeData.bank_accounts || [];
  accounts.forEach(a => snap.push(`- ${a.name} (${a.bank}): XCD $${parseFloat(a.balance||0).toLocaleString()}`));
  const subs = storeData.subscriptions || [];
  if (subs.length) snap.push(`- Active subscriptions: ${subs.length} totalling XCD $${subs.reduce((s,sub)=>s+(parseFloat(sub.cost)||0),0).toLocaleString()}/mo`);

  const blemJobs = storeData.blem_jobs || [];
  const activeJobs = blemJobs.filter(j => j.status !== 'Complete');
  const blemRevenue = blemJobs.filter(thisMonth).reduce((s,j)=>s+(parseFloat(j.amount_paid_xcd)||0),0);
  snap.push(`\n### Blem Tuned`);
  snap.push(`- Active jobs: ${activeJobs.length}`);
  snap.push(`- Revenue this month: XCD $${blemRevenue.toLocaleString()}`);
  snap.push(`- Total jobs logged: ${blemJobs.length}`);

  const yProjects = storeData.younity_projects || [];
  const yTasks    = storeData.younity_tasks    || [];
  snap.push(`\n### Younity`);
  snap.push(`- Active projects: ${yProjects.filter(p=>p.status==='Active').length}`);
  snap.push(`- Open tasks: ${yTasks.filter(t=>t.status!=='Done').length}`);

  const bpTasks = storeData.blueport_tasks || [];
  const bpDone  = bpTasks.filter(t=>t.done).length;
  snap.push(`\n### Blueport`);
  snap.push(`- Launch tasks: ${bpDone}/${bpTasks.length} complete (${bpTasks.length?Math.round(bpDone/bpTasks.length*100):0}%)`);
  snap.push(`- Days to launch: ${Math.ceil((new Date('2026-09-01')-now)/86400000)}`);

  const workTasks = storeData.work_tasks || [];
  snap.push(`\n### Work`);
  snap.push(`- Open Silcomm tasks: ${workTasks.filter(t=>!t.done&&t.employer==='Silcomm Engineering').length}`);
  snap.push(`- Open NovaTrust tasks: ${workTasks.filter(t=>!t.done&&t.employer==='NovaTrust').length}`);

  const lessons = storeData.study_lessons || [];
  snap.push(`\n### Study`);
  snap.push(`- Google PM: ${lessons.filter(l=>l.course==='gpm'&&l.status==='Complete').length}/${lessons.filter(l=>l.course==='gpm').length} lessons`);
  snap.push(`- ACCA FOA: ${lessons.filter(l=>l.course==='acca'&&l.status==='Complete').length}/${lessons.filter(l=>l.course==='acca').length} chapters`);
  snap.push(`- TRW AI: ${lessons.filter(l=>l.course==='trw'&&l.status==='Complete').length}/${lessons.filter(l=>l.course==='trw').length} lessons`);

  const weights = storeData.gym_weight || [];
  const latest  = weights.sort((a,b)=>new Date(b.logged_date)-new Date(a.logged_date))[0];
  const sessions = storeData.gym_sessions || [];
  const thisWeek = s => {
    const d=new Date(s.session_date+'T00:00:00'),t=new Date(),day=t.getDay(),mon=new Date(t);
    mon.setDate(t.getDate()-(day===0?6:day-1));
    mon.setHours(0,0,0,0);
    return d>=mon;
  };
  const wStart  = (storeData.user_prefs || {}).weight_start  || 0;
  const wTarget = (storeData.user_prefs || {}).weight_target || 0;
  snap.push(`\n### Health`);
  snap.push(`- Current weight: ${latest?latest.weight_lbs+'lb':'not logged'}`);
  snap.push(`- Weight goal: ${wStart > 0 ? wStart + ' → ' + wTarget + ' lb' : 'not set'}`);
  snap.push(`- Workouts this week: ${sessions.filter(thisWeek).length}`);

  const foodLog    = storeData.food_log || [];
  const todayFood  = foodLog.filter(f => f.log_date === new Date().toISOString().split('T')[0]);
  const todayCals  = todayFood.reduce((s,f) => s + (parseInt(f.calories)||0), 0);
  const todayProt  = todayFood.reduce((s,f) => s + (parseFloat(f.protein_g)||0), 0);
  const calTarget = (storeData.user_prefs || {}).calorie_target || 0;
  snap.push(`\n### Food & Nutrition`);
  snap.push(`- Calorie target: ${calTarget > 0 ? calTarget + ' kcal/day' : 'not set — configure in settings'}`);
  snap.push(`- Calories today: ${todayCals} kcal`);
  snap.push(`- Protein today: ${todayProt}g`);
  snap.push(`- Meals logged today: ${todayFood.length}`);
  todayFood.forEach(f => snap.push(`  - ${f.meal_type}: ${f.meal_name} — ${f.calories} kcal, P:${f.protein_g||0}g C:${f.carbs_g||0}g F:${f.fat_g||0}g`));
  snap.push(`- Total food log entries: ${foodLog.length}`);

  const journal = storeData.journal_entries || [];
  snap.push(`\n### Journal`);
  snap.push(`- Total entries: ${journal.length}`);
  const recentJ = journal.sort((a,b)=>new Date(b.entry_date)-new Date(a.entry_date)).slice(0,3);
  recentJ.forEach(j => snap.push(`- ${j.entry_date}: ${j.title||'untitled'} (mood: ${j.mood||'—'})${j.body?' — '+j.body.slice(0,60)+'...':''}`));

  const activeAlerts = (storeData.alerts || []).filter(a => !a.dismissed);
  snap.push(`\n### Active alerts`);
  if (activeAlerts.length) {
    activeAlerts.forEach(a => {
      snap.push(`- [${a.level.toUpperCase()}] ${a.message}${a.action ? ' — Suggested: ' + a.action : ''}`);
    });
  } else {
    snap.push('- No active alerts — all systems clear');
  }

  const tasks = storeData.tasks || [];
  snap.push(`\n### Dashboard tasks`);
  snap.push(`- Open: ${tasks.filter(t=>!t.done).length}`);
  tasks.filter(t=>!t.done).slice(0,5).forEach(t => snap.push(`  - ${t.title} [${t.badge}]`));

  const milestones = storeData.milestones || [];
  if (milestones.length) {
    snap.push(`\n### Milestones`);
    milestones.forEach(m => {
      const days = m.target_date ? Math.ceil((new Date(m.target_date)-now)/86400000) : null;
      snap.push(`- ${m.name}${days!==null?' ('+days+'d away)':''}: ${m.current_value||0} / ${m.target_value||'—'} ${m.unit||''}`);
    });
  }

  return snap.join('\n');
}

/* ── Call Anthropic API ── */
async function callClaude(question, storeData) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in .env');

  const vaultContext = readVaultContext(question);
  const dataSnapshot = buildDataSnapshot(storeData);
  const systemPrompt = buildSystemPrompt();

  const userMessage = `${dataSnapshot}${vaultContext}\n\n---\n\nQuestion: ${question}`;

  const body = JSON.stringify({
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    system:     systemPrompt,
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
      }
    ],
    messages: [{ role: 'user', content: userMessage }],
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
        'anthropic-beta':    'web-search-2025-03-05',
        'Content-Length':    Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            logger.error('Claude API error:', parsed.error.message);
            reject(new Error(parsed.error.message));
          } else {
            const textBlocks = (parsed.content || [])
              .filter(item => item.type === 'text')
              .map(item => item.text);

            let text = textBlocks.join('\n').trim();

            if (!text && parsed.stop_reason === 'tool_use') {
              text = 'Searching the web for current information...';
            }

            if (!text) {
              text = 'No response received. Please try again.';
            }

            resolve(text);
          }
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/* ── Parse action blocks from response ── */
function parseActions(response) {
  const actions = [];
  const regex   = /<action>([\s\S]*?)<\/action>/g;
  let match;
  while ((match = regex.exec(response)) !== null) {
    try { actions.push(JSON.parse(match[1].trim())); } catch(e) { /* skip malformed */ }
  }
  return actions;
}

/* ── Clean response for display (strip action blocks) ── */
function cleanResponse(response) {
  return response.replace(/<action>[\s\S]*?<\/action>/g, '').trim();
}

module.exports = { callClaude, parseActions, cleanResponse };
