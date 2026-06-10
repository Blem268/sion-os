# Sion OS Vault — Claude Instructions

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
```yaml
date: YYYY-MM-DD
type: daily | lesson | job-note | decision | reflection | project | journal
status: active | archived | inbox
project: blem-tuned | younity | blueport | silcomm | novatrust | personal
tags: [list]
```

## Query patterns
- "What did I learn about X?" → search knowledge/ by tag
- "What decisions did I make for Blueport?" → search businesses/blueport/
- "Summarise this week" → read daily/ for last 7 days
- "What patterns in Blem jobs?" → search businesses/blem-tuned/jobs/
- "Show my journal entries this month" → search daily/ with type=journal

## Cost note
CLI grep targets specific folders — never load full vault.
Average query: ~100 tokens. MCP would cost ~7M tokens. We do not use MCP.
