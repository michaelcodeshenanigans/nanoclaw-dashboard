<script lang="ts">
  import { createPoller } from '$lib/poll';
  import type { HealthStatus } from '$lib/types';

  const health = createPoller<HealthStatus>(
    (signal) =>
      fetch('/api/health', { signal }).then((r) => {
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

    <div class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
      <h2 class="text-sm font-semibold text-[hsl(var(--foreground))] mb-4">System Health</h2>

      {#if health.loading}
        <p class="text-sm text-[hsl(var(--muted-foreground))]">Checking health…</p>
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
            Last updated: {health.lastUpdated.toLocaleTimeString()}
          </p>
        {/if}
      {/if}
    </div>
  </div>
</div>
