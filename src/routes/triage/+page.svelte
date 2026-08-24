<script lang="ts">
  import { createPoller, type PollState } from '$lib/poll';
  import { formatDistanceToNow } from 'date-fns';
  import type { TriageResponse, TriageItem, TriageItemType } from '$lib/types';

  let triage = $state<PollState<TriageResponse>>({ data: null, loading: true, error: null, lastUpdated: null });

  const poller = createPoller<TriageResponse>(
    (signal) => fetch('/api/triage', { signal }).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }),
    5000,
    (s) => { triage = s; }
  );

  $effect(() => () => poller.stop());

  let snoozeOpen = $state<string | null>(null); // item_key with snooze menu open
  let acting = $state<Set<string>>(new Set());

  function markActing(key: string) {
    acting = new Set([...acting, key]);
  }
  function clearActing(key: string) {
    acting = new Set([...acting].filter(k => k !== key));
  }

  async function snooze(item: TriageItem, minutes: number) {
    snoozeOpen = null;
    markActing(item.item_key);
    try {
      await fetch('/api/triage/snooze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_key: item.item_key, minutes })
      });
    } finally {
      clearActing(item.item_key);
    }
  }

  async function dismiss(item: TriageItem) {
    markActing(item.item_key);
    try {
      await fetch('/api/triage/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_key: item.item_key })
      });
    } finally {
      clearActing(item.item_key);
    }
  }

  function typeLabel(t: TriageItemType): string {
    if (t === 'approval') return 'Approval';
    if (t === 'dropped') return 'Dropped';
    if (t === 'stalled') return 'Stalled';
    if (t === 'overdue_task') return 'Overdue';
    return t;
  }

  function typeBadgeClass(t: TriageItemType): string {
    if (t === 'approval') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    if (t === 'dropped') return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    if (t === 'stalled') return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (t === 'overdue_task') return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }

  function priorityDot(p: TriageItem['priority']): string {
    if (p === 'high') return 'bg-red-500';
    if (p === 'medium') return 'bg-yellow-500';
    return 'bg-gray-500';
  }

  function viewHref(item: TriageItem): string | null {
    if (item.item_type === 'approval') return '/approvals';
    if (item.item_type === 'stalled' && item.session_id) return `/sessions/${item.session_id}`;
    if (item.item_type === 'dropped') return '/dropped';
    if (item.item_type === 'overdue_task') return '/tasks';
    return null;
  }

  function relTime(ts: string): string {
    try { return formatDistanceToNow(new Date(ts), { addSuffix: true }); } catch { return ts; }
  }
</script>

<svelte:head>
  <title>Triage Inbox · NanoClaw Dashboard</title>
</svelte:head>

<div class="mx-auto flex max-w-4xl flex-col gap-6 p-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold text-[hsl(var(--foreground))]">Triage Inbox</h1>
      {#if triage.data}
        <p class="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          {triage.data.counts.total} item{triage.data.counts.total !== 1 ? 's' : ''} need attention
          {#if !triage.data.state_available}
            · <span class="text-yellow-400">Snooze/dismiss unavailable — DASHBOARD_DB not set</span>
          {/if}
        </p>
      {/if}
    </div>
    {#if triage.lastUpdated}
      <p class="text-xs text-[hsl(var(--muted-foreground))]">Updated {triage.lastUpdated.toLocaleTimeString()}</p>
    {/if}
  </div>

  <!-- Type counts -->
  {#if triage.data && triage.data.counts.total > 0}
    <div class="flex flex-wrap gap-2">
      {#if triage.data.counts.approval > 0}
        <span class="inline-flex items-center gap-1 rounded border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-1 text-xs text-yellow-400">
          {triage.data.counts.approval} Approval{triage.data.counts.approval !== 1 ? 's' : ''}
        </span>
      {/if}
      {#if triage.data.counts.stalled > 0}
        <span class="inline-flex items-center gap-1 rounded border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-400">
          {triage.data.counts.stalled} Stalled
        </span>
      {/if}
      {#if triage.data.counts.overdue_task > 0}
        <span class="inline-flex items-center gap-1 rounded border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-xs text-purple-400">
          {triage.data.counts.overdue_task} Overdue
        </span>
      {/if}
      {#if triage.data.counts.dropped > 0}
        <span class="inline-flex items-center gap-1 rounded border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-xs text-orange-400">
          {triage.data.counts.dropped} Dropped
        </span>
      {/if}
    </div>
  {/if}

  {#if triage.loading && !triage.data}
    <div class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 text-center">
      <p class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
    </div>
  {:else if triage.error}
    <div class="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
      <p class="text-sm text-red-400">Error: {triage.error}</p>
    </div>
  {:else if triage.data && triage.data.items.length === 0}
    <div class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-12 text-center">
      <p class="text-4xl mb-3">✓</p>
      <p class="text-lg font-medium text-[hsl(var(--foreground))]">All clear</p>
      <p class="mt-1 text-sm text-[hsl(var(--muted-foreground))]">No items need attention right now.</p>
    </div>
  {:else if triage.data}
    <div class="flex flex-col gap-2">
      {#each triage.data.items as item (item.item_key)}
        {@const isActing = acting.has(item.item_key)}
        <div class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 transition-opacity {isActing ? 'opacity-50' : ''}">
          <div class="flex items-start gap-3">
            <!-- Priority dot -->
            <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full {priorityDot(item.priority)}"></span>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-2 mb-1">
                <span class="inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium {typeBadgeClass(item.item_type)}">
                  {typeLabel(item.item_type)}
                </span>
                {#if item.group_name}
                  <span class="text-xs text-[hsl(var(--muted-foreground))]">{item.group_name}</span>
                {/if}
                <span class="text-xs text-[hsl(var(--muted-foreground))]">{relTime(item.occurred_at)}</span>
              </div>
              <p class="text-sm font-medium text-[hsl(var(--foreground))] truncate">{item.title}</p>
              <p class="mt-0.5 text-xs text-[hsl(var(--muted-foreground))] line-clamp-2">{item.description}</p>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-1 shrink-0">
              {#if viewHref(item)}
                <a
                  href={viewHref(item)}
                  class="rounded px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
                >
                  View
                </a>
              {/if}

              <!-- Snooze -->
              <div class="relative">
                <button
                  onclick={() => snoozeOpen = snoozeOpen === item.item_key ? null : item.item_key}
                  disabled={isActing}
                  class="rounded px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors disabled:opacity-50"
                >
                  Snooze
                </button>
                {#if snoozeOpen === item.item_key}
                  <div class="absolute right-0 top-full mt-1 z-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg py-1 min-w-[120px]">
                    {#each [[60, '1 hour'], [240, '4 hours'], [1440, '24 hours'], [10080, '7 days']] as [mins, label]}
                      <button
                        onclick={() => snooze(item, mins)}
                        class="w-full px-3 py-1.5 text-left text-xs text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
                      >
                        {label}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>

              <!-- Dismiss -->
              <button
                onclick={() => dismiss(item)}
                disabled={isActing}
                class="rounded px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Close snooze menu on outside click -->
{#if snoozeOpen !== null}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-[5]" onclick={() => snoozeOpen = null}></div>
{/if}
