<!-- GSD:project-start source:PROJECT.md -->
## Project

**NanoClaw Dashboard**

A dark-theme web ops panel for a self-hosted NanoClaw installation, giving the operator real-time visibility into agent groups, active sessions, message logs, and system health — with admin controls to restart agents, approve pending commands, and manage members. Deployed at `nanoclaw.marinemr.xyz` behind Authelia single-factor auth, running as a Docker container on the same host as NanoClaw.

**Core Value:** An operator can see what every agent group is doing right now and take action (restart, approve, manage members) without touching the command line.

### Constraints

- **Stack**: Node.js (Hono) backend + Svelte frontend — must stay lightweight; no heavy ORMs or frameworks
- **Data access**: Must read NanoClaw SQLite DB directly (mount volume) and exec `ncl` for write ops
- **Deployment**: Single Docker container; must include Traefik + Authelia labels in compose config
- **Auth**: Authelia handles all authentication — dashboard does not implement its own auth
- **Dark theme**: UI must use a dark color scheme (Michael's preference)
- **No SSH key in container**: Host access for deploy is out-of-band; GitHub is the artifact delivery mechanism
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

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
# Root workspace
# Backend (packages/backend)
# Frontend (packages/frontend)
# Shared types
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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
