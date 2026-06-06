# Project State

**Project:** NanoClaw Dashboard
**Updated:** 2026-06-06

## Current Position

Phase: 10A — NanoClaw Core: LLM Call Capture
Plan: —
Status: Planning
Last activity: 2026-06-06 — Milestone v1.2 roadmap created; Phase 10A ready for execution

## Milestone

v1.2 — LLM Call Observability (per-session LLM logs: thinking blocks, token counts, duration)

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
| 10A | NanoClaw Core — LLM Call Capture | Planning | 2 |
| 10B | Dashboard — LLM Call Viewer | Not started | 2 |

## Project Reference

See: .planning/PROJECT.md
**Core value:** An operator can see what every agent group is doing right now and take action without touching the command line.
**Current focus:** v1.1 — Mobile UX

## Confirmed Infrastructure (SSH-verified 2026-05-28)

- **ncl socket:** `/home/michael/workspace/nanoclaw-v2/data/ncl.sock`
- **Central DB:** `/home/michael/workspace/nanoclaw-v2/data/v2.db`
- **Session DBs:** `data/v2-sessions/<agent-group-id>/<session-id>/{inbound,outbound}.db`
- **Docker network:** `saltbox`
- **GitHub repo:** `michaelcodeshenanigans/nanoclaw-dashboard`
