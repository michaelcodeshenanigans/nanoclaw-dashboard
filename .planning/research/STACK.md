# Stack Research

**Domain:** Admin ops dashboard — SvelteKit (Node adapter), single Docker container
**Researched:** 2026-05-28 (revised: switched from Hono+SPA to SvelteKit after Mike review)
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| SvelteKit | 2.x | Full-stack framework | Svelte 5 + Vite + API routes + SSR in one package. `@sveltejs/adapter-node` outputs `build/index.js` — same single-container Docker pattern, zero extra glue. Eliminates separate Hono server, Vite proxy config, and monorepo wiring. |
| `@sveltejs/adapter-node` | 5.x | Node.js deployment adapter | Compiles SvelteKit to a standalone Node.js server (`node build/index.js`). Correct adapter for Docker deployment. |
| better-sqlite3 | 11.x | SQLite access (sync) | Used in SvelteKit server routes (`+server.ts`, `+page.server.ts`). Sync API is ideal for read-heavy dashboard queries. Auto-excluded from client bundle via `$lib/server/`. |
| TypeScript | 5.x | Language | SvelteKit projects are TypeScript-native. Shared types in `$lib/types.ts` work across server and client without a separate package. |
| pnpm | 9.x | Package manager | Single `package.json` — no monorepo needed. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 3.x | Request validation | Validate query params and request bodies in `+server.ts` handlers |
| shadcn-svelte | latest | Dark-theme UI components | Best dark-mode component library for Svelte 5. Tailwind-based, customizable. |
| tailwindcss | 4.x | Utility CSS | Required by shadcn-svelte; SvelteKit has first-class Tailwind support |
| lucide-svelte | latest | Icons | Clean icon set, works well with Svelte 5 runes |
| date-fns | 3.x | Date formatting | Format SQLite ISO timestamps for display |
| @tanstack/svelte-table | 8.x | Data tables | Headless table for message logs / session lists with sorting and filtering |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `vite dev` (built-in) | Dev server | One command runs both frontend HMR and server-side API routes on the same port. No proxy needed. |
| eslint + typescript-eslint | Linting | SvelteKit scaffold includes this |
| prettier + prettier-plugin-svelte | Formatting | Format `.svelte` files correctly |

## Installation

```bash
# Scaffold
pnpm create svelte@latest .
# → Choose: Skeleton project, TypeScript, ESLint, Prettier

# Core server deps
pnpm add better-sqlite3 zod
pnpm add -D @types/better-sqlite3 @sveltejs/adapter-node

# UI
pnpm add -D tailwindcss @tailwindcss/vite
pnpm dlx shadcn-svelte@latest init
pnpm add lucide-svelte date-fns @tanstack/svelte-table
```

## Project Structure

```
nanoclaw-dashboard/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte              # Dark-theme shell, sidebar nav
│   │   ├── +page.svelte                # Overview / health summary
│   │   ├── groups/
│   │   │   ├── +page.svelte            # Groups list
│   │   │   └── [id]/+page.svelte       # Group detail
│   │   ├── sessions/
│   │   │   ├── +page.svelte            # Sessions index
│   │   │   └── [id]/+page.svelte       # Session detail + message log
│   │   ├── approvals/
│   │   │   └── +page.svelte            # Approvals queue
│   │   └── api/
│   │       ├── health/+server.ts
│   │       ├── groups/+server.ts
│   │       ├── groups/[id]/+server.ts
│   │       ├── groups/[id]/members/+server.ts
│   │       ├── groups/[id]/restart/+server.ts
│   │       ├── sessions/+server.ts
│   │       ├── sessions/[id]/+server.ts
│   │       ├── sessions/[id]/messages/+server.ts
│   │       └── approvals/+server.ts
│   └── lib/
│       ├── server/                     # Never bundled to client
│       │   ├── db.ts                   # better-sqlite3 + queries
│       │   └── ncl.ts                  # ncl execFile wrapper
│       ├── components/                 # Svelte UI components
│       └── types.ts                    # Shared types
├── static/
├── svelte.config.js                    # adapter-node here
├── vite.config.ts
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Key Patterns

**SvelteKit API route:**
```typescript
// src/routes/api/groups/+server.ts
import { json } from '@sveltejs/kit'
import { getGroups } from '$lib/server/db'

export async function GET() {
  return json(getGroups())
}
```

**Server-only DB module:**
```typescript
// src/lib/server/db.ts
import Database from 'better-sqlite3'
const db = new Database(process.env.NANOCLAW_DB!, { readonly: true })
db.pragma('busy_timeout = 1000')
```

**svelte.config.js:**
```javascript
import adapter from '@sveltejs/adapter-node'
export default { kit: { adapter: adapter() } }
```

## Alternatives Considered

| Recommended | Alternative | Why SvelteKit Wins |
|-------------|-------------|-------------------|
| SvelteKit | Hono + Svelte 5 SPA | Two build pipelines, Vite proxy config, monorepo wiring — all eliminated by SvelteKit. No capability difference for this use case. |
| SvelteKit | Next.js | React ecosystem, not preferred here. |
| better-sqlite3 | Drizzle ORM | Read-heavy dashboard doesn't need a query builder; direct SQL is simpler. |
| shadcn-svelte | Skeleton UI / Carbon | shadcn-svelte has the best dark mode defaults and Svelte 5 support. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Separate Hono/Express backend | Creates two build pipelines and glue code | SvelteKit `+server.ts` routes |
| Prisma | ORM overhead, schema ownership conflict with NanoClaw's DB | better-sqlite3 direct |
| pnpm workspaces / monorepo | No longer needed — one SvelteKit project covers everything | Single `package.json` |
| ws (WebSocket) | 5s polling is sufficient for a single-operator ops panel | `setInterval + fetch` |
| `@sveltejs/adapter-auto` | Produces incorrect output for Docker; must use `adapter-node` explicitly | `@sveltejs/adapter-node` |

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| SvelteKit 2.x | @sveltejs/adapter-node 5.x | Must match |
| Tailwind 4.x | shadcn-svelte latest | Tailwind 4 uses CSS-native variables (different from v3 config) |
| better-sqlite3 11.x | Node 20+ | Native module — must compile inside Docker image |

## Sources

- SvelteKit docs (kit.svelte.dev) — adapter-node, server routes, $lib/server
- better-sqlite3 README — WAL mode, readonly flag
- shadcn-svelte docs — Svelte 5 + Tailwind 4 setup
- NanoClaw source (nanocoai/nanoclaw) — confirmed SQLite usage, no REST admin API

---
*Stack research for: NanoClaw admin dashboard*
*Revised: 2026-05-28 — switched from Hono+SPA to SvelteKit*
