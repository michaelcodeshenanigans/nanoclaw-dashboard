# Stack Research

**Domain:** Admin ops dashboard — Node.js backend + Svelte frontend, single Docker container
**Researched:** 2026-05-28
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Hono | 4.x | Backend HTTP framework | Ultralight (~14KB), TypeScript-native, runs on Node/Bun/Deno/Edge. Perfect for a thin API proxy. No bloat. |
| Svelte 5 | 5.x | Frontend UI framework | Runes-based reactivity, minimal bundle, compiles away. Better than SvelteKit for a single-page ops panel served from one backend. |
| Vite | 6.x | Frontend build tool | Native Svelte 5 support, fast HMR in dev, optimized production builds |
| better-sqlite3 | 11.x | SQLite access (sync) | Synchronous API is ideal for a backend that does many small reads. WAL mode support. Better than sql.js or async wrappers for this pattern. |
| TypeScript | 5.x | Language | Shared types between backend and frontend via `packages/shared/` |
| pnpm | 9.x | Package manager + workspace | Monorepo workspaces: `packages/backend`, `packages/frontend`, `packages/shared` |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @hono/node-server | 1.x | Node.js adapter for Hono | Required to run Hono on Node.js (vs Bun) |
| @hono/cors | built-in | CORS for API | Dev only — in prod, frontend is served from same origin |
| zod | 3.x | Request validation | Validate query params and body on API routes |
| shadcn-svelte | latest | Dark-theme UI components | Best dark-mode component library for Svelte 5. Tailwind-based, customizable. |
| tailwindcss | 4.x | Utility CSS | Required by shadcn-svelte; also ideal for ops dashboard layouts |
| lucide-svelte | latest | Icons | Clean icon set, good Svelte integration |
| date-fns | 3.x | Date formatting | Format timestamps from SQLite (ISO strings) |
| @tanstack/svelte-table | 8.x | Data tables | Powerful headless table for message logs / session lists |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| tsx | TypeScript executor for Node | Run backend in dev without compile step |
| vite-node | Node backend with Vite HMR | Alternative to tsx for backend dev |
| @sveltejs/vite-plugin-svelte | Svelte 5 Vite integration | Required in vite.config.ts |
| eslint + typescript-eslint | Linting | Catch type errors early |
| prettier | Formatting | Consistent code style |

## Installation

```bash
# Root workspace
pnpm init
pnpm add -D typescript pnpm

# Backend (packages/backend)
pnpm add hono @hono/node-server better-sqlite3 zod
pnpm add -D @types/better-sqlite3 tsx

# Frontend (packages/frontend)
pnpm add svelte@5 @sveltejs/vite-plugin-svelte vite tailwindcss lucide-svelte date-fns
pnpm add shadcn-svelte @tanstack/svelte-table
pnpm add -D @sveltejs/vite-plugin-svelte

# Shared types
pnpm add -D typescript
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Hono | Express | If team already knows Express and migration cost matters |
| Hono | Fastify | If you need full plugin ecosystem; overkill for a thin API layer |
| Svelte 5 | SvelteKit | If you need SSR, file-based routing, or form actions. For an SPA ops panel served from Hono, SvelteKit adds unnecessary complexity |
| Svelte 5 | React + Vite | If team is React-native; React adds 40KB+ gzipped vs Svelte's ~5KB |
| better-sqlite3 | node-sqlite3 | If you need async ops (not needed here — sync reads are faster and simpler) |
| better-sqlite3 | Drizzle ORM | If you want type-safe query builder; adds complexity; direct SQL is fine for a read-heavy dashboard |
| shadcn-svelte | Carbon Design | If you need IBM/enterprise design language |
| shadcn-svelte | Skeleton UI | If Tailwind isn't already in the project |
| pnpm workspaces | Turborepo | If you have many packages and need build caching; overkill here |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Prisma | WAY too heavy for SQLite reads; generates its own DB client, adds schema drift risk for a read-only external DB | better-sqlite3 direct |
| Next.js / Nuxt | Server-side rendering is unnecessary for a protected ops panel; adds build complexity | Svelte 5 + Vite SPA |
| Express + many middleware | Bloated for this use case | Hono |
| better-sqlite3 async wrapper | Async wrappers negate the main benefit; use sync API directly | better-sqlite3 sync |
| ws (WebSocket) for v1 | Adds infrastructure complexity; polling every 5s is sufficient for an ops panel | setInterval + fetch |
| Docker multi-stage without caching | Slow rebuilds during development | Proper layer ordering (deps before src) |

## Stack Patterns

**Backend serves frontend in production:**
```typescript
// Hono serves the built frontend
app.use('/*', serveStatic({ root: '../frontend/dist' }))
```

**Dev mode (separate ports, proxied):**
```
Vite dev server: localhost:5173 (frontend with HMR)
Hono dev server: localhost:3000 (backend API)
Vite proxy: /api/* → localhost:3000
```

**SQLite WAL mode (critical for concurrent reads):**
```typescript
const db = new Database(dbPath, { readonly: true })
db.pragma('journal_mode = WAL') // Already set by NanoClaw — just verify
```

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Svelte 5.x | @sveltejs/vite-plugin-svelte 5.x | Must match major versions |
| Tailwind 4.x | shadcn-svelte latest | Tailwind 4 uses CSS-native variables |
| better-sqlite3 11.x | Node 20+ | Requires native compilation — include in Docker build |
| Hono 4.x | @hono/node-server 1.x | Must match |

## Sources

- Hono official docs (hono.dev) — routing, Node.js adapter, static serving
- Svelte 5 docs (svelte.dev) — runes, component API
- better-sqlite3 README (github.com/WiseLibs/better-sqlite3) — WAL mode, readonly flag
- shadcn-svelte docs — dark mode setup, Tailwind 4 compatibility
- NanoClaw source (nanocoai/nanoclaw) — confirmed SQLite usage, no REST admin API

---
*Stack research for: NanoClaw admin dashboard*
*Researched: 2026-05-28*
