<script lang="ts">
  import { page } from '$app/stores';
  import { createPoller } from '$lib/poll';
  import { format } from 'date-fns';
  import type { Message } from '$lib/types';

  const id = $page.params.id;

  // Filter state — read inside fetchFn on each poll.
  let search = $state('');
  let kind = $state('');
  let timeRange = $state('');

  function sinceFromRange(range: string): string {
    if (!range) return '';
    const now = Date.now();
    let ms = 0;
    if (range === '1h') ms = 60 * 60 * 1000;
    else if (range === '24h') ms = 24 * 60 * 60 * 1000;
    else if (range === '7d') ms = 7 * 24 * 60 * 60 * 1000;
    return ms ? new Date(now - ms).toISOString() : '';
  }

  function buildUrl(): string {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (kind) params.set('kind', kind);
    const since = sinceFromRange(timeRange);
    if (since) params.set('since', since);
    params.set('limit', '200');
    const qs = params.toString();
    return qs ? `/api/sessions/${id}/messages?${qs}` : `/api/sessions/${id}/messages`;
  }

  const messages = createPoller<Message[]>(
    (signal) => fetch(buildUrl(), { signal }).then((r) => r.json()),
    5000
  );

  function truncate(s: string, n = 200): string {
    if (s.length <= n) return s;
    return s.slice(0, n) + '…';
  }

  function formatTs(ts: string): string {
    try {
      return format(new Date(ts), 'HH:mm:ss');
    } catch {
      return ts;
    }
  }

  function directionLabel(dir: string): string {
    return dir === 'in' ? 'inbound' : 'outbound';
  }

  function directionClass(dir: string): string {
    return dir === 'in'
      ? 'text-blue-400'
      : 'text-green-400';
  }
</script>

<svelte:head>
  <title>Messages · Session {id} · NanoClaw Dashboard</title>
</svelte:head>

<div class="mx-auto flex max-w-6xl flex-col gap-6 p-6">
  <!-- Header -->
  <div class="flex items-center gap-4">
    <a
      href={`/sessions/${id}`}
      class="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
    >
      ← Session
    </a>
    <h1 class="text-2xl font-semibold text-[hsl(var(--foreground))]">
      Messages
    </h1>
    <span class="text-sm text-[hsl(var(--muted-foreground))] font-mono">{id}</span>
  </div>

  <!-- Filters -->
  <section
    class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-[hsl(var(--card-foreground))]"
  >
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <label class="flex flex-col gap-1 text-sm sm:col-span-1">
        <span class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          Search
        </span>
        <input
          type="text"
          placeholder="Filter by content…"
          bind:value={search}
          class="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
        />
      </label>

      <label class="flex flex-col gap-1 text-sm">
        <span class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          Kind
        </span>
        <select
          bind:value={kind}
          class="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
        >
          <option value="">All kinds</option>
          <option value="message">message</option>
          <option value="tool_call">tool_call</option>
          <option value="tool_result">tool_result</option>
          <option value="system">system</option>
        </select>
      </label>

      <label class="flex flex-col gap-1 text-sm">
        <span class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          Time
        </span>
        <select
          bind:value={timeRange}
          class="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
        >
          <option value="">All time</option>
          <option value="1h">Last hour</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 days</option>
        </select>
      </label>
    </div>
  </section>

  <!-- Messages table -->
  <section
    class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-[hsl(var(--card-foreground))]"
  >
    {#if messages.loading && !messages.data}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
    {:else if messages.error}
      <p class="text-sm text-red-500">Failed to load messages: {messages.error}</p>
    {:else if !messages.data || messages.data.length === 0}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">No messages match these filters.</p>
    {:else}
      <div class="mb-3 flex items-center justify-between">
        <span class="text-xs text-[hsl(var(--muted-foreground))]">
          {messages.data.length} message{messages.data.length === 1 ? '' : 's'}
          {#if messages.lastUpdated}
            · updated {messages.lastUpdated.toLocaleTimeString()}
          {/if}
        </span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-[hsl(var(--border))] text-left text-[hsl(var(--muted-foreground))]">
              <th class="py-2 pr-4 font-medium whitespace-nowrap">Time</th>
              <th class="py-2 pr-4 font-medium whitespace-nowrap">Dir</th>
              <th class="py-2 pr-4 font-medium whitespace-nowrap">Kind</th>
              <th class="py-2 pr-4 font-medium whitespace-nowrap">Channel</th>
              <th class="py-2 font-medium">Content</th>
            </tr>
          </thead>
          <tbody>
            {#each messages.data as m (m.id)}
              <tr class="border-b border-[hsl(var(--border))]/50 align-top">
                <td class="py-2 pr-4 font-mono text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                  {formatTs(m.timestamp)}
                </td>
                <td class="py-2 pr-4 text-xs whitespace-nowrap {directionClass(m.direction)}">
                  {directionLabel(m.direction)}
                </td>
                <td class="py-2 pr-4 font-mono text-xs whitespace-nowrap">
                  {m.kind}
                </td>
                <td class="py-2 pr-4 font-mono text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                  {m.channel_type ?? '—'}
                </td>
                <td class="py-2 text-xs break-all">
                  <span title={m.content}>{truncate(m.content)}</span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
</div>
