<script lang="ts">
  import { createPoller, type PollState } from '$lib/poll';
  import type { HealthStatus, HealthStats, KpiStats, MonitorAlert, HostHealth } from '$lib/types';

  let health = $state<PollState<HealthStatus>>({ data: null, loading: true, error: null, lastUpdated: null });
  let stats = $state<PollState<HealthStats>>({ data: null, loading: true, error: null, lastUpdated: null });
  let kpi = $state<PollState<KpiStats>>({ data: null, loading: true, error: null, lastUpdated: null });

  $effect(() => {
    const p = createPoller<HealthStatus>(
      (signal) => fetch('/api/health', { signal }).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      5000,
      (s) => { health = s; }
    );
    return () => p.stop();
  });

  $effect(() => {
    const p = createPoller<HealthStats>(
      (signal) => fetch('/api/stats', { signal }).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      5000,
      (s) => { stats = s; }
    );
    return () => p.stop();
  });

  $effect(() => {
    const p = createPoller<KpiStats>(
      (signal) => fetch('/api/kpi', { signal }).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      5000,
      (s) => { kpi = s; }
    );
    return () => p.stop();
  });

  type TrendDir = 'up' | 'down' | 'flat';

  function calcTrend(current: number, prior: number): TrendDir {
    if (prior === 0 && current === 0) return 'flat';
    if (prior === 0) return 'up';
    const pct = (current - prior) / prior;
    if (Math.abs(pct) < 0.01) return 'flat';
    return pct > 0 ? 'up' : 'down';
  }

  function deltaLabel(current: number, prior: number): string {
    if (prior === 0) return '';
    const pct = ((current - prior) / prior) * 100;
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(0)}%`;
  }

  function trendClass(dir: TrendDir, higherIsBad: boolean): string {
    if (dir === 'flat') return 'text-[hsl(var(--muted-foreground))]';
    if (higherIsBad) return dir === 'up' ? 'text-red-400' : 'text-green-400';
    return 'text-[hsl(var(--muted-foreground))]';
  }

  function arrow(dir: TrendDir): string {
    return dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→';
  }

  function fmtDuration(s: number | null): string {
    if (s === null) return '—';
    if (s < 60) return `${Math.round(s)}s`;
    if (s < 3600) return `${Math.round(s / 60)}m`;
    return `${(s / 3600).toFixed(1)}h`;
  }

  let hostHealth = $state<PollState<HostHealth>>({ data: null, loading: true, error: null, lastUpdated: null });

  $effect(() => {
    const p = createPoller<HostHealth>(
      (signal) => fetch('/api/health/host', { signal }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      10000,
      s => { hostHealth = s; }
    );
    return () => p.stop();
  });

  function resourceColor(pct: number, diskMode = false): string {
    const warn = diskMode ? 70 : 60;
    const crit = diskMode ? 85 : 80;
    if (pct >= crit) return 'text-red-400';
    if (pct >= warn) return 'text-yellow-400';
    return 'text-green-400';
  }

  function barColor(pct: number, diskMode = false): string {
    const warn = diskMode ? 70 : 60;
    const crit = diskMode ? 85 : 80;
    if (pct >= crit) return 'bg-red-500';
    if (pct >= warn) return 'bg-yellow-500';
    return 'bg-green-500';
  }

  function raidStateColor(state: string): string {
    if (state === 'degraded') return 'text-red-400';
    if (state === 'rebuilding') return 'text-yellow-400';
    return 'text-green-400';
  }

  let activeAlerts = $state<MonitorAlert[]>([]);
  $effect(() => {
    function fetchAlerts() {
      fetch('/api/monitors/alerts?limit=5&unacknowledged=true')
        .then(r => r.ok ? r.json() : [])
        .then((d: MonitorAlert[]) => { activeAlerts = d; })
        .catch(() => {});
    }
    fetchAlerts();
    const iv = setInterval(fetchAlerts, 30000);
    return () => clearInterval(iv);
  });

  async function acknowledgeAlert(id: number) {
    activeAlerts = activeAlerts.filter(a => a.id !== id);
    await fetch('/api/monitors/alerts/acknowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
  }

  // Derived KPI tiles from reactive kpi data
  let kpiTiles = $derived.by(() => {
    const d = kpi.data;
    if (!d) return null;

    const sessTrend = calcTrend(d.current.sessions, d.prior.sessions);
    const failTrend = calcTrend(d.current.failures, d.prior.failures);
    const rateTrend = calcTrend(d.current.failure_rate, d.prior.failure_rate);
    const durTrend = d.current.avg_duration_s !== null && d.prior.avg_duration_s !== null
      ? calcTrend(d.current.avg_duration_s, d.prior.avg_duration_s)
      : 'flat' as TrendDir;

    return {
      sessions: {
        value: String(d.current.sessions),
        valueClass: 'text-[hsl(var(--foreground))]',
        showDelta: d.prior.sessions > 0,
        deltaText: `${arrow(sessTrend)} ${deltaLabel(d.current.sessions, d.prior.sessions)} vs prior`,
        deltaClass: trendClass(sessTrend, false)
      },
      failures: {
        value: String(d.current.failures),
        valueClass: d.current.failures > 0 ? 'text-red-400' : 'text-[hsl(var(--foreground))]',
        showDelta: d.prior.failures > 0 || d.current.failures > 0,
        deltaText: `${arrow(failTrend)} ${deltaLabel(d.current.failures, d.prior.failures)} vs prior`,
        deltaClass: trendClass(failTrend, true)
      },
      failureRate: {
        value: `${d.current.failure_rate.toFixed(1)}%`,
        valueClass: d.current.failure_rate > 10 ? 'text-red-400' : d.current.failure_rate > 0 ? 'text-yellow-400' : 'text-[hsl(var(--foreground))]',
        showDelta: d.prior.sessions > 0,
        deltaText: `${arrow(rateTrend)} vs prior`,
        deltaClass: trendClass(rateTrend, true)
      },
      avgDuration: {
        value: fmtDuration(d.current.avg_duration_s),
        valueClass: 'text-[hsl(var(--foreground))]',
        showDelta: d.current.avg_duration_s !== null && d.prior.avg_duration_s !== null,
        deltaText: `${arrow(durTrend)} vs prior`,
        deltaClass: trendClass(durTrend, false)
      }
    };
  });
</script>

<div class="p-4 md:p-8">
  <div class="max-w-6xl mx-auto">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-[hsl(var(--foreground))]">NanoClaw Dashboard</h1>
      <p class="mt-1 text-sm text-[hsl(var(--muted-foreground))]">System overview</p>
    </div>

    <!-- Monitor Alerts -->
    {#if activeAlerts.length > 0}
      <div class="mb-4 flex flex-col gap-2">
        {#each activeAlerts as alert (alert.id)}
          <div class="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
            <span class="mt-0.5 text-yellow-400 shrink-0">⚠</span>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-yellow-300">{alert.monitor_name}</p>
              <p class="text-xs text-yellow-400/80 mt-0.5">{alert.condition_met}</p>
            </div>
            <button
              onclick={() => acknowledgeAlert(alert.id)}
              class="shrink-0 text-xs text-yellow-400/60 hover:text-yellow-300 transition-colors"
              aria-label="Dismiss alert"
            >
              ✕
            </button>
          </div>
        {/each}
      </div>
    {/if}

    <!-- KPI Banner -->
    <div class="mb-6">
      <p class="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">Last 7 days</p>

      {#if kpi.loading}
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {#each { length: 5 } as _}
            <div class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 h-20"></div>
          {/each}
        </div>
      {:else if kpi.error}
        <p class="text-sm text-red-400">KPI error: {kpi.error}</p>
      {:else if kpiTiles}
        {@const t = kpiTiles}
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">

          <!-- Sessions -->
          <div class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <p class="text-xs text-[hsl(var(--muted-foreground))] mb-1">Sessions</p>
            <p class="text-2xl font-bold {t!.sessions.valueClass}">{t!.sessions.value}</p>
            {#if t!.sessions.showDelta}
              <p class="text-xs mt-1 {t!.sessions.deltaClass}">{t!.sessions.deltaText}</p>
            {/if}
          </div>

          <!-- Failures -->
          <div class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <p class="text-xs text-[hsl(var(--muted-foreground))] mb-1">Failures</p>
            <p class="text-2xl font-bold {t!.failures.valueClass}">{t!.failures.value}</p>
            {#if t!.failures.showDelta}
              <p class="text-xs mt-1 {t!.failures.deltaClass}">{t!.failures.deltaText}</p>
            {/if}
          </div>

          <!-- Failure Rate -->
          <div class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <p class="text-xs text-[hsl(var(--muted-foreground))] mb-1">Failure Rate</p>
            <p class="text-2xl font-bold {t!.failureRate.valueClass}">{t!.failureRate.value}</p>
            {#if t!.failureRate.showDelta}
              <p class="text-xs mt-1 {t!.failureRate.deltaClass}">{t!.failureRate.deltaText}</p>
            {/if}
          </div>

          <!-- Avg Duration -->
          <div class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <p class="text-xs text-[hsl(var(--muted-foreground))] mb-1">Avg Duration</p>
            <p class="text-2xl font-bold {t!.avgDuration.valueClass}">{t!.avgDuration.value}</p>
            {#if t!.avgDuration.showDelta}
              <p class="text-xs mt-1 {t!.avgDuration.deltaClass}">{t!.avgDuration.deltaText}</p>
            {/if}
          </div>

          <!-- Spend -->
          <div class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <p class="text-xs text-[hsl(var(--muted-foreground))] mb-1">Spend</p>
            <p class="text-2xl font-bold text-[hsl(var(--muted-foreground))]">—</p>
            <p class="text-xs mt-1 text-[hsl(var(--muted-foreground))]">Unavailable</p>
          </div>

        </div>
      {/if}
    </div>

    <!-- Host Resource Strip -->
    <div class="mb-6 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-4">
      <div class="flex items-center justify-between mb-3">
        <p class="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Host resources</p>
        {#if hostHealth.lastUpdated}
          <p class="text-xs text-[hsl(var(--muted-foreground))]">Updated {hostHealth.lastUpdated.toLocaleTimeString()}</p>
        {/if}
      </div>
      {#if hostHealth.loading && !hostHealth.data}
        <p class="text-xs text-[hsl(var(--muted-foreground))]">Sampling…</p>
      {:else if hostHealth.error || !hostHealth.data}
        <p class="text-xs text-red-400">Unavailable</p>
      {:else}
        {@const h = hostHealth.data}
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <!-- CPU -->
          <div>
            <div class="flex items-baseline justify-between mb-1">
              <span class="text-xs text-[hsl(var(--muted-foreground))]">CPU</span>
              <span class="text-sm font-semibold {resourceColor(h.cpu_pct)}">{h.cpu_pct.toFixed(1)}%</span>
            </div>
            <div class="h-1.5 w-full rounded-full bg-[hsl(var(--muted))]">
              <div class="h-1.5 rounded-full transition-all {barColor(h.cpu_pct)}" style="width: {Math.min(h.cpu_pct, 100)}%"></div>
            </div>
          </div>
          <!-- Memory -->
          <div>
            <div class="flex items-baseline justify-between mb-1">
              <span class="text-xs text-[hsl(var(--muted-foreground))]">Memory</span>
              <span class="text-sm font-semibold {resourceColor(h.mem.pct)}">{h.mem.pct.toFixed(1)}% <span class="text-xs font-normal text-[hsl(var(--muted-foreground))]">{h.mem.used_mb >= 1024 ? (h.mem.used_mb / 1024).toFixed(1) + 'G' : h.mem.used_mb + 'M'} / {h.mem.total_mb >= 1024 ? (h.mem.total_mb / 1024).toFixed(0) + 'G' : h.mem.total_mb + 'M'}</span></span>
            </div>
            <div class="h-1.5 w-full rounded-full bg-[hsl(var(--muted))]">
              <div class="h-1.5 rounded-full transition-all {barColor(h.mem.pct)}" style="width: {Math.min(h.mem.pct, 100)}%"></div>
            </div>
          </div>
          <!-- Disk (/) -->
          <div>
            <div class="flex items-baseline justify-between mb-1">
              <span class="text-xs text-[hsl(var(--muted-foreground))]">Disk (/)</span>
              <span class="text-sm font-semibold {resourceColor(h.disk.pct, true)}">{h.disk.pct}% <span class="text-xs font-normal text-[hsl(var(--muted-foreground))]">{h.disk.used_gb}G / {h.disk.total_gb}G</span></span>
            </div>
            <div class="h-1.5 w-full rounded-full bg-[hsl(var(--muted))]">
              <div class="h-1.5 rounded-full transition-all {barColor(h.disk.pct, true)}" style="width: {Math.min(h.disk.pct, 100)}%"></div>
            </div>
          </div>
          <!-- RAID md0 -->
          {#if h.raid}
            {@const r = h.raid}
            <div>
              <div class="flex items-baseline justify-between mb-1">
                <span class="text-xs text-[hsl(var(--muted-foreground))]">RAID {r.name}</span>
                <span class="text-sm font-semibold {r.state === 'degraded' ? resourceColor(100) : resourceColor(r.pct, true)}">
                  {#if r.state !== 'clean'}
                    <span class="{raidStateColor(r.state)} capitalize mr-1">{r.state}</span>
                  {/if}
                  {r.pct}% <span class="text-xs font-normal text-[hsl(var(--muted-foreground))]">{r.used_gb}T / {r.total_gb}T</span>
                </span>
              </div>
              <div class="h-1.5 w-full rounded-full bg-[hsl(var(--muted))]">
                <div class="h-1.5 rounded-full transition-all {r.state === 'degraded' ? 'bg-red-500' : barColor(r.pct, true)}" style="width: {Math.min(r.pct, 100)}%"></div>
              </div>
              <p class="mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">{r.active_devices}/{r.total_devices} drives · {r.state}</p>
            </div>
          {/if}
        </div>
        <p class="mt-2 text-[10px] text-[hsl(var(--muted-foreground))]">Host-aggregate totals — not per-container (no docker.sock)</p>
      {/if}
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

      <!-- Infrastructure health card -->
      <div class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <h2 class="text-sm font-semibold text-[hsl(var(--foreground))] mb-4">Infrastructure</h2>

        {#if health.loading}
          <p class="text-sm text-[hsl(var(--muted-foreground))]">Checking…</p>
        {:else if health.error}
          <p class="text-sm text-red-400">Error: {health.error}</p>
        {:else if health.data}
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-[hsl(var(--muted-foreground))]">Overall</span>
              <span class="text-sm font-medium {health.data.status === 'ok' ? 'text-green-400' : 'text-yellow-400'}">
                {health.data.status === 'ok' ? 'OK' : 'Degraded'}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-[hsl(var(--muted-foreground))]">Database</span>
              <span class="text-sm font-medium {health.data.db.ok ? 'text-green-400' : 'text-red-400'}">
                {health.data.db.ok ? 'Connected' : health.data.db.error ?? 'Error'}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-[hsl(var(--muted-foreground))]">ncl socket</span>
              <span class="text-sm font-medium {health.data.ncl.ok ? 'text-green-400' : 'text-red-400'}">
                {health.data.ncl.ok ? 'Available' : health.data.ncl.error ?? 'Error'}
              </span>
            </div>
          </div>
          {#if health.lastUpdated}
            <p class="mt-4 text-xs text-[hsl(var(--muted-foreground))]">
              Updated {health.lastUpdated.toLocaleTimeString()}
            </p>
          {/if}
        {/if}
      </div>

      <!-- System stats card -->
      <div class="rounded-lg border border-[hsl(var(--card))] bg-[hsl(var(--card))] p-6">
        <h2 class="text-sm font-semibold text-[hsl(var(--foreground))] mb-4">System</h2>

        {#if stats.loading}
          <p class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
        {:else if stats.error}
          <p class="text-sm text-red-400">Error: {stats.error}</p>
        {:else if stats.data}
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-[hsl(var(--muted-foreground))]">Active sessions</span>
              <span class="text-sm font-medium text-[hsl(var(--foreground))]">{stats.data.active_sessions}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-[hsl(var(--muted-foreground))]">Containers</span>
              <span class="text-sm font-medium text-[hsl(var(--foreground))]">
                <span class="text-green-400">{stats.data.container_statuses.running}</span> running
                · <span class="text-gray-400">{stats.data.container_statuses.stopped}</span> stopped
                · <span class="text-red-400">{stats.data.container_statuses.error}</span> error
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-[hsl(var(--muted-foreground))]">Errors (24h)</span>
              <span class="text-sm font-medium {stats.data.recent_errors > 0 ? 'text-red-400' : 'text-green-400'}">
                {stats.data.recent_errors}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-[hsl(var(--muted-foreground))]">Total groups</span>
              <span class="text-sm font-medium text-[hsl(var(--foreground))]">
                <a href="/groups" class="hover:underline">{stats.data.total_groups}</a>
              </span>
            </div>
          </div>
          {#if stats.lastUpdated}
            <p class="mt-4 text-xs text-[hsl(var(--muted-foreground))]">
              Updated {stats.lastUpdated.toLocaleTimeString()}
            </p>
          {/if}
        {/if}
      </div>

    </div>
  </div>
</div>
