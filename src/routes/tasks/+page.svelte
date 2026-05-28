<script lang="ts">
  import { createPoller, type PollState } from '$lib/poll';
  import type { ScheduledTask } from '$lib/types';
  import { formatDistanceToNow, format } from 'date-fns';

  let tasks = $state<PollState<ScheduledTask[]>>({ data: null, loading: true, error: null, lastUpdated: null });
  let expandedScript = $state<string | null>(null);

  $effect(() => {
    const p = createPoller<ScheduledTask[]>(
      signal => fetch('/api/tasks', { signal }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      15000,
      s => { tasks = s; }
    );
    return () => p.stop();
  });

  function fmt(ts: string): string {
    try { return formatDistanceToNow(new Date(ts), { addSuffix: true }); } catch { return ts; }
  }

  function fmtAbsolute(ts: string): string {
    try { return format(new Date(ts), 'MMM d, HH:mm'); } catch { return ts; }
  }

  function toggleScript(id: string) {
    expandedScript = expandedScript === id ? null : id;
  }
</script>

<svelte:head><title>Scheduled Tasks — NanoClaw</title></svelte:head>

<div class="p-6 space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold">Scheduled Tasks</h1>
      <p class="text-sm text-[hsl(var(--muted-foreground))] mt-1">
        Recurring and one-shot tasks scheduled by agents.
      </p>
    </div>
    {#if tasks.lastUpdated}
      <span class="text-xs text-[hsl(var(--muted-foreground))]">Updated {fmt(tasks.lastUpdated.toISOString())}</span>
    {/if}
  </div>

  {#if tasks.error}
    <div class="rounded-md bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">
      {tasks.error}
    </div>
  {:else if tasks.loading && !tasks.data}
    <div class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</div>
  {:else if !tasks.data || tasks.data.length === 0}
    <div class="rounded-md border border-[hsl(var(--border))] px-6 py-12 text-center text-[hsl(var(--muted-foreground))] text-sm">
      No scheduled tasks found.
    </div>
  {:else}
    <div class="rounded-md border border-[hsl(var(--border))] overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-[hsl(var(--muted))] border-b border-[hsl(var(--border))]">
          <tr>
            <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Group</th>
            <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Prompt</th>
            <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Recurrence</th>
            <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Next run</th>
            <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Status</th>
            <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Script</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[hsl(var(--border))]">
          {#each tasks.data as t}
            <tr class="hover:bg-[hsl(var(--muted)/0.5)] transition-colors">
              <td class="px-4 py-3 font-medium">{t.group_name}</td>
              <td class="px-4 py-3 max-w-xs">
                <p class="truncate text-[hsl(var(--foreground))]" title={t.prompt}>{t.prompt}</p>
                <p class="font-mono text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{t.id.slice(0, 8)}…</p>
              </td>
              <td class="px-4 py-3">
                {#if t.recurrence}
                  <code class="text-xs bg-[hsl(var(--accent))] px-1.5 py-0.5 rounded">{t.recurrence}</code>
                {:else}
                  <span class="text-[hsl(var(--muted-foreground))]">one-shot</span>
                {/if}
              </td>
              <td class="px-4 py-3 text-sm">
                {#if t.process_after}
                  <span title={t.process_after}>{fmtAbsolute(t.process_after)}</span>
                  <div class="text-xs text-[hsl(var(--muted-foreground))]">{fmt(t.process_after)}</div>
                {:else}
                  <span class="text-[hsl(var(--muted-foreground))]">—</span>
                {/if}
              </td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                  {t.status === 'pending'
                    ? 'bg-green-900/40 text-green-300 border border-green-700/40'
                    : 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/40'}">
                  {t.status}
                </span>
              </td>
              <td class="px-4 py-3">
                {#if t.script}
                  <button
                    onclick={() => toggleScript(t.id)}
                    class="text-xs text-[hsl(var(--muted-foreground))] underline hover:text-[hsl(var(--foreground))] transition-colors"
                  >
                    {expandedScript === t.id ? 'hide' : 'view'}
                  </button>
                {:else}
                  <span class="text-xs text-[hsl(var(--muted-foreground))]">none</span>
                {/if}
              </td>
            </tr>
            {#if expandedScript === t.id && t.script}
              <tr>
                <td colspan="6" class="px-4 pb-4">
                  <pre class="text-xs bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">{t.script}</pre>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
    <p class="text-xs text-[hsl(var(--muted-foreground))]">
      {tasks.data.length} task{tasks.data.length !== 1 ? 's' : ''} across all groups. One row per series — shows the live pending/paused occurrence.
    </p>
  {/if}
</div>
