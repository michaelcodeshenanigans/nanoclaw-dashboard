# Project State

**Project:** NanoClaw Dashboard
**Updated:** 2026-08-24

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-08-24 — Milestone v2.0 started

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
| 11 | Overview KPI Banner | Not started | 2 |
| 12 | Unified Run History | Not started | 2 |
| 13 | Triage Inbox | Not started | 3 |
| 14 | Chat-pushed Alerts/Monitors | Not started | 4 |
| 15 | Cost & Token Command Center | Not started | 3 |
| 16 | Emergency Stop/Pause | Not started | 2 |
| 17 | Run Now + Task Run History | Not started | 3 |
| 18 | Steer from Dashboard | Not started | 1 |
| 19 | Failure Triage | Not started | 3 |
| 20 | Session Trace View | Not started | 1 |
| 21 | Host & Container Health Strip | Not started | 2 |
| 22 | Annotations | Not started | 2 |
| 23 | Error Digest | Not started | 2 |
| 24 | Skills & MCP Server Inventory | Not started | 2 |
| 25 | Connections Health | Not started | 2 |
| 26 | Instructions/Memory Version History | Not started | 3 |
| 27 | Roles + Dashboard Audit Log | Not started | 2 |
| 28 | Global FTS5 Search | Not started | 1 |
| 29 | Retention & Redaction Settings | Not started | 2 |
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
