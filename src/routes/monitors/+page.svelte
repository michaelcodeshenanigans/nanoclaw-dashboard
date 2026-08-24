<script lang="ts">
  import { createPoller, type PollState } from '$lib/poll';
  import { formatDistanceToNow } from 'date-fns';
  import type { Monitor, MonitorAlert, MonitorType } from '$lib/types';

  let monitors = $state<PollState<Monitor[]>>({ data: null, loading: true, error: null, lastUpdated: null });
  let alerts = $state<PollState<MonitorAlert[]>>({ data: null, loading: true, error: null, lastUpdated: null });

  const monitorPoller = createPoller<Monitor[]>(
    (signal) => fetch('/api/monitors', { signal }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
    10000,
    (s) => { monitors = s; }
  );
  const alertPoller = createPoller<MonitorAlert[]>(
    (signal) => fetch('/api/monitors/alerts?limit=30', { signal }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
    10000,
    (s) => { alerts = s; }
  );

  $effect(() => () => { monitorPoller.stop(); alertPoller.stop(); });

  let showNewForm = $state(false);
  let newName = $state('');
  let newType = $state<MonitorType>('approval_timeout');
  let newThreshold = $state(30);
  let newCooldown = $state(60);
  let saving = $state(false);
  let saveError = $state<string | null>(null);

  async function createMonitor() {
    saving = true;
    saveError = null;
    try {
      const res = await fetch('/api/monitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, type: newType, threshold_minutes: newThreshold, cooldown_minutes: newCooldown })
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message ?? `HTTP ${res.status}`); }
      showNewForm = false;
      newName = '';
      newType = 'approval_timeout';
      newThreshold = 30;
      newCooldown = 60;
    } catch (err) {
      saveError = err instanceof Error ? err.message : String(err);
    } finally {
      saving = false;
    }
  }

  async function toggleMonitor(m: Monitor) {
    await fetch(`/api/monitors/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !m.enabled })
    });
  }

  async function deleteMonitor(id: string) {
    if (!confirm('Delete this monitor?')) return;
    await fetch(`/api/monitors/${id}`, { method: 'DELETE' });
  }

  async function acknowledgeAll() {
    await fetch('/api/monitors/alerts/acknowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true })
    });
  }

  function typeLabel(t: MonitorType): string {
    if (t === 'approval_timeout') return 'Approval Timeout';
    if (t === 'session_silence') return 'Session Silence';
    return t;
  }

  function typeDescription(t: MonitorType, threshold: number): string {
    if (t === 'approval_timeout') return `Fire when any approval is pending for >${threshold}min`;
    if (t === 'session_silence') return `Fire when any running session is silent for >${threshold}min`;
    return '';
  }

  function relTime(ts: string): string {
    try { return formatDistanceToNow(new Date(ts), { addSuffix: true }); } catch { return ts; }
  }
</script>

<svelte:head>
  <title>Monitors · NanoClaw Dashboard</title>
</svelte:head>

<div class="mx-auto flex max-w-4xl flex-col gap-6 p-6">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-semibold text-[hsl(var(--foreground))]">Alert Monitors</h1>
    <button
      onclick={() => showNewForm = !showNewForm}
      class="rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-sm text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
    >
      + New Monitor
    </button>
  </div>

  <!-- New monitor form -->
  {#if showNewForm}
    <div class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <h2 class="text-sm font-medium text-[hsl(var(--foreground))] mb-3">New Monitor</h2>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Name</span>
          <input
            bind:value={newName}
            placeholder="e.g. Approval Alert"
            class="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Type</span>
          <select bind:value={newType} class="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]">
            <option value="approval_timeout">Approval Timeout</option>
            <option value="session_silence">Session Silence</option>
          </select>
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Threshold (minutes)</span>
          <input
            type="number"
            bind:value={newThreshold}
            min="1"
            max="10080"
            class="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Cooldown (minutes)</span>
          <input
            type="number"
            bind:value={newCooldown}
            min="5"
            max="10080"
            class="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
        </label>
      </div>
      <p class="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{typeDescription(newType, newThreshold)}</p>
      {#if saveError}
        <p class="mt-2 text-xs text-red-400">{saveError}</p>
      {/if}
      <div class="mt-3 flex gap-2">
        <button
          onclick={createMonitor}
          disabled={saving || !newName.trim()}
          class="rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-sm text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? 'Creating…' : 'Create'}
        </button>
        <button
          onclick={() => { showNewForm = false; saveError = null; }}
          class="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  {/if}

  <!-- Monitors list -->
  <section>
    <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Configured Monitors</h2>
    {#if monitors.loading && !monitors.data}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
    {:else if monitors.error}
      <p class="text-sm text-red-400">Error: {monitors.error}</p>
    {:else if !monitors.data || monitors.data.length === 0}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">No monitors configured. Create one to start receiving alerts.</p>
    {:else}
      <div class="flex flex-col gap-2">
        {#each monitors.data as m (m.id)}
          <div class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-sm font-medium text-[hsl(var(--foreground))]">{m.name}</span>
                  <span class="text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))]">{typeLabel(m.type)}</span>
                  {#if !m.enabled}
                    <span class="text-xs px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-400">Paused</span>
                  {/if}
                </div>
                <p class="text-xs text-[hsl(var(--muted-foreground))]">{typeDescription(m.type, m.threshold_minutes)} · Cooldown: {m.cooldown_minutes}min</p>
                {#if m.last_fired_at}
                  <p class="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Last fired: {relTime(m.last_fired_at)}</p>
                {:else}
                  <p class="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Never fired</p>
                {/if}
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button
                  onclick={() => toggleMonitor(m)}
                  class="rounded px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
                >
                  {m.enabled ? 'Pause' : 'Enable'}
                </button>
                <button
                  onclick={() => deleteMonitor(m.id)}
                  class="rounded px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <!-- Alert history -->
  <section>
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-sm font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Alert History</h2>
      {#if alerts.data && alerts.data.some(a => !a.acknowledged)}
        <button
          onclick={acknowledgeAll}
          class="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          Acknowledge all
        </button>
      {/if}
    </div>

    {#if alerts.loading && !alerts.data}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
    {:else if !alerts.data || alerts.data.length === 0}
      <div class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-center">
        <p class="text-sm text-[hsl(var(--muted-foreground))]">No alerts fired yet.</p>
      </div>
    {:else}
      <div class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-[hsl(var(--border))] text-left text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              <th class="px-4 py-2 font-medium">Monitor</th>
              <th class="px-4 py-2 font-medium">Condition</th>
              <th class="px-4 py-2 font-medium">Fired</th>
              <th class="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {#each alerts.data as a (a.id)}
              <tr class="border-b border-[hsl(var(--border))]/40 transition-colors {a.acknowledged ? 'opacity-50' : 'bg-yellow-500/5'}">
                <td class="px-4 py-2 font-medium text-[hsl(var(--foreground))]">{a.monitor_name}</td>
                <td class="px-4 py-2 text-xs text-[hsl(var(--muted-foreground))] max-w-xs truncate">{a.condition_met}</td>
                <td class="px-4 py-2 text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">{relTime(a.fired_at)}</td>
                <td class="px-4 py-2 text-right">
                  {#if !a.acknowledged}
                    <button
                      onclick={() => fetch('/api/monitors/alerts/acknowledge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id }) })}
                      class="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                    >
                      Ack
                    </button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
</div>
