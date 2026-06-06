---
phase: 10a-nanoclaw-llm-capture
plan: "01"
type: execute
wave: 1
depends_on: []
codebase: nanoclaw-v2
target_dir: /home/michael/workspace/nanoclaw-v2/container/agent-runner/src/
autonomous: true
requirements:
  - LLM-01
  - LLM-02
must_haves:
  truths:
    - "Agent-runner runs on Bun — use 'bun:sqlite' (import { Database } from 'bun:sqlite') NOT better-sqlite3 or node:sqlite"
    - "The llm_calls table MUST be in outbound.db (the per-session DB), NOT in v2.db (central) or a new file"
    - "CREATE TABLE IF NOT EXISTS — idempotent, so existing outbound.db files are upgraded gracefully"
    - "Write one row per completed agent turn, not per message or per thinking block chunk"
    - "If the provider emits no thinking event, still write the row with thinking_text = NULL"
    - "track duration_ms as wall-clock from when the query() call starts to when the result event arrives"
    - "The nanoclaw-v2 repo lives at /home/michael/workspace/nanoclaw-v2 on the host"
    - "After code changes: commit to nanoclaw-v2 repo, push to 'mine' remote, then rebuild with ./container/build.sh"
  artifacts:
    - path: "container/agent-runner/src/db/outbound.ts (or wherever outbound.db is opened)"
      provides: "llm_calls table DDL in the outbound.db initialization"
      contains: "CREATE TABLE IF NOT EXISTS llm_calls"
    - path: "container/agent-runner/src/poll-loop.ts"
      provides: "thinking capture + usage capture + DB write after each turn"
      contains: "llm_calls"
  key_links:
    - from: "poll-loop.ts event handler"
      to: "llm_calls table write"
      via: "result event (has usage) + accumulated thinking text"
      pattern: "INSERT INTO llm_calls"
---

<objective>
Add per-turn LLM call logging to the NanoClaw agent-runner. After each agent turn completes, write one row to the `llm_calls` table in outbound.db capturing: turn_seq, timestamp, model, input_tokens, output_tokens, thinking_text (full thinking block content, if any), and duration_ms.

Purpose: Enables the dashboard to display per-session LLM observability data — thinking blocks, token burn, model used — without any new infrastructure.
Codebase: nanoclaw-v2 agent-runner (NOT the dashboard repo)
Output: Modified outbound.db init + poll-loop event capture; commit + push to mine remote.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
</context>

<tasks>

<task type="auto">
Locate and read the outbound.db initialization code in the agent-runner source.

Run:
```
find /home/michael/workspace/nanoclaw-v2/container/agent-runner/src -name "*.ts" | xargs grep -l "outbound" | head -10
```

Then read the files that reference outbound.db to find:
1. Where the outbound DB is opened/created (likely a db setup file or a function called from poll-loop.ts)
2. What existing tables are defined (should include `messages_out` and `container_state`)
3. The exact import path for bun:sqlite
</task>

<task type="auto">
Add the `llm_calls` table DDL to the outbound.db initialization.

Find where the other tables (`messages_out`, `container_state`) are created with `CREATE TABLE IF NOT EXISTS`. Add the following DDL immediately after those definitions:

```sql
CREATE TABLE IF NOT EXISTS llm_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  turn_seq INTEGER NOT NULL DEFAULT 0,
  timestamp TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  thinking_text TEXT,
  duration_ms INTEGER
)
```

In TypeScript (bun:sqlite pattern):
```typescript
db.run(`
  CREATE TABLE IF NOT EXISTS llm_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turn_seq INTEGER NOT NULL DEFAULT 0,
    timestamp TEXT NOT NULL,
    model TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    thinking_text TEXT,
    duration_ms INTEGER
  )
`);
```

Do NOT modify any existing table definitions.
</task>

<task type="auto">
Read poll-loop.ts in full to understand the current event handling loop.

Key things to identify:
1. How `query.events` is iterated (for-await-of loop or similar)
2. What event types are emitted by the provider (look for `event.type` checks — expected: something like 'thinking', 'result', 'error', 'rate_limit')
3. Where the outbound DB reference is available (is it passed as a parameter? imported? stored in a closure?)
4. What the `result` event shape looks like (does it have `usage`, `model`, `inputTokens`/`input_tokens`?)
5. Whether there's already a `turnSeq` or turn counter variable

Read the file and record your findings before modifying anything.
</task>

<task type="auto">
Modify poll-loop.ts to capture LLM call data for each agent turn.

**Pattern to implement:**

Before the event loop for a single agent turn, initialize:
```typescript
const thinkingParts: string[] = [];
const callStartMs = Date.now();
let turnSeq = 0; // increment per turn, or use a persistent counter
```

Inside the event loop, handle thinking events by accumulating text:
```typescript
// The exact event type name depends on what the provider emits.
// Check the claude.ts provider to see if it emits 'thinking', 'agent_thinking',
// or something from the SDK event stream.
if (event.type === 'thinking' /* or whatever the actual type is */) {
  // Accumulate — thinking may come in chunks
  if (typeof event.thinking === 'string') thinkingParts.push(event.thinking);
  else if (typeof event.text === 'string') thinkingParts.push(event.text);
}
```

After the result event (or after the loop exits with a result), write the row:
```typescript
if (event.type === 'result') {
  const durationMs = Date.now() - callStartMs;
  const thinkingText = thinkingParts.length > 0 ? thinkingParts.join('') : null;
  
  // Get the outbound DB reference (however it's available in this scope)
  outboundDb.run(
    `INSERT INTO llm_calls (turn_seq, timestamp, model, input_tokens, output_tokens, thinking_text, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      turnSeq,
      new Date().toISOString(),
      event.model ?? null,
      event.usage?.inputTokens ?? event.usage?.input_tokens ?? null,
      event.usage?.outputTokens ?? event.usage?.output_tokens ?? null,
      thinkingText,
      durationMs
    ]
  );
  turnSeq++;
}
```

**IMPORTANT:** The exact field names (`event.model`, `event.usage?.inputTokens`, thinking event type) must be verified against the actual claude.ts provider implementation before writing. Read claude.ts and adapt accordingly. The above is pseudocode — match actual field names.

**ALSO IMPORTANT:** Reset `thinkingParts = []` and `callStartMs = Date.now()` at the start of each new turn, not globally. Each turn is one LLM API call.
</task>

<task type="auto">
Commit and push the changes to the nanoclaw-v2 repo.

```bash
cd /home/michael/workspace/nanoclaw-v2
git add container/agent-runner/src/
git commit -m "feat: log LLM calls (thinking, tokens, duration) to outbound.db per turn

Adds llm_calls table to outbound.db schema and hooks into poll-loop.ts
to capture thinking blocks, token usage, model, and duration for each
completed agent turn. Dashboard can now read this table for per-session
LLM observability."
git push mine main
```
</task>

<task type="auto">
Write the summary file at .planning/phases/10a-nanoclaw-llm-capture/10a-01-SUMMARY.md.

Include:
- Which files in nanoclaw-v2 were modified
- The exact llm_calls table schema as implemented
- The thinking event type name discovered in claude.ts
- The result event fields used (usage shape, model field)
- Commit hash pushed to mine remote
- What still needs to happen: container rebuild (./container/build.sh) and redeploy — relay to Yoni
</task>

</tasks>
