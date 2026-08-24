<script lang="ts">
  import { createPoller, type PollState } from '$lib/poll';
  import type { ScheduledTask, FailedTaskSummary, ErrorDigestGroup } from '$lib/types';
  import { formatDistanceToNow, format } from 'date-fns';

  let activeTab = $state<'scheduled' | 'failures' | 'digest'>('scheduled');

  let tasks = $state<PollState<ScheduledTask[]>>({ data: null, loading: true, error: null, lastUpdated: null });
  let expandedScript = $state<string | null>(null);
  let expandedPrompt = $state<string | null>(null);
  let runningTask = $state<string | null>(null);
  let runFeedback = $state<Map<string, string>>(new Map());

  async function runNow(task: ScheduledTask) {
    if (!confirm(`Run "${task.prompt.slice(0, 60)}…" now?`)) return;
    runningTask = task.id;
    try {
      const res = await fetch(`/api/tasks/${task.id}/run`, { method: 'POST' });
      const msg = res.status === 202 ? 'Queued — pending approval' : res.ok ? 'Queued' : `Error ${res.status}`;
      runFeedback = new Map(runFeedback).set(task.id, msg);
      setTimeout(() => {
        runFeedback = new Map([...runFeedback].filter(([k]) => k !== task.id));
      }, 6000);
    } catch {
      runFeedback = new Map(runFeedback).set(task.id, 'Error');
    } finally {
      runningTask = null;
    }
  }

  let failures = $state<PollState<FailedTaskSummary[]>>({ data: null, loading: true, error: null, lastUpdated: null });
  let digest = $state<PollState<ErrorDigestGroup[]>>({ data: null, loading: true, error: null, lastUpdated: null });

  $effect(() => {
    const p = createPoller<ScheduledTask[]>(
      signal => fetch('/api/tasks', { signal }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      15000,
      s => { tasks = s; }
    );
    return () => p.stop();
  });

  $effect(() => {
    const p = createPoller<FailedTaskSummary[]>(
      signal => fetch('/api/tasks/failures', { signal }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      30000,
      s => { failures = s; }
    );
    return () => p.stop();
  });

  $effect(() => {
    const p = createPoller<ErrorDigestGroup[]>(
      signal => fetch('/api/tasks/digest', { signal }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      30000,
      s => { digest = s; }
    );
    return () => p.stop();
  });

  function fmt(ts: string): string {
    try { return formatDistanceToNow(new Date(ts), { addSuffix: true }); } catch { return ts; }
  }

  function fmtAbsolute(ts: string): string {
    try { return format(new Date(ts), 'MMM d, HH:mm'); } catch { return ts; }
  }

  function toggleScript(id: string) {
    expandedScript = expandedScript === id ? null : id;
  }

  function togglePrompt(id: string) {
    expandedPrompt = expandedPrompt === id ? null : id;
  }
</script>

<svelte:head><title>Tasks — NanoClaw</title></svelte:head>

<div class="p-6 space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold">Tasks</h1>
      <p class="text-sm text-[hsl(var(--muted-foreground))] mt-1">
        Scheduled tasks and failure triage.
      </p>
    </div>
    <span class="text-xs text-[hsl(var(--muted-foreground))]">
      {#if activeTab === 'scheduled' && tasks.lastUpdated}Updated {fmt(tasks.lastUpdated.toISOString())}
      {:else if activeTab === 'failures' && failures.lastUpdated}Updated {fmt(failures.lastUpdated.toISOString())}
      {:else if activeTab === 'digest' && digest.lastUpdated}Updated {fmt(digest.lastUpdated.toISOString())}
      {/if}
    </span>
  </div>

  <!-- Tab bar -->
  <div class="flex gap-1 border-b border-[hsl(var(--border))]">
    <button
      onclick={() => { activeTab = 'scheduled'; }}
      class="px-4 py-2 text-sm font-medium transition-colors {activeTab === 'scheduled'
        ? 'border-b-2 border-[hsl(var(--foreground))] text-[hsl(var(--foreground))]'
        : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}"
    >
      Scheduled {#if tasks.data}({tasks.data.length}){/if}
    </button>
    <button
      onclick={() => { activeTab = 'failures'; }}
      class="px-4 py-2 text-sm font-medium transition-colors {activeTab === 'failures'
        ? 'border-b-2 border-[hsl(var(--foreground))] text-[hsl(var(--foreground))]'
        : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}"
    >
      Failures {#if failures.data && failures.data.length > 0}<span class="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white">{failures.data.length}</span>{/if}
    </button>
    <button
      onclick={() => { activeTab = 'digest'; }}
      class="px-4 py-2 text-sm font-medium transition-colors {activeTab === 'digest'
        ? 'border-b-2 border-[hsl(var(--foreground))] text-[hsl(var(--foreground))]'
        : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}"
    >
      Digest {#if digest.data && digest.data.length > 0}<span class="ml-1 rounded-full bg-orange-600 px-1.5 py-0.5 text-xs text-white">{digest.data.length}</span>{/if}
    </button>
  </div>

  {#if activeTab === 'scheduled'}

  {#if tasks.error}
    <div class="rounded-md bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">
      {tasks.error}
    </div>
  {:else if tasks.loading && !tasks.data}
    <div class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</div>
  {:else if !tasks.data || tasks.data.length === 0}
    <div class="rounded-md border border-[hsl(var(--border))] px-6 py-12 text-center text-[hsl(var(--muted-foreground))] text-sm">
      No scheduled tasks found.
    </div>
  {:else}
    <div class="rounded-md border border-[hsl(var(--border))] overflow-hidden">
      <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-[hsl(var(--muted))] border-b border-[hsl(var(--border))]">
          <tr>
            <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Group</th>
            <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Prompt</th>
            <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Recurrence</th>
            <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Next run</th>
            <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Status</th>
            <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Script</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[hsl(var(--border))]">
          {#each tasks.data as t}
            <tr class="hover:bg-[hsl(var(--muted)/0.5)] transition-colors">
              <td class="px-4 py-3 font-medium">{t.group_name}</td>
              <td class="px-4 py-3">
                <div class="max-w-sm overflow-hidden">
                  <p class="truncate text-[hsl(var(--foreground))]" title={t.prompt}>{t.prompt}</p>
                  <div class="flex items-center gap-2 mt-0.5">
                    <p class="font-mono text-xs text-[hsl(var(--muted-foreground))]">{t.id.slice(0, 8)}…</p>
                    <button
                      onclick={() => togglePrompt(t.id)}
                      class="text-xs text-[hsl(var(--muted-foreground))] underline hover:text-[hsl(var(--foreground))] transition-colors"
                    >{expandedPrompt === t.id ? 'hide' : 'expand'}</button>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3">
                {#if t.recurrence}
                  <code class="text-xs bg-[hsl(var(--accent))] px-1.5 py-0.5 rounded">{t.recurrence}</code>
                {:else}
                  <span class="text-[hsl(var(--muted-foreground))]">one-shot</span>
                {/if}
              </td>
              <td class="px-4 py-3 text-sm">
                {#if t.process_after}
                  <span title={t.process_after}>{fmtAbsolute(t.process_after)}</span>
                  <div class="text-xs text-[hsl(var(--muted-foreground))]">{fmt(t.process_after)}</div>
                {:else}
                  <span class="text-[hsl(var(--muted-foreground))]">—</span>
                {/if}
              </td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                  {t.status === 'pending'
                    ? 'bg-green-900/40 text-green-300 border border-green-700/40'
                    : 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/40'}">
                  {t.status}
                </span>
              </td>
              <td class="px-4 py-3">
                {#if t.script}
                  <button
                    onclick={() => toggleScript(t.id)}
                    class="text-xs text-[hsl(var(--muted-foreground))] underline hover:text-[hsl(var(--foreground))] transition-colors"
                  >
                    {expandedScript === t.id ? 'hide' : 'view'}
                  </button>
                {:else}
                  <span class="text-xs text-[hsl(var(--muted-foreground))]">none</span>
                {/if}
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-3 justify-end">
                  {#if runFeedback.get(t.id)}
                    <span class="text-xs {runFeedback.get(t.id)?.startsWith('Error') ? 'text-red-400' : 'text-green-400'}">
                      {runFeedback.get(t.id)}
                    </span>
                  {/if}
                  <button
                    onclick={() => runNow(t)}
                    disabled={runningTask === t.id}
                    class="rounded px-2 py-1 text-xs font-medium bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {runningTask === t.id ? 'Queuing…' : 'Run now'}
                  </button>
                  <a
                    href={`/tasks/${t.id}?groupId=${encodeURIComponent(t.agent_group_id)}&sessionId=${encodeURIComponent(t.session_id)}&groupName=${encodeURIComponent(t.group_name)}`}
                    class="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                  >
                    History →
                  </a>
                </div>
              </td>
            </tr>
            {#if expandedPrompt === t.id}
              <tr>
                <td colspan="7" class="px-4 pb-4">
                  <pre class="text-xs bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-48 overflow-y-auto">{t.prompt}</pre>
                </td>
              </tr>
            {/if}
            {#if expandedScript === t.id && t.script}
              <tr>
                <td colspan="7" class="px-4 pb-4">
                  <pre class="text-xs bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">{t.script}</pre>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
      </div>
    </div>
    <p class="text-xs text-[hsl(var(--muted-foreground))]">
      {tasks.data.length} task{tasks.data.length !== 1 ? 's' : ''} across all groups. One row per series — shows the live pending/paused occurrence.
    </p>
  {/if}

  {:else if activeTab === 'failures'}

  <!-- Failures tab -->
  {#if failures.error}
    <div class="rounded-md bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">
      {failures.error}
    </div>
  {:else if failures.loading && !failures.data}
    <div class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</div>
  {:else if !failures.data || failures.data.length === 0}
    <div class="rounded-md border border-[hsl(var(--border))] px-6 py-12 text-center text-[hsl(var(--muted-foreground))] text-sm">
      No task failures recorded.
    </div>
  {:else}
    <div class="rounded-md border border-[hsl(var(--border))] overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-[hsl(var(--muted))] border-b border-[hsl(var(--border))]">
            <tr>
              <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Group</th>
              <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Prompt</th>
              <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Last failure</th>
              <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Count</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[hsl(var(--border))]">
            {#each failures.data as f (f.series_id)}
              <tr class="hover:bg-[hsl(var(--muted)/0.5)] transition-colors">
                <td class="px-4 py-3 font-medium">{f.group_name}</td>
                <td class="px-4 py-3">
                  <p class="max-w-sm truncate text-[hsl(var(--foreground))]" title={f.prompt}>{f.prompt || '—'}</p>
                  <p class="font-mono text-xs text-[hsl(var(--muted-foreground))]">{f.series_id.slice(0, 8)}…</p>
                </td>
                <td class="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                  {#if f.last_failure}
                    <span title={f.last_failure}>{fmt(f.last_failure)}</span>
                  {:else}—{/if}
                </td>
                <td class="px-4 py-3">
                  <span class="inline-flex items-center rounded-full bg-red-900/40 px-2 py-0.5 text-xs font-medium text-red-300 border border-red-700/40">
                    {f.failure_count}
                  </span>
                </td>
                <td class="px-4 py-3 text-right">
                  <a
                    href={`/tasks/${f.series_id}?groupId=${encodeURIComponent(f.agent_group_id)}&sessionId=${encodeURIComponent(f.session_id)}&groupName=${encodeURIComponent(f.group_name)}`}
                    class="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                  >
                    History →
                  </a>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
    <p class="text-xs text-[hsl(var(--muted-foreground))]">
      {failures.data.length} task series with failures (latest session per group).
      Drill-down into individual failing turns is parked pending Langfuse tracing.
    </p>
  {/if}

  {:else}

  <!-- Digest tab -->
  {#if digest.error}
    <div class="rounded-md bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">
      {digest.error}
    </div>
  {:else if digest.loading && !digest.data}
    <div class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</div>
  {:else if !digest.data || digest.data.length === 0}
    <div class="rounded-md border border-[hsl(var(--border))] px-6 py-12 text-center text-[hsl(var(--muted-foreground))] text-sm">
      No task failures recorded across any group.
    </div>
  {:else}
    <div class="rounded-md border border-[hsl(var(--border))] overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-[hsl(var(--muted))] border-b border-[hsl(var(--border))]">
            <tr>
              <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Group</th>
              <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Failing series</th>
              <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Total failure runs</th>
              <th class="text-left px-4 py-3 font-medium text-[hsl(var(--muted-foreground))]">Last failure</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[hsl(var(--border))]">
            {#each digest.data as d (d.agent_group_id)}
              <tr class="hover:bg-[hsl(var(--muted)/0.5)] transition-colors">
                <td class="px-4 py-3 font-medium">
                  <a href={`/groups/${d.agent_group_id}`} class="hover:underline">{d.group_name}</a>
                </td>
                <td class="px-4 py-3">
                  <span class="inline-flex items-center rounded-full bg-orange-900/40 border border-orange-700/40 px-2 py-0.5 text-xs font-medium text-orange-300">
                    {d.failing_series}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <span class="inline-flex items-center rounded-full bg-red-900/40 border border-red-700/40 px-2 py-0.5 text-xs font-medium text-red-300">
                    {d.total_failure_runs}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                  {#if d.last_failure}<span title={d.last_failure}>{fmt(d.last_failure)}</span>{:else}—{/if}
                </td>
                <td class="px-4 py-3 text-right">
                  <a
                    href={`/tasks#failures`}
                    onclick={(e) => { e.preventDefault(); activeTab = 'failures'; }}
                    class="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                  >
                    Details →
                  </a>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
    <p class="text-xs text-[hsl(var(--muted-foreground))]">
      {digest.data.length} group{digest.data.length !== 1 ? 's' : ''} with task failures — sorted by total failure runs. Per-series breakdown in Failures tab.
      Error-signature grouping is parked pending Langfuse tracing.
    </p>
  {/if}

  {/if}
</div>
