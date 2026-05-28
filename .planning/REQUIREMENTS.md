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

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-instance support | Michael runs one NanoClaw instance; multi-server view adds routing complexity for zero current value |
| User management / auth UI | Authelia handles all authentication; duplicating it adds security surface area |
| Agent code editor (CLAUDE.md editing) | Security risk — AI behavior editing should go through git, not a web form |
| Light/dark theme toggle | Dark is the stated preference; a toggle doubles CSS work with no return |
| Mobile-first design | Desktop ops panel; mobile-responsive is a stretch goal, not a v1 requirement |
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
- v1 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-28*
*Last updated: 2026-05-28 after initial definition*
