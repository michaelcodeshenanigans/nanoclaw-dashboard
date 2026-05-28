<script lang="ts">
  import { page } from '$app/stores';
  import { createPoller } from '$lib/poll';
  import { formatDistanceToNow, format } from 'date-fns';
  import type {
    GroupDetail,
    Member,
    Destination,
    SessionSummary
  } from '$lib/types';

  const id = Number($page.params.id);

  const detail = createPoller<GroupDetail | null>(
    () => fetch(`/api/groups/${id}`).then((r) => (r.ok ? r.json() : null)),
    5000
  );
  const members = createPoller<Member[]>(
    () => fetch(`/api/groups/${id}/members`).then((r) => r.json()),
    10000
  );
  const destinations = createPoller<Destination[]>(
    () => fetch(`/api/groups/${id}/destinations`).then((r) => r.json()),
    10000
  );
  const sessions = createPoller<SessionSummary[]>(
    () => fetch(`/api/groups/${id}/sessions`).then((r) => r.json()),
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
      return format(new Date(ts), 'yyyy-MM-dd HH:mm');
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
</script>

<svelte:head>
  <title>Group {id} · NanoClaw Dashboard</title>
</svelte:head>

<div class="mx-auto flex max-w-5xl flex-col gap-6 p-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-4">
      <a
        href="/groups"
        class="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        ← Groups
      </a>
      {#if detail.data}
        <h1 class="text-2xl font-semibold text-[hsl(var(--foreground))]">
          {detail.data.name}
        </h1>
      {:else if detail.loading}
        <h1 class="text-2xl font-semibold text-[hsl(var(--muted-foreground))]">Loading…</h1>
      {:else if detail.error}
        <h1 class="text-2xl font-semibold text-red-500">Error</h1>
      {:else}
        <h1 class="text-2xl font-semibold text-[hsl(var(--muted-foreground))]">Not found</h1>
      {/if}
    </div>
  </div>

  <!-- Config card -->
  <section
    class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-[hsl(var(--card-foreground))]"
  >
    <h2 class="mb-4 text-lg font-semibold">Configuration</h2>
    {#if detail.loading && !detail.data}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
    {:else if detail.error}
      <p class="text-sm text-red-500">Failed to load group: {detail.error}</p>
    {:else if !detail.data}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">Group not found.</p>
    {:else}
      <dl class="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        <div>
          <dt class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Folder
          </dt>
          <dd class="mt-1 font-mono text-sm">{detail.data.folder ?? '—'}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Agent provider
          </dt>
          <dd class="mt-1 font-mono text-sm">{detail.data.agent_provider ?? '—'}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Created at
          </dt>
          <dd class="mt-1 font-mono text-sm">{formatTimestamp(detail.data.created_at)}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Group ID
          </dt>
          <dd class="mt-1 font-mono text-sm">{detail.data.id}</dd>
        </div>
      </dl>
    {/if}
  </section>

  <!-- Members card -->
  <section
    class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-[hsl(var(--card-foreground))]"
  >
    <h2 class="mb-4 text-lg font-semibold">Members</h2>
    {#if members.loading && !members.data}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
    {:else if members.error}
      <p class="text-sm text-red-500">Failed to load members: {members.error}</p>
    {:else if !members.data || members.data.length === 0}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">No members</p>
    {:else}
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-[hsl(var(--border))] text-left text-[hsl(var(--muted-foreground))]">
            <th class="py-2 font-medium">Name</th>
            <th class="py-2 font-medium">Platform</th>
            <th class="py-2 font-medium">Role</th>
          </tr>
        </thead>
        <tbody>
          {#each members.data as m (m.id ?? `${m.platform}:${m.name}`)}
            <tr class="border-b border-[hsl(var(--border))]/50">
              <td class="py-2">{m.name}</td>
              <td class="py-2 font-mono text-xs text-[hsl(var(--muted-foreground))]">
                {m.platform}
              </td>
              <td class="py-2">{m.role ?? '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>

  <!-- Destinations card -->
  <section
    class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-[hsl(var(--card-foreground))]"
  >
    <h2 class="mb-4 text-lg font-semibold">Destinations</h2>
    {#if destinations.loading && !destinations.data}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
    {:else if destinations.error}
      <p class="text-sm text-red-500">
        Failed to load destinations: {destinations.error}
      </p>
    {:else if !destinations.data || destinations.data.length === 0}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">No destinations</p>
    {:else}
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-[hsl(var(--border))] text-left text-[hsl(var(--muted-foreground))]">
            <th class="py-2 font-medium">Name</th>
            <th class="py-2 font-medium">Platform</th>
          </tr>
        </thead>
        <tbody>
          {#each destinations.data as d (d.id ?? `${d.platform}:${d.name}`)}
            <tr class="border-b border-[hsl(var(--border))]/50">
              <td class="py-2">{d.name}</td>
              <td class="py-2 font-mono text-xs text-[hsl(var(--muted-foreground))]">
                {d.platform}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>

  <!-- Sessions card -->
  <section
    class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-[hsl(var(--card-foreground))]"
  >
    <h2 class="mb-4 text-lg font-semibold">Recent sessions</h2>
    {#if sessions.loading && !sessions.data}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
    {:else if sessions.error}
      <p class="text-sm text-red-500">Failed to load sessions: {sessions.error}</p>
    {:else if !sessions.data || sessions.data.length === 0}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">No sessions</p>
    {:else}
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-[hsl(var(--border))] text-left text-[hsl(var(--muted-foreground))]">
            <th class="py-2 font-medium">Thread ID</th>
            <th class="py-2 font-medium">Status</th>
            <th class="py-2 font-medium">Last active</th>
            <th class="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {#each sessions.data as s (s.id)}
            <tr class="border-b border-[hsl(var(--border))]/50">
              <td class="py-2 font-mono text-xs">{s.thread_id ?? '—'}</td>
              <td class="py-2">
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white {statusClass(
                    s.container_status
                  )}"
                >
                  {statusLabel(s.container_status)}
                </span>
              </td>
              <td class="py-2 text-[hsl(var(--muted-foreground))]">
                {relativeTime(s.last_active)}
              </td>
              <td class="py-2 text-right">
                <a
                  href={`/sessions/${s.id}`}
                  class="text-sm text-[hsl(var(--accent-foreground))] hover:underline"
                >
                  View →
                </a>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>
</div>
