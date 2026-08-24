<script lang="ts">
  import { createPoller, type PollState } from '$lib/poll';
  import type { ConnectionHealth } from '$lib/types';
  import { formatDistanceToNow } from 'date-fns';

  let connections = $state<PollState<ConnectionHealth[]>>({ data: null, loading: true, error: null, lastUpdated: null });

  $effect(() => {
    const p = createPoller<ConnectionHealth[]>(
      signal => fetch('/api/connections', { signal }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      30000,
      s => { connections = s; }
    );
    return () => p.stop();
  });

  function fmt(ts: string): string {
    try { return formatDistanceToNow(new Date(ts), { addSuffix: true }); } catch { return ts; }
  }

  type ConnStatus = 'active' | 'recent' | 'stale' | 'dormant' | 'unknown';

  function inferStatus(c: ConnectionHealth): ConnStatus {
    if (c.active_sessions > 0) return 'active';
    if (!c.last_active) return 'unknown';
    const ageMs = Date.now() - new Date(c.last_active).getTime();
    if (ageMs < 60 * 60 * 1000) return 'recent';
    if (ageMs < 7 * 24 * 60 * 60 * 1000) return 'stale';
    return 'dormant';
  }

  const STATUS_LABEL: Record<ConnStatus, string> = {
    active: 'Active',
    recent: 'Recent',
    stale: 'Stale',
    dormant: 'Dormant',
    unknown: 'No activity',
  };

  const STATUS_CLASS: Record<ConnStatus, string> = {
    active:  'bg-green-900/40 text-green-300 border-green-700/40',
    recent:  'bg-blue-900/40 text-blue-300 border-blue-700/40',
    stale:   'bg-yellow-900/40 text-yellow-300 border-yellow-700/40',
    dormant: 'bg-zinc-800/60 text-zinc-400 border-zinc-600/40',
    unknown: 'bg-zinc-800/60 text-zinc-500 border-zinc-600/40',
  };
</script>

<svelte:head><title>Connections — NanoClaw</title></svelte:head>

<div class="p-6 space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold">Connections</h1>
      <p class="text-sm text-[hsl(var(--muted-foreground))] mt-1">
        Messaging channels configured in NanoClaw.
      </p>
    </div>
    <span class="text-xs text-[hsl(var(--muted-foreground))]">
      {#if connections.lastUpdated}Updated {fmt(connections.lastUpdated.toISOString())}{/if}
    </span>
  </div>

  <div class="rounded-md border border-amber-700/50 bg-amber-900/20 px-4 py-3 text-sm text-amber-300">
    Status is inferred from session activity — NanoClaw has no live channel ping verb.
    "Active" means a session is currently running against this channel; "Recent" means activity within the last hour.
    Tokens and credentials are host env vars and are not visible here.
  </div>

  {#if connections.error}
    <div class="rounded-md bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">
      {connections.error}
    </div>
  {:else if connections.loading && !connections.data}
    <div class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</div>
  {:else if !connections.data || connections.data.length === 0}
    <div class="rounded-md border border-[hsl(var(--border))] px-6 py-12 text-center text-[hsl(var(--muted-foreground))] text-sm">
      No messaging channels configured.
    </div>
  {:else}
    <div class="rounded-md border border-[hsl(var(--border))] overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-[hsl(var(--muted))] border-b border-[hsl(var(--border))]">
            <tr>
              <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Channel</th>
              <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Platform</th>
              <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Groups</th>
              <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Last activity</th>
              <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[hsl(var(--border))]">
            {#each connections.data as c (c.id)}
              {@const status = inferStatus(c)}
              <tr class="hover:bg-[hsl(var(--muted)/0.5)] transition-colors">
                <td class="px-4 py-3 font-medium">{c.name}</td>
                <td class="px-4 py-3">
                  <span class="capitalize text-[hsl(var(--muted-foreground))]">{c.platform}</span>
                </td>
                <td class="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                  {c.agent_group_count}
                </td>
                <td class="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                  {#if c.last_active}
                    <span title={c.last_active}>{fmt(c.last_active)}</span>
                  {:else}
                    —
                  {/if}
                </td>
                <td class="px-4 py-3">
                  <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium {STATUS_CLASS[status]}">
                    {STATUS_LABEL[status]}
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
    <p class="text-xs text-[hsl(var(--muted-foreground))]">
      {connections.data.length} channel{connections.data.length !== 1 ? 's' : ''} — sorted by most recent activity.
    </p>
  {/if}
</div>
