<script lang="ts">
  import { createPoller, type PollState } from '$lib/poll';
  import type { AuditLogEntry } from '$lib/types';

  interface AuditResponse { entries: AuditLogEntry[]; actors: string[] }

  let poll = $state<PollState<AuditResponse>>({ data: null, loading: true, error: null, lastUpdated: null });
  let filterActor = $state('');
  let filterAction = $state('');

  $effect(() => {
    const actor = filterActor;
    const action = filterAction;
    const params = new URLSearchParams();
    if (actor) params.set('actor', actor);
    if (action) params.set('action', action);
    params.set('limit', '200');
    const url = `/api/audit-log?${params}`;

    const p = createPoller<AuditResponse>(
      signal => fetch(url, { signal }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      30000,
      s => { poll = s; }
    );
    return () => p.stop();
  });

  function fmtTs(ts: string) {
    return ts.replace('T', ' ').slice(0, 19);
  }

  function fmtPayload(json: string | null) {
    if (!json) return '';
    try {
      const obj = JSON.parse(json) as Record<string, unknown>;
      return Object.entries(obj).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ');
    } catch { return json; }
  }
</script>

<svelte:head><title>Audit Log — NanoClaw</title></svelte:head>

<div class="p-6 space-y-4">
  <h1 class="text-lg font-semibold">Audit Log</h1>

  <div class="flex flex-wrap gap-2">
    <select
      bind:value={filterActor}
      class="h-9 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
    >
      <option value="">All actors</option>
      {#each poll.data?.actors ?? [] as a}
        <option value={a}>{a}</option>
      {/each}
    </select>
    <input
      type="text"
      placeholder="Filter action prefix…"
      bind:value={filterAction}
      class="h-9 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
    />
    <button
      onclick={() => { filterActor = ''; filterAction = ''; }}
      class="h-9 px-3 rounded-md border border-[hsl(var(--border))] text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
    >
      Clear
    </button>
  </div>

  {#if poll.error}
    <div class="rounded-md bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">{poll.error}</div>
  {:else if poll.loading && !poll.data}
    <div class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</div>
  {:else}
    <div class="rounded-md border border-[hsl(var(--border))] overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-[hsl(var(--muted))]">
          <tr>
            <th class="text-left px-4 py-2.5 font-medium text-[hsl(var(--muted-foreground))]">Time</th>
            <th class="text-left px-4 py-2.5 font-medium text-[hsl(var(--muted-foreground))]">Actor</th>
            <th class="text-left px-4 py-2.5 font-medium text-[hsl(var(--muted-foreground))]">Action</th>
            <th class="text-left px-4 py-2.5 font-medium text-[hsl(var(--muted-foreground))]">Target</th>
            <th class="text-left px-4 py-2.5 font-medium text-[hsl(var(--muted-foreground))]">Details</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[hsl(var(--border))]">
          {#if !poll.data?.entries?.length}
            <tr><td colspan="5" class="px-4 py-6 text-center text-[hsl(var(--muted-foreground))]">No entries.</td></tr>
          {/if}
          {#each poll.data?.entries ?? [] as e (e.id)}
            <tr class="hover:bg-[hsl(var(--muted)/0.5)]">
              <td class="px-4 py-2 font-mono text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">{fmtTs(e.ts)}</td>
              <td class="px-4 py-2 font-mono text-xs">{e.actor}</td>
              <td class="px-4 py-2">
                <span class="inline-block text-xs font-medium px-1.5 py-0.5 rounded bg-[hsl(var(--accent))]">{e.action}</span>
              </td>
              <td class="px-4 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                {#if e.target}
                  <span class="font-medium">{e.target}</span>{#if e.target_id} / {e.target_id}{/if}
                {/if}
              </td>
              <td class="px-4 py-2 text-xs text-[hsl(var(--muted-foreground))] max-w-xs truncate">{fmtPayload(e.payload_json)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="text-xs text-[hsl(var(--muted-foreground))]">Showing up to 200 most recent entries. Refreshes every 30s.</p>
  {/if}
</div>
