# Project State

**Project:** NanoClaw Dashboard
**Updated:** 2026-08-25

## Current Position

Phase: 29 — Retention & Redaction Settings
Plan: —
Status: Complete
Last activity: 2026-08-25 — Phase 29 complete (dashboard-data retention: audit_log/alerts/triage/search_index/annotations; dry-run + confirm + scheduled auto-prune; NanoClaw session data gap noted in UI)

## Milestone

v2.0 — Ops Intelligence (20 features, 4 tiers, phases 11–30)

## Phase Index

| # | Name | Status | Requirements |
|---|------|--------|--------------|
| 1 | Foundation & Deploy | Complete | 6 |
| 2 | Groups Overview & System Health | Complete | 3 |
| 3 | Group Detail, Members, Destinations & Sessions Index | Complete | 8 |
| 4 | Per-Session Message Log Viewer | Complete | 5 |
| 5 | Group Admin — Restart & Member Management | Complete | 3 |
| 6 | Pending Command Approvals Queue | Complete | 4 |
| 7 | Dropped Messages + Scheduled Tasks (informal, outside GSD) | Complete | — |
| 8 | Responsive Nav & Layout Foundation | Complete | 3 |
| 9 | Mobile Polish — Tables, Filters, Touch Targets | Complete | 3 |
| 10A | NanoClaw Core — LLM Call Capture | Parked (Langfuse) | 2 |
| 10B | Dashboard — LLM Call Viewer | Parked (Langfuse) | 2 |
| 11 | Overview KPI Banner | Complete | 2 |
| 12 | Unified Run History | Complete | 2 |
| 13 | Triage Inbox | Complete | 3 |
| 14 | Chat-pushed Alerts/Monitors | Complete | 4 |
| 15 | Cost & Token Command Center | Parked (Langfuse) | 3 |
| 16 | Session Trace View | Parked (Langfuse) | 1 |
| 17 | Emergency Stop/Pause | Complete | 2 |
| 18 | Run Now + Task Run History | Complete | 3 |
| 19 | Steer from Dashboard | Stub (pending core) | 1 |
| 20 | Failure Triage | Partial (drill-down parked Langfuse) | 3 |
| 21 | Host & Container Health Strip | Complete | 2 |
| 22 | Annotations | Complete | 2 |
| 23 | Error Digest | Complete | 2 |
| 24 | Skills & MCP Server Inventory | Complete | 2 |
| 25 | Connections Health | Complete | 2 |
| 26 | Instructions/Memory Version History | Parked (no version data in core) | 3 |
| 27 | Roles + Dashboard Audit Log | Complete | 2 |
| 28 | Global FTS5 Search | Complete | 1 |
| 29 | Retention & Redaction Settings | Complete (dashboard-data scope; NanoClaw session data pending ncl verb) | 2 |
| 30 | Delta View | Not started | 1 |

## Project Reference

See: .planning/PROJECT.md
**Core value:** An operator can see what every agent group is doing right now and take action without touching the command line.
**Current focus:** v2.0 — Ops Intelligence

## Confirmed Infrastructure (SSH-verified 2026-05-28)

- **ncl socket:** `/home/michael/workspace/nanoclaw-v2/data/ncl.sock`
- **Central DB:** `/home/michael/workspace/nanoclaw-v2/data/v2.db`
- **Session DBs:** `data/v2-sessions/<agent-group-id>/<session-id>/{inbound,outbound}.db`
- **Docker network:** `saltbox`
- **GitHub repo:** `michaelcodeshenanigans/nanoclaw-dashboard`

## Accumulated Context

### Key Decisions (carried from v1.x)
- SvelteKit + Node adapter (not Hono SPA) — collapses frontend/backend into one build
- Direct SQLite reads for read ops, ncl exec for write ops
- Polling (5s) not WebSocket — sufficient for ops panel
- Authelia gates the whole dashboard — no additional dashboard auth needed for control-plane features

### Notes
- v1.2 LLM observability parked — Langfuse will handle tracing; revisit COST (item 5) and TRACE (item 6) once Langfuse is live per Yoni's instruction
- Tier 1 is highest priority; tiers are sequential (each builds on previous data/queries)
- Phase 21: /proc/stat + /proc/meminfo + df -h / reflect host totals (no lxcfs masking); no docker.sock — host-aggregate only, not per-container
- Phase 23: No error-message/log-line data anywhere in system; only error signal is container_state.status='error' (boolean); normalization/signature grouping is Langfuse-gated; ROADMAP.md note: Phase 23's Phase 19 dependency assumed error-message data that doesn't exist in core
- Phase 24: container_configs table in v2.db has skills TEXT and mcp_servers TEXT columns (one row per agent_group_id); read directly; mutation: ncl groups config add-mcp-server/remove-mcp-server + restart; no skills verb (read-only for skills)
- Phase 25: No credentials table (dropped in migration 009); channel tokens are host env vars; no test/ping/status verb on any ncl resource; infer connection from messaging_groups + message recency; explicitly note in UI that it's not a live ping
- Phase 26: Parked — no .git in group folders, no instruction/memory version table, no rollback verb, GROUPS_DIR not mounted anyway
