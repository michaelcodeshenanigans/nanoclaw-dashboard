<script lang="ts">
  import { page } from '$app/stores';
  import { createPoller, type PollState } from '$lib/poll';
  import { formatDistanceToNow, format } from 'date-fns';
  import type { SessionDetail, Annotation } from '$lib/types';

  const id = $page.params.id;

  let session = $state<PollState<SessionDetail | null>>({ data: null, loading: true, error: null, lastUpdated: null });

  // Annotation state
  let annotation = $state<Annotation | null>(null);
  let annotationLoaded = $state(false);
  let annotationSaving = $state(false);
  let tagInput = $state('');
  let noteInput = $state('');

  $effect(() => {
    fetch(`/api/annotations?targetType=session&targetId=${encodeURIComponent(id)}`)
      .then(r => r.ok ? r.json() : null)
      .then((a: Annotation | null) => {
        annotation = a;
        tagInput = a?.tags.join(', ') ?? '';
        noteInput = a?.note ?? '';
        annotationLoaded = true;
      })
      .catch(() => { annotationLoaded = true; });
  });

  async function saveAnnotation(patch: Partial<{ bookmarked: boolean; rating: number | null; tags: string[]; note: string | null }>) {
    if (annotationSaving) return;
    annotationSaving = true;
    try {
      const label = session.data ? `Session #${session.data.id} in ${session.data.group_name ?? 'Group'}` : `Session ${id}`;
      const res = await fetch('/api/annotations', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ target_type: 'session', target_id: id, display_label: label, ...patch }),
      });
      if (res.ok) annotation = await res.json() as Annotation;
    } finally {
      annotationSaving = false;
    }
  }

  function parseTags(input: string): string[] {
    return input.split(',').map(t => t.trim()).filter(Boolean);
  }

  $effect(() => {
    const p = createPoller<SessionDetail | null>(
      (signal) => fetch(`/api/sessions/${id}`, { signal }).then((r) => (r.ok ? r.json() : null)),
      5000,
      (s) => { session = s; }
    );
    return () => p.stop();
  });

  function statusClass(status: string | null | undefined): string {
    if (status === 'running') return 'bg-green-500';
    if (status === 'error') return 'bg-red-500';
    return 'bg-gray-500';
  }

  function statusLabel(status: string | null | undefined): string {
    if (!status) return 'stopped';
    return status;
  }

  function formatTimestamp(ts: string | null | undefined): string {
    if (!ts) return '—';
    try {
      return format(new Date(ts), 'yyyy-MM-dd HH:mm:ss');
    } catch {
      return ts;
    }
  }

  function relativeTime(ts: string | null | undefined): string {
    if (!ts) return '—';
    try {
      return formatDistanceToNow(new Date(ts), { addSuffix: true });
    } catch {
      return ts;
    }
  }

  function elapsedSince(ts: string | null | undefined): string {
    if (!ts) return '—';
    try {
      return formatDistanceToNow(new Date(ts));
    } catch {
      return ts;
    }
  }

</script>

<svelte:head>
  <title>Session {id} · NanoClaw Dashboard</title>
</svelte:head>

<div class="mx-auto flex max-w-5xl flex-col gap-6 p-6">
  <!-- Header -->
  <div class="flex items-center gap-4">
    <a
      href="/sessions"
      class="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
    >
      ← Sessions
    </a>
    {#if session.data}
      <h1 class="text-2xl font-semibold text-[hsl(var(--foreground))]">
        Session #{session.data.id}
      </h1>
      <span
        class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-white {statusClass(
          session.data.container_status
        )}"
      >
        {statusLabel(session.data.container_status)}
      </span>
    {:else if session.loading}
      <h1 class="text-2xl font-semibold text-[hsl(var(--muted-foreground))]">Loading…</h1>
    {:else if session.error}
      <h1 class="text-2xl font-semibold text-red-500">Error</h1>
    {:else}
      <h1 class="text-2xl font-semibold text-[hsl(var(--muted-foreground))]">Not found</h1>
    {/if}
  </div>

  <!-- Info card -->
  <section
    class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-[hsl(var(--card-foreground))]"
  >
    <h2 class="mb-4 text-lg font-semibold">Session</h2>
    {#if session.loading && !session.data}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
    {:else if session.error}
      <p class="text-sm text-red-500">Failed to load session: {session.error}</p>
    {:else if !session.data}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">Session not found.</p>
    {:else}
      <dl class="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        <div>
          <dt class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Group
          </dt>
          <dd class="mt-1 text-sm">
            <a
              href={`/groups/${session.data.agent_group_id}`}
              class="text-[hsl(var(--accent-foreground))] hover:underline"
            >
              {session.data.group_name ?? `Group ${session.data.agent_group_id}`}
            </a>
          </dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Thread ID
          </dt>
          <dd class="mt-1 font-mono text-sm">{session.data.thread_id ?? '—'}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Created at
          </dt>
          <dd class="mt-1 font-mono text-sm">{formatTimestamp(session.data.created_at)}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Last active
          </dt>
          <dd class="mt-1 text-sm">
            <span class="font-mono">{formatTimestamp(session.data.last_active)}</span>
            <span class="ml-2 text-[hsl(var(--muted-foreground))]">
              ({relativeTime(session.data.last_active)})
            </span>
          </dd>
        </div>
      </dl>
    {/if}
  </section>

  <!-- Container state card -->
  <section
    class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-[hsl(var(--card-foreground))]"
  >
    <h2 class="mb-4 text-lg font-semibold">Container state</h2>
    {#if session.loading && !session.data}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
    {:else if !session.data}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">—</p>
    {:else if !session.data.container_state}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">No active tool</p>
    {:else}
      <dl class="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        <div>
          <dt class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Current tool
          </dt>
          <dd class="mt-1 font-mono text-sm">
            {session.data.container_state.current_tool ?? '—'}
          </dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Tool started at
          </dt>
          <dd class="mt-1 font-mono text-sm">
            {formatTimestamp(session.data.container_state.tool_started_at)}
          </dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Elapsed
          </dt>
          <dd class="mt-1 text-sm">
            {elapsedSince(session.data.container_state.tool_started_at)}
          </dd>
        </div>
      </dl>
    {/if}
  </section>

  <!-- Action links -->
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-3">
      {#if session.data?.container_status === 'running'}
        <button
          disabled
          title="Session-scoped stop is pending a NanoClaw core update"
          class="rounded-md border border-red-500/30 bg-red-500/5 px-4 py-2 text-sm font-medium text-red-400/40 cursor-not-allowed"
        >
          Stop Session
        </button>
        <span class="text-xs text-[hsl(var(--muted-foreground))]">Pending NanoClaw core support</span>
      {/if}
    </div>
    <div class="flex gap-3">
      <a
        href={`/sessions/${id}/llm-calls`}
        class="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        LLM Calls →
      </a>
      <a
        href={`/sessions/${id}/messages`}
        class="rounded-md bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 transition-opacity"
      >
        View messages →
      </a>
    </div>
  </div>

  <!-- Annotations -->
  {#if annotationLoaded}
  <section class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-[hsl(var(--card-foreground))]">
    <h2 class="mb-4 text-base font-semibold">Annotations</h2>
    <div class="flex flex-col gap-4">
      <!-- Bookmark + rating row -->
      <div class="flex items-center gap-4">
        <button
          onclick={() => saveAnnotation({ bookmarked: !(annotation?.bookmarked ?? false) })}
          class="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors
            {annotation?.bookmarked
              ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400'
              : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}"
        >
          {annotation?.bookmarked ? '★' : '☆'} Bookmark
        </button>
        <div class="flex items-center gap-1">
          <button
            onclick={() => saveAnnotation({ rating: annotation?.rating === 1 ? null : 1 })}
            class="rounded px-2 py-1 text-sm transition-colors {annotation?.rating === 1 ? 'text-green-400' : 'text-[hsl(var(--muted-foreground))] hover:text-green-400'}"
            title="Thumbs up"
          >👍</button>
          <button
            onclick={() => saveAnnotation({ rating: annotation?.rating === -1 ? null : -1 })}
            class="rounded px-2 py-1 text-sm transition-colors {annotation?.rating === -1 ? 'text-red-400' : 'text-[hsl(var(--muted-foreground))] hover:text-red-400'}"
            title="Thumbs down"
          >👎</button>
        </div>
      </div>

      <!-- Tags -->
      <div class="flex flex-col gap-1">
        <label class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Tags (comma-separated)</label>
        <div class="flex gap-2">
          <input
            type="text"
            bind:value={tagInput}
            placeholder="e.g. good-run, to-review, bug"
            class="flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
          />
          <button
            onclick={() => saveAnnotation({ tags: parseTags(tagInput) })}
            class="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm hover:bg-[hsl(var(--muted))] transition-colors"
          >Save</button>
        </div>
        {#if annotation?.tags && annotation.tags.length > 0}
          <div class="flex flex-wrap gap-1 mt-1">
            {#each annotation.tags as tag}
              <span class="rounded-full bg-[hsl(var(--accent))] px-2 py-0.5 text-xs text-[hsl(var(--accent-foreground))]">{tag}</span>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Note -->
      <div class="flex flex-col gap-1">
        <label class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Note</label>
        <textarea
          rows="3"
          bind:value={noteInput}
          placeholder="Free-text notes about this session…"
          class="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] resize-none"
          onblur={() => saveAnnotation({ note: noteInput || null })}
        ></textarea>
      </div>
    </div>
  </section>
  {/if}

  <!-- Send message (stubbed — pending NanoClaw core support) -->
  <section class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-[hsl(var(--card-foreground))] opacity-60">
    <h2 class="mb-1 text-base font-semibold">Send Message</h2>
    <p class="mb-4 text-xs text-[hsl(var(--muted-foreground))]">
      Pending NanoClaw core support — message injection requires a write-capable verb not yet in ncl.
    </p>
    <div class="flex flex-col gap-3">
      <textarea
        disabled
        placeholder="Type a message or instruction for this session…"
        rows="3"
        class="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))] cursor-not-allowed resize-none"
      ></textarea>
      <div class="flex justify-end">
        <button
          disabled
          class="rounded-md bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] opacity-40 cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  </section>
</div>
