# Plan 02-01 Summary — Groups & Stats API

**Status:** Complete
**Files modified/created:** 4

## Files
- src/lib/types.ts — appended Group, ContainerStatusCounts, HealthStats interfaces
- src/lib/server/db.ts — added getGroups() (LEFT JOIN to sessions) and getHealthStats() (counts by container_status)
- src/routes/api/groups/+server.ts — GET /api/groups → Group[]
- src/routes/api/stats/+server.ts — GET /api/stats → HealthStats

## SQL queries
- getGroups: LEFT JOIN sessions ON most recent session per group (ORDER BY last_active DESC LIMIT 1)
- getHealthStats: COUNT by container_status='running'|'stopped'|'error', plus 24h error window

## Verification
- [x] src/lib/types.ts exports Group, HealthStats; still exports HealthStatus, DbStatus, NclStatus
- [x] src/lib/server/db.ts exports getGroups and getHealthStats; still has readonly:true
- [x] GET /api/groups and GET /api/stats created

## Deviations
None.
