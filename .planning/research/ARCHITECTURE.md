# Architecture Research

**Domain:** Admin ops dashboard connecting to NanoClaw via SQLite reads + ncl CLI
**Researched:** 2026-05-28
**Confidence:** HIGH

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         HOST MACHINE                            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 Docker Compose Network                    │  │
│  │                                                           │  │
│  │  ┌─────────────┐   labels      ┌──────────────────────┐  │  │
│  │  │   Traefik   │──────────────▶│  dashboard container │  │  │
│  │  │             │               │                       │  │  │
│  │  │ (ingress)   │  authelia     │  ┌─────────────────┐ │  │  │
│  │  └─────────────┘  middleware   │  │  Hono backend   │ │  │  │
│  │         ▲                      │  │  (port 3001)    │ │  │  │
│  │         │                      │  └────────┬────────┘ │  │  │
│  │  https://nanoclaw.marinemr.xyz │           │           │  │  │
│  │                                │  ┌────────▼────────┐ │  │  │
│  │  ┌─────────────┐               │  │ Svelte SPA      │ │  │  │
│  │  │   Authelia  │               │  │ (served as      │ │  │  │
│  │  │             │               │  │  static files)  │ │  │  │
│  │  └─────────────┘               │  └─────────────────┘ │  │  │
│  │                                └──────────┬────────────┘  │  │
│  │  ┌─────────────────────────┐              │               │  │
│  │  │   NanoClaw container    │              │ volume mount  │  │
│  │  │                         │◀─────────────┘ (read-only)  │  │
│  │  │  /workspace/            │                              │  │
│  │  │    nanoclaw.db          │                              │  │
│  │  │    groups/              │                              │  │
│  │  │      <group>/           │                              │  │
│  │  │        sessions/        │                              │  │
│  │  │          <session>/     │                              │  │
│  │  │            inbound.db   │                              │  │
│  │  │            outbound.db  │                              │  │
│  │  └─────────────────────────┘                              │  │
│  │                                                           │  │
│  │  ┌─────────────────────────┐                              │  │
│  │  │   ncl socket server     │◀─────────── exec ncl via    │  │
│  │  │   (Unix socket)         │             host bind mount  │  │
│  │  └─────────────────────────┘                              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Read path (SQLite direct)
```
Browser → Hono API → better-sqlite3 → NanoClaw SQLite files (volume mount, read-only)
```

### Write path (ncl CLI)
```
Browser → Hono API → exec('ncl <command>') → ncl socket → NanoClaw host process
```

### Static serving
```
Browser → Traefik → Hono backend → Svelte SPA (dist/ files served as static)
Browser → Traefik → Hono backend → /api/* routes (REST API)
```

## Key Integration Patterns

### 1. Volume Mount for SQLite Access

The dashboard container needs read-only access to NanoClaw's data directory.

```yaml
# docker-compose.yml
services:
  nanoclaw-dashboard:
    volumes:
      - /home/michael/workspace/nanoclaw-v2/data:/nanoclaw-data:ro
    environment:
      - NANOCLAW_DATA_DIR=/nanoclaw-data
```

**Important:** Mount as `:ro` (read-only) — the dashboard must NEVER write to NanoClaw's SQLite files directly. All writes go through ncl.

**SQLite WAL mode:** NanoClaw uses WAL journal mode. Readers don't block writers in WAL mode, so concurrent reads from the dashboard won't interfere with NanoClaw operation. The dashboard must NOT set the DB to WAL mode (it's already set); just open read-only.

```typescript
const db = new Database(`${NANOCLAW_DATA_DIR}/nanoclaw.db`, { readonly: true })
```

### 2. Per-Session DB Discovery

NanoClaw creates a pair of DBs per session. The dashboard needs to find them.

```
Pattern: {data_dir}/groups/{group_folder}/sessions/{session_id}/inbound.db
          {data_dir}/groups/{group_folder}/sessions/{session_id}/outbound.db
```

Discovery approach:
```typescript
function findSessionDbs(dataDir: string, sessionId: string): { inbound: string, outbound: string } | null {
  // Query the main DB first to get group folder
  const session = mainDb.prepare('SELECT agent_groups.folder FROM sessions JOIN agent_groups ON sessions.agent_group_id = agent_groups.id WHERE sessions.id = ?').get(sessionId)
  if (!session) return null
  const base = path.join(dataDir, 'groups', session.folder, 'sessions', sessionId)
  return { inbound: path.join(base, 'inbound.db'), outbound: path.join(base, 'outbound.db') }
}
```

Cache opened DB connections (LRU cache, max 50 connections) to avoid per-request open/close overhead.

### 3. ncl CLI Access from Docker

**Option A: Mount the ncl socket (preferred)**
```yaml
volumes:
  - /home/michael/workspace/nanoclaw-v2/nanoclaw.sock:/nanoclaw.sock
environment:
  - NCL_SOCKET=/nanoclaw.sock
```

Then in the backend, exec ncl with the socket path:
```bash
NCL_SOCKET=/nanoclaw.sock ncl groups restart --id <id>
```

**Option B: Mount the ncl binary + socket**
```yaml
volumes:
  - /usr/local/bin/ncl:/usr/local/bin/ncl:ro
  - /home/michael/workspace/nanoclaw-v2/nanoclaw.sock:/nanoclaw.sock
```

**Option C: HTTP endpoint on NanoClaw (if one is added)**
Not available in current NanoClaw. Requires upstream change.

**Recommendation:** Option A. The ncl binary already handles socket-based IPC; mounting the socket is clean and doesn't require NanoClaw changes.

### 4. Docker Compose + Traefik + Authelia

```yaml
services:
  nanoclaw-dashboard:
    image: nanoclaw-dashboard:latest
    build: .
    restart: unless-stopped
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.nanoclaw-dashboard.rule=Host(`nanoclaw.marinemr.xyz`)"
      - "traefik.http.routers.nanoclaw-dashboard.entrypoints=websecure"
      - "traefik.http.routers.nanoclaw-dashboard.tls.certresolver=cfdns"
      - "traefik.http.routers.nanoclaw-dashboard.middlewares=authelia@docker"
      - "traefik.http.services.nanoclaw-dashboard.loadbalancer.server.port=3001"
    volumes:
      - /home/michael/workspace/nanoclaw-v2/data:/nanoclaw-data:ro
      - /home/michael/workspace/nanoclaw-v2/nanoclaw.sock:/nanoclaw.sock
    environment:
      - NODE_ENV=production
      - NANOCLAW_DATA_DIR=/nanoclaw-data
      - NCL_SOCKET=/nanoclaw.sock
      - PORT=3001
    networks:
      - proxy  # Traefik's network

networks:
  proxy:
    external: true
```

## Monorepo Structure

```
nanoclaw-dashboard/
├── packages/
│   ├── backend/           # Hono API server
│   │   ├── src/
│   │   │   ├── index.ts       # Server entry
│   │   │   ├── db/
│   │   │   │   ├── main.ts    # Main DB queries
│   │   │   │   └── session.ts # Per-session DB access
│   │   │   ├── routes/
│   │   │   │   ├── groups.ts  # /api/groups
│   │   │   │   ├── sessions.ts
│   │   │   │   ├── messages.ts
│   │   │   │   └── admin.ts   # Restart, approve, members
│   │   │   └── ncl.ts         # ncl exec wrapper
│   │   └── package.json
│   │
│   ├── frontend/          # Svelte 5 SPA
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── +page.svelte   # Overview
│   │   │   │   ├── groups/
│   │   │   │   ├── sessions/
│   │   │   │   ├── messages/
│   │   │   │   └── approvals/
│   │   │   ├── lib/
│   │   │   │   ├── api.ts         # Fetch wrapper
│   │   │   │   ├── stores.svelte.ts # Reactive state
│   │   │   │   └── components/
│   │   │   └── app.css
│   │   └── package.json
│   │
│   └── shared/            # Shared TypeScript types
│       ├── src/
│       │   └── types.ts   # AgentGroup, Session, Message, etc.
│       └── package.json
│
├── Dockerfile
├── docker-compose.yml
├── package.json           # pnpm workspace root
└── .planning/
```

## API Design

```
GET  /api/groups                    → AgentGroup[]
GET  /api/groups/:id                → AgentGroup (with config)
GET  /api/groups/:id/members        → Member[]
GET  /api/groups/:id/sessions       → Session[]
POST /api/groups/:id/restart        → { success, message }

GET  /api/sessions                  → Session[] (filterable)
GET  /api/sessions/:id              → Session (with container state)
GET  /api/sessions/:id/messages     → Message[] (paginated)

GET  /api/approvals                 → PendingApproval[]
POST /api/approvals/:id/approve     → { success }
POST /api/approvals/:id/reject      → { success }

GET  /api/members                   → Member[] (all groups)
POST /api/groups/:id/members        → add member
DELETE /api/groups/:id/members/:uid → remove member

GET  /api/health                    → system health summary
```

## Suggested Build Order

1. **Monorepo scaffold** — pnpm workspace, TypeScript, shared types
2. **Docker + Traefik config** — verify routing before writing any real code
3. **SQLite read layer** — main DB queries (groups, sessions) with mock data fallback
4. **Backend API** — Hono routes serving real SQLite data
5. **Frontend shell** — Svelte 5 SPA layout, dark theme, sidebar nav
6. **Core views** — Groups list, Sessions list (read-only)
7. **Message logs** — per-session DB access, search/filter
8. **Admin controls** — ncl exec wrapper, restart + approvals UI
9. **Polish** — auto-refresh polling, loading states, error handling

---
*Architecture research for: NanoClaw admin dashboard*
*Researched: 2026-05-28*
