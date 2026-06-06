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
