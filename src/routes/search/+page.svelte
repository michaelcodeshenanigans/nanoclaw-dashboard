<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import type { SearchResult } from '$lib/types';

  interface SearchResponse { query: string; results: SearchResult[] }

  let query = $state((page.url.searchParams.get('q') ?? '').trim());
  let inputVal = $state(query);
  let results = $state<SearchResult[]>([]);
  let loading = $state(false);
  let error = $state('');
  let searched = $state(false);

  $effect(() => {
    const q = page.url.searchParams.get('q')?.trim() ?? '';
    query = q;
    inputVal = q;
    if (q.length >= 2) {
      doSearch(q);
    } else {
      results = [];
      searched = false;
    }
  });

  async function doSearch(q: string) {
    loading = true;
    error = '';
    searched = false;
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=50`);
      if (!res.ok) {
        const text = await res.text();
        error = text || `HTTP ${res.status}`;
        results = [];
      } else {
        const data: SearchResponse = await res.json();
        results = data.results;
        searched = true;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Search failed';
      results = [];
    } finally {
      loading = false;
    }
  }

  function onSubmit(e: Event) {
    e.preventDefault();
    const q = inputVal.trim();
    if (q.length < 2) return;
    goto(`/search?q=${encodeURIComponent(q)}`, { replaceState: false });
  }

  function resultHref(r: SearchResult): string {
    if (r.type === 'group') return `/groups/${r.entity_id}`;
    if (r.type === 'session') return `/sessions/${r.entity_id}`;
    if (r.type === 'task') return `/tasks`;
    if (r.type === 'message') {
      const q = query ? `?search=${encodeURIComponent(query)}` : '';
      return `/sessions/${r.session_id}/messages${q}`;
    }
    return '/';
  }

  type TypeKey = SearchResult['type'];

  const TYPE_LABEL: Record<TypeKey, string> = {
    group: 'Group',
    session: 'Session',
    task: 'Task',
    message: 'Message'
  };

  const TYPE_CLASS: Record<TypeKey, string> = {
    group: 'bg-purple-900/30 text-purple-300',
    session: 'bg-blue-900/30 text-blue-300',
    task: 'bg-amber-900/30 text-amber-300',
    message: 'bg-zinc-800 text-zinc-300'
  };

  function grouped(): Array<{ type: TypeKey; items: SearchResult[] }> {
    const map = new Map<TypeKey, SearchResult[]>();
    for (const r of results) {
      const list = map.get(r.type) ?? [];
      list.push(r);
      map.set(r.type, list);
    }
    const order: TypeKey[] = ['message', 'session', 'group', 'task'];
    return order.filter(t => map.has(t)).map(t => ({ type: t, items: map.get(t)! }));
  }

  function highlight(text: string, q: string): string {
    if (!q || !text) return text;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="bg-yellow-400/30 text-yellow-200 rounded">$1</mark>');
  }
</script>

<svelte:head><title>{query ? `"${query}" — Search` : 'Search'} — NanoClaw</title></svelte:head>

<div class="p-6 space-y-6">
  <div class="flex items-center gap-3">
    <h1 class="text-lg font-semibold shrink-0">Search</h1>
    <form onsubmit={onSubmit} class="flex-1 max-w-xl">
      <div class="relative">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="9" cy="9" r="6"/><path d="M15 15l3 3"/>
        </svg>
        <input
          type="search"
          bind:value={inputVal}
          placeholder="Search groups, sessions, tasks, messages…"
          class="w-full h-10 pl-9 pr-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          autofocus
        />
      </div>
    </form>
  </div>

  {#if loading}
    <div class="text-sm text-[hsl(var(--muted-foreground))]">Searching…</div>
  {:else if error}
    <div class="rounded-md bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">{error}</div>
  {:else if searched && results.length === 0}
    <div class="rounded-md border border-[hsl(var(--border))] px-6 py-12 text-center text-[hsl(var(--muted-foreground))] text-sm">
      No results for <strong class="text-[hsl(var(--foreground))]">"{query}"</strong>.
      <p class="mt-1 text-xs">The search index builds incrementally — try again in a minute if this is a new message.</p>
    </div>
  {:else if searched}
    <p class="text-sm text-[hsl(var(--muted-foreground))]">{results.length} result{results.length !== 1 ? 's' : ''} for <strong class="text-[hsl(var(--foreground))]">"{query}"</strong></p>

    {#each grouped() as group}
      <section class="space-y-1">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] px-1">{TYPE_LABEL[group.type]}s</h2>
        <div class="rounded-md border border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))]">
          {#each group.items as r (r.entity_id)}
            <a
              href={resultHref(r)}
              class="flex items-start gap-3 px-4 py-3 hover:bg-[hsl(var(--muted)/0.5)] transition-colors group/row"
            >
              <span class="mt-0.5 shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium {TYPE_CLASS[r.type]}">{TYPE_LABEL[r.type]}</span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium leading-snug truncate group-hover/row:text-[hsl(var(--primary))]">
                  {@html highlight(r.title, query)}
                </p>
                {#if r.body}
                  <p class="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2">
                    {@html highlight(r.body.slice(0, 200), query)}
                  </p>
                {/if}
              </div>
              <span class="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">
                {r.ts ? r.ts.slice(0, 10) : ''}
              </span>
            </a>
          {/each}
        </div>
      </section>
    {/each}
  {:else if !query}
    <div class="text-sm text-[hsl(var(--muted-foreground))]">Enter at least 2 characters to search.</div>
  {/if}
</div>
