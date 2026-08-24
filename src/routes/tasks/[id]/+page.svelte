<script lang="ts">
  import { page } from '$app/stores';
  import { createPoller, type PollState } from '$lib/poll';
  import { formatDistanceToNow, format } from 'date-fns';
  import type { TaskHistoryResponse } from '$lib/types';

  const id = $page.params.id;
  const groupId = $page.url.searchParams.get('groupId') ?? '';
  const sessionId = $page.url.searchParams.get('sessionId') ?? '';
  const groupName = $page.url.searchParams.get('groupName') ?? 'Unknown group';

  let history = $state<PollState<TaskHistoryResponse | null>>({ data: null, loading: true, error: null, lastUpdated: null });

  $effect(() => {
    const url = `/api/tasks/${id}/history?groupId=${encodeURIComponent(groupId)}&sessionId=${encodeURIComponent(sessionId)}`;
    const p = createPoller<TaskHistoryResponse | null>(
      (signal) => fetch(url, { signal }).then((r) => (r.ok ? r.json() : null)),
      15000,
      (s) => { history = s; }
    );
    return () => p.stop();
  });

  let runLoading = $state(false);
  let runFeedback = $state('');

  async function handleRunNow() {
    if (!confirm('Run this task now? A new run will be queued immediately without changing the schedule.')) return;
    runLoading = true;
    runFeedback = '';
    try {
      const res = await fetch(`/api/tasks/${id}/run`, { method: 'POST' });
      if (res.status === 202) {
        runFeedback = 'Run queued — pending approval';
      } else if (res.ok) {
        runFeedback = 'Run queued';
      } else {
        const body = await res.json().catch(() => ({}));
        runFeedback = `Error: ${(body as { message?: string }).message ?? res.statusText}`;
      }
    } catch (err) {
      runFeedback = `Error: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      runLoading = false;
      setTimeout(() => { runFeedback = ''; }, 6000);
    }
  }

  function fmt(ts: string | null | undefined): string {
    if (!ts) return '—';
    try { return formatDistanceToNow(new Date(ts), { addSuffix: true }); } catch { return ts; }
  }

  function fmtAbs(ts: string | null | undefined): string {
    if (!ts) return '—';
    try { return format(new Date(ts), 'MMM d HH:mm:ss'); } catch { return ts; }
  }
</script>

<svelte:head>
  <title>Task {id.slice(0, 8)}… · NanoClaw Dashboard</title>
</svelte:head>

<div class="mx-auto flex max-w-5xl flex-col gap-6 p-6">
  <div class="flex items-center gap-4">
    <a href="/tasks" class="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
      ← Tasks
    </a>
    <h1 class="text-2xl font-semibold">
      Task <span class="font-mono text-lg">{id.slice(0, 12)}…</span>
    </h1>
    {#if history.data?.flapping}
      <span class="inline-flex items-center rounded-full border border-orange-500/50 bg-orange-500/10 px-2.5 py-0.5 text-xs font-medium text-orange-400">
        Flapping
      </span>
    {/if}
  </div>

  <div class="text-sm text-[hsl(var(--muted-foreground))]">
    Group: <span class="text-[hsl(var(--foreground))]">{groupName}</span>
  </div>

  <!-- Run now action -->
  <section class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-[hsl(var(--card-foreground))]">
    <h2 class="mb-3 text-base font-semibold">Run Now</h2>
    <p class="mb-4 text-xs text-[hsl(var(--muted-foreground))]">
      Queues an immediate extra run without changing the recurrence schedule.
    </p>
    <div class="flex items-center gap-4">
      <button
        onclick={handleRunNow}
        disabled={runLoading || !groupId || !sessionId}
        class="rounded-md bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {runLoading ? 'Queuing…' : 'Run now'}
      </button>
      {#if runFeedback}
        <span class="text-sm {runFeedback.startsWith('Error') ? 'text-red-400' : 'text-green-400'}">
          {runFeedback}
        </span>
      {/if}
    </div>
  </section>

  <!-- Run history -->
  <section class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-[hsl(var(--card-foreground))]">
    <h2 class="mb-4 text-base font-semibold">Run History</h2>

    {#if history.loading && !history.data}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
    {:else if history.error}
      <p class="text-sm text-red-400">Failed to load history: {history.error}</p>
    {:else if !history.data || history.data.runs.length === 0}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">No completed runs yet.</p>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-[hsl(var(--border))] text-left text-[hsl(var(--muted-foreground))]">
              <th class="py-2 font-medium">Seq</th>
              <th class="py-2 font-medium">Status</th>
              <th class="py-2 font-medium">Trigger</th>
              <th class="py-2 font-medium">Scheduled at</th>
            </tr>
          </thead>
          <tbody>
            {#each history.data.runs as run (run.seq)}
              <tr class="border-b border-[hsl(var(--border))]/50">
                <td class="py-2 font-mono text-xs text-[hsl(var(--muted-foreground))]">{run.seq}</td>
                <td class="py-2">
                  {#if run.status === 'completed'}
                    <span class="inline-flex items-center rounded-full bg-green-900/40 px-2 py-0.5 text-xs font-medium text-green-300 border border-green-700/40">completed</span>
                  {:else if run.status === 'failed'}
                    <span class="inline-flex items-center rounded-full bg-red-900/40 px-2 py-0.5 text-xs font-medium text-red-300 border border-red-700/40">failed</span>
                  {:else}
                    <span class="inline-flex items-center rounded-full bg-blue-900/40 px-2 py-0.5 text-xs font-medium text-blue-300 border border-blue-700/40">processing</span>
                  {/if}
                </td>
                <td class="py-2">
                  {#if run.trigger === 'manual'}
                    <span class="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]">manual</span>
                  {:else}
                    <span class="text-xs text-[hsl(var(--muted-foreground))]">scheduled</span>
                  {/if}
                </td>
                <td class="py-2 text-[hsl(var(--muted-foreground))]">
                  <span class="font-mono text-xs">{fmtAbs(run.process_after)}</span>
                  <span class="ml-2 text-xs">{fmt(run.process_after)}</span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="mt-3 text-xs text-[hsl(var(--muted-foreground))]">
        {history.data.runs.length} run{history.data.runs.length !== 1 ? 's' : ''} shown (most recent first, up to 50)
        {#if history.data.flapping}
          · <span class="text-orange-400">Flapping detected — alternating outcomes in recent runs</span>
        {/if}
      </p>
    {/if}
  </section>
</div>
