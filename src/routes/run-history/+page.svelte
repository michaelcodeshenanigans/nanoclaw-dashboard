<script lang="ts">
  import { createPoller, type PollState } from '$lib/poll';
  import { formatDistanceToNow } from 'date-fns';
  import type { Group, RunHistoryEntry, RunStatus, TriggerSource } from '$lib/types';

  let statusFilter = $state<RunStatus | ''>('');
  let groupId = $state<string>('');
  let triggerFilter = $state<TriggerSource | ''>('');
  let timeRange = $state<string>('');

  let groups = $state<Group[]>([]);
  $effect(() => {
    fetch('/api/groups').then(r => r.ok ? r.json() : []).then((d: Group[]) => { groups = d; }).catch(() => {});
  });

  function sinceFromRange(range: string): string | null {
    const now = Date.now();
    if (range === '1h') return new Date(now - 3600000).toISOString();
    if (range === '24h') return new Date(now - 86400000).toISOString();
    if (range === '7d') return new Date(now - 7 * 86400000).toISOString();
    if (range === '30d') return new Date(now - 30 * 86400000).toISOString();
    return null;
  }

  function buildUrl(): string {
    const p = new URLSearchParams();
    if (statusFilter) p.set('status', statusFilter);
    if (groupId) p.set('groupId', groupId);
    if (triggerFilter) p.set('trigger', triggerFilter);
    const since = sinceFromRange(timeRange);
    if (since) p.set('since', since);
    const qs = p.toString();
    return qs ? `/api/run-history?${qs}` : '/api/run-history';
  }

  let runs = $state<PollState<RunHistoryEntry[]>>({ data: null, loading: true, error: null, lastUpdated: null });

  $effect(() => {
    const url = buildUrl();
    const poller = createPoller<RunHistoryEntry[]>(
      (signal) => fetch(url, { signal }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      5000,
      (s) => { runs = s; }
    );
    return () => poller.stop();
  });

  function statusBadgeClass(s: RunHistoryEntry['run_status']): string {
    if (s === 'running') return 'bg-green-500/20 text-green-400 border border-green-500/30';
    if (s === 'success') return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    if (s === 'failed') return 'bg-red-500/20 text-red-400 border border-red-500/30';
    if (s === 'waiting') return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
    if (s === 'dropped') return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
    return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
  }

  function triggerBadgeClass(t: RunHistoryEntry['trigger_source']): string {
    if (t === 'scheduled') return 'text-purple-400';
    if (t === 'manual') return 'text-cyan-400';
    return 'text-[hsl(var(--muted-foreground))]';
  }

  function fmtDuration(s: number | null): string {
    if (s === null) return '—';
    if (s < 60) return `${Math.round(s)}s`;
    if (s < 3600) return `${Math.round(s / 60)}m`;
    return `${(s / 3600).toFixed(1)}h`;
  }

  function relTime(ts: string | null): string {
    if (!ts) return '—';
    try { return formatDistanceToNow(new Date(ts), { addSuffix: true }); } catch { return ts; }
  }
</script>

<svelte:head>
  <title>Run History · NanoClaw Dashboard</title>
</svelte:head>

<div class="mx-auto flex max-w-6xl flex-col gap-6 p-6">
  <h1 class="text-2xl font-semibold text-[hsl(var(--foreground))]">Run History</h1>

  <!-- Filters -->
  <section class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">

      <label class="flex flex-col gap-1 text-sm">
        <span class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Status</span>
        <select class="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] min-h-[44px] sm:min-h-0"
          bind:value={statusFilter}>
          <option value="">All statuses</option>
          <option value="running">Running</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="waiting">Waiting</option>
          <option value="dropped">Dropped</option>
        </select>
      </label>

      <label class="flex flex-col gap-1 text-sm">
        <span class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Group</span>
        <select class="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] min-h-[44px] sm:min-h-0"
          bind:value={groupId}>
          <option value="">All groups</option>
          {#each groups as g (g.id)}
            <option value={g.id}>{g.name}</option>
          {/each}
        </select>
      </label>

      <label class="flex flex-col gap-1 text-sm">
        <span class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Trigger</span>
        <select class="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] min-h-[44px] sm:min-h-0"
          bind:value={triggerFilter}>
          <option value="">All triggers</option>
          <option value="message">Message</option>
          <option value="scheduled">Scheduled</option>
          <option value="manual">Manual</option>
        </select>
      </label>

      <label class="flex flex-col gap-1 text-sm">
        <span class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Time</span>
        <select class="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] min-h-[44px] sm:min-h-0"
          bind:value={timeRange}>
          <option value="">All time</option>
          <option value="1h">Last hour</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
      </label>

    </div>
  </section>

  <!-- Table -->
  <section class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
    {#if runs.loading && !runs.data}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
    {:else if runs.error}
      <p class="text-sm text-red-400">Error: {runs.error}</p>
    {:else if !runs.data || runs.data.length === 0}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">No runs match these filters.</p>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-[hsl(var(--border))] text-left text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              <th class="pb-2 pr-4 font-medium">Status</th>
              <th class="pb-2 pr-4 font-medium">Group</th>
              <th class="pb-2 pr-4 font-medium">Trigger</th>
              <th class="pb-2 pr-4 font-medium">Duration</th>
              <th class="pb-2 pr-4 font-medium">Started</th>
              <th class="pb-2 pr-4 font-medium">Cost</th>
              <th class="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {#each runs.data as run (run.id + run.run_type)}
              <tr class="border-b border-[hsl(var(--border))]/40 hover:bg-[hsl(var(--muted))]/20">
                <td class="py-2 pr-4">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {statusBadgeClass(run.run_status)}">
                    {run.run_status}
                  </span>
                </td>
                <td class="py-2 pr-4 text-[hsl(var(--foreground))]">{run.group_name}</td>
                <td class="py-2 pr-4 text-xs {triggerBadgeClass(run.trigger_source)}">{run.trigger_source}</td>
                <td class="py-2 pr-4 text-[hsl(var(--muted-foreground))]">{fmtDuration(run.duration_s)}</td>
                <td class="py-2 pr-4 text-[hsl(var(--muted-foreground))]">{relTime(run.started_at)}</td>
                <td class="py-2 pr-4 text-[hsl(var(--muted-foreground))]">—</td>
                <td class="py-2 text-right">
                  {#if run.run_type === 'session'}
                    <a href="/sessions/{run.id}" class="text-xs text-[hsl(var(--accent-foreground))] hover:underline">View →</a>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if runs.data.length >= 200}
          <p class="mt-3 text-xs text-[hsl(var(--muted-foreground))]">Showing first 200 results — use filters to narrow.</p>
        {/if}
      </div>
    {/if}
  </section>
</div>
