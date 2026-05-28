# Pitfalls Research

**Domain:** Admin dashboard reading from live SQLite + ncl CLI exec + Docker/Traefik/Authelia
**Researched:** 2026-05-28
**Confidence:** HIGH

## Critical Pitfalls

### 1. SQLite SQLITE_BUSY / Read Contention

**Warning signs:**
- `SQLITE_BUSY: database is locked` errors in logs
- Dashboard returns stale data or errors under load
- NanoClaw writes slow down when dashboard is polling

**What goes wrong:**
Even in WAL mode, opening many per-session DBs simultaneously can exhaust SQLite's file descriptor limits or trigger busy timeouts. If the dashboard opens a connection to every session's `outbound.db` on every request, it'll thrash.

**Prevention strategy:**
- Open the main DB as `readonly` (prevents WAL writer registration)
- Use an LRU connection cache: keep at most N session DBs open at once (N = 20-50)
- Set `busy_timeout` pragma to 1000ms so reads retry instead of immediately failing
- Never open outbound.db for a session unless explicitly requested (lazy loading)
- Prefer `db.prepare().get()` over `db.exec()` — prepared statements are faster

```typescript
const db = new Database(path, { readonly: true })
db.pragma('busy_timeout = 1000')
```

**Phase:** Phase 1 (SQLite read layer)

---

### 2. ncl Socket Access from Docker

**Warning signs:**
- `ENOENT: no such file or directory` on the socket path
- `ncl: permission denied` errors
- ncl commands hang with no output

**What goes wrong:**
The ncl socket is a Unix domain socket created by NanoClaw's host process. If the socket path doesn't match between host and container, or if file permissions prevent the container user from writing to it, all write operations fail silently.

**Prevention strategy:**
- Verify the socket path in NanoClaw config BEFORE writing the dashboard code
- Mount the socket explicitly: `-v /path/to/nanoclaw.sock:/nanoclaw.sock`
- The container user (node/hostuser) must have RW access to the socket
- Test with a simple `ncl help` exec before wiring to UI
- Add a `/api/health` check that verifies ncl connectivity on startup
- Set execution timeout on ncl commands (default can hang indefinitely)

```typescript
const { stdout, stderr } = await execFile('ncl', ['groups', 'list'], {
  timeout: 10000,
  env: { ...process.env, NCL_SOCKET: '/nanoclaw.sock' }
})
```

**Phase:** Phase 1 (ncl integration)

---

### 3. Traefik + Authelia Middleware Misconfiguration

**Warning signs:**
- Dashboard accessible without auth at nanoclaw.marinemr.xyz
- 404 or redirect loop after Authelia login
- API routes (`/api/*`) bypassing Authelia

**What goes wrong:**
Traefik applies middleware per-router. If only the frontend router gets the `authelia@docker` middleware but `/api/*` has a separate router without the middleware, the API is publicly accessible. Common mistake: creating separate routers for static vs API routes.

**Prevention strategy:**
- Use ONE router for the entire domain — Hono handles both static and API routes internally; no need for Traefik-level path splitting
- Double-check: `traefik.http.routers.nanoclaw-dashboard.middlewares=authelia@docker` must be on the main (and only) router
- Test by opening an incognito tab to `nanoclaw.marinemr.xyz/api/groups` — should redirect to Authelia, not return JSON
- Verify Authelia's `access_control` rules don't accidentally allow the dashboard domain
- Use `traefik.http.routers.*.entrypoints=websecure` (not `web`) — HTTP should redirect to HTTPS

**Phase:** Phase 2 (Docker/Traefik setup)

---

### 4. Per-Session DB Path Discovery Failure

**Warning signs:**
- Message logs return empty for some sessions
- `ENOENT` errors for DB files that should exist
- Inconsistent results between sessions

**What goes wrong:**
NanoClaw's session DB path is derived from `agent_groups.folder` + session ID. If the dashboard hardcodes the wrong path structure, or if session DBs for archived/deleted sessions are missing, every bad path lookup causes an error cascade.

**Prevention strategy:**
- Always derive DB paths from the main DB (query `agent_groups.folder` first)
- Return empty results (not errors) for sessions whose DB files don't exist on disk
- Use `fs.existsSync()` before opening a DB file
- Log path lookup misses for debugging but don't surface as API errors
- Handle the case where a session exists in the main DB but its DB files were cleaned up

```typescript
if (!fs.existsSync(dbPath)) {
  return { messages: [], note: 'session_db_not_found' }
}
```

**Phase:** Phase 3 (Message logs)

---

### 5. Svelte Polling Memory Leaks

**Warning signs:**
- Browser tab gets progressively slower over time
- Memory usage grows without stopping in DevTools
- `Maximum call stack size exceeded` after leaving tab open for hours

**What goes wrong:**
If polling intervals (setInterval) or fetch calls accumulate without cleanup, the frontend leaks memory. Common causes: `setInterval` not cleared in `onDestroy`, stale closures capturing old state, large message arrays growing unbounded.

**Prevention strategy:**
- Always clear intervals in Svelte `onDestroy`:
```typescript
import { onDestroy } from 'svelte'
const interval = setInterval(fetchData, 5000)
onDestroy(() => clearInterval(interval))
```
- Cap message log arrays in memory (keep last 500, not all-time)
- Use Svelte 5 `$effect` cleanup return for reactive intervals
- Abort in-flight fetches when component unmounts (AbortController)

**Phase:** Phase 4 (Frontend UI)

---

### 6. Docker Build Fails on better-sqlite3 (Native Module)

**Warning signs:**
- `Cannot find module 'better-sqlite3'` at runtime
- `Error: The module was compiled against a different Node.js version`
- Docker build succeeds but container crashes on start

**What goes wrong:**
better-sqlite3 is a native Node.js addon — it compiles C++ bindings during `npm install`. If the Docker base image differs from the build machine's Node version, or if `node_modules` is volume-mounted from the host, the binaries won't match.

**Prevention strategy:**
- Build better-sqlite3 INSIDE the Docker image (don't copy node_modules from host)
- Use `node:20-alpine` as base (smaller, consistent)
- Multi-stage build: install deps in builder stage, copy only production files to runtime stage
- Pin Node version: `FROM node:20.18-alpine` (exact version)
- Add `/workspace/node_modules` to `.dockerignore`

**Dockerfile pattern:**
```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build
CMD ["node", "dist/index.js"]
```

**Phase:** Phase 2 (Docker setup)

---

### 7. Security: Unsafe ncl Command Construction

**Warning signs:**
- API accepts arbitrary strings and passes them to ncl without validation
- Shell injection possible via group IDs or member usernames
- Restart endpoint accepts unconstrained `--message` parameter

**What goes wrong:**
If the API builds shell commands by string interpolation from user-supplied values, it's vulnerable to command injection. The dashboard has admin-level access to ncl — a compromised API endpoint could destroy the NanoClaw installation.

**Prevention strategy:**
- NEVER use shell interpolation for ncl commands: use `execFile` (not `exec`) with argument array
- Validate and whitelist all inputs before passing to ncl:
  - Group IDs: must match UUID pattern from DB
  - Usernames: must match known user IDs from DB
  - Restart message: strip shell metacharacters or length-limit to 200 chars
- Authelia protects the dashboard, but defense-in-depth applies: treat the API as if it could receive malicious input
- Log all admin actions (restart, approve, member changes) with timestamp + source IP

```typescript
// WRONG:
exec(`ncl groups restart --id ${groupId} --message ${message}`)

// RIGHT:
execFile('ncl', ['groups', 'restart', '--id', groupId, '--message', sanitizedMessage])
```

**Phase:** Phase 5 (Admin controls)

---

## Lower-Severity Notes

- **Tailwind 4 + shadcn-svelte:** Tailwind 4 uses a different config format (CSS variables instead of `tailwind.config.js`). Follow shadcn-svelte's Tailwind 4 setup guide exactly — don't mix v3 and v4 patterns.
- **Vite proxy in dev:** Set `server.proxy` in `vite.config.ts` to forward `/api/*` to Hono's dev port. Without this, API calls fail in development.
- **WAL shm/wal files:** SQLite WAL mode creates `-shm` and `-wal` sidecar files. The volume mount must include the full directory, not just the `.db` file, or these will be inaccessible.
- **Authelia session timeout:** Operators who leave the dashboard open will get logged out by Authelia's session timeout. Handle 401 responses from the API by redirecting to the Authelia login page.

---
*Pitfalls research for: NanoClaw admin dashboard*
*Researched: 2026-05-28*
