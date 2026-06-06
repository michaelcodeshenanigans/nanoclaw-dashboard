---
phase: 10b-dashboard-llm-viewer
plan: "01"
status: complete
---

# Summary: Phase 10B — Dashboard LLM Call Viewer

## Files Modified

| File | Change |
|------|--------|
| `src/lib/types.ts` | Added `LlmCall` interface (id, turn_seq, timestamp, model, input_tokens, output_tokens, thinking_text, duration_ms) |
| `src/lib/server/db.ts` | Added `LlmCall` to imports; added `getLlmCalls(sessionId)` function |
| `src/routes/sessions/[id]/+page.svelte` | Added "LLM Calls →" link alongside "View messages →" |

## Files Created

| File | Purpose |
|------|---------|
| `src/routes/api/sessions/[id]/llm-calls/+server.ts` | GET endpoint — calls `getLlmCalls(id)`, returns JSON array |
| `src/routes/sessions/[id]/llm-calls/+page.svelte` | LLM calls viewer page with table + expandable thinking accordion |

## Graceful Degradation

`getLlmCalls()` wraps the `outbound.prepare(...).all()` call in a `try/catch` that returns `[]` when the `llm_calls` table doesn't exist (pre-Phase-10A containers). The page shows "No LLM call data recorded yet." in this case.

## Build Result

`node_modules/.bin/vite build` — **clean**, no TypeScript errors. 187 modules (client), full SSR bundle built successfully.

## What the Operator Sees

- **Session detail page** — "LLM Calls →" link appears next to "View messages →" at the bottom of every session detail page.
- **LLM calls page** (`/sessions/[id]/llm-calls`) — table with columns: turn #, time (HH:mm:ss), model, in tokens, out tokens, duration (ms), thinking preview.
- **Thinking preview** — truncated to 80 chars. "—" shown when no thinking text.
- **Expand toggle** — ▶/▼ button on rows with thinking_text reveals full thinking in a `<pre>` block below the row. Only one row expanded at a time.
- **Empty state** — "No LLM call data recorded yet." when array is empty.
- **Polling** — page polls every 10 seconds, shows last-updated time above the table.
