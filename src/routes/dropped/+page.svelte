<script lang="ts">
  import { createPoller, type PollState } from '$lib/poll';
  import type { UnregisteredSender, Group } from '$lib/types';
  import { formatDistanceToNow } from 'date-fns';

  let senders = $state<PollState<UnregisteredSender[]>>({ data: null, loading: true, error: null, lastUpdated: null });
  let groups = $state<Group[]>([]);

  let groupFilter = $state('');
  let channelFilter = $state('');

  function buildUrl(): string {
    const p = new URLSearchParams();
    if (groupFilter) p.set('groupId', groupFilter);
    if (channelFilter) p.set('channelType', channelFilter);
    const qs = p.toString();
    return `/api/dropped${qs ? '?' + qs : ''}`;
  }

  $effect(() => {
    fetch('/api/groups').then(r => r.json()).then((data: Group[]) => { groups = data; }).catch(() => {});
  });

  $effect(() => {
    const url = buildUrl();
    const p = createPoller<UnregisteredSender[]>(
      signal => fetch(url, { signal }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      10000,
      s => { senders = s; }
    );
    return () => p.stop();
  });

  const channelTypes = $derived(
    [...new Set((senders.data ?? []).map(s => s.channel_type))].sort()
  );

  function fmt(ts: string): string {
    try { return formatDistanceToNow(new Date(ts), { addSuffix: true }); } catch { return ts; }
  }

  function reasonLabel(r: string): string {
    const map: Record<string, string> = {
      unknown_sender: 'Unknown sender',
      not_member: 'Not a member',
      strict_policy: 'Strict policy',
      rate_limited: 'Rate limited'
    };
    return map[r] ?? r;
  }
</script>

<svelte:head><title>Dropped Messages — NanoClaw</title></svelte:head>

<div class="p-6 space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold">Dropped Messages</h1>
      <p class="text-sm text-[hsl(var(--muted-foreground))] mt-1">
        Inbound messages rejected due to unknown or unauthorized senders.
      </p>
    </div>
    {#if senders.lastUpdated}
      <span class="text-xs text-[hsl(var(--muted-foreground))]">Updated {fmt(senders.lastUpdated.toISOString())}</span>
    {/if}
  </div>

  <!-- Filters -->
  <div class="flex flex-wrap gap-3">
    <select
      bind:value={groupFilter}
      class="px-3 py-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-sm focus:outline-none"
    >
      <option value="">All groups</option>
      {#each groups as g}
        <option value={g.id}>{g.name}</option>
      {/each}
    </select>

    <select
      bind:value={channelFilter}
      class="px-3 py-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-sm focus:outline-none"
    >
      <option value="">All channels</option>
      {#each channelTypes as ct}
        <option value={ct}>{ct}</option>
      {/each}
    </select>
  </div>

  {#if senders.error}
    <div class="rounded-md bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">
      {senders.error}
    </div>
  {:else if senders.loading && !senders.data}
    <div class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</div>
  {:else if !senders.data || senders.data.length === 0}
    <div class="rounded-md border border-[hsl(var(--border))] px-6 py-12 text-center text-[hsl(var(--muted-foreground))] text-sm">
      No dropped messages found.
    </div>
  {:else}
    <div class="rounded-md border border-[hsl(var(--border))] overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-[hsl(var(--muted))] border-b border-[hsl(var(--border))]">
          <tr>
            <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Sender</th>
            <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Channel</th>
            <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Reason</th>
            <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Group</th>
            <th class="text-right px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Count</th>
            <th class="text-right px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Last seen</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[hsl(var(--border))]">
          {#each senders.data as s}
            <tr class="hover:bg-[hsl(var(--muted)/0.5)] transition-colors">
              <td class="px-4 py-3">
                <div class="font-mono text-xs">{s.platform_id}</div>
                {#if s.sender_name}
                  <div class="text-[hsl(var(--muted-foreground))] text-xs mt-0.5">{s.sender_name}</div>
                {/if}
              </td>
              <td class="px-4 py-3 text-[hsl(var(--muted-foreground))]">{s.channel_type}</td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-900/40 text-amber-300 border border-amber-700/40">
                  {reasonLabel(s.reason)}
                </span>
              </td>
              <td class="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                {s.group_name ?? '—'}
              </td>
              <td class="px-4 py-3 text-right font-mono text-xs">{s.message_count}</td>
              <td class="px-4 py-3 text-right text-[hsl(var(--muted-foreground))] text-xs">{fmt(s.last_seen)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="text-xs text-[hsl(var(--muted-foreground))]">
      Showing {senders.data.length} sender{senders.data.length !== 1 ? 's' : ''}.
      Counts are cumulative — each row represents one unique sender identity.
    </p>
  {/if}
</div>
