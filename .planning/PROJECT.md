# NanoClaw Dashboard

## What This Is

A dark-theme web ops panel for a self-hosted NanoClaw installation, giving the operator real-time visibility into agent groups, active sessions, message logs, and system health — with admin controls to restart agents, approve pending commands, and manage members. Deployed at `nanoclaw.marinemr.xyz` behind Authelia single-factor auth, running as a Docker container on the same host as NanoClaw.

## Core Value

An operator can see what every agent group is doing right now and take action (restart, approve, manage members) without touching the command line.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Operator can view all agent groups with status, model, and last-active time
- [ ] Operator can drill into a group to see its config, members, destinations, and session list
- [ ] Operator can view all active and recent sessions (filterable by group, status, time)
- [ ] Operator can browse and search message logs (inbound + outbound) by group/session/text/time
- [ ] Operator can see pending ncl write commands and approve or reject them inline
- [ ] Operator can restart an agent group (with optional rebuild flag and message)
- [ ] Operator can add and remove group members
- [ ] Operator can view group config details and compare to defaults
- [ ] Dashboard shows system health summary (container statuses, error rates, uptime)
- [ ] Dashboard auto-refreshes active state (sessions, containers) without full page reload
- [ ] Dashboard is protected by Authelia single-factor auth at nanoclaw.marinemr.xyz
- [ ] Dashboard runs as a Docker container with Traefik routing labels on the NanoClaw host

### Out of Scope

- Multi-install support — one NanoClaw instance only; no multi-server view
- User management beyond member add/remove — no full identity admin
- Agent code editing — view-only for configs; changes go through ncl/git
- Mobile-first design — desktop ops panel, mobile-responsive is nice-to-have not required
- Real-time WebSocket push for every field — polling is fine for v1

## Context

**NanoClaw architecture (from source):**
- Message-passing pipeline: `messaging apps → host router → inbound.db → container (agent) → outbound.db → delivery → messaging apps`
- Per-session SQLite pairs: each session has its own `inbound.db` + `outbound.db`
- Central SQLite DB manages: `agent_groups`, `messaging_groups`, `messaging_group_agents`, `users`, `user_roles`, `agent_group_members`, `sessions`, `pending_questions`, `pending_sender_approvals`
- `ncl` CLI communicates via Unix socket (`socket-server.ts` / `socket-client.ts`) — no REST API for admin ops
- Webhook server (port 3000) only handles inbound channel webhooks — not an admin API
- Containers run Bun + Claude Agent SDK; credentials injected via OneCLI proxy at request time

**Key DB tables for the dashboard:**
- `agent_groups` — id, name, folder, agent_provider, created_at
- `sessions` — id, agent_group_id, messaging_group_id, thread_id, status, container_status, last_active, created_at
- `messages_in` — id, seq, kind, timestamp, status, platform_id, channel_type, content, tries
- `messages_out` — id, seq, timestamp, kind, platform_id, channel_type, content
- `container_state` — current_tool, tool_declared_timeout_ms, tool_started_at (per-session outbound.db)

**Host infrastructure:**
- Linux/Docker, Saltbox setup, Traefik reverse proxy with label-based routing
- Auth: Authelia at marinemr.xyz — add `authelia@docker` middleware label to protect route
- TLS: `cfdns` cert resolver, wildcard `*.marinemr.xyz`
- NanoClaw lives at `/home/michael/workspace/nanoclaw-v2` on the host
- GitHub repo for dashboard: `michaelcodeshenanigans/nanoclaw-dashboard`

**Upstream NanoClaw source:** `nanocoai/nanoclaw` (TypeScript, 29.5k stars)

## Constraints

- **Stack**: Node.js (Hono) backend + Svelte frontend — must stay lightweight; no heavy ORMs or frameworks
- **Data access**: Must read NanoClaw SQLite DB directly (mount volume) and exec `ncl` for write ops
- **Deployment**: Single Docker container; must include Traefik + Authelia labels in compose config
- **Auth**: Authelia handles all authentication — dashboard does not implement its own auth
- **Dark theme**: UI must use a dark color scheme (Michael's preference)
- **No SSH key in container**: Host access for deploy is out-of-band; GitHub is the artifact delivery mechanism

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Hono for backend | Ultralight, fast, TypeScript-native, perfect for a thin API proxy layer | — Pending |
| Svelte for frontend | Reactive without heavy bundle, good for ops dashboards, minimal boilerplate | — Pending |
| Direct SQLite reads (not ncl for reads) | ncl is socket-based with no batch/query API; direct DB reads are faster and simpler for list/search | — Pending |
| ncl exec for write ops | ncl is the authoritative write interface; reimplementing its logic would create drift | — Pending |
| Polling (not WebSocket) for v1 | Simpler infrastructure; 5-second polling is fine for an ops panel | — Pending |
| Single Docker container (backend serves frontend build) | Simpler compose config, one Traefik entry, easier to maintain | — Pending |

---
*Last updated: 2026-05-28 after initialization*

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
