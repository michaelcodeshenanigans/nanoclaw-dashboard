---
phase: 04-message-log
plan: "01"
status: complete
---

## Files Added/Modified

| File | Change |
|------|--------|
| `src/lib/server/session-db-pool.ts` | **Created** — LRU pool of per-session SQLite DB handles |
| `src/lib/types.ts` | **Modified** — `Message` interface appended |
| `src/lib/server/db.ts` | **Modified** — import updated, `getSessionMessages` + `GetSessionMessagesOpts` appended |
| `src/routes/api/sessions/[id]/messages/+server.ts` | **Created** — GET handler for session message log |

## LRU Pool Design

- **Implementation:** JavaScript `Map` with insertion-order preserved (ES2015 spec). On cache hit, delete + re-insert moves entry to end (most recently used). Eviction removes the first key (least recently used).
- **Max connections:** `MAX_CONNECTIONS = 50` — once pool reaches 50 entries, `evictLRU()` closes both `inbound` and `outbound` handles before inserting new entry.
- **Open strategy:** `openDb()` returns `null` if file doesn't exist (`existsSync` check) or if `new Database()` throws. Pool entries can have `null` handles for either side.
- **All access is synchronous** — better-sqlite3 is sync; no async/await in the pool layer.
- **Exports:** `getSessionDbPair(groupId, sessionId)` and `getPoolSize()`.

## DB Schema Used

**inbound.db → `messages_in`:**
```
id TEXT PRIMARY KEY, seq INTEGER UNIQUE, kind TEXT NOT NULL, timestamp TEXT NOT NULL,
status TEXT, platform_id TEXT, channel_type TEXT, thread_id TEXT, content TEXT NOT NULL
```

**outbound.db → `messages_out`:**
```
id TEXT PRIMARY KEY, seq INTEGER UNIQUE, in_reply_to TEXT, timestamp TEXT NOT NULL,
kind TEXT NOT NULL, platform_id TEXT, channel_type TEXT, thread_id TEXT, content TEXT NOT NULL
```

## New Exports

### Types (`$lib/types`)
- `Message` — merged message row with `direction: 'in' | 'out'` field

### Server functions (`$lib/server/db`)
- `GetSessionMessagesOpts` — interface `{ search?, kind?, since?, until?, limit? }`
- `getSessionMessages(groupId, sessionId, opts?)` — queries both session DBs, merges by timestamp, caps at min(limit, 500)

### Pool (`$lib/server/session-db-pool`)
- `getSessionDbPair(groupId, sessionId)` — LRU-cached `{ inbound: Database | null, outbound: Database | null }`
- `getPoolSize()` — current number of open pool entries

## API Surface Added

`GET /api/sessions/:id/messages`
- Looks up `agent_group_id` from central DB using session string ID
- Returns 404 if session not found
- Query params: `search` (LIKE), `kind` (exact), `since` (timestamp >=), `until` (timestamp <=), `limit` (default 200, max 500)
- Returns `Message[]` JSON — merged inbound + outbound, sorted by timestamp ASC

## Verification

```
svelte-check --tsconfig ./tsconfig.json
→ COMPLETED 540 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS
```

Note: `svelte-kit sync` was required after creating the new nested route to generate `.svelte-kit/types/src/routes/api/sessions/[id]/messages/$types.d.ts`.
