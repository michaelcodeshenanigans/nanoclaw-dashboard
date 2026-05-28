<script lang="ts">
  import { page } from '$app/stores';
  import { createPoller } from '$lib/poll';
  import { formatDistanceToNow, format } from 'date-fns';
  import type { SessionDetail } from '$lib/types';

  const id = $page.params.id;

  const session = createPoller<SessionDetail | null>(
    (signal) => fetch(`/api/sessions/${id}`, { signal }).then((r) => (r.ok ? r.json() : null)),
    5000
  );

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
</div>
