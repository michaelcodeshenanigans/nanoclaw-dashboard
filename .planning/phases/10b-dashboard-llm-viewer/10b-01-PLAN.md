---
phase: 10b-dashboard-llm-viewer
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/types.ts
  - src/lib/server/db.ts
  - src/routes/api/sessions/[id]/llm-calls/+server.ts
  - src/routes/sessions/[id]/llm-calls/+page.svelte
  - src/routes/sessions/[id]/+page.svelte
autonomous: true
requirements:
  - LLM-03
  - LLM-04
must_haves:
  truths:
    - "Svelte 5 runes ($state, $effect, $derived) — do NOT use legacy Svelte 4 stores"
    - "Tailwind 4.x responsive classes — dark theme only, matches existing page patterns"
    - "The llm_calls table may not exist (pre-Phase-10A containers) — ALL DB reads must be wrapped in try/catch returning [] gracefully"
    - "Dashboard is read-only — no write operations, no approval flows"
    - "Per-session data: getLlmCalls takes a sessionId and opens outbound.db via the existing getSessionDbPair() helper"
    - "Polling interval: 10 seconds (LLM calls don't change once written — but new calls appear as the session progresses)"
    - "pnpm is the ONLY package manager"
    - "No new npm packages — pure SvelteKit + Tailwind + existing date-fns"
  artifacts:
    - path: "src/lib/types.ts"
      provides: "LlmCall interface"
      contains: "thinking_text"
    - path: "src/lib/server/db.ts"
      provides: "getLlmCalls(sessionId) function"
      contains: "llm_calls"
    - path: "src/routes/api/sessions/[id]/llm-calls/+server.ts"
      provides: "GET /api/sessions/:id/llm-calls endpoint"
      contains: "getLlmCalls"
    - path: "src/routes/sessions/[id]/llm-calls/+page.svelte"
      provides: "LLM calls viewer page with expandable thinking"
      contains: "expandedId"
    - path: "src/routes/sessions/[id]/+page.svelte"
      provides: "Link to LLM calls page"
      contains: "llm-calls"
  key_links:
    - from: "src/routes/api/sessions/[id]/llm-calls/+server.ts"
      to: "src/lib/server/db.ts"
      via: "getLlmCalls(id)"
      pattern: "import { getLlmCalls }"
    - from: "src/routes/sessions/[id]/llm-calls/+page.svelte"
      to: "/api/sessions/[id]/llm-calls"
      via: "fetch + createPoller"
      pattern: "createPoller"
---

<objective>
Add a per-session LLM call observability page to the dashboard. Reads the `llm_calls` table from the session's outbound.db, shows a table of turns (model, tokens, duration, thinking preview), and expands rows inline to show full thinking text. Gracefully handles missing table (pre-Phase-10A containers).

Purpose: Closes the v1.2 milestone by giving the operator visibility into LLM call behavior — thinking process, token burn, latency — for any session.
Output: New type, DB reader, API endpoint, and page; link from session detail page.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
Read the following files to understand the patterns to follow:
- src/lib/types.ts (existing type interfaces — follow the same style)
- src/lib/server/db.ts (getSessionDbPair pattern, how to open outbound.db)
- src/routes/api/sessions/[id]/+server.ts (existing session API route pattern)
- src/routes/sessions/[id]/+page.svelte (existing session detail — add link here)
- src/routes/dropped/+page.svelte (polling + table pattern to follow for the new page)
</task>

<task type="auto">
Add the LlmCall interface to src/lib/types.ts.

Add after the existing interfaces (before the last export or at the end of the file):

```typescript
export interface LlmCall {
  id: number;
  turn_seq: number;
  timestamp: string;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  thinking_text: string | null;
  duration_ms: number | null;
}
```
</task>

<task type="auto">
Add getLlmCalls() to src/lib/server/db.ts.

The function opens the session's outbound.db via the existing getSessionDbPair() helper (which already handles path resolution and LRU caching), then queries the llm_calls table. It MUST NOT throw if the table doesn't exist.

```typescript
export function getLlmCalls(sessionId: string): LlmCall[] {
  // Find the session to get agent_group_id
  const session = db.prepare(
    'SELECT id, agent_group_id FROM sessions WHERE id = ?'
  ).get(sessionId) as { id: string; agent_group_id: string } | undefined;
  
  if (!session) return [];
  
  const { outbound } = getSessionDbPair(session.agent_group_id, session.id);
  if (!outbound) return [];
  
  try {
    return outbound.prepare(
      'SELECT * FROM llm_calls ORDER BY turn_seq ASC, id ASC'
    ).all() as LlmCall[];
  } catch {
    // Table doesn't exist yet (pre-Phase-10A container)
    return [];
  }
}
```

Import LlmCall from types at the top of db.ts (add to existing import line):
```typescript
import type { ..., LlmCall } from '$lib/types';
```
</task>

<task type="auto">
Create the API endpoint at src/routes/api/sessions/[id]/llm-calls/+server.ts.

Follow the exact pattern of existing session API routes:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLlmCalls } from '$lib/server/db';

export const GET: RequestHandler = ({ params }) => {
  const calls = getLlmCalls(params.id);
  return json(calls);
};
```
</task>

<task type="auto">
Create the LLM calls viewer page at src/routes/sessions/[id]/llm-calls/+page.svelte.

The page must satisfy all Phase 10B success criteria:
- Table: turn #, timestamp, model, in tokens, out tokens, duration (ms), thinking preview
- "No thinking" shown as "—" in preview column
- Expand button (▶ / ▼ toggle) on rows with thinking_text — reveals full thinking in a <pre> block below the row
- Empty state: "No LLM call data recorded yet" when array is empty
- Polls every 10 seconds via createPoller (same pattern as dropped/tasks pages)

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { createPoller, type PollState } from '$lib/poll';
  import type { LlmCall } from '$lib/types';
  import { formatDistanceToNow, format } from 'date-fns';

  const id = page.params.id;

  let calls = $state<PollState<LlmCall[]>>({ data: null, loading: true, error: null, lastUpdated: null });
  let expandedId = $state<number | null>(null);

  $effect(() => {
    const p = createPoller<LlmCall[]>(
      signal => fetch(`/api/sessions/${id}/llm-calls`, { signal })
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      10000,
      s => { calls = s; }
    );
    return () => p.stop();
  });

  function fmt(ts: string): string {
    try { return format(new Date(ts), 'HH:mm:ss'); } catch { return ts; }
  }

  function preview(text: string | null): string {
    if (!text) return '—';
    const trimmed = text.trim().replace(/\n/g, ' ');
    return trimmed.length > 80 ? trimmed.slice(0, 80) + '…' : trimmed;
  }

  function toggleExpand(id: number) {
    expandedId = expandedId === id ? null : id;
  }
</script>

<svelte:head><title>LLM Calls · Session {id} · NanoClaw</title></svelte:head>

<div class="mx-auto flex max-w-6xl flex-col gap-6 p-6">
  <!-- Header with back link -->
  <div class="flex items-center gap-4">
    <a href="/sessions/{id}" class="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
      ← Session
    </a>
    <h1 class="text-2xl font-semibold text-[hsl(var(--foreground))]">LLM Calls</h1>
    <span class="text-sm text-[hsl(var(--muted-foreground))] font-mono">{id}</span>
  </div>

  <section class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
    {#if calls.loading && !calls.data}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
    {:else if calls.error}
      <p class="text-sm text-red-500">Failed to load LLM calls: {calls.error}</p>
    {:else if !calls.data || calls.data.length === 0}
      <div class="py-12 text-center">
        <p class="text-sm text-[hsl(var(--muted-foreground))]">No LLM call data recorded yet.</p>
        <p class="text-xs text-[hsl(var(--muted-foreground))] mt-2">LLM calls are logged once the agent-runner is updated to Phase 10A.</p>
      </div>
    {:else}
      <div class="mb-3 text-xs text-[hsl(var(--muted-foreground))]">
        {calls.data.length} call{calls.data.length !== 1 ? 's' : ''}
        {#if calls.lastUpdated}· updated {calls.lastUpdated.toLocaleTimeString()}{/if}
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-[hsl(var(--border))] text-left text-[hsl(var(--muted-foreground))] text-xs uppercase tracking-wide">
              <th class="pb-3 pr-4 font-medium">#</th>
              <th class="pb-3 pr-4 font-medium">Time</th>
              <th class="pb-3 pr-4 font-medium">Model</th>
              <th class="pb-3 pr-4 font-medium text-right">In</th>
              <th class="pb-3 pr-4 font-medium text-right">Out</th>
              <th class="pb-3 pr-4 font-medium text-right">ms</th>
              <th class="pb-3 font-medium">Thinking</th>
            </tr>
          </thead>
          <tbody>
            {#each calls.data as call (call.id)}
              <tr class="border-b border-[hsl(var(--border))]/50 hover:bg-[hsl(var(--accent))]/20 transition-colors">
                <td class="py-3 pr-4 font-mono text-xs text-[hsl(var(--muted-foreground))]">{call.turn_seq}</td>
                <td class="py-3 pr-4 font-mono text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">{fmt(call.timestamp)}</td>
                <td class="py-3 pr-4 text-xs text-[hsl(var(--muted-foreground))]">{call.model ?? '—'}</td>
                <td class="py-3 pr-4 text-xs text-right font-mono">{call.input_tokens ?? '—'}</td>
                <td class="py-3 pr-4 text-xs text-right font-mono">{call.output_tokens ?? '—'}</td>
                <td class="py-3 pr-4 text-xs text-right font-mono text-[hsl(var(--muted-foreground))]">{call.duration_ms ?? '—'}</td>
                <td class="py-3">
                  {#if call.thinking_text}
                    <div class="flex items-start gap-2">
                      <button
                        onclick={() => toggleExpand(call.id)}
                        class="shrink-0 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                        aria-label="Toggle thinking"
                      >
                        {expandedId === call.id ? '▼' : '▶'}
                      </button>
                      <span class="text-xs text-[hsl(var(--muted-foreground))] truncate max-w-sm" title={call.thinking_text}>
                        {preview(call.thinking_text)}
                      </span>
                    </div>
                  {:else}
                    <span class="text-xs text-[hsl(var(--muted-foreground))]">—</span>
                  {/if}
                </td>
              </tr>
              {#if expandedId === call.id && call.thinking_text}
                <tr class="border-b border-[hsl(var(--border))]/50">
                  <td colspan="7" class="px-4 pb-4 pt-1">
                    <pre class="text-xs bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-96 overflow-y-auto">{call.thinking_text}</pre>
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
</div>
```
</task>

<task type="auto">
Add a "View LLM Calls" link to the session detail page (src/routes/sessions/[id]/+page.svelte).

Read the file first to understand its current structure, then add a link to the LLM calls page in the header or actions area — somewhere that makes contextual sense (e.g., near the "View messages" link if one exists, or in a row of action links at the top of the page).

The link should be:
```svelte
<a href="/sessions/{id}/llm-calls" class="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
  LLM Calls →
</a>
```
</task>

<task type="auto">
Run `node_modules/.bin/vite build` in /workspace/agent/nanoclaw-dashboard to verify the TypeScript compiles clean.

If the build fails:
- Fix TypeScript errors in the new files
- Do NOT add workaround casts — fix the actual types
- Re-run until clean

Do NOT proceed to the summary until the build is clean.
</task>

<task type="auto">
Write the summary at .planning/phases/10b-dashboard-llm-viewer/10b-01-SUMMARY.md. Include:
- Files created/modified
- The graceful degradation approach (try/catch on llm_calls query)
- Build result
- What the operator will see (table columns, expand behavior, empty state message)
</task>

</tasks>
