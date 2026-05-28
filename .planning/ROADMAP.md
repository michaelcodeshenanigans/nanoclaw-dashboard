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
