# Research Summary

**Project:** NanoClaw Dashboard
**Synthesized:** 2026-05-28

## Key Findings

### Stack

**Recommended:** Hono (backend) + Svelte 5 (frontend) + better-sqlite3 + pnpm workspaces

- **Hono** is the clear choice for a thin API proxy layer — ultralight, TypeScript-native, runs on Node.js, serves static files. No alternatives come close for this use case.
- **Svelte 5** with Vite builds to a minimal SPA served by Hono. SvelteKit would add SSR complexity we don't need.
- **better-sqlite3** (synchronous) is correct for read-heavy dashboard queries. Don't use async wrappers; don't use ORMs.
- **shadcn-svelte** + Tailwind 4 gives the dark-theme component library without building from scratch.
- **pnpm workspaces** for monorepo: `packages/backend` + `packages/frontend` + `packages/shared` (types).

### Architecture

**Critical integration decisions:**

1. **Volume mount for SQLite:** Mount NanoClaw's data dir read-only into dashboard container. Path pattern: `{data_dir}/groups/{folder}/sessions/{id}/{inbound,outbound}.db`. Must open with `readonly: true` — never write to NanoClaw's DBs directly.

2. **ncl for writes:** Mount the ncl Unix socket into the dashboard container. Use `execFile('ncl', [...args])` — never string interpolation (injection risk). The socket path must be confirmed from the NanoClaw installation config.

3. **Single container:** Hono serves both the API (`/api/*`) and the Svelte SPA (static files). One Docker container, one Traefik router with `authelia@docker` middleware.

4. **Polling:** `setInterval` at 5s for container status + active sessions. No WebSockets in v1.

### Features — Build in v1

| Category | Must-Build |
|----------|-----------|
| Groups | List view, detail view with config/members/sessions |
| Sessions | List (filterable), per-session detail with container state |
| Messages | Per-session log viewer with search/filter |
| Approvals | Pending commands queue with approve/reject |
| Admin | Restart controls, member add/remove |
| Health | System health summary on overview page |
| Infra | Docker + Traefik + Authelia, auto-refresh polling |

### Features — Defer to v2

- WebSocket push, mobile optimization, multi-instance, config diff view, notification alerts, agent code editor

### Watch Out For

1. **SQLite concurrency:** Open DBs with `readonly: true` + `busy_timeout = 1000`. LRU connection cache for per-session DBs (max 50 open connections).
2. **ncl socket permissions:** Verify container user can access the Unix socket. Add `/api/health` check that validates ncl connectivity.
3. **Traefik + Authelia:** ONE router for the entire domain — both `/` and `/api/*` protected. Test API routes in incognito to verify auth isn't bypassed.
4. **better-sqlite3 Docker build:** Native module — must be built inside the Docker image, not copied from host. Use multi-stage build.
5. **Command injection via ncl:** Use `execFile` with argument array, never string interpolation. Validate all inputs against DB.
6. **Svelte polling cleanup:** Clear `setInterval` in `onDestroy`. Cap message arrays in memory.

## Decision Confidence Summary

| Decision | Confidence | Key Risk |
|----------|-----------|----------|
| Hono backend | HIGH | None — clear best fit |
| Svelte 5 + Vite | HIGH | Svelte 5 runes have some learning curve but docs are excellent |
| better-sqlite3 direct reads | HIGH | Must confirm NanoClaw's DB paths on host |
| ncl socket mounting | MEDIUM | Socket path TBD — needs confirmation from NanoClaw install |
| Polling @ 5s | HIGH | Sufficient for ops panel; upgrade if operator requests faster |
| Single Docker container | HIGH | Simple, easy to maintain |
| Traefik + Authelia labels | HIGH | Pattern well-established on Michael's Saltbox setup |

---
*Synthesis of STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md*
*NanoClaw Dashboard — 2026-05-28*
