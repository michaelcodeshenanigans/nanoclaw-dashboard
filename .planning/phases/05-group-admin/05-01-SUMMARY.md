---
phase: 05-group-admin
plan: "01"
status: complete
---

# 05-01 Summary: Fix ID Types + Admin API Endpoints

## Objective

Fixed foundational bug where all group IDs were typed as `number` but are actually strings in NanoClaw DB (e.g., `ag-1779997904986-f35nnp`). Added three admin API endpoints: restart group, add member, remove member.

## Files Modified

### src/lib/types.ts
- `Group.id`: `number` → `string`
- `GroupDetail.id`: `number` → `string`
- `Member.id`: `number` → `string`
- `Destination.id`: `number` → `string`
- `SessionSummary.agent_group_id`: `number` → `string`
- `SessionWithGroup.agent_group_id`: `number` → `string`
- `SessionWithGroup.messaging_group_id`: `number | null` → `string | null`

### src/lib/server/db.ts
- `getGroupById(id: number)` → `getGroupById(id: string)`
- `getGroupMembers(groupId: number)` → `getGroupMembers(groupId: string)`
- `getGroupDestinations(groupId: number)` → `getGroupDestinations(groupId: string)`
- `getGroupSessions(groupId: number)` → `getGroupSessions(groupId: string)`
- `getSessionMessages(groupId: number, ...)` → `getSessionMessages(groupId: string, ...)`
- `SessionFilters.groupId?: number` → `groupId?: string`
- Filter guard: `typeof === 'number' && Number.isInteger` → `typeof === 'string' && length > 0`
- `params` array type: `Array<number | string>` → `Array<string>`

### src/lib/server/sessions.ts
- `getSessionContainerState(groupId: number, ...)` → `getSessionContainerState(groupId: string, ...)`
- Removed `String(groupId)` wrapper (now passes string directly to path.join)

### src/lib/server/session-db-pool.ts
- `getSessionDbPair(groupId: number, ...)` → `getSessionDbPair(groupId: string, ...)`
- Removed `String(groupId)` wrapper in path.join call

### src/routes/api/groups/[id]/+server.ts
- Removed `Number(params.id)` and integer validation; uses `params.id` string directly

### src/routes/api/groups/[id]/destinations/+server.ts
- Removed `Number(params.id)` and integer validation; uses `params.id` string directly

### src/routes/api/groups/[id]/sessions/+server.ts
- Removed `Number(params.id)` and integer validation; uses `params.id` string directly

### src/routes/api/groups/[id]/members/+server.ts
- Removed `Number(params.id)` cast from GET handler
- Added `POST` handler for adding members via `ncl members add`

### src/routes/api/sessions/+server.ts
- Replaced integer-based `groupId` filter with string-based filter
- `filters.groupId` is now typed as `string`

### src/routes/api/sessions/[id]/messages/+server.ts
- Cast `agent_group_id` as `string` instead of `number` in db query result

## Files Created

### src/routes/api/groups/[id]/restart/+server.ts
- `POST /api/groups/:id/restart`
- Body: `{ rebuild?: boolean, message?: string }`
- Calls `execNcl(['groups', 'restart', '--id', groupId, ...])` 
- Returns 202 `{ status: 'approval-pending' }` when ncl returns approval-pending

### src/routes/api/groups/[id]/members/[userId]/+server.ts
- `DELETE /api/groups/:id/members/:userId`
- Looks up user's `platform` and `platform_id` from `users` table
- Returns 404 if user not found
- Calls `execNcl(['members', 'remove', '--user', 'platform:platform_id', '--agent-group-id', groupId])`
- Returns 202 `{ status: 'approval-pending' }` when ncl returns approval-pending

## Verification Results

```
svelte-check --tsconfig ./tsconfig.json
COMPLETED 546 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS
```

Note: Required running `svelte-kit sync` first to generate `$types` for the two new route directories before svelte-check could resolve them.

## Deviations from Plan

None. All 8 tasks completed as specified. The only additional step was running `svelte-kit sync` (standard SvelteKit workflow for new routes) before the type check, which resolved the `$types` module-not-found errors immediately.
