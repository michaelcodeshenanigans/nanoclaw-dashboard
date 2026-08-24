<script lang="ts">
  import { page } from '$app/stores';
  import { createPoller, type PollState } from '$lib/poll';
  import { formatDistanceToNow, format } from 'date-fns';
  import type {
    GroupDetail,
    Member,
    Destination,
    SessionSummary,
    GroupConfig
  } from '$lib/types';

  const id = $page.params.id;

  let detail = $state<PollState<GroupDetail | null>>({ data: null, loading: true, error: null, lastUpdated: null });
  let members = $state<PollState<Member[]>>({ data: null, loading: true, error: null, lastUpdated: null });
  let destinations = $state<PollState<Destination[]>>({ data: null, loading: true, error: null, lastUpdated: null });
  let sessions = $state<PollState<SessionSummary[]>>({ data: null, loading: true, error: null, lastUpdated: null });

  $effect(() => {
    const p = createPoller<GroupDetail | null>(
      (signal) => fetch(`/api/groups/${id}`, { signal }).then((r) => (r.ok ? r.json() : null)),
      5000,
      (s) => { detail = s; }
    );
    return () => p.stop();
  });

  $effect(() => {
    const p = createPoller<Member[]>(
      (signal) => fetch(`/api/groups/${id}/members`, { signal }).then((r) => r.json()),
      10000,
      (s) => { members = s; }
    );
    return () => p.stop();
  });

  $effect(() => {
    const p = createPoller<Destination[]>(
      (signal) => fetch(`/api/groups/${id}/destinations`, { signal }).then((r) => r.json()),
      10000,
      (s) => { destinations = s; }
    );
    return () => p.stop();
  });

  $effect(() => {
    const p = createPoller<SessionSummary[]>(
      (signal) => fetch(`/api/groups/${id}/sessions`, { signal }).then((r) => r.json()),
      5000,
      (s) => { sessions = s; }
    );
    return () => p.stop();
  });

  // Restart state
  let restartRebuild = $state(false);
  let restartMessage = $state('');
  let restartLoading = $state(false);
  let restartFeedback = $state('');

  // Stop state
  let stopLoading = $state(false);
  let stopFeedback = $state('');

  async function handleStop() {
    if (!confirm('Stop all running sessions for this group? The agent will be terminated.')) return;
    stopLoading = true;
    stopFeedback = '';
    try {
      const res = await fetch(`/api/groups/${id}/stop`, { method: 'POST' });
      if (res.status === 202) {
        showFeedback(v => { stopFeedback = v; }, 'Stop request submitted — pending approval');
      } else if (res.ok) {
        showFeedback(v => { stopFeedback = v; }, 'Stop initiated');
      } else {
        const body = await res.json().catch(() => ({}));
        showFeedback(v => { stopFeedback = v; }, `Error: ${(body as { message?: string }).message ?? res.statusText}`);
      }
    } catch (err) {
      showFeedback(v => { stopFeedback = v; }, `Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      stopLoading = false;
    }
  }

  // Member add state
  let addUser = $state('');
  let addLoading = $state(false);
  let addFeedback = $state('');

  // Member remove state
  let removeLoading = $state<string | null>(null);
  let removeFeedback = $state('');

  function showFeedback(setter: (v: string) => void, msg: string) {
    setter(msg);
    setTimeout(() => setter(''), 4000);
  }

  async function handleRestart() {
    restartLoading = true;
    try {
      const res = await fetch(`/api/groups/${id}/restart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rebuild: restartRebuild, message: restartMessage || undefined })
      });
      if (res.status === 202) {
        showFeedback(v => { restartFeedback = v; }, 'Request submitted — pending approval');
      } else if (res.ok) {
        showFeedback(v => { restartFeedback = v; }, 'Restart initiated');
      } else {
        const body = await res.json().catch(() => ({}));
        showFeedback(v => { restartFeedback = v; }, `Error: ${(body as { message?: string }).message ?? res.statusText}`);
      }
    } catch (err) {
      showFeedback(v => { restartFeedback = v; }, `Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      restartLoading = false;
    }
  }

  async function handleAddMember() {
    if (!addUser.trim()) return;
    addLoading = true;
    try {
      const res = await fetch(`/api/groups/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: addUser.trim() })
      });
      if (res.status === 202 || res.status === 201) {
        showFeedback(v => { addFeedback = v; }, res.status === 202 ? 'Request submitted — pending approval' : 'Member added');
        addUser = '';
      } else {
        const body = await res.json().catch(() => ({}));
        showFeedback(v => { addFeedback = v; }, `Error: ${(body as { message?: string }).message ?? res.statusText}`);
      }
    } catch (err) {
      showFeedback(v => { addFeedback = v; }, `Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      addLoading = false;
    }
  }

  async function handleRemoveMember(userId: string) {
    removeLoading = userId;
    try {
      const res = await fetch(`/api/groups/${id}/members/${userId}`, { method: 'DELETE' });
      if (res.status === 202 || res.ok) {
        showFeedback(v => { removeFeedback = v; }, res.status === 202 ? 'Request submitted — pending approval' : 'Member removed');
      } else {
        const body = await res.json().catch(() => ({}));
        showFeedback(v => { removeFeedback = v; }, `Error: ${(body as { message?: string }).message ?? res.statusText}`);
      }
    } catch (err) {
      showFeedback(v => { removeFeedback = v; }, `Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      removeLoading = null;
    }
  }

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

  // Config (skills + MCP servers)
  let config = $state<GroupConfig | null>(null);
  let configLoading = $state(true);
  let pendingRestart = $state(false);

  // MCP add form
  let mcpAddName = $state('');
  let mcpAddType = $state<'stdio' | 'http'>('stdio');
  let mcpAddCommand = $state('');
  let mcpAddUrl = $state('');
  let mcpAddLoading = $state(false);
  let mcpAddFeedback = $state('');
  let mcpRemoveLoading = $state<string | null>(null);
  let mcpFeedback = $state('');

  $effect(() => {
    fetch(`/api/groups/${id}/config`)
      .then(r => r.ok ? r.json() : null)
      .then((d: GroupConfig | null) => { config = d; })
      .catch(() => {})
      .finally(() => { configLoading = false; });
  });

  async function handleAddMcp() {
    const name = mcpAddName.trim();
    const val = mcpAddType === 'stdio' ? mcpAddCommand.trim() : mcpAddUrl.trim();
    if (!name || !val) return;
    mcpAddLoading = true;
    mcpAddFeedback = '';
    try {
      const body: Record<string, string> = { name };
      if (mcpAddType === 'stdio') body.command = val;
      else body.url = val;
      const res = await fetch(`/api/groups/${id}/config/mcp-servers`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok || res.status === 202) {
        mcpAddName = ''; mcpAddCommand = ''; mcpAddUrl = '';
        pendingRestart = true;
        showFeedback(v => { mcpAddFeedback = v; }, res.status === 202 ? 'Pending approval' : 'Added — restart to apply');
        // Refresh config
        const updated = await fetch(`/api/groups/${id}/config`).then(r => r.ok ? r.json() : null).catch(() => null);
        if (updated) config = updated;
      } else {
        const b = await res.json().catch(() => ({}));
        showFeedback(v => { mcpAddFeedback = v; }, `Error: ${(b as { message?: string }).message ?? res.statusText}`);
      }
    } catch (err) {
      showFeedback(v => { mcpAddFeedback = v; }, `Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      mcpAddLoading = false;
    }
  }

  async function handleRemoveMcp(name: string) {
    if (!confirm(`Remove MCP server "${name}"? A restart will be required to apply.`)) return;
    mcpRemoveLoading = name;
    mcpFeedback = '';
    try {
      const res = await fetch(`/api/groups/${id}/config/mcp-servers`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok || res.status === 202) {
        pendingRestart = true;
        showFeedback(v => { mcpFeedback = v; }, res.status === 202 ? 'Pending approval' : 'Removed — restart to apply');
        const updated = await fetch(`/api/groups/${id}/config`).then(r => r.ok ? r.json() : null).catch(() => null);
        if (updated) config = updated;
      } else {
        const b = await res.json().catch(() => ({}));
        showFeedback(v => { mcpFeedback = v; }, `Error: ${(b as { message?: string }).message ?? res.statusText}`);
      }
    } catch (err) {
      showFeedback(v => { mcpFeedback = v; }, `Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      mcpRemoveLoading = null;
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

  <!-- Controls: Restart + Emergency Stop -->
  <section class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-[hsl(var(--card-foreground))]">
    <h2 class="mb-4 text-lg font-semibold">Controls</h2>
    <div class="flex flex-col gap-6">

      <!-- Restart -->
      <div class="flex flex-col gap-3">
        <h3 class="text-sm font-medium text-[hsl(var(--foreground))]">Restart</h3>
        <label class="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" bind:checked={restartRebuild} class="rounded" />
          <span>Rebuild container image (--rebuild)</span>
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">On-wake message (optional)</span>
          <input
            type="text"
            bind:value={restartMessage}
            placeholder="Instruction for the agent after restart…"
            class="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
          />
        </label>
        <div class="flex items-center gap-4">
          <button
            onclick={handleRestart}
            disabled={restartLoading}
            class="rounded-md bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {restartLoading ? 'Submitting…' : 'Restart'}
          </button>
          {#if restartFeedback}
            <span class="text-sm text-[hsl(var(--muted-foreground))]">{restartFeedback}</span>
          {/if}
        </div>
      </div>

      <hr class="border-[hsl(var(--border))]" />

      <!-- Emergency Stop -->
      <div class="flex flex-col gap-3">
        <h3 class="text-sm font-medium text-[hsl(var(--foreground))]">Emergency Stop</h3>
        <p class="text-xs text-[hsl(var(--muted-foreground))]">Stops all running sessions for this group. The group will not restart until the next user message arrives.</p>
        <div class="flex items-center gap-4">
          <button
            onclick={handleStop}
            disabled={stopLoading}
            class="rounded-md border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
          >
            {stopLoading ? 'Stopping…' : 'Stop All Sessions'}
          </button>
          {#if stopFeedback}
            <span class="text-sm {stopFeedback.startsWith('Error') ? 'text-red-400' : 'text-[hsl(var(--muted-foreground))]'}">{stopFeedback}</span>
          {/if}
        </div>
      </div>

    </div>
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
      <p class="text-sm text-[hsl(var(--muted-foreground))] mb-4">No members.</p>
    {:else}
      <div class="overflow-x-auto mb-4">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-[hsl(var(--border))] text-left text-[hsl(var(--muted-foreground))]">
              <th class="py-2 pr-4 font-medium">Name</th>
              <th class="py-2 pr-4 font-medium">Platform</th>
              <th class="py-2 pr-4 font-medium">Role</th>
              <th class="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {#each members.data as m (m.id)}
              <tr class="border-b border-[hsl(var(--border))]/50">
                <td class="py-2 pr-4">{m.name}</td>
                <td class="py-2 pr-4 font-mono text-xs text-[hsl(var(--muted-foreground))]">
                  {m.platform}:{m.platform_id}
                </td>
                <td class="py-2 pr-4 text-xs">{m.role}</td>
                <td class="py-2">
                  <button
                    onclick={() => handleRemoveMember(m.id)}
                    disabled={removeLoading === m.id}
                    class="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    {removeLoading === m.id ? '…' : 'Remove'}
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if removeFeedback}
        <p class="text-sm text-[hsl(var(--muted-foreground))] mb-3">{removeFeedback}</p>
      {/if}
    {/if}

    <!-- Add member form -->
    <div class="border-t border-[hsl(var(--border))] pt-4 mt-2">
      <p class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-2">Add Member</p>
      <div class="flex gap-2">
        <input
          type="text"
          bind:value={addUser}
          placeholder="platform:identifier (e.g. telegram:jane)"
          class="flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
        />
        <button
          onclick={handleAddMember}
          disabled={addLoading || !addUser.trim()}
          class="rounded-md bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {addLoading ? 'Adding…' : 'Add'}
        </button>
      </div>
      {#if addFeedback}
        <p class="text-sm text-[hsl(var(--muted-foreground))] mt-2">{addFeedback}</p>
      {/if}
    </div>
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

  <!-- Configuration card -->
  <section class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-[hsl(var(--card-foreground))]">
    <h2 class="mb-4 text-lg font-semibold">Configuration</h2>
    {#if configLoading}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
    {:else if !config}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">No config found for this group.</p>
    {:else}
      <!-- Restart required banner -->
      {#if pendingRestart}
        <div class="mb-4 flex items-center justify-between gap-4 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <p class="text-sm text-yellow-300">Config changed — restart required for changes to take effect.</p>
          <button
            onclick={handleRestart}
            disabled={restartLoading}
            class="shrink-0 rounded-md bg-yellow-500/20 px-3 py-1.5 text-sm text-yellow-300 hover:bg-yellow-500/30 disabled:opacity-50"
          >
            {restartLoading ? 'Restarting…' : 'Restart now'}
          </button>
        </div>
      {/if}

      <!-- Skills (read-only) -->
      <div class="mb-6">
        <h3 class="mb-2 text-sm font-medium">Skills <span class="ml-1 text-xs text-[hsl(var(--muted-foreground))]">(read-only — edit via config files)</span></h3>
        {#if config.skills === 'all'}
          <span class="rounded-full bg-[hsl(var(--accent))] px-2 py-0.5 text-xs text-[hsl(var(--accent-foreground))]">All skills</span>
        {:else if Array.isArray(config.skills) && config.skills.length === 0}
          <span class="text-sm text-[hsl(var(--muted-foreground))]">None configured</span>
        {:else if Array.isArray(config.skills)}
          <div class="flex flex-wrap gap-1">
            {#each config.skills as skill}
              <span class="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs text-[hsl(var(--foreground))]">{skill}</span>
            {/each}
          </div>
        {/if}
      </div>

      <!-- MCP Servers -->
      <div>
        <h3 class="mb-2 text-sm font-medium">MCP Servers</h3>
        {#if mcpFeedback}
          <p class="mb-2 text-sm {mcpFeedback.startsWith('Error') ? 'text-red-400' : 'text-green-400'}">{mcpFeedback}</p>
        {/if}

        {#if Object.keys(config.mcp_servers).length === 0}
          <p class="mb-4 text-sm text-[hsl(var(--muted-foreground))]">No MCP servers configured.</p>
        {:else}
          <div class="mb-4 flex flex-col gap-2">
            {#each Object.entries(config.mcp_servers) as [name, cfg]}
              <div class="flex items-center gap-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium">{name}</p>
                  <p class="text-xs text-[hsl(var(--muted-foreground))] font-mono truncate">
                    {cfg.command ? cfg.command : cfg.url ? cfg.url : 'no command/url'}
                  </p>
                </div>
                <button
                  onclick={() => handleRemoveMcp(name)}
                  disabled={mcpRemoveLoading === name}
                  class="shrink-0 rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                >
                  {mcpRemoveLoading === name ? '…' : 'Remove'}
                </button>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Add MCP server form -->
        <details class="rounded-md border border-[hsl(var(--border))]">
          <summary class="cursor-pointer px-4 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] select-none">
            + Add MCP server
          </summary>
          <div class="border-t border-[hsl(var(--border))] p-4 flex flex-col gap-3">
            <p class="text-xs text-[hsl(var(--muted-foreground))]">
              Changes take effect after restarting the group.
            </p>
            <label class="flex flex-col gap-1 text-sm">
              <span class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Server name</span>
              <input
                type="text"
                bind:value={mcpAddName}
                placeholder="e.g. my-tool-server"
                class="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
              />
            </label>
            <div class="flex gap-4 text-sm">
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" bind:group={mcpAddType} value="stdio" class="accent-[hsl(var(--accent-foreground))]" /> stdio
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" bind:group={mcpAddType} value="http" class="accent-[hsl(var(--accent-foreground))]" /> HTTP
              </label>
            </div>
            {#if mcpAddType === 'stdio'}
              <label class="flex flex-col gap-1 text-sm">
                <span class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Command</span>
                <input
                  type="text"
                  bind:value={mcpAddCommand}
                  placeholder="e.g. /usr/local/bin/my-mcp-server"
                  class="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] font-mono"
                />
              </label>
            {:else}
              <label class="flex flex-col gap-1 text-sm">
                <span class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">URL</span>
                <input
                  type="url"
                  bind:value={mcpAddUrl}
                  placeholder="https://my-mcp-server.example.com"
                  class="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] font-mono"
                />
              </label>
            {/if}
            {#if mcpAddFeedback}
              <p class="text-sm {mcpAddFeedback.startsWith('Error') ? 'text-red-400' : 'text-green-400'}">{mcpAddFeedback}</p>
            {/if}
            <button
              onclick={handleAddMcp}
              disabled={mcpAddLoading || !mcpAddName.trim() || (mcpAddType === 'stdio' ? !mcpAddCommand.trim() : !mcpAddUrl.trim())}
              class="self-start rounded-md bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {mcpAddLoading ? 'Adding…' : 'Add server'}
            </button>
          </div>
        </details>
      </div>
    {/if}
  </section>
</div>
