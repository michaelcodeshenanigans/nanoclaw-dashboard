<script lang="ts">
  import { createPoller } from '$lib/poll';
  import { formatDistanceToNow } from 'date-fns';
  import type { Group, SessionWithGroup } from '$lib/types';

  // Filter state — read inside fetchFn so each poll cycle uses current values.
  let groupId = $state<number | null>(null);
  let containerStatus = $state<string | null>(null);
  let timeRange = $state<string | null>(null); // null | "1h" | "24h" | "7d"

  // Groups dropdown — fetched once on first run.
  let groups = $state<Group[]>([]);
  let groupsLoaded = $state(false);

  $effect(() => {
    if (groupsLoaded) return;
    fetch('/api/groups')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Group[]) => {
        groups = data;
        groupsLoaded = true;
      })
      .catch(() => {
        groupsLoaded = true;
      });
  });

  function sinceFromRange(range: string | null): string | null {
    if (!range) return null;
    const now = Date.now();
    let ms = 0;
    if (range === '1h') ms = 60 * 60 * 1000;
    else if (range === '24h') ms = 24 * 60 * 60 * 1000;
    else if (range === '7d') ms = 7 * 24 * 60 * 60 * 1000;
    else return null;
    return new Date(now - ms).toISOString();
  }

  function buildUrl(): string {
    const params = new URLSearchParams();
    if (groupId !== null) params.set('groupId', String(groupId));
    if (containerStatus) params.set('containerStatus', containerStatus);
    const since = sinceFromRange(timeRange);
    if (since) params.set('since', since);
    const qs = params.toString();
    return qs ? `/api/sessions?${qs}` : '/api/sessions';
  }

  // fetchFn closes over the reactive filter state — createPoller calls it each
  // interval, so updated filters take effect on the next poll automatically.
  const sessions = createPoller<SessionWithGroup[]>(
    (signal) => fetch(buildUrl(), { signal }).then((r) => r.json()),
    5000
  );

  function statusClass(status: string | null | undefined): string {
    if (status === 'running') return 'bg-green-500';
    if (status === 'error') return 'bg-red-500';
    return 'bg-gray-500';
  }

  function statusLabel(status: string | null | undefined): string {
    if (!status) return 'stopped';
    return status;
  }

  function truncate(s: string | null | undefined, n = 12): string {
    if (!s) return '—';
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  function relativeTime(ts: string | null | undefined): string {
    if (!ts) return '—';
    try {
      return formatDistanceToNow(new Date(ts), { addSuffix: true });
    } catch {
      return ts;
    }
  }
</script>

<svelte:head>
  <title>Sessions · NanoClaw Dashboard</title>
</svelte:head>

<div class="mx-auto flex max-w-6xl flex-col gap-6 p-6">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-semibold text-[hsl(var(--foreground))]">Sessions</h1>
  </div>

  <!-- Filters -->
  <section
    class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-[hsl(var(--card-foreground))]"
  >
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <label class="flex flex-col gap-1 text-sm">
        <span class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          Group
        </span>
        <select
          class="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
          bind:value={groupId}
        >
          <option value={null}>All groups</option>
          {#each groups as g (g.id)}
            <option value={g.id}>{g.name}</option>
          {/each}
        </select>
      </label>

      <label class="flex flex-col gap-1 text-sm">
        <span class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          Status
        </span>
        <select
          class="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
          bind:value={containerStatus}
        >
          <option value={null}>All statuses</option>
          <option value="running">running</option>
          <option value="stopped">stopped</option>
          <option value="error">error</option>
        </select>
      </label>

      <label class="flex flex-col gap-1 text-sm">
        <span class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          Time
        </span>
        <select
          class="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
          bind:value={timeRange}
        >
          <option value={null}>All time</option>
          <option value="1h">Last hour</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 days</option>
        </select>
      </label>
    </div>
  </section>

  <!-- Sessions table -->
  <section
    class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-[hsl(var(--card-foreground))]"
  >
    {#if sessions.loading && !sessions.data}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
    {:else if sessions.error}
      <p class="text-sm text-red-500">Failed to load sessions: {sessions.error}</p>
    {:else if !sessions.data || sessions.data.length === 0}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">No sessions match these filters.</p>
    {:else}
      <table class="w-full text-sm">
        <thead>
          <tr
            class="border-b border-[hsl(var(--border))] text-left text-[hsl(var(--muted-foreground))]"
          >
            <th class="py-2 font-medium">Group</th>
            <th class="py-2 font-medium">Thread ID</th>
            <th class="py-2 font-medium">Status</th>
            <th class="py-2 font-medium">Last active</th>
            <th class="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {#each sessions.data as s (s.id)}
            <tr class="border-b border-[hsl(var(--border))]/50">
              <td class="py-2">{s.group_name ?? '—'}</td>
              <td class="py-2 font-mono text-xs">{truncate(s.thread_id, 16)}</td>
              <td class="py-2">
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white {statusClass(
                    s.container_status
                  )}"
                >
                  {statusLabel(s.container_status)}
                </span>
              </td>
              <td class="py-2 text-[hsl(var(--muted-foreground))]">
                {relativeTime(s.last_active)}
              </td>
              <td class="py-2 text-right">
                <a
                  href={`/sessions/${s.id}`}
                  class="text-sm text-[hsl(var(--accent-foreground))] hover:underline"
                >
                  View →
                </a>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>
</div>
