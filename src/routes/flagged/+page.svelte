<script lang="ts">
  import { createPoller, type PollState } from '$lib/poll';
  import { formatDistanceToNow } from 'date-fns';
  import type { Annotation } from '$lib/types';

  let tagFilter = $state('');
  let ratingFilter = $state('');

  function buildUrl(): string {
    const params = new URLSearchParams();
    if (tagFilter.trim()) params.set('tag', tagFilter.trim());
    if (ratingFilter !== '') params.set('rating', ratingFilter);
    const qs = params.toString();
    return qs ? `/api/annotations/flagged?${qs}` : '/api/annotations/flagged';
  }

  let flagged = $state<PollState<Annotation[]>>({ data: null, loading: true, error: null, lastUpdated: null });

  $effect(() => {
    const url = buildUrl();
    const p = createPoller<Annotation[]>(
      (signal) => fetch(url, { signal }).then(r => r.ok ? r.json() : []),
      30000,
      s => { flagged = s; }
    );
    return () => p.stop();
  });

  function rel(ts: string): string {
    try { return formatDistanceToNow(new Date(ts), { addSuffix: true }); } catch { return ts; }
  }

  function targetHref(a: Annotation): string {
    if (a.target_type === 'session') return `/sessions/${a.target_id}`;
    if (a.session_id) return `/sessions/${a.session_id}/messages`;
    return '#';
  }
</script>

<svelte:head><title>Flagged — NanoClaw Dashboard</title></svelte:head>

<div class="mx-auto flex max-w-5xl flex-col gap-6 p-6">
  <h1 class="text-2xl font-semibold">Flagged</h1>

  <!-- Filters -->
  <section class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 text-[hsl(var(--card-foreground))]">
    <div class="flex flex-wrap gap-4">
      <label class="flex flex-col gap-1 text-sm min-w-48">
        <span class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Tag</span>
        <input
          type="text"
          bind:value={tagFilter}
          placeholder="Filter by tag…"
          class="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
        />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Rating</span>
        <select
          bind:value={ratingFilter}
          class="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm text-[hsl(var(--foreground))]"
        >
          <option value="">Any</option>
          <option value="1">👍 Thumbs up</option>
          <option value="-1">👎 Thumbs down</option>
        </select>
      </label>
    </div>
  </section>

  <!-- List -->
  {#if flagged.loading && !flagged.data}
    <p class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
  {:else if flagged.error}
    <p class="text-sm text-red-400">Failed to load: {flagged.error}</p>
  {:else if !flagged.data || flagged.data.length === 0}
    <div class="rounded-lg border border-[hsl(var(--border))] px-6 py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
      No flagged items yet. Bookmark or annotate sessions and messages to see them here.
    </div>
  {:else}
    <div class="flex flex-col gap-3">
      {#each flagged.data as a (a.id)}
        <div class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 text-[hsl(var(--card-foreground))]">
          <div class="flex items-start justify-between gap-3">
            <div class="flex min-w-0 flex-col gap-1">
              <div class="flex items-center gap-2">
                {#if a.bookmarked}<span class="text-yellow-400">★</span>{/if}
                {#if a.rating === 1}<span class="text-green-400 text-sm">👍</span>
                {:else if a.rating === -1}<span class="text-red-400 text-sm">👎</span>{/if}
                <span class="text-xs rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[hsl(var(--muted-foreground))]">
                  {a.target_type}
                </span>
                <span class="text-sm font-medium truncate">
                  {a.display_label ?? a.target_id.slice(0, 20) + '…'}
                </span>
              </div>
              {#if a.tags.length > 0}
                <div class="flex flex-wrap gap-1">
                  {#each a.tags as tag}
                    <span class="rounded-full bg-[hsl(var(--accent))] px-2 py-0.5 text-xs text-[hsl(var(--accent-foreground))]">{tag}</span>
                  {/each}
                </div>
              {/if}
              {#if a.note}
                <p class="text-sm text-[hsl(var(--muted-foreground))] line-clamp-2">{a.note}</p>
              {/if}
            </div>
            <div class="flex shrink-0 flex-col items-end gap-2">
              <span class="text-xs text-[hsl(var(--muted-foreground))]">{rel(a.updated_at)}</span>
              <a
                href={targetHref(a)}
                class="text-xs text-[hsl(var(--accent-foreground))] hover:underline"
              >View →</a>
            </div>
          </div>
        </div>
      {/each}
    </div>
    <p class="text-xs text-[hsl(var(--muted-foreground))]">
      {flagged.data.length} flagged item{flagged.data.length !== 1 ? 's' : ''}
    </p>
  {/if}
</div>
