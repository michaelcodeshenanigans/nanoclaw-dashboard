# Phase 11: Overview KPI Banner

**Goal:** Operator sees a 5-tile KPI banner on the home page showing 7-day rolling metrics (sessions, failures, failure rate, avg duration, spend) with delta vs prior 7-day period.

**Requirements:** KPI-01, KPI-02

## Success Criteria

1. Operator opens the home page and sees 5 KPI tiles in a row above the existing infra/system cards: Total Sessions, Failures, Failure Rate, Avg Duration, Spend.
2. Each tile shows its current 7-day rolling window value; Spend tile shows "Unavailable" (no cost source yet).
3. Each tile (except Spend) shows a trend indicator (↑ green / ↓ red / → neutral) comparing current vs prior 7-day window; the direction is correct for the metric (more failures = red ↑, fewer sessions = red ↓).
4. KPI banner uses the same 5-second polling interval as the rest of the home page.

## Implementation Plan

### Task 1: Add `KpiStats` type to `types.ts`
Add:
- `KpiPeriod`: `{ count: number; avg_duration_s: number | null; failures: number; failure_rate: number }`
- `KpiStats`: `{ current: KpiPeriod; prior: KpiPeriod; spend_unavailable: true; window_days: 7 }`

### Task 2: Add `getKpiStats()` to `db.ts`
Query the read-only central DB for both 7-day windows:
- Sessions created in [now-7d, now] → count, failure count, avg (julianday(last_active)-julianday(created_at))*86400
- Sessions created in [now-14d, now-7d] → same
- Return KpiStats (spend is always unavailable until Langfuse wired)

### Task 3: Add `/api/kpi` route
`src/routes/api/kpi/+server.ts` — calls `getKpiStats()`, returns JSON.

### Task 4: Update home page
In `+page.svelte`:
- Add a third poller for `/api/kpi`
- Add the KPI banner above the existing 2-card grid
- 5 tiles in a responsive row (2-3 columns on mobile, 5 on desktop)
- Each tile: label, big value, trend badge (↑/↓/→ with color)
- Spend tile: shows "—" with a small "Unavailable" note

## Data notes

- `sessions` table: `created_at`, `last_active`, `container_status`
- Duration = `(julianday(last_active) - julianday(created_at)) * 86400` seconds (only for sessions where both are non-null and last_active > created_at)
- Failure = container_status = 'error' (most observable failure signal available in central DB)
- Failure rate = failures / max(total, 1) × 100

## Delta direction semantics

| Metric | "Good" direction | Up trend color |
|--------|-----------------|----------------|
| sessions | more = neutral | gray |
| failures | fewer = good | up = red, down = green |
| failure_rate | lower = good | up = red, down = green |
| avg_duration | shorter = neutral | gray |
| spend | n/a | n/a |
