<script lang="ts">
  import { createPoller, type PollState } from '$lib/poll';
  import type { Group } from '$lib/types';
  import { formatDistanceToNow } from 'date-fns';

  let groups = $state<PollState<Group[]>>({ data: null, loading: true, error: null, lastUpdated: null });

  $effect(() => {
    const p = createPoller<Group[]>(
      (signal) =>
        fetch('/api/groups', { signal }).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        }),
      5000,
      (s) => { groups = s; }
    );
    return () => p.stop();
  });

  function statusColor(status: Group['container_status']): string {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'error':   return 'bg-red-500';
      default:        return 'bg-gray-500';
    }
  }

  function statusLabel(status: Group['container_status']): string {
    return status ?? 'unknown';
  }
</script>

<div class="p-8">
  <div class="max-w-5xl mx-auto">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-[hsl(var(--foreground))]">Agent Groups</h1>
      <p class="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
        {#if groups.lastUpdated}
          Updated {groups.lastUpdated.toLocaleTimeString()}
        {:else}
          Loading…
        {/if}
      </p>
    </div>

    {#if groups.loading}
      <div class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <p class="text-sm text-[hsl(var(--muted-foreground))]">Loading groups…</p>
      </div>
    {:else if groups.error}
      <div class="rounded-lg border border-red-800 bg-[hsl(var(--card))] p-6">
        <p class="text-sm text-red-400">Error: {groups.error}</p>
      </div>
    {:else if groups.data}
      {#if groups.data.length === 0}
        <div class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
          <p class="text-sm text-[hsl(var(--muted-foreground))]">No agent groups found.</p>
        </div>
      {:else}
        <div class="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
                <th class="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Name</th>
                <th class="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Status</th>
                <th class="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Provider</th>
                <th class="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {#each groups.data as group}
                <tr class="border-b border-[hsl(var(--border))] last:border-0 bg-[hsl(var(--card))] hover:bg-[hsl(var(--accent))] transition-colors">
                  <td class="px-4 py-3">
                    <a href="/groups/{group.id}" class="font-medium text-[hsl(var(--foreground))] hover:underline">
                      {group.name}
                    </a>
                    <p class="text-xs text-[hsl(var(--muted-foreground))]">{group.folder}</p>
                  </td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center gap-1.5">
                      <span class="h-2 w-2 rounded-full {statusColor(group.container_status)}"></span>
                      <span class="text-[hsl(var(--foreground))] capitalize">{statusLabel(group.container_status)}</span>
                    </span>
                  </td>
                  <td class="px-4 py-3 text-[hsl(var(--muted-foreground))]">{group.agent_provider}</td>
                  <td class="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {#if group.last_active}
                      {formatDistanceToNow(new Date(group.last_active), { addSuffix: true })}
                    {:else}
                      —
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    {/if}
  </div>
</div>
