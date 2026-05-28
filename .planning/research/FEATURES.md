# Features Research

**Domain:** Admin ops dashboard for a self-hosted AI agent orchestration system
**Researched:** 2026-05-28
**Confidence:** HIGH

## Table Stakes (Must-Have)

These are the features that make the dashboard actually useful. Without these, the operator would prefer the CLI.

### Agent Group Overview
- List all agent groups with: name, status (container running/stopped), last active timestamp
- Visual indicator when a container is actively processing a tool call
- Quick-launch restart from the list view
- **Complexity:** Low — one query to agent_groups + sessions

### Session Monitor
- List active and recent sessions across all groups
- Show: group name, messaging group, status, container_status, last_active
- Filter by: group, status (active/idle/stopped), time range
- **Complexity:** Medium — join of sessions + agent_groups + messaging_groups

### Message Log Viewer
- Chronological view of inbound + outbound messages per session
- Search by: text content, sender, channel type, time range
- Show message content (with truncation for long tool outputs)
- Indicate message type: user message / tool call / tool result / assistant message
- **Complexity:** High — reads per-session inbound.db + outbound.db files; need DB discovery

### Approvals Queue
- List all pending ncl write commands awaiting approval
- Show: command, requester, timestamp, what it would do
- Approve / Reject buttons that execute via ncl socket
- **Complexity:** Medium — needs ncl exec integration for approve/reject

### Group Detail View
- Config: model, container image, CLAUDE.md content
- Members: list with roles; add/remove member controls
- Destinations: where this group can send messages
- Session list for this group
- **Complexity:** Medium — multiple ncl queries or DB reads

### Container Status Panel
- Per-group container status badge
- Current tool being executed (from container_state table in outbound.db)
- Error rate indicator (failed messages_in)
- **Complexity:** Medium — reads per-session container_state

### Restart Controls
- Restart a group with optional flags: --rebuild, --message
- Confirmation dialog before executing
- Show result of restart operation
- **Complexity:** Medium — ncl exec + response handling

## Differentiators (Worth Adding If Time Allows)

These add real value but aren't blockers for v1.

### Message Thread View
- Group messages by conversation thread within a session
- Nested display: user → agent → tool calls → response
- **Complexity:** High

### Config Diff View
- Compare current group config to a baseline or previous version
- Useful when debugging unexpected behavior
- **Complexity:** Medium

### System Health Timeline
- 24h graph of session activity, error counts
- Simple sparklines — not a full Grafana replacement
- **Complexity:** Medium

### Pending Questions View
- Show any `pending_questions` (interactive prompts awaiting user response)
- Allow responding from the dashboard
- **Complexity:** Medium

### Activity Feed
- Reverse-chronological stream of recent events across all groups
- New sessions, approvals, restarts, errors
- **Complexity:** Medium

## Anti-Features (Deliberately Exclude from v1)

These look tempting but add complexity without sufficient v1 value.

### Real-time WebSocket Push
- **Why exclude:** Polling every 5s is invisible to the operator at this scale. WebSockets require server state management, reconnection logic, and add infra complexity for zero perceptible benefit at 5-20 agent groups.
- **Add in v2:** Only if operator explicitly asks for sub-second updates.

### User Management / Auth UI
- **Why exclude:** Authelia handles all authentication. Building a user management UI within the dashboard duplicates Authelia's role and adds security surface area.

### Agent Code Editor
- **Why exclude:** CLAUDE.md editing should go through git, not a web editor. A web editor for code that drives AI behavior is a significant security surface.

### Multi-Instance Support
- **Why exclude:** Michael runs one NanoClaw instance. Supporting multiple adds routing, credential management, and UI complexity for zero immediate value.

### Notification System (Email/Slack Alerts)
- **Why exclude:** NanoClaw's own agents handle notifications. The dashboard is for active monitoring, not passive alerting.

### Plugin/Extension System
- **Why exclude:** Premature abstraction. Build the core dashboard first; extension points can emerge from actual usage.

### Dark/Light Theme Toggle
- **Why exclude:** Dark theme is the stated preference. A toggle doubles CSS work. Fix the theme, ship faster.

## Observations from Similar Dashboards

**Portainer (Docker management):** Gets right: container status clarity, log tailing, simple restart controls. Gets wrong: too many tabs/views, overwhelming for single-operator use.

**ArgoCD:** Gets right: git sync status, rollback to previous state, clear diff view. Gets wrong: complex RBAC that's overkill for solo operators.

**Grafana:** Gets right: flexible data visualization, time-series queries. Gets wrong: requires separate datasource config, heavy for simple ops panels.

**Lesson:** Single-operator tools should optimize for "I want to know what's happening and fix it quickly," not "I want to configure every possible view." Keep it to 5-7 screens, not 20+.

---
*Features research for: NanoClaw admin dashboard*
*Researched: 2026-05-28*
