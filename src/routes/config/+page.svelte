<script lang="ts">
  import { createPoller, type PollState } from '$lib/poll';
  import type { GroupConfig } from '$lib/types';

  let configs = $state<PollState<GroupConfig[]>>({ data: null, loading: true, error: null, lastUpdated: null });

  $effect(() => {
    const p = createPoller<GroupConfig[]>(
      (signal) => fetch('/api/config', { signal }).then(r => r.ok ? r.json() : []),
      30000,
      s => { configs = s; }
    );
    return () => p.stop();
  });

  function mcpCount(c: GroupConfig): number {
    return Object.keys(c.mcp_servers).length;
  }

  function skillsLabel(c: GroupConfig): string {
    if (c.skills === 'all') return 'All';
    if (Array.isArray(c.skills) && c.skills.length === 0) return 'None';
    return Array.isArray(c.skills) ? c.skills.join(', ') : String(c.skills);
  }
</script>

<svelte:head><title>Config Inventory — NanoClaw Dashboard</title></svelte:head>

<div class="mx-auto flex max-w-5xl flex-col gap-6 p-6">
  <h1 class="text-2xl font-semibold">Config Inventory</h1>
  <p class="text-sm text-[hsl(var(--muted-foreground))]">
    Skills and MCP server configuration across all groups. Skills are read-only here — manage them via config files. MCP servers can be added or removed on each group's detail page.
  </p>

  {#if configs.loading && !configs.data}
    <p class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
  {:else if configs.error}
    <p class="text-sm text-red-400">Failed to load: {configs.error}</p>
  {:else if !configs.data || configs.data.length === 0}
    <p class="text-sm text-[hsl(var(--muted-foreground))]">No groups found.</p>
  {:else}
    <section class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-[hsl(var(--card-foreground))]">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-[hsl(var(--border))] text-left text-[hsl(var(--muted-foreground))]">
              <th class="py-2 pr-6 font-medium whitespace-nowrap">Group</th>
              <th class="py-2 pr-6 font-medium whitespace-nowrap">Skills</th>
              <th class="py-2 pr-6 font-medium whitespace-nowrap">MCP Servers</th>
              <th class="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {#each configs.data as c (c.agent_group_id)}
              <tr class="border-b border-[hsl(var(--border))]/50 align-top">
                <td class="py-3 pr-6 font-medium">{c.group_name}</td>
                <td class="py-3 pr-6">
                  {#if c.skills === 'all'}
                    <span class="rounded-full bg-[hsl(var(--accent))] px-2 py-0.5 text-xs text-[hsl(var(--accent-foreground))]">All</span>
                  {:else if Array.isArray(c.skills) && c.skills.length === 0}
                    <span class="text-xs text-[hsl(var(--muted-foreground))]">None</span>
                  {:else if Array.isArray(c.skills)}
                    <div class="flex flex-wrap gap-1">
                      {#each c.skills as skill}
                        <span class="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs text-[hsl(var(--foreground))]">{skill}</span>
                      {/each}
                    </div>
                  {/if}
                </td>
                <td class="py-3 pr-6">
                  {#if mcpCount(c) === 0}
                    <span class="text-xs text-[hsl(var(--muted-foreground))]">None</span>
                  {:else}
                    <div class="flex flex-col gap-1">
                      {#each Object.entries(c.mcp_servers) as [name, cfg]}
                        <span class="text-xs">
                          <span class="font-medium">{name}</span>
                          <span class="ml-1 text-[hsl(var(--muted-foreground))]">{cfg.command ? '(stdio)' : cfg.url ? '(http)' : ''}</span>
                        </span>
                      {/each}
                    </div>
                  {/if}
                </td>
                <td class="py-3 text-right">
                  <a href={`/groups/${c.agent_group_id}`} class="text-xs text-[hsl(var(--accent-foreground))] hover:underline">Config →</a>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}
</div>
