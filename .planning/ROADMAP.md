# Roadmap: NanoClaw Dashboard

**Created:** 2026-05-28
**Milestone:** v1.0 — Ops Panel Launch

## Overview

This roadmap delivers v1 of the NanoClaw Dashboard as six vertical MVP slices. Each phase produces a working, observable feature on the live route at `nanoclaw.marinemr.xyz` — not a horizontal layer. We build infrastructure first (so every later phase ships behind real auth on the real domain), then the read-side surfaces (groups, sessions, messages, health), then the write-side admin controls (restart, members, approvals) once the read side proves the data plumbing.

**Sequencing rationale:**
1. Infra first — every subsequent phase needs the container, Authelia, and SQLite mount working.
2. Groups list + health overview second — proves SQLite read path on the real DB, gives the operator their first useful page.
3. Sessions third — proves cross-table joins and per-session DB opening (the hardest read pattern).
4. Messages fourth — proves per-session DB pooling at scale (the largest data volume).
5. Group admin (restart + members) fifth — first ncl write path; lower risk than approvals.
6. Approvals last — most sensitive write path (executes pending commands); benefits from all prior plumbing being solid.

## Phases

### Phase 1: Foundation & Deploy
**Goal:** Stand up a single Docker container at `nanoclaw.marinemr.xyz` behind Authelia, serving a Hono backend + Svelte SPA with a stubbed overview page and a working SQLite read-only mount. Establishes the deploy loop and the 5-second polling pattern end-to-end.
**Mode:** mvp
**Requirements:** INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06
**Success Criteria:**
1. Operator navigates to `https://nanoclaw.marinemr.xyz`, is challenged by Authelia, and after login sees a dark-themed Svelte SPA served by Hono in a single container.
2. The backend's `/api/health` endpoint reports green for SQLite read connectivity (NanoClaw central DB mounted read-only) and ncl socket reachability.
3. The overview page auto-refreshes a "last updated" timestamp every 5 seconds via polling, with no full-page reload, and the interval is cleaned up on navigation.
4. `docker compose up -d` from the repo brings the container up with Traefik + Authelia labels applied, routed on the `cfdns` cert resolver.

### Phase 2: Groups Overview & System Health
**Goal:** Deliver the first real operator value — a groups list with live container status badges plus a system health summary card on the overview page. Proves the central SQLite read pattern and the live-status polling contract.
**Mode:** mvp
**Requirements:** GRP-01, HLTH-01, HLTH-02
**Success Criteria:**
1. Operator opens the overview page and sees a health summary card showing active session count, container status breakdown (running/stopped/error), and recent error count — all updating every 5 seconds.
2. Operator opens `/groups` and sees every agent group from the central DB listed with name, container status badge (color-coded running/stopped/error), and last-active time.
3. The groups list re-polls without page reload and badges flip color when a container state changes on the host.

### Phase 3: Group Detail, Members, Destinations & Sessions Index
**Goal:** Build out the group detail page (config, members, destinations, embedded session list) and the cross-group sessions index with filtering. Establishes navigation hierarchy and the joined-table read patterns that messages will later reuse.
**Mode:** mvp
**Requirements:** GRP-02, GRP-03, GRP-06, GRP-08, SESS-01, SESS-02, SESS-03, SESS-04
**Success Criteria:**
1. Operator clicks a group in the list and lands on a detail page showing its model, folder, provider, member list with roles, destination list, and that group's active sessions.
2. Operator opens `/sessions` and sees all active and recent sessions across every group, filterable by group, container status, and time range.
3. Operator opens a session detail page and sees its status, container state, and current tool being executed (from the per-session outbound.db `container_state`).
4. Operator clicks the parent-group link from a session detail and lands back on the correct group detail page.

### Phase 4: Per-Session Message Log Viewer
**Goal:** Ship the per-session message log with search and filter. Proves the per-session SQLite connection pool (LRU, max 50) under the heaviest read load in the app.
**Mode:** mvp
**Requirements:** MSG-01, MSG-02, MSG-03, MSG-04, MSG-05
**Success Criteria:**
1. Operator opens a session detail and sees a chronological merged log of inbound + outbound messages with sender, channel type, timestamp, and truncated content.
2. Operator types in a search box and the log filters to messages whose content matches the query within that session.
3. Operator toggles message-type filters (user / tool call / tool result / assistant) and a time range, and the log narrows accordingly.
4. Switching between sessions does not leak file descriptors — backend logs show LRU eviction once the 50-connection cap is reached.

### Phase 5: Group Admin — Restart & Member Management
**Goal:** Introduce the first write path through `ncl execFile`. Operator can restart a group (with optional `--rebuild` and message) and add/remove members. Establishes the input-validation and ncl-invocation patterns reused by approvals.
**Mode:** mvp
**Requirements:** GRP-04, GRP-05, GRP-07
**Success Criteria:**
1. Operator clicks "Restart" on a group detail page, optionally toggles `--rebuild` and enters a message, confirms, and within 5 seconds sees the container status badge transition through stopped → running.
2. Operator adds a member to a group by user ID; the new member appears in the group's member list on the next poll cycle.
3. Operator removes a member from a group and the member disappears from the list.
4. All write inputs are validated against the central DB before calling `ncl` via `execFile` with argument arrays (no string interpolation); invalid inputs return a 4xx without invoking the CLI.

### Phase 6: Pending Command Approvals Queue
**Goal:** Final write surface — the pending `ncl` write commands queue with inline approve/reject. Closes the v1 milestone by giving the operator full hands-off control of agent write requests.
**Mode:** mvp
**Requirements:** APPR-01, APPR-02, APPR-03, APPR-04
**Success Criteria:**
1. Operator opens `/approvals` and sees every pending command awaiting approval, each row showing command details, requesting group, and timestamp.
2. Operator clicks "Approve" on a pending command and the command executes via `ncl`; the row disappears from the queue on the next poll cycle.
3. Operator clicks "Reject" on a pending command and the command is cancelled via `ncl`; the row disappears from the queue.
4. The approvals queue auto-refreshes every 5 seconds and surfaces a count badge in the main nav when items are pending.

## Requirement Coverage

- v1 requirements: 29 total
- Mapped: 29 / 29 ✓
- Unmapped: 0

## Phase Dependencies

```
Phase 1 (Foundation)
        |
        v
Phase 2 (Groups Overview + Health)
        |
        v
Phase 3 (Group Detail + Sessions Index)
        |
        +----> Phase 4 (Message Log)     [can run parallel with Phase 5]
        |
        v
Phase 5 (Restart + Members)
        |
        v
Phase 6 (Approvals)
```

---
*Roadmap created: 2026-05-28*

---

## Milestone v1.1 Phases

**Milestone:** v1.1 — Mobile UX
**Created:** 2026-06-01
**Scope:** Make every existing dashboard page usable on a phone-sized viewport without touching any data/API layer.

### Overview

v1.0 shipped a desktop-optimized ops panel through Phase 6, plus an informal Phase 7 (Dropped Messages + Scheduled Tasks). v1.1 is a focused two-phase responsive pass over the existing surface — no new data, no new pages, no new dependencies. Just Tailwind v4 responsive utilities and a single Svelte 5 `$state` rune for the mobile drawer.

**Sequencing rationale:**
- Phase 8 first — the structural change (sidebar → hamburger drawer, layout reflow at 375px) is the hardest and unblocks observable mobile usage of every page.
- Phase 9 second — once the shell is mobile-usable, polish the in-page chrome: table scroll containers, filter stacking, and tap-target sizing.

### Phase 8: Responsive Nav & Layout Foundation
**Goal:** Operator can navigate the dashboard on a 375px-wide phone — the fixed sidebar becomes a hamburger-toggled drawer, and every existing page reflows without horizontal overflow.
**Mode:** mvp
**Depends on:** Phase 7 (existing desktop layout)
**Requirements:** MOB-01, MOB-02, MOB-03
**Success Criteria:**
1. On a viewport ≤768px wide, the fixed 220px sidebar is hidden and a hamburger button in the top bar is the only nav entry point.
2. Tapping the hamburger opens a drawer with the same nav links as desktop; tapping the backdrop or any nav link inside the drawer closes it.
3. Every existing page (overview, groups, group detail, sessions, session detail, messages, approvals, dropped, tasks) renders at 375px width with zero horizontal page-level scroll — verified by `document.documentElement.scrollWidth === window.innerWidth` in devtools.
4. The desktop layout (≥769px) is visually unchanged — the sidebar stays fixed, the hamburger is hidden, no regressions in spacing or navigation behavior.
**Plans:** TBD
**UI hint**: yes

### Phase 9: Mobile Polish — Tables, Filters, Touch Targets
**Goal:** Operator can read every data table, use every filter, and tap every action on a phone without zooming or frustration.
**Mode:** mvp
**Depends on:** Phase 8
**Requirements:** MOB-04, MOB-05, MOB-06
**Success Criteria:**
1. Every data table (groups, sessions, approvals, dropped, tasks) sits inside a horizontally scrollable container on ≤768px viewports — the page itself does not scroll horizontally, but the table can.
2. Filter control rows on `/sessions`, `/messages`, `/approvals`, and `/dropped` wrap or stack vertically on ≤768px so no control overflows or gets clipped.
3. Every interactive element — nav links (drawer + desktop), buttons, table row actions, filter controls — has a minimum 44×44px touch target on mobile, verified by computed style on representative elements.
4. The desktop layout (≥769px) keeps its denser table rows, inline filter row, and existing button sizes — mobile sizing is additive via responsive classes, not a global change.
**Plans:** TBD
**UI hint**: yes

### v1.1 Requirement Coverage

- v1.1 requirements: 6 total
- Mapped: 6 / 6 ✓
- Unmapped: 0

| Requirement | Phase |
|-------------|-------|
| MOB-01 | Phase 8 |
| MOB-02 | Phase 8 |
| MOB-03 | Phase 8 |
| MOB-04 | Phase 9 |
| MOB-05 | Phase 9 |
| MOB-06 | Phase 9 |

### v1.1 Phase Dependencies

```
Phase 7 (existing — desktop layout, Dropped + Tasks)
        |
        v
Phase 8 (Responsive nav + layout foundation)
        |
        v
Phase 9 (Tables, filters, touch targets)
```

---
*v1.1 roadmap appended: 2026-06-01*

---

## Milestone v1.2 Phases

**Milestone:** v1.2 — LLM Call Observability
**Created:** 2026-06-06
**Scope:** Per-session LLM call logging (thinking blocks, token counts, duration) stored in outbound.db by the agent-runner and surfaced in the dashboard as a read-only observability page.

### Overview

v1.2 spans two codebases: the NanoClaw agent-runner (Bun, in `nanoclaw-v2`) and the dashboard (SvelteKit, in `nanoclaw-dashboard`). Phase 10A is a **prerequisite** for Phase 10B — the dashboard page has no data to read until the agent-runner writes the `llm_calls` table.

**Design decisions locked:**
- Storage: `llm_calls` table in `outbound.db` (co-located with session, no new DB file)
- Scope: per-session only — no cross-session aggregation
- Display: expandable accordion inline in the LLM calls table (no separate drill-down page)
- Agent-runner uses `bun:sqlite` (not Node's better-sqlite3)

**Sequencing rationale:**
- Phase 10A first — agent-runner must write `llm_calls` rows before the dashboard can read them. No dashboard work is meaningful without real data.
- Phase 10B second — pure read-side dashboard work; can be developed against a test DB with manually inserted rows if 10A isn't deployed yet.

### Phase 10A: NanoClaw Core — LLM Call Capture
**Goal:** The agent-runner captures per-turn thinking blocks and token usage into an `llm_calls` table in each session's `outbound.db` — so the dashboard can read it without any new infrastructure.
**Codebase:** `nanoclaw-v2` (not the dashboard repo) — `/home/michael/workspace/nanoclaw-v2/container/agent-runner/src/`
**Mode:** mvp
**Requirements:** LLM-01, LLM-02
**Success Criteria:**
1. After the agent-runner image is rebuilt and deployed, every completed agent turn writes one row to `outbound.db`'s `llm_calls` table with a non-null `timestamp`, `turn_seq`, and either `input_tokens > 0` or `thinking_text IS NOT NULL` (or both).
2. A session with 3 turns produces exactly 3 rows in `llm_calls` — no duplicates, no missing turns.
3. The `llm_calls` table is created idempotently (`CREATE TABLE IF NOT EXISTS`) so existing outbound.db files with no `llm_calls` table are upgraded gracefully on first run.
4. Agent-runner processes with no thinking blocks (thinking disabled) still write rows with `thinking_text = NULL` — the table is always populated regardless of thinking mode.
**Plans:** TBD
**Note:** Phase 10A changes go to the `nanoclaw-v2` repo on the host. Executor must relay code via SSH or bundle for Yoni to apply.

### Phase 10B: Dashboard — LLM Call Viewer
**Goal:** Operator can open a per-session LLM calls page from the session detail page, see a table of turns with token counts and thinking previews, and expand any row to read the full thinking text.
**Codebase:** `nanoclaw-dashboard`
**Mode:** mvp
**Depends on:** Phase 10A (outbound.db must have `llm_calls` table)
**Requirements:** LLM-03, LLM-04
**Success Criteria:**
1. Session detail page (`/sessions/[id]`) has a "View LLM Calls" link that navigates to `/sessions/[id]/llm-calls`.
2. The LLM calls page shows a table with one row per turn: turn number, timestamp, model, input tokens, output tokens, duration, and a truncated thinking preview (max 80 chars) or "—" if no thinking.
3. Clicking an expand button on any row with thinking text reveals the full thinking block in a `<pre>` element below that row.
4. If no `llm_calls` table exists (Phase 10A not yet deployed), the page shows "No LLM call data recorded yet" without crashing.
**Plans:** TBD

### v1.2 Requirement Coverage

- v1.2 requirements: 4 total
- Mapped: 4 / 4 ✓

| Requirement | Phase |
|-------------|-------|
| LLM-01 | Phase 10A |
| LLM-02 | Phase 10A |
| LLM-03 | Phase 10B |
| LLM-04 | Phase 10B |

### v1.2 Phase Dependencies

```
Phase 9 (Mobile Polish — complete)
        |
        v
Phase 10A (NanoClaw Core — LLM capture)   <-- prerequisite: writes the data
        |
        v
Phase 10B (Dashboard — LLM Call Viewer)   <-- reads from outbound.db
```

---
*v1.2 roadmap appended: 2026-06-06*

---

## Milestone v2.0 Phases

**Milestone:** v2.0 — Ops Intelligence
**Created:** 2026-08-24
**Scope:** 20 features across 4 tiers (Phases 11–30) transforming the dashboard from a status viewer into a full ops intelligence platform — triage, alerting, cost, control, debugging, configuration, and housekeeping.

### Overview

v1.0–v1.1 shipped a complete read-and-act ops panel (Phases 1–9). v1.2 (Phases 10A/10B) is **parked** — Langfuse will own LLM tracing, cost, and token analytics. v2.0 picks up at **Phase 11** and runs one phase per feature through **Phase 30**, in strict tier order: Tier 1 (triage & alerting) → Tier 2 (cost, control, debugging) → Tier 3 (configuration & polish) → Tier 4 (security & housekeeping).

**Cross-cutting facts that shape this milestone:**

1. **The NanoClaw DB is mounted read-only.** `src/lib/server/db.ts` opens the central DB with `{ readonly: true }` and that stays true. Every v2.0 feature that stores dashboard-owned state — triage snooze/ack, alert thresholds, annotations, audit log, retention settings, task run history, FTS index, per-operator last-visit — needs a **dashboard-owned writable SQLite DB**. Phase 13 introduces it; Phases 14, 17, 22, 27, 28, 29, and 30 build on it. Any phase plan that needs to persist state must use that DB, never the NanoClaw one.

2. **There is no cost/token source live today.** Phase 10A (the `llm_calls` writer) is parked, so spend and token figures have no origin until either Langfuse lands or 10A is unparked. KPI-01's spend tile and RUNS-01's estimated-cost column must therefore degrade explicitly ("Unavailable") rather than fabricate a zero. Phases 11, 12, and 15 all carry this caveat.

3. **Langfuse scope revisit — Phases 15 and 20.** Cost & Token Command Center and Session Trace View may reduce to "link out to Langfuse" rather than full in-dashboard implementations. Both phase plans must confirm the data source of record before building UI.

4. **Authelia already handles authentication.** No v2.0 phase implements auth. ROLE-01 (Phase 27) maps *existing* Authelia identities to owner/admin/member roles — it does not reimplement login. Mutating actions in Phases 16, 17, 18, 19, 22, 24, 25, and 26 do **not** need their own auth layer; they only need to write to the audit log (ROLE-02) once Phase 27 ships. Build them now, wire the audit call at Phase 27.

**Sequencing rationale:**
- Tier 1 first because triage is the operator's daily loop. Phase 11 (KPI) establishes the shared run-aggregation query layer; Phase 12 (run history) turns it into a browsable table; Phase 13 (triage) consumes that status classification and introduces the writable state DB; Phase 14 (alerts) pushes it all into chat.
- Tier 2 is the "when something is wrong" tier — cost visibility, emergency control, task control, steering, failure triage, and tracing.
- Tier 3 is configuration surface and long-tail visibility.
- Tier 4 closes the milestone with security (roles + audit), search, retention, and the delta view — all deliberately last because they depend on the mutating actions and data surfaces built in Tiers 1–3.

---

### Phase 11: Overview KPI Banner
**Goal:** Operator lands on the overview page and immediately sees the 7-day health of the whole install — sessions, failures, failure rate, average duration, and spend — each with a trend arrow versus the prior week.
**Mode:** mvp
**Tier:** 1 — Triage & Alerting
**Depends on:** Phase 9 (existing overview page and 5s polling shell)
**Requirements:** KPI-01, KPI-02
**Success Criteria:**
1. The overview page shows five KPI tiles — total sessions, failure count, failure rate, average session duration, total spend — each computed over a rolling 7-day window from the central DB.
2. Each tile shows a delta versus the prior 7-day period with direction-aware color coding (fewer failures is green, not red) and refreshes on the standard poll without a full page reload.
3. A tile with no data in either window renders "—" rather than `NaN`, `Infinity`, or a misleading 0% delta.
4. The spend tile renders an explicit "Unavailable" state with a reason while no cost source exists (Phase 10A parked / Langfuse not live) instead of showing a fabricated zero.
**Plans:** TBD
**Note:** Establishes the shared run-aggregation module (sessions rolled up into runs with status, duration, turn count) that Phases 12, 15, and 19 reuse. Build it as a reusable server module, not inline page queries.
**UI hint**: yes

### Phase 12: Unified Run History
**Goal:** Operator can see every session run and task run across every group in one filterable, linkable table.
**Mode:** mvp
**Tier:** 1 — Triage & Alerting
**Depends on:** Phase 11 (run-aggregation module)
**Requirements:** RUNS-01, RUNS-02
**Success Criteria:**
1. `/runs` shows one row per session run and per scheduled-task run across all groups, with status (running/success/failed/waiting/dropped), group, trigger source (message/scheduled/manual), duration, turn count, and estimated cost.
2. Operator can filter by status, group, trigger source, and time range, and the active filters are reflected in the URL so a filtered view is shareable and survives reload.
3. Every row links through to the underlying session detail (or task detail) page.
4. The estimated-cost column renders "—" while no cost source is live, and the table stays responsive on the full history window via paging or a capped result set.
**Plans:** TBD
**Note:** The status classification defined here (what counts as failed vs dropped vs waiting) becomes the canonical definition consumed by Phases 13, 17, and 19.
**UI hint**: yes

### Phase 13: Triage Inbox
**Goal:** Operator has a single "needs attention" queue — approvals, dropped messages, overdue/failed tasks, stalled sessions — that can be cleared inline without visiting four separate pages.
**Mode:** mvp
**Tier:** 1 — Triage & Alerting
**Depends on:** Phase 12 (run status classification), Phase 6 (approvals), Phase 7 (dropped + tasks)
**Requirements:** TRIAGE-01, TRIAGE-02, TRIAGE-03
**Success Criteria:**
1. `/triage` lists items from all four sources — open approvals, dropped/unregistered-sender messages, overdue or failed scheduled tasks, and stalled sessions — in one prioritized list showing source badge, group, and age.
2. Operator resolves an item inline without leaving the page (approve/reject an approval, retry/dismiss a task, acknowledge a stalled session) and the item leaves the list on the next poll.
3. Operator snoozes an item for a chosen duration; the item disappears immediately and reappears once the snooze expires, surviving a dashboard restart.
4. The nav shows a live count badge of unresolved, non-snoozed triage items.
**Plans:** TBD
**Note:** This phase introduces the **dashboard-owned writable SQLite DB** (snooze and acknowledgement state cannot go in the read-only NanoClaw DB). Schema, migration approach, and volume mount established here are reused by Phases 14, 17, 22, 27, 28, 29, and 30 — treat it as milestone infrastructure, not a one-off table.
**UI hint**: yes

### Phase 14: Chat-pushed Alerts/Monitors
**Goal:** The dashboard proactively pushes a NanoClaw message when a group blows its budget, an approval goes stale, or a group goes silent — with thresholds the operator configures per group.
**Mode:** mvp
**Tier:** 1 — Triage & Alerting
**Depends on:** Phase 13 (dashboard state DB), Phase 11 (spend aggregation for the budget monitor)
**Requirements:** ALERT-01, ALERT-02, ALERT-03, ALERT-04
**Success Criteria:**
1. Operator configures per-group alert thresholds in the dashboard UI — monthly budget, approval-pending timeout (default 30 min), and silence window in hours — and the values persist across container restarts.
2. Exceeding a group's monthly budget delivers a NanoClaw message naming the group, the budget, and the actual spend, sent **once per breach** rather than on every evaluation tick.
3. An approval pending longer than its threshold, and a group silent longer than its window, each deliver a NanoClaw message identifying the group and the triggering condition (the silence detector must catch a dead companion that is otherwise invisible).
4. Monitor evaluation runs on a background schedule inside the dashboard container, exposes a "last evaluated" timestamp plus a manual "evaluate now" for testing, and does not re-send already-fired alerts after a restart.
**Plans:** TBD
**Note:** Budget monitoring depends on a live cost source. Until one exists, ALERT-01 ships with its config and firing logic testable against a manually seeded spend value, and the plan must state that explicitly rather than silently no-op.
**UI hint**: yes

### Phase 15: Cost & Token Command Center
**Goal:** Operator can see where the money is going — spend by group, model, and session type for today, month-to-date, and projected — with a trend chart and per-group budget guardrails that can auto-pause a runaway group.
**Mode:** mvp
**Tier:** 2 — Cost, Control, Debugging
**Depends on:** Phase 11 (aggregation module), Phase 14 (budget threshold config), Phase 16 (pause mechanism for the auto-pause guardrail)
**Requirements:** COST-01, COST-02, COST-03
**Success Criteria:**
1. The phase plan **first confirms the cost source of record** (Langfuse vs. local token capture). If Langfuse is live, scope reduces to guardrail configuration plus a link-out to the corresponding Langfuse views, and that decision is recorded in the plan before any chart is built.
2. Spend is broken down by companion group, model, and session type for today, month-to-date, and a projected monthly total derived from the MTD run-rate — or, under the reduced scope, the equivalent Langfuse views are reachable in one click from the dashboard.
3. A spend trend chart covers the current month at daily granularity (reduced scope: satisfied by the Langfuse link-out).
4. Operator sets a per-group budget guardrail with an optional auto-pause toggle; when the guardrail is exceeded with auto-pause enabled, that group is paused and the action is recorded and visible.
**Plans:** TBD
**Scope flag:** ⚠️ **Revisit once Langfuse is live.** This phase may become "link out to Langfuse" rather than a full implementation. Do not build cost charting before confirming Langfuse is not already the answer.
**UI hint**: yes

### Phase 16: Emergency Stop/Pause
**Goal:** Operator can halt everything — or one misbehaving group — instantly from the dashboard, without losing a single queued inbound message.
**Mode:** mvp
**Tier:** 2 — Cost, Control, Debugging
**Depends on:** Phase 5 (ncl write path and validation patterns)
**Requirements:** CTRL-01, CTRL-02
**Success Criteria:**
1. Operator triggers a global emergency stop behind an explicit confirmation step; every running agent container halts and all queued inbound messages are quarantined (marked and held, never deleted).
2. Operator triggers a group-scoped emergency stop; only that group's container halts and only that group's inbound queue is quarantined, while other groups keep running normally.
3. Operator releases a stop and quarantined messages are restored to the queue in their original order — no message lost, no message processed twice.
4. Active stop state (global or per-group) is visible as a persistent banner on every dashboard page, so the operator cannot forget the system is halted.
**Plans:** TBD
**Note:** Mutating actions. No separate auth layer is needed — Authelia already gates the dashboard. Once Phase 27 ships, both stop and release must write audit rows (ROLE-02).
**UI hint**: yes

### Phase 17: Run Now + Task Run History
**Goal:** Operator can fire a scheduled task on demand and see the full per-run history of every task, including which ones are flapping.
**Mode:** mvp
**Tier:** 2 — Cost, Control, Debugging
**Depends on:** Phase 7 (tasks page), Phase 12 (run history), Phase 13 (dashboard state DB for run records)
**Requirements:** SCHED-01, SCHED-02, SCHED-03
**Success Criteria:**
1. Operator clicks "Run now" on a scheduled task; it executes immediately **without altering its recurrence schedule**, and the run appears in run history with trigger source "manual".
2. Each scheduled task has a per-run history view showing timestamp, duration, status, and delivery outcome for every run.
3. A task that has alternated between failed and success more than N times in the recent window shows a "flapping" badge, with N configurable.
4. Run history persists across dashboard restarts and container recycles — history is stored in the dashboard-owned DB, not derived on the fly from ephemeral state.
**Plans:** TBD
**Note:** Mutating action ("Run now") — audit-log it once Phase 27 ships.
**UI hint**: yes

### Phase 18: Steer from Dashboard
**Goal:** Operator can drop a message or prompt into a live session straight from the UI and watch the agent respond.
**Mode:** mvp
**Tier:** 2 — Cost, Control, Debugging
**Depends on:** Phase 4 (message log), Phase 16 (control-action and stop-state patterns)
**Requirements:** STEER-01
**Success Criteria:**
1. The session detail page has a compose box that writes a well-formed inbound message into that session's `inbound.db`.
2. The injected message appears in that session's message log and the agent picks it up on its next turn.
3. Injection is refused with a clear, specific error for sessions that are not live (stopped/errored) or that sit under an active emergency stop.
4. Dashboard-originated messages are visually distinguishable in the log from real channel traffic, so the operator can tell what they injected versus what a user sent.
**Plans:** TBD
**Note:** Mutating action — audit-log it once Phase 27 ships. Authelia already gates access; no separate auth needed.
**UI hint**: yes

### Phase 19: Failure Triage
**Goal:** Operator can see failures grouped by what actually broke, drill into the failing turn with full context, and replay the action.
**Mode:** mvp
**Tier:** 2 — Cost, Control, Debugging
**Depends on:** Phase 12 (run history and failure classification)
**Requirements:** FAIL-01, FAIL-02, FAIL-03
**Success Criteria:**
1. `/failures` groups failed runs by normalized error signature (error message and/or failing tool name) with occurrence count and last-seen timestamp, so 40 instances of one bug read as one row.
2. Operator drills from a signature into an individual failed run and sees the failing turn in full surrounding context — the messages before and after, not just the error line.
3. Operator replays a failed action and chooses between current instructions and the instructions as they were at the time of failure; the replay appears in run history as a new run linked back to the original.
4. Until Phase 26 (instruction version history) ships, the "instructions as they were" replay option is visibly disabled with an explanation rather than silently falling back to current instructions.
**Plans:** TBD
**Note:** The signature-normalization logic built here is reused by Phase 23 (Error Digest) — build it as a shared module. Replay is a mutating action; audit-log it once Phase 27 ships.
**UI hint**: yes

### Phase 20: Session Trace View
**Goal:** Operator can see exactly what a session did — a chronological tool-call timeline with arguments and durations.
**Mode:** mvp
**Tier:** 2 — Cost, Control, Debugging
**Depends on:** Phase 4 (session detail and per-session DB pool)
**Requirements:** TRACE-01
**Success Criteria:**
1. **Feasibility gate (must complete before any UI work):** the phase plan documents a *verified* read path to session transcripts from inside the dashboard container — mount path, file format, and permissions confirmed on the real host — or records the blocker and the fallback decision and stops.
2. Session detail exposes a trace view listing tool calls in chronological order with tool name, arguments (truncated with expand), and duration.
3. Still-executing or long-running tool calls are visually distinct from completed ones, so a hung tool is obvious at a glance.
4. When transcripts are unavailable, or when Langfuse becomes the trace source of record, the view renders an explicit unavailable state or link-out instead of an empty, broken, or misleading page.
**Plans:** TBD
**Scope flag:** ⚠️ **Feasibility-gated AND Langfuse-gated.** Two independent risks: (a) transcript access from the container is unproven — the plan must verify it first; (b) Langfuse may supersede this entirely, reducing the phase to a link-out. Resolve both before committing to full implementation.
**UI hint**: yes

### Phase 21: Host & Container Health Strip
**Goal:** Operator can see host CPU, RAM, and disk alongside every container's state at a glance, with color that screams when something is wrong.
**Mode:** mvp
**Tier:** 3 — Configuration & Polish
**Depends on:** Phase 2 (existing health summary and polling contract)
**Requirements:** HOST-01, HOST-02
**Success Criteria:**
1. A health strip shows host CPU, RAM, and disk usage alongside individual container states, and refreshes on the standard poll interval without a full page reload.
2. Operator configures warn and critical thresholds per metric; breaching a threshold flips that metric to amber or red respectively.
3. Thresholds persist across restarts and default to sensible values so the strip is useful before any configuration.
4. If host metrics are not readable from inside the container, the strip degrades to container states only with a visible reason — never displays zeros or stale values as if they were live.
**Plans:** TBD
**UI hint**: yes

### Phase 22: Annotations
**Goal:** Operator can bookmark, tag, rate, and annotate any session or message, then pull up everything they flagged.
**Mode:** mvp
**Tier:** 3 — Configuration & Polish
**Depends on:** Phase 13 (dashboard state DB), Phase 4 (message log)
**Requirements:** ANNOT-01, ANNOT-02
**Success Criteria:**
1. Operator can bookmark, add tags, set a thumbs-up/thumbs-down rating, and write a free-text note on any session and on any individual message.
2. Annotations persist across restarts and render inline on the session or message they belong to.
3. A "flagged" view lists only annotated sessions and messages, filterable by tag and by rating.
4. Annotations are edited and deleted from the same UI and are stored entirely in the dashboard-owned DB — the NanoClaw DB is never written to.
**Plans:** TBD
**Note:** Mutating actions — audit-log once Phase 27 ships.
**UI hint**: yes

### Phase 23: Error Digest
**Goal:** Operator sees all error output across every session collapsed into signature groups, plus a per-session warning when the context window is filling up.
**Mode:** mvp
**Tier:** 3 — Configuration & Polish
**Depends on:** Phase 19 (shared signature-normalization module)
**Requirements:** ERR-01, ERR-02
**Success Criteria:**
1. Error log lines from all sessions are aggregated into signature groups with occurrence count and last-seen timestamp, ordered so the loudest and most recent problems surface first.
2. Operator drills from a signature into the specific sessions and runs where it occurred.
3. Each active session shows a context-window and compaction pressure indicator (usage against limit, compaction events) with a warn state as it approaches the limit.
4. The digest reuses Phase 19's signature normalization rather than duplicating it — one error grouping definition across the dashboard.
**Plans:** TBD
**UI hint**: yes

### Phase 24: Skills & MCP Server Inventory
**Goal:** Operator can see exactly which skills and MCP servers each group has, when each was last used, and turn any of them off.
**Mode:** mvp
**Tier:** 3 — Configuration & Polish
**Depends on:** Phase 3 (group detail page)
**Requirements:** INV-01, INV-02
**Success Criteria:**
1. Group detail shows an inventory of installed skills and configured MCP servers with a last-used timestamp per entry; entries never used show "never" rather than a blank or an epoch date.
2. Operator enables or disables a skill or MCP server for a group, and the change takes effect for that group's next session.
3. Enable/disable state is persisted and authoritative on reload — it is not client-only optimistic state.
4. The inventory reflects reality after an external change (a skill added on the host) on the next refresh, rather than serving a stale cached list.
**Plans:** TBD
**Note:** Mutating action — audit-log once Phase 27 ships.
**UI hint**: yes

### Phase 25: Connections Health
**Goal:** Operator can inventory every stored credential and channel bridge per group and test them live — without a secret value ever reaching the browser.
**Mode:** mvp
**Tier:** 3 — Configuration & Polish
**Depends on:** Phase 24 (inventory surface and patterns)
**Requirements:** CONN-01, CONN-02
**Success Criteria:**
1. Group detail lists stored credentials and channel bridges with name, type, and last-used timestamp; credential values are masked **at the server boundary** and never rendered, logged, or serialized into any API response.
2. Operator triggers a live "test connection" for any credential or bridge and sees a pass/fail result, with a reason shown on failure.
3. The last test result and its timestamp persist and remain visible until re-tested.
4. Tests are rate-limited and non-blocking — a slow test shows an in-progress state rather than hanging the page.
**Plans:** TBD
**UI hint**: yes

### Phase 26: Instructions/Memory Version History
**Goal:** Operator can see how a group's instructions and memory changed over time, diff any two versions, roll back, and know which version was live for any given run.
**Mode:** mvp
**Tier:** 3 — Configuration & Polish
**Depends on:** Phase 12 (run history, for INST-03 linking), Phase 24 (group configuration surfaces)
**Requirements:** INST-01, INST-02, INST-03
**Success Criteria:**
1. Group detail shows version history for `CLAUDE.md`, fragment files, and memory files, with a diff view between any two selected versions.
2. Operator rolls a group's instructions back to a previous version; the group's next session uses the rolled-back content, and the rollback itself is recorded as a new version (not a silent overwrite).
3. Every run in run history links to the instruction version that was live when it ran, and clicking through opens that exact version.
4. Runs predating version tracking display "version unknown" rather than linking to a wrong or nearest-guess version.
**Plans:** TBD
**Note:** Unblocks Phase 19's "replay with instructions as they were" (FAIL-03) — once this ships, revisit that disabled option. Rollback is a mutating action; audit-log it once Phase 27 ships. This does **not** contradict the "no agent code editing" constraint: rollback selects an existing committed version, it is not a web-form editor.
**UI hint**: yes

### Phase 27: Roles + Dashboard Audit Log
**Goal:** Every operator identity maps to a role, and every mutating action taken in the dashboard is permanently recorded with who, what, and when.
**Mode:** mvp
**Tier:** 4 — Security & Housekeeping
**Depends on:** Phases 16, 17, 18, 19, 22, 24, 25, 26 (the mutating actions being logged), Phase 13 (dashboard state DB)
**Requirements:** ROLE-01, ROLE-02
**Success Criteria:**
1. The dashboard reads the already-authenticated Authelia identity from the forwarded request headers and maps it to an owner/admin/member role; an unmapped user gets the least-privileged role by default.
2. Role determines which mutating actions are offered, and a blocked action returns an explicit 403 with a reason rather than failing silently or hiding the failure.
3. Every mutating action — restart, member add/remove, approve, reject, steer, replay, rollback, emergency stop/release, run-now, snooze, enable/disable, retention change — writes an audit row capturing actor, action, target, and timestamp.
4. Operator can view the audit log and filter it by actor, action type, target, and time range.
**Plans:** TBD
**Note:** ⚠️ **Authelia already handles authentication.** ROLE-01 is *role mapping over existing Authelia users* — do not build login, sessions, password handling, or any identity store. The dashboard trusts the Authelia-forwarded identity header and maps it. This phase is deliberately late so it can wire audit logging into every mutating action from Tiers 2–3 in one pass.
**UI hint**: yes

### Phase 28: Global FTS5 Search
**Goal:** Operator can find any message, session, or task from a single search box in the header.
**Mode:** mvp
**Tier:** 4 — Security & Housekeeping
**Depends on:** Phase 4 (message read path), Phase 12 (run history), Phase 13 (dashboard state DB to host the index)
**Requirements:** SEARCH-01
**Success Criteria:**
1. A search bar in the dashboard header runs a SQLite FTS5 query across all messages, sessions, and scheduled tasks and returns results grouped by type and ranked by relevance.
2. Every result links directly to its source and lands on the matched item itself, not merely the top of the containing page.
3. The FTS index lives in the dashboard-owned DB (the NanoClaw DB stays read-only) and stays current as new messages arrive via incremental update.
4. Search across the full corpus returns at interactive latency, and a no-match query shows a clear empty state rather than an error or a blank page.
**Plans:** TBD
**UI hint**: yes

### Phase 29: Retention & Redaction Settings
**Goal:** Operator controls how long data is kept and can strip message bodies while keeping the metrics that matter.
**Mode:** mvp
**Tier:** 4 — Security & Housekeeping
**Depends on:** Phase 27 (audit log — retention changes are mutating and destructive), Phase 28 (search index must survive pruning)
**Requirements:** RET-01, RET-02
**Success Criteria:**
1. Operator configures a retention window; messages and sessions older than the window are pruned by a scheduled job, and the next-run time plus last-run result are visible in the UI.
2. Operator enables metadata-only retention; after it runs, timestamps, statuses, and cost data survive while message payload bodies are removed.
3. A dry-run preview shows exactly how many records each setting would affect **before** anything is deleted, and destructive application requires explicit confirmation.
4. Pruning keeps derived state consistent — KPI windows, run history, and the FTS index do not break or leave orphaned rows after a prune.
**Plans:** TBD
**Note:** The only irreversibly destructive feature in the milestone. Dry-run and audit logging are not optional polish here — they are the safety mechanism.
**UI hint**: yes

### Phase 30: Delta View
**Goal:** Operator returning to the dashboard sees exactly what changed since they last looked.
**Mode:** mvp
**Tier:** 4 — Security & Housekeeping
**Depends on:** Phase 13 (dashboard state DB), Phase 12 (run history), Phase 27 (per-operator identity for per-user last-seen)
**Requirements:** DELTA-01
**Success Criteria:**
1. The dashboard records a per-operator last-visit timestamp and offers a delta view listing new sessions, session status changes, new approvals, and new failures since that moment.
2. Operator can mark the delta as seen, which resets the baseline; the view then shows an explicit "nothing new" state rather than an empty table.
3. A badge surfaces the delta count so the operator knows something is new before opening the view.
4. Last-visit tracking is per operator identity (from Phase 27 role mapping), not a single global timestamp shared by everyone.
**Plans:** TBD
**UI hint**: yes

### v2.0 Requirement Coverage

- v2.0 requirements: 43 total
- Mapped: 43 / 43 ✓
- Unmapped: 0
- Duplicated across phases: 0

| Requirement | Phase | Tier |
|-------------|-------|------|
| KPI-01 | Phase 11 | 1 |
| KPI-02 | Phase 11 | 1 |
| RUNS-01 | Phase 12 | 1 |
| RUNS-02 | Phase 12 | 1 |
| TRIAGE-01 | Phase 13 | 1 |
| TRIAGE-02 | Phase 13 | 1 |
| TRIAGE-03 | Phase 13 | 1 |
| ALERT-01 | Phase 14 | 1 |
| ALERT-02 | Phase 14 | 1 |
| ALERT-03 | Phase 14 | 1 |
| ALERT-04 | Phase 14 | 1 |
| COST-01 | Phase 15 | 2 |
| COST-02 | Phase 15 | 2 |
| COST-03 | Phase 15 | 2 |
| CTRL-01 | Phase 16 | 2 |
| CTRL-02 | Phase 16 | 2 |
| SCHED-01 | Phase 17 | 2 |
| SCHED-02 | Phase 17 | 2 |
| SCHED-03 | Phase 17 | 2 |
| STEER-01 | Phase 18 | 2 |
| FAIL-01 | Phase 19 | 2 |
| FAIL-02 | Phase 19 | 2 |
| FAIL-03 | Phase 19 | 2 |
| TRACE-01 | Phase 20 | 2 |
| HOST-01 | Phase 21 | 3 |
| HOST-02 | Phase 21 | 3 |
| ANNOT-01 | Phase 22 | 3 |
| ANNOT-02 | Phase 22 | 3 |
| ERR-01 | Phase 23 | 3 |
| ERR-02 | Phase 23 | 3 |
| INV-01 | Phase 24 | 3 |
| INV-02 | Phase 24 | 3 |
| CONN-01 | Phase 25 | 3 |
| CONN-02 | Phase 25 | 3 |
| INST-01 | Phase 26 | 3 |
| INST-02 | Phase 26 | 3 |
| INST-03 | Phase 26 | 3 |
| ROLE-01 | Phase 27 | 4 |
| ROLE-02 | Phase 27 | 4 |
| SEARCH-01 | Phase 28 | 4 |
| RET-01 | Phase 29 | 4 |
| RET-02 | Phase 29 | 4 |
| DELTA-01 | Phase 30 | 4 |

### v2.0 Phase Dependencies

```
Phase 9 (Mobile Polish — complete)
        |
        v
TIER 1 ─────────────────────────────────────────────
Phase 11 (KPI Banner)  ── establishes run-aggregation module
        |
        v
Phase 12 (Run History) ── establishes run status classification
        |
        v
Phase 13 (Triage Inbox) ── establishes dashboard-owned WRITABLE DB
        |
        v
Phase 14 (Alerts/Monitors)
        |
TIER 2 ─────────────────────────────────────────────
        +--> Phase 16 (Emergency Stop) ──┐
        |         ^                      |
        |         |                      v
        +--> Phase 15 (Cost) <───────────┘  [Langfuse-gated]
        |
        +--> Phase 17 (Run Now + Task History)
        |
        +--> Phase 18 (Steer)          [needs Phase 16 stop-state]
        |
        +--> Phase 19 (Failure Triage) ── establishes signature normalization
        |
        +--> Phase 20 (Session Trace)  [feasibility-gated + Langfuse-gated]
        |
TIER 3 ─────────────────────────────────────────────
        +--> Phase 21 (Host Health Strip)
        |
        +--> Phase 22 (Annotations)    [needs Phase 13 state DB]
        |
        +--> Phase 23 (Error Digest)   [needs Phase 19 signatures]
        |
        +--> Phase 24 (Skills/MCP Inventory)
        |         |
        |         v
        +--> Phase 25 (Connections Health)
        |
        +--> Phase 26 (Instruction History) ── unblocks FAIL-03 replay
        |
TIER 4 ─────────────────────────────────────────────
        v
Phase 27 (Roles + Audit Log)  <── wires audit into ALL mutating actions
        |                          from Phases 16,17,18,19,22,24,25,26
        +--> Phase 28 (Global FTS5 Search)
        |         |
        |         v
        +--> Phase 29 (Retention & Redaction)
        |
        v
Phase 30 (Delta View)  [needs per-operator identity from Phase 27]
```

### v2.0 Open Risks

| Risk | Affects | Resolution path |
|------|---------|-----------------|
| No live cost/token source (Phase 10A parked, Langfuse not yet live) | 11, 12, 14, 15 | Spend surfaces degrade to explicit "Unavailable"; revisit when Langfuse lands |
| Langfuse may supersede in-dashboard cost and trace features | 15, 20 | Confirm source of record in each phase plan **before** building UI; reduce to link-out if so |
| Session transcript access from the dashboard container is unverified | 20 | Feasibility gate in the Phase 20 plan — verify mount/format/permissions first, or defer |
| NanoClaw DB is read-only; all new state needs a new writable DB | 13, 14, 17, 22, 27, 28, 29, 30 | Phase 13 establishes the dashboard-owned DB as milestone infrastructure |
| Retention pruning is irreversible and can corrupt derived state | 29 | Dry-run preview + explicit confirmation + index/rollup consistency criterion |

---
*v2.0 roadmap appended: 2026-08-24*
