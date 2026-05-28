<script lang="ts">
  import { createPoller } from '$lib/poll';
  import type { HealthStatus, HealthStats } from '$lib/types';

  const health = createPoller<HealthStatus>(
    (signal) =>
      fetch('/api/health', { signal }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
    5000
  );

  const stats = createPoller<HealthStats>(
    (signal) =>
      fetch('/api/stats', { signal }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
    5000
  );
</script>

<div class="p-8">
  <div class="max-w-4xl mx-auto">
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-[hsl(var(--foreground))]">NanoClaw Dashboard</h1>
      <p class="mt-1 text-sm text-[hsl(var(--muted-foreground))]">System overview</p>
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
      <div class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
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
