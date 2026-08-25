<script lang="ts">
  import { createPoller, type PollState } from '$lib/poll';
  import type { RetentionConfig, RetentionPreview, RetentionRun } from '$lib/types';

  interface RetentionResponse { config: RetentionConfig | null; runs: RetentionRun[] }

  let poll = $state<PollState<RetentionResponse>>({ data: null, loading: true, error: null, lastUpdated: null });

  // Local form state (mirrors server config)
  let windowDays = $state(90);
  let scheduleDays = $state(7);
  let enabled = $state(false);
  let inclAuditLog = $state(true);
  let inclMonitorAlerts = $state(true);
  let inclTriage = $state(true);
  let inclSearchIndex = $state(true);
  let inclAnnotations = $state(false);

  let preview = $state<RetentionPreview | null>(null);
  let previewLoading = $state(false);
  let applyLoading = $state(false);
  let saveLoading = $state(false);
  let opError = $state('');
  let opOk = $state('');
  let confirmed = $state(false);

  $effect(() => {
    const p = createPoller<RetentionResponse>(
      signal => fetch('/api/retention', { signal }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      30000,
      s => {
        poll = s;
        if (s.data?.config) {
          const c = s.data.config;
          windowDays = c.window_days;
          scheduleDays = c.schedule_days;
          enabled = c.enabled;
          inclAuditLog = c.include_audit_log;
          inclMonitorAlerts = c.include_monitor_alerts;
          inclTriage = c.include_triage;
          inclSearchIndex = c.include_search_index;
          inclAnnotations = c.include_annotations;
        }
      }
    );
    return () => p.stop();
  });

  function currentConfig() {
    return {
      window_days: windowDays,
      schedule_days: scheduleDays,
      enabled,
      include_audit_log: inclAuditLog,
      include_monitor_alerts: inclMonitorAlerts,
      include_triage: inclTriage,
      include_search_index: inclSearchIndex,
      include_annotations: inclAnnotations,
    };
  }

  async function doPost(action: string, extraConfig?: Record<string, unknown>) {
    const res = await fetch('/api/retention', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, config: { ...currentConfig(), ...extraConfig } })
    });
    if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
    return res.json();
  }

  async function saveConfig() {
    saveLoading = true; opError = ''; opOk = '';
    try {
      await doPost('save');
      opOk = 'Settings saved.';
    } catch (err) {
      opError = err instanceof Error ? err.message : String(err);
    } finally {
      saveLoading = false;
    }
  }

  async function dryRun() {
    previewLoading = true; opError = ''; opOk = ''; preview = null; confirmed = false;
    try {
      preview = await doPost('dry-run') as RetentionPreview;
    } catch (err) {
      opError = err instanceof Error ? err.message : String(err);
    } finally {
      previewLoading = false;
    }
  }

  async function apply() {
    if (!confirmed) return;
    applyLoading = true; opError = ''; opOk = '';
    try {
      const result = await doPost('apply') as RetentionPreview;
      preview = result;
      confirmed = false;
      opOk = `Done — ${result.total} records pruned.`;
    } catch (err) {
      opError = err instanceof Error ? err.message : String(err);
    } finally {
      applyLoading = false;
    }
  }

  function fmtTs(ts: string | null) {
    if (!ts) return '—';
    return ts.replace('T', ' ').slice(0, 16);
  }

  function fmtSummary(json: string): string {
    try {
      const s = JSON.parse(json) as RetentionPreview;
      return `${s.total} records (audit:${s.audit_log} alerts:${s.monitor_alerts} triage:${s.triage} index:${s.search_index} ann:${s.annotations})`;
    } catch { return json; }
  }
</script>

<svelte:head><title>Retention — NanoClaw</title></svelte:head>

<div class="p-6 space-y-6 max-w-2xl">
  <div>
    <h1 class="text-lg font-semibold">Retention & Redaction</h1>
    <p class="text-sm text-[hsl(var(--muted-foreground))] mt-1">
      Prune old dashboard data on a schedule. Dry-run first to see what would be deleted.
    </p>
  </div>

  <!-- Scope disclaimer -->
  <div class="rounded-md border border-amber-700/50 bg-amber-900/20 px-4 py-3 text-sm text-amber-300 space-y-1">
    <p class="font-medium">Dashboard-owned data only</p>
    <p class="text-xs">
      NanoClaw session data (v2.db, per-session message DBs) is mounted read-only and cannot be pruned or redacted here.
      Full RET-01/RET-02 coverage (message body stripping, session-row deletion) requires a future <code class="font-mono">ncl retention</code> verb — pending NanoClaw support.
    </p>
  </div>

  {#if poll.error}
    <div class="rounded-md bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">{poll.error}</div>
  {/if}

  <!-- Settings -->
  <div class="rounded-md border border-[hsl(var(--border))] p-4 space-y-4">
    <h2 class="text-sm font-medium">Settings</h2>

    <div class="grid grid-cols-2 gap-4">
      <label class="space-y-1">
        <span class="text-xs text-[hsl(var(--muted-foreground))]">Retain data for (days)</span>
        <input
          type="number"
          min="1" max="3650"
          bind:value={windowDays}
          class="w-full h-9 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
        />
      </label>
      <label class="space-y-1">
        <span class="text-xs text-[hsl(var(--muted-foreground))]">Auto-prune every (days)</span>
        <input
          type="number"
          min="1" max="365"
          bind:value={scheduleDays}
          class="w-full h-9 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
        />
      </label>
    </div>

    <fieldset class="space-y-2">
      <legend class="text-xs text-[hsl(var(--muted-foreground))] font-medium">Include in prune</legend>
      {#each [
        { key: 'inclAuditLog', label: 'Audit log entries' },
        { key: 'inclMonitorAlerts', label: 'Acknowledged monitor alerts' },
        { key: 'inclTriage', label: 'Triage dismiss/snooze history' },
        { key: 'inclSearchIndex', label: 'Search index (message entries)' },
        { key: 'inclAnnotations', label: 'Annotations (user notes — irreversible)' },
      ] as item}
        <label class="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={item.key === 'inclAuditLog' ? inclAuditLog
              : item.key === 'inclMonitorAlerts' ? inclMonitorAlerts
              : item.key === 'inclTriage' ? inclTriage
              : item.key === 'inclSearchIndex' ? inclSearchIndex
              : inclAnnotations}
            onchange={(e) => {
              const v = (e.target as HTMLInputElement).checked;
              if (item.key === 'inclAuditLog') inclAuditLog = v;
              else if (item.key === 'inclMonitorAlerts') inclMonitorAlerts = v;
              else if (item.key === 'inclTriage') inclTriage = v;
              else if (item.key === 'inclSearchIndex') inclSearchIndex = v;
              else inclAnnotations = v;
            }}
            class="rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]"
          />
          {item.label}
        </label>
      {/each}
    </fieldset>

    <label class="flex items-center gap-2 text-sm cursor-pointer">
      <input type="checkbox" bind:checked={enabled} class="rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]" />
      Enable scheduled auto-prune
    </label>

    <div class="flex gap-2">
      <button
        onclick={saveConfig}
        disabled={saveLoading}
        class="h-9 px-4 rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-medium disabled:opacity-50"
      >
        {saveLoading ? 'Saving…' : 'Save settings'}
      </button>
    </div>
  </div>

  <!-- Dry-run + Apply -->
  <div class="rounded-md border border-[hsl(var(--border))] p-4 space-y-4">
    <h2 class="text-sm font-medium">Run retention</h2>

    <div class="flex gap-2 flex-wrap">
      <button
        onclick={dryRun}
        disabled={previewLoading || applyLoading}
        class="h-9 px-4 rounded-md border border-[hsl(var(--border))] text-sm disabled:opacity-50 hover:bg-[hsl(var(--accent))]"
      >
        {previewLoading ? 'Calculating…' : 'Dry run (preview)'}
      </button>
    </div>

    {#if preview}
      <div class="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 space-y-2">
        <p class="text-sm font-medium">{preview.dry_run ? 'Dry-run preview' : 'Applied'} — cutoff {preview.cutoff.slice(0, 10)}</p>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span class="text-[hsl(var(--muted-foreground))]">Audit log</span><span>{preview.audit_log}</span>
          <span class="text-[hsl(var(--muted-foreground))]">Monitor alerts</span><span>{preview.monitor_alerts}</span>
          <span class="text-[hsl(var(--muted-foreground))]">Triage records</span><span>{preview.triage}</span>
          <span class="text-[hsl(var(--muted-foreground))]">Search index entries</span><span>{preview.search_index}</span>
          <span class="text-[hsl(var(--muted-foreground))]">Annotations</span><span>{preview.annotations}</span>
          <span class="font-medium">Total</span><span class="font-medium">{preview.total}</span>
        </div>
        {#if preview.dry_run && preview.total > 0}
          <div class="pt-2 space-y-2 border-t border-[hsl(var(--border))]">
            <label class="flex items-center gap-2 text-sm text-red-400 cursor-pointer">
              <input type="checkbox" bind:checked={confirmed} class="accent-red-500" />
              I understand this will permanently delete {preview.total} records and cannot be undone
            </label>
            <button
              onclick={apply}
              disabled={!confirmed || applyLoading}
              class="h-9 px-4 rounded-md bg-red-700 hover:bg-red-600 text-white text-sm font-medium disabled:opacity-40"
            >
              {applyLoading ? 'Deleting…' : `Delete ${preview.total} records`}
            </button>
          </div>
        {:else if preview.dry_run && preview.total === 0}
          <p class="text-sm text-[hsl(var(--muted-foreground))]">Nothing to prune within this window.</p>
        {/if}
      </div>
    {/if}

    {#if opError}
      <p class="text-sm text-red-400">{opError}</p>
    {/if}
    {#if opOk}
      <p class="text-sm text-green-400">{opOk}</p>
    {/if}
  </div>

  <!-- Run history -->
  {#if poll.data?.runs?.length}
    <div class="space-y-2">
      <h2 class="text-sm font-medium">Run history</h2>
      <div class="rounded-md border border-[hsl(var(--border))] overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-[hsl(var(--muted))]">
            <tr>
              <th class="text-left px-4 py-2.5 font-medium text-[hsl(var(--muted-foreground))]">Time</th>
              <th class="text-left px-4 py-2.5 font-medium text-[hsl(var(--muted-foreground))]">Type</th>
              <th class="text-left px-4 py-2.5 font-medium text-[hsl(var(--muted-foreground))]">Window</th>
              <th class="text-left px-4 py-2.5 font-medium text-[hsl(var(--muted-foreground))]">Result</th>
              <th class="text-left px-4 py-2.5 font-medium text-[hsl(var(--muted-foreground))]">By</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[hsl(var(--border))]">
            {#each poll.data.runs as r (r.id)}
              <tr class="hover:bg-[hsl(var(--muted)/0.5)]">
                <td class="px-4 py-2 font-mono text-xs text-[hsl(var(--muted-foreground))]">{fmtTs(r.ts)}</td>
                <td class="px-4 py-2">
                  <span class="text-xs px-1.5 py-0.5 rounded {r.dry_run ? 'bg-zinc-700 text-zinc-300' : 'bg-red-900/40 text-red-300'}">
                    {r.dry_run ? 'dry-run' : 'applied'}
                  </span>
                </td>
                <td class="px-4 py-2 text-xs text-[hsl(var(--muted-foreground))]">{r.window_days}d</td>
                <td class="px-4 py-2 text-xs text-[hsl(var(--muted-foreground))] max-w-xs truncate">{fmtSummary(r.summary_json)}</td>
                <td class="px-4 py-2 text-xs font-mono">{r.triggered_by}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  <!-- Next/last run info -->
  {#if poll.data?.config}
    {@const c = poll.data.config}
    <div class="text-xs text-[hsl(var(--muted-foreground))] space-y-0.5">
      {#if c.last_run_ts}<p>Last run: {fmtTs(c.last_run_ts)}</p>{/if}
      {#if c.next_run_ts && c.enabled}<p>Next scheduled: {fmtTs(c.next_run_ts)}</p>{/if}
      {#if !c.enabled}<p>Auto-prune: disabled</p>{/if}
    </div>
  {/if}
</div>
