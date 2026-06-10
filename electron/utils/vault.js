// electron/utils/vault.js
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const VAULT_ROOT = path.join(os.homedir(), 'Sion-os', 'vault');

const DIRS = [
  'inbox',
  'knowledge/google-pm',
  'knowledge/acca-foa',
  'knowledge/trw-ai',
  'knowledge/general',
  'work/silcomm',
  'work/novatrust',
  'businesses/blem-tuned/jobs',
  'businesses/younity/projects',
  'businesses/blueport',
  'finance/decisions',
  'finance/goals',
  'health',
  'daily',
  'reflections',
  '_claude-output/synthesis',
  '_claude-output/summaries',
];

function initVault() {
  DIRS.forEach(dir => {
    fs.mkdirSync(path.join(VAULT_ROOT, dir), { recursive: true });
  });
  writeVaultClaude();
  writeVaultIndex();
}

function writeVaultClaude() {
  const file = path.join(VAULT_ROOT, 'CLAUDE.md');
  if (fs.existsSync(file)) return; // never overwrite
  fs.writeFileSync(file, vaultClaudeMd());
}

function writeVaultIndex() {
  const file = path.join(VAULT_ROOT, 'index.md');
  if (fs.existsSync(file)) return;
  fs.writeFileSync(file, `---
type: index
date: ${today()}
---

# Sion OS — Vault Index

Master pointer for all knowledge in this vault.

## Sections
- [[inbox/]] — raw captures, unprocessed
- [[knowledge/]] — study lessons and learning
- [[work/]] — Silcomm + NovaTrust context
- [[businesses/]] — Blem, Younity, Blueport
- [[finance/]] — financial decisions and goals
- [[health/]] — gym and wellness patterns
- [[daily/]] — daily notes (auto-created)
- [[reflections/]] — weekly and monthly reviews
- [[_claude-output/]] — AI-generated synthesis only
`);
}

function vaultClaudeMd() {
  return `# Sion OS Vault — Claude Instructions

## Owner
Sion Looby-Martinez, Antigua. CEO of Blem Tuned, Younity Consultancy,
Blueport Agency. Senior Admin at Silcomm Engineering and NovaTrust.

## Vault rules
1. NEVER write to vault root folders — only to _claude-output/
2. All notes use YAML frontmatter (date, type, tags, status, project)
3. Link related notes with [[wikilinks]]
4. inbox/ = unprocessed. Do not reference until filed.
5. _claude-output/ = AI summaries only. Not source of truth.
6. Do not delete any user-written notes.

## Frontmatter schema
\`\`\`yaml
date: YYYY-MM-DD
type: daily | lesson | job-note | decision | reflection | project | journal
status: active | archived | inbox
project: blem-tuned | younity | blueport | silcomm | novatrust | personal
tags: [list]
\`\`\`

## Query patterns
- "What did I learn about X?" → search knowledge/ by tag
- "What decisions did I make for Blueport?" → search businesses/blueport/
- "Summarise this week" → read daily/ for last 7 days
- "What patterns in Blem jobs?" → search businesses/blem-tuned/jobs/
- "Show my journal entries this month" → search daily/ with type=journal

## Cost note
CLI grep targets specific folders — never load full vault.
Average query: ~100 tokens. MCP would cost ~7M tokens. We do not use MCP.
`;
}

function writeNote(relativePath, frontmatter, body) {
  const full = path.join(VAULT_ROOT, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const fm = Object.entries(frontmatter)
    .map(([k,v]) => `${k}: ${Array.isArray(v) ? JSON.stringify(v) : v}`)
    .join('\n');
  fs.writeFileSync(full, `---\n${fm}\n---\n\n${body}`);
}

function appendToNote(relativePath, content) {
  const full = path.join(VAULT_ROOT, relativePath);
  if (!fs.existsSync(full)) return;
  fs.appendFileSync(full, '\n' + content);
}

function noteExists(relativePath) {
  return fs.existsSync(path.join(VAULT_ROOT, relativePath));
}

function today() {
  return new Date().toISOString().split('T')[0];
}

module.exports = { initVault, writeNote, appendToNote, noteExists, VAULT_ROOT, today };
