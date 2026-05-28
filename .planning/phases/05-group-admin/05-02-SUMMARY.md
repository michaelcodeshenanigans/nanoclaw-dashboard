---
phase: 05-group-admin
plan: "02"
status: complete
---

## Changes made to `src/routes/groups/[id]/+page.svelte`

### Change 1 — Fixed string ID (critical bug)
- `const id = Number($page.params.id)` → `const id = $page.params.id`
- Group IDs are strings (UUIDs); `Number()` was converting them to NaN

### Change 2 — Added admin state and action functions
All variables use `$state()` rune. Added:
- `restartRebuild`, `restartMessage`, `restartLoading`, `restartFeedback`
- `addUser`, `addLoading`, `addFeedback`
- `removeLoading` (`$state<string | null>(null)`), `removeFeedback`
- `showFeedback()` helper — sets message then clears via `setTimeout` after 4s
- `handleRestart()` — POSTs to `/api/groups/${id}/restart`
- `handleAddMember()` — POSTs to `/api/groups/${id}/members`
- `handleRemoveMember(userId)` — DELETEs `/api/groups/${id}/members/${userId}`
- All three use `async/await`, disable button while loading, show 202 as "pending approval" (muted, not error)

### Change 3 — Added Restart card
- Inserted between Config section and Members section
- Rebuild checkbox (`bind:checked={restartRebuild}`)
- Optional on-wake message text input (`bind:value={restartMessage}`)
- Restart button with `onclick={handleRestart}` (Svelte 5 syntax), disabled while loading
- Inline feedback span below button

### Change 4 — Updated Members section
- Added `pr-4` column padding and empty header column for Remove button
- Updated `{#each}` key to `(m.id)` (guaranteed non-null)
- Added `{m.platform}:{m.platform_id}` combined cell
- Added Remove button per row: `onclick={() => handleRemoveMember(m.id)}`, disabled when that row's userId matches `removeLoading`
- `removeFeedback` shown after table (within the `{:else}` branch)
- Add Member form at bottom, below a divider: text input + Add button + `addFeedback` display

## Requirements satisfied

| Requirement | Description | Status |
|-------------|-------------|--------|
| GRP-04 | Add member form with platform:identifier input | ✅ |
| GRP-05 | Remove button per member row | ✅ |
| GRP-07 | Restart card with rebuild checkbox and message field | ✅ |

## Verification results

- [x] `const id = $page.params.id` (string, not Number)
- [x] Restart card with rebuild checkbox, message input, button, feedback display
- [x] Members table has Remove button per row showing loading state
- [x] Add Member form below members table with text input and button
- [x] 202 responses show "Request submitted — pending approval" (muted text, not error)
- [x] `node_modules/.bin/svelte-check --tsconfig ./tsconfig.json` → **0 errors, 0 warnings**

## Deviations from plan

- Added explicit type casts `(body as { message?: string }).message` in error handling paths to satisfy TypeScript's strict unknown-typed catch blocks. This was not called out in the plan but required for a clean type check.
- The plan's code snippets used bare `body.message` without a cast; updated to typed access to avoid implicit `any` errors.
- No other deviations. All existing `createPoller` calls left as-is (no `signal` added).
