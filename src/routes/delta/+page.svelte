<script lang="ts">
  import { createPoller, type PollState } from '$lib/poll';
  import type { DeltaView, DeltaSession, DeltaApproval } from '$lib/types';

  let poll = $state<PollState<DeltaView>>({ data: null, loading: true, error: null, lastUpdated: null });
  let marking = $state(false);

  const p = createPoller<DeltaView>(
    signal => fetch('/api/delta', { signal }).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }),
    30000,
    s => { poll = s; }
  );

  $effect(() => () => p.stop());

  async function markSeen() {
    marking = true;
    try {
      await fetch('/api/delta', { method: 'POST' });
      const r = await fetch('/api/delta');
      if (r.ok) {
        const data = (await r.json()) as DeltaView;
        poll = { ...poll, data, loading: false, error: null, lastUpdated: new Date() };
      }
    } finally {
      marking = false;
    }
  }

  function fmtTs(ts: string | null): string {
    if (!ts) return '—';
    return ts.replace('T', ' ').slice(0, 16);
  }

  function statusBadge(s: DeltaSession): string {
    const cs = s.container_status;
    if (cs === 'running') return 'bg-emerald-500/20 text-emerald-400';
    if (cs === 'error') return 'bg-red-500/20 text-red-400';
    if (cs === 'stopped') return 'bg-zinc-600/40 text-zinc-400';
    return 'bg-zinc-700/40 text-zinc-500';
  }

  function sessionLabel(s: DeltaSession): string {
    return s.id.slice(0, 8);
  }
</script>

<svelte:head><title>Delta View — NanoClaw</title></svelte:head>

<div class="p-6 space-y-6">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="text-lg font-semibold">What's New</h1>
      {#if poll.data?.baseline_ts}
        <p class="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
          Since {fmtTs(poll.data.baseline_ts)}
          {#if poll.data.total > 0}
            &mdash; <span class="text-[hsl(var(--foreground))] font-medium">{poll.data.total} change{poll.data.total === 1 ? '' : 's'}</span>
          {/if}
        </p>
      {/if}
    </div>
    <button
      onclick={markSeen}
      disabled={marking}
      class="shrink-0 h-8 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] disabled:opacity-50 transition-colors"
    >
      {marking ? 'Marking…' : 'Mark as seen'}
    </button>
  </div>

  {#if poll.loading && !poll.data}
    <p class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
  {:else if poll.error}
    <p class="text-sm text-red-400">Error: {poll.error}</p>
  {:else if poll.data}
    {#if poll.data.total === 0}
      <div class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-5 py-8 text-center">
        <p class="text-sm font-medium text-[hsl(var(--foreground))]">Nothing new</p>
        <p class="text-xs text-[hsl(var(--muted-foreground))] mt-1">
          No changes since {fmtTs(poll.data.baseline_ts)}
        </p>
      </div>
    {:else}

      <!-- New Sessions -->
      {#if poll.data.new_sessions.length > 0}
        <section class="space-y-2">
          <h2 class="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            New Sessions ({poll.data.new_sessions.length})
          </h2>
          <div class="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
            <table class="w-full text-sm">
              <thead class="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
                <tr>
                  <th class="px-3 py-2 text-left text-xs text-[hsl(var(--muted-foreground))] font-medium">Session</th>
                  <th class="px-3 py-2 text-left text-xs text-[hsl(var(--muted-foreground))] font-medium">Group</th>
                  <th class="px-3 py-2 text-left text-xs text-[hsl(var(--muted-foreground))] font-medium">Status</th>
                  <th class="px-3 py-2 text-left text-xs text-[hsl(var(--muted-foreground))] font-medium">Started</th>
                </tr>
              </thead>
              <tbody>
                {#each poll.data.new_sessions as s}
                  <tr class="border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--muted))/50]">
                    <td class="px-3 py-2">
                      <a href="/sessions/{s.id}" class="font-mono text-xs text-blue-400 hover:underline">{sessionLabel(s)}</a>
                    </td>
                    <td class="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                      <a href="/groups/{s.group_id}" class="hover:text-[hsl(var(--foreground))]">{s.group_name}</a>
                    </td>
                    <td class="px-3 py-2">
                      <span class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold {statusBadge(s)}">
                        {s.container_status ?? '—'}
                      </span>
                    </td>
                    <td class="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">{fmtTs(s.created_at)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>
      {/if}

      <!-- Status Changes (completed/errored since baseline) -->
      {#if poll.data.completed_since.length > 0}
        <section class="space-y-2">
          <h2 class="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Status Changes ({poll.data.completed_since.length})
          </h2>
          <p class="text-[11px] text-[hsl(var(--muted-foreground))]">Sessions that were already running when you last looked and have since completed or errored.</p>
          <div class="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
            <table class="w-full text-sm">
              <thead class="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
                <tr>
                  <th class="px-3 py-2 text-left text-xs text-[hsl(var(--muted-foreground))] font-medium">Session</th>
                  <th class="px-3 py-2 text-left text-xs text-[hsl(var(--muted-foreground))] font-medium">Group</th>
                  <th class="px-3 py-2 text-left text-xs text-[hsl(var(--muted-foreground))] font-medium">Status</th>
                  <th class="px-3 py-2 text-left text-xs text-[hsl(var(--muted-foreground))] font-medium">Completed</th>
                </tr>
              </thead>
              <tbody>
                {#each poll.data.completed_since as s}
                  <tr class="border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--muted))/50]">
                    <td class="px-3 py-2">
                      <a href="/sessions/{s.id}" class="font-mono text-xs text-blue-400 hover:underline">{sessionLabel(s)}</a>
                    </td>
                    <td class="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                      <a href="/groups/{s.group_id}" class="hover:text-[hsl(var(--foreground))]">{s.group_name}</a>
                    </td>
                    <td class="px-3 py-2">
                      <span class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold {statusBadge(s)}">
                        {s.container_status ?? '—'}
                      </span>
                    </td>
                    <td class="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">{fmtTs(s.last_active)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>
      {/if}

      <!-- New Approvals -->
      {#if poll.data.new_approvals.length > 0}
        <section class="space-y-2">
          <h2 class="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            New Approvals ({poll.data.new_approvals.length})
          </h2>
          <div class="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
            <table class="w-full text-sm">
              <thead class="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
                <tr>
                  <th class="px-3 py-2 text-left text-xs text-[hsl(var(--muted-foreground))] font-medium">Action</th>
                  <th class="px-3 py-2 text-left text-xs text-[hsl(var(--muted-foreground))] font-medium">Group</th>
                  <th class="px-3 py-2 text-left text-xs text-[hsl(var(--muted-foreground))] font-medium">Requested</th>
                </tr>
              </thead>
              <tbody>
                {#each poll.data.new_approvals as a}
                  <tr class="border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--muted))/50]">
                    <td class="px-3 py-2">
                      <a href="/approvals" class="text-xs text-amber-400 hover:underline">
                        {a.title || a.action}
                      </a>
                    </td>
                    <td class="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                      {#if a.group_id}
                        <a href="/groups/{a.group_id}" class="hover:text-[hsl(var(--foreground))]">{a.group_name ?? a.group_id}</a>
                      {:else}
                        —
                      {/if}
                    </td>
                    <td class="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">{fmtTs(a.created_at)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>
      {/if}

    {/if}
  {/if}
</div>
