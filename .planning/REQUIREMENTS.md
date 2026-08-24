# Requirements: NanoClaw Dashboard

**Defined:** 2026-05-28
**Core Value:** An operator can see what every agent group is doing right now and take action without touching the command line.

## v1 Requirements

### Infrastructure

- [ ] **INFRA-01**: Dashboard runs as a Docker container with Traefik routing labels on the NanoClaw host
- [ ] **INFRA-02**: Dashboard is protected by Authelia single-factor auth at nanoclaw.marinemr.xyz
- [ ] **INFRA-03**: Backend serves Svelte SPA (static files + API routes from one container on port 3001)
- [ ] **INFRA-04**: Backend reads NanoClaw SQLite DBs via read-only volume mount
- [ ] **INFRA-05**: Backend executes ncl CLI commands for write operations via Unix socket mount
- [ ] **INFRA-06**: Dashboard auto-refreshes active state (sessions, containers) every 5 seconds without full page reload

### Groups

- [ ] **GRP-01**: Operator can view a list of all agent groups showing name, container status, last active time
- [ ] **GRP-02**: Operator can open a group detail page showing its configuration (model, folder, provider)
- [ ] **GRP-03**: Operator can view all members of a group and their roles
- [ ] **GRP-04**: Operator can add a member to a group by user ID
- [ ] **GRP-05**: Operator can remove a member from a group
- [ ] **GRP-06**: Operator can view a group's destinations (where it can send messages)
- [ ] **GRP-07**: Operator can restart an agent group with an optional --rebuild flag and message
- [ ] **GRP-08**: Operator can see the group's active session list from the detail page

### Sessions

- [ ] **SESS-01**: Operator can view a list of all active and recent sessions across all groups
- [ ] **SESS-02**: Operator can filter the sessions list by group, container status, and time range
- [ ] **SESS-03**: Operator can open a session detail page showing its status, container state, and current tool being executed
- [ ] **SESS-04**: Operator can navigate from a session to its parent group detail

### Messages

- [ ] **MSG-01**: Operator can view a chronological message log for a session (inbound + outbound messages)
- [ ] **MSG-02**: Operator can search messages by text content within a session
- [ ] **MSG-03**: Operator can filter messages by type (user message, tool call, tool result, assistant message)
- [ ] **MSG-04**: Operator can filter messages by time range
- [ ] **MSG-05**: Message log displays sender, channel type, timestamp, and truncated content

### Approvals

- [ ] **APPR-01**: Operator can view a queue of all pending ncl write commands awaiting approval
- [ ] **APPR-02**: Approval queue shows command details, requesting group, and timestamp
- [ ] **APPR-03**: Operator can approve a pending command (executes via ncl)
- [ ] **APPR-04**: Operator can reject a pending command (cancels via ncl)

### Health

- [ ] **HLTH-01**: Overview page shows system health summary: active session count, container statuses, recent error count
- [ ] **HLTH-02**: Each agent group in the groups list shows a live container status badge (running, stopped, error)

## v1.1 Requirements — Mobile UX

### Mobile Layout

- [ ] **MOB-01**: Operator can collapse the navigation sidebar on mobile (≤768px) via a hamburger button visible in the top bar
- [ ] **MOB-02**: When the mobile nav drawer is open, tapping the backdrop or a nav link closes it
- [ ] **MOB-03**: All existing pages render without horizontal overflow on a 375px-wide viewport
- [ ] **MOB-04**: Data tables (groups, sessions, approvals, dropped, tasks) scroll horizontally within their containers on small screens
- [ ] **MOB-05**: Filter controls on sessions, messages, approvals, and dropped pages wrap vertically on mobile instead of overflowing
- [ ] **MOB-06**: All interactive elements (nav links, buttons, table row actions) have a minimum 44×44px touch target on mobile

## v1.2 Requirements — LLM Call Observability

### NanoClaw Core (agent-runner)

- [ ] **LLM-01**: NanoClaw agent-runner creates an `llm_calls` table in `outbound.db` on startup — columns: `id`, `turn_seq`, `timestamp`, `model`, `input_tokens`, `output_tokens`, `thinking_text`, `duration_ms`
- [ ] **LLM-02**: After each agent turn completes, the agent-runner writes one row to `llm_calls` capturing the full thinking block text (if present), token usage from the result event, and wall-clock duration for that turn

### Dashboard (read-only)

- [ ] **LLM-03**: Operator can open a per-session LLM calls page showing a table of turns with model, token counts (in/out), duration, and a truncated thinking preview — accessible via a link from the session detail page
- [ ] **LLM-04**: Operator can expand any LLM call row inline to read the full thinking block text

## v2 Requirements

### Enhanced Monitoring
- **HLTH-03**: System activity timeline — 24h graph of session activity and error counts
- **MSG-06**: Cross-session message search (search across all groups simultaneously)
- **SESS-05**: Per-session conversation thread view (nested user → agent → tool → response)

### Enhanced Admin
- **GRP-09**: Config diff view — compare current group config to a baseline or previous version
- **GRP-10**: Pending questions view — see interactive prompts awaiting user response, respond from dashboard
- **APPR-05**: Sender approval queue — approve/reject unknown senders trying to contact agents

### Quality of Life
- **INFRA-07**: Real-time WebSocket push for container status (replace polling)
- **INFRA-08**: Dashboard sends browser notifications for new approvals and agent errors

---

## v2.0 Requirements — Ops Intelligence

### Triage & Inbox (Tier 1)

- [ ] **TRIAGE-01**: Operator can view a unified "needs attention" inbox combining open approvals, dropped messages, overdue/failed scheduled tasks, and stalled sessions in one view
- [ ] **TRIAGE-02**: Operator can resolve an item in the triage inbox inline (approve/reject an approval, retry/dismiss a task, acknowledge a stalled session)
- [ ] **TRIAGE-03**: Operator can snooze a triage item for a configurable duration; snoozed items reappear when the snooze expires

### Run History (Tier 1)

- [ ] **RUNS-01**: Operator can view a cross-group table of every session and task run showing status (running/success/failed/waiting/dropped), group, trigger source (message/scheduled/manual), duration, turn count, and estimated cost
- [ ] **RUNS-02**: Operator can filter the run history by status, group, trigger source, and time range

### KPI Banner (Tier 1)

- [ ] **KPI-01**: Overview home page shows a KPI banner with total sessions, failure count, failure rate, average session duration, and total spend — each tile shows the 7-day rolling value
- [ ] **KPI-02**: Each KPI tile shows a delta indicator vs the prior 7-day period (trend up/down with color coding)

### Alerts & Monitors (Tier 1)

- [ ] **ALERT-01**: System sends a NanoClaw message when any group exceeds its configured monthly budget
- [ ] **ALERT-02**: System sends a NanoClaw message when an approval request has been pending longer than a configurable threshold (default: 30 min)
- [ ] **ALERT-03**: System sends a NanoClaw message when a group has had no session activity in N hours where N is configurable per group ("silence detector" — dead companion otherwise invisible)
- [ ] **ALERT-04**: Operator can configure alert thresholds (budget limit, approval timeout, silence window) per group via the dashboard UI

### Cost & Token Visibility (Tier 2 — scope pending Langfuse)

- [ ] **COST-01**: Operator can view spend broken down by companion group, model, and session type for today, month-to-date, and projected monthly total
- [ ] **COST-02**: Operator can view a spend trend chart over the current month
- [ ] **COST-03**: Operator can configure a budget guardrail per group; when exceeded, the dashboard optionally auto-pauses that group

### Session Trace View (Tier 2 — feasibility-gated, scope pending Langfuse)

- [ ] **TRACE-01**: Operator can view a per-session tool-call timeline showing what tools ran, their arguments, and duration (requires session transcript access from container)

### Emergency Control (Tier 2)

- [ ] **CTRL-01**: Operator can trigger a global emergency stop that halts all running agent containers and quarantines their queued inbound messages without dropping them
- [ ] **CTRL-02**: Operator can trigger an emergency stop scoped to one group (halt container, quarantine inbound queue for that group only)

### Steer from Dashboard (Tier 2)

- [ ] **STEER-01**: Operator can send a message or inject a prompt into a live session from the dashboard UI (writes to that session's inbound.db)

### Scheduled Task Control (Tier 2)

- [ ] **SCHED-01**: Operator can manually trigger a scheduled task to run immediately from the dashboard
- [ ] **SCHED-02**: Operator can view per-run history for each scheduled task: timestamp, duration, status, and delivery outcome
- [ ] **SCHED-03**: Dashboard shows a "flapping" badge on scheduled tasks that have alternated between failed and success more than N times recently

### Failure Triage (Tier 2)

- [ ] **FAIL-01**: Dashboard groups failed runs by normalized error signature (error message / failing tool name) with occurrence count and last-seen timestamp
- [ ] **FAIL-02**: Operator can drill into a failed run to view the failing turn in full context
- [ ] **FAIL-03**: Operator can replay a failed action — re-run it with the current instructions or with instructions as they were at the time of the failure

### Instructions Version History (Tier 3)

- [ ] **INST-01**: Operator can view the version history of CLAUDE.md, fragment files, and memory files for each group, with a diff view between versions
- [ ] **INST-02**: Operator can roll back a group's instructions to a previous version
- [ ] **INST-03**: Each run in the run history links to the instruction version that was live when it ran

### Skills & MCP Inventory (Tier 3)

- [ ] **INV-01**: Operator can view an inventory of skills and MCP servers installed for each group, including last-used timestamp
- [ ] **INV-02**: Operator can enable or disable a skill or MCP server for a group from the dashboard

### Connections Health (Tier 3)

- [ ] **CONN-01**: Operator can view an inventory of stored credentials and channel bridges per group — credential values are never shown in plaintext; shows last-used timestamp
- [ ] **CONN-02**: Operator can trigger a live "test connection" check for any credential or channel bridge and see a pass/fail result

### Annotations (Tier 3)

- [ ] **ANNOT-01**: Operator can bookmark, tag, add a thumbs-up/down rating, or write a note on any session or message
- [ ] **ANNOT-02**: Operator can filter to a "flagged" view showing only annotated sessions and messages

### Host & Container Health (Tier 3)

- [ ] **HOST-01**: Dashboard shows a host health strip with CPU, RAM, and disk usage alongside individual container states, auto-refreshing on the standard poll interval
- [ ] **HOST-02**: Host health strip shows warn/critical color indicators when configurable thresholds are breached

### Error Digest (Tier 3)

- [ ] **ERR-01**: Dashboard aggregates error log lines from all sessions into signature groups with occurrence count and last-seen timestamp
- [ ] **ERR-02**: Dashboard shows a context-window and compaction pressure indicator per active session

### Roles & Audit Log (Tier 4)

- [ ] **ROLE-01**: Dashboard supports owner/admin/member role mapping for operator accounts (Authelia users)
- [ ] **ROLE-02**: Every mutating action in the dashboard (restart, approve, reject, steer, rollback, emergency stop) is logged in an audit log with who performed it, what was done, and when

### Retention & Redaction (Tier 4)

- [ ] **RET-01**: Operator can configure a retention window; messages and sessions older than the window are pruned on a schedule
- [ ] **RET-02**: Operator can configure metadata-only retention — keep timestamps, statuses, and cost data while dropping message payload bodies

### Global Search (Tier 4)

- [ ] **SEARCH-01**: Operator can perform full-text search (SQLite FTS5) across all messages, sessions, and tasks from a global search bar in the dashboard header

### Delta View (Tier 4)

- [ ] **DELTA-01**: Dashboard shows a "what changed since I last looked" view highlighting new sessions, status changes, new approvals, and new failures since the operator's last visit

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-instance support | Michael runs one NanoClaw instance; multi-server view adds routing complexity for zero current value |
| User management / auth UI | Authelia handles all authentication; duplicating it adds security surface area |
| Agent code editor (CLAUDE.md editing) | Security risk — AI behavior editing should go through git, not a web form |
| Light/dark theme toggle | Dark is the stated preference; a toggle doubles CSS work with no return |
| ~~Mobile-first design~~ | Promoted to v1.1 milestone |
| Notification system (email/Slack alerts) | NanoClaw's agents already handle notifications; dashboard is active monitoring only |
| Plugin/extension system | Premature abstraction — build core first |
| Backup / restore functionality | Out of scope; handled at infrastructure level |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| INFRA-05 | Phase 1 | Pending |
| INFRA-06 | Phase 1 | Pending |
| GRP-01 | Phase 2 | Pending |
| GRP-02 | Phase 3 | Pending |
| GRP-03 | Phase 3 | Pending |
| GRP-04 | Phase 5 | Pending |
| GRP-05 | Phase 5 | Pending |
| GRP-06 | Phase 3 | Pending |
| GRP-07 | Phase 5 | Pending |
| GRP-08 | Phase 3 | Pending |
| SESS-01 | Phase 3 | Pending |
| SESS-02 | Phase 3 | Pending |
| SESS-03 | Phase 3 | Pending |
| SESS-04 | Phase 3 | Pending |
| MSG-01 | Phase 4 | Pending |
| MSG-02 | Phase 4 | Pending |
| MSG-03 | Phase 4 | Pending |
| MSG-04 | Phase 4 | Pending |
| MSG-05 | Phase 4 | Pending |
| APPR-01 | Phase 6 | Pending |
| APPR-02 | Phase 6 | Pending |
| APPR-03 | Phase 6 | Pending |
| APPR-04 | Phase 6 | Pending |
| HLTH-01 | Phase 2 | Pending |
| HLTH-02 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 29 total — all mapped ✓
- v1.1 requirements: 6 total — to be mapped by roadmapper

| Requirement | Phase | Status |
|-------------|-------|--------|
| MOB-01 | Phase 8 | Pending |
| MOB-02 | Phase 8 | Pending |
| MOB-03 | Phase 8 | Pending |
| MOB-04 | Phase 9 | Pending |
| MOB-05 | Phase 9 | Pending |
| MOB-06 | Phase 9 | Pending |

| Requirement | Phase | Status |
|-------------|-------|--------|
| LLM-01 | Phase 10A | Pending |
| LLM-02 | Phase 10A | Pending |
| LLM-03 | Phase 10B | Pending |
| LLM-04 | Phase 10B | Pending |

| Requirement | Phase | Status |
|-------------|-------|--------|
| TRIAGE-01 | Phase 13 | Not started |
| TRIAGE-02 | Phase 13 | Not started |
| TRIAGE-03 | Phase 13 | Not started |
| RUNS-01 | Phase 12 | Not started |
| RUNS-02 | Phase 12 | Not started |
| KPI-01 | Phase 11 | Not started |
| KPI-02 | Phase 11 | Not started |
| ALERT-01 | Phase 14 | Not started |
| ALERT-02 | Phase 14 | Not started |
| ALERT-03 | Phase 14 | Not started |
| ALERT-04 | Phase 14 | Not started |
| COST-01 | Phase 15 | Not started |
| COST-02 | Phase 15 | Not started |
| COST-03 | Phase 15 | Not started |
| TRACE-01 | Phase 20 | Not started |
| CTRL-01 | Phase 16 | Not started |
| CTRL-02 | Phase 16 | Not started |
| STEER-01 | Phase 18 | Not started |
| SCHED-01 | Phase 17 | Not started |
| SCHED-02 | Phase 17 | Not started |
| SCHED-03 | Phase 17 | Not started |
| FAIL-01 | Phase 19 | Not started |
| FAIL-02 | Phase 19 | Not started |
| FAIL-03 | Phase 19 | Not started |
| INST-01 | Phase 26 | Not started |
| INST-02 | Phase 26 | Not started |
| INST-03 | Phase 26 | Not started |
| INV-01 | Phase 24 | Not started |
| INV-02 | Phase 24 | Not started |
| CONN-01 | Phase 25 | Not started |
| CONN-02 | Phase 25 | Not started |
| ANNOT-01 | Phase 22 | Not started |
| ANNOT-02 | Phase 22 | Not started |
| HOST-01 | Phase 21 | Not started |
| HOST-02 | Phase 21 | Not started |
| ERR-01 | Phase 23 | Not started |
| ERR-02 | Phase 23 | Not started |
| ROLE-01 | Phase 27 | Not started |
| ROLE-02 | Phase 27 | Not started |
| RET-01 | Phase 29 | Not started |
| RET-02 | Phase 29 | Not started |
| SEARCH-01 | Phase 28 | Not started |
| DELTA-01 | Phase 30 | Not started |

---
*Requirements defined: 2026-05-28*
*Last updated: 2026-08-24 — v2.0 Ops Intelligence requirements added (43 requirements, 20 features, 4 tiers)*
