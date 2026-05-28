<script lang="ts">
  import { createPoller } from '$lib/poll';
  import type { PendingApproval } from '$lib/types';
  import { formatDistanceToNow } from 'date-fns';

  let statusFilter = $state('pending');

  const approvals = createPoller<PendingApproval[]>(
    (signal) =>
      fetch(`/api/approvals?status=${statusFilter}`, { signal }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
    5000
  );

  function statusBadge(status: string): string {
    switch (status) {
      case 'pending':  return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'approved': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'rejected': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'expired':  return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default:         return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  }

  function fmtDate(iso: string): string {
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true });
    } catch {
      return iso;
    }
  }
</script>

<div class="p-8">
  <div class="max-w-6xl mx-auto space-y-6">

    <!-- Header -->
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold text-[hsl(var(--foreground))]">Approval Queue</h1>
        <p class="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          {#if approvals.lastUpdated}
            Updated {approvals.lastUpdated.toLocaleTimeString()}
          {:else}
            Loading…
          {/if}
        </p>
      </div>
      <!-- Status filter -->
      <select
        bind:value={statusFilter}
        class="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
      >
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="expired">Expired</option>
        <option value="all">All</option>
      </select>
    </div>

    <!-- Resolution notice -->
    <div class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <p class="text-sm text-[hsl(var(--muted-foreground))]">
        <span class="font-medium text-[hsl(var(--foreground))]">To approve or reject:</span>
        respond to the approval message in the originating chat platform (Telegram, etc.).
        NanoClaw has no programmatic approve/reject API — all approvals are resolved via the
        messaging platform where the request originated.
      </p>
    </div>

    <!-- Table card -->
    <div class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-[hsl(var(--card-foreground))]">
      {#if approvals.loading && !approvals.data}
        <p class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
      {:else if approvals.error}
        <p class="text-sm text-red-500">Failed to load approvals: {approvals.error}</p>
      {:else if !approvals.data || approvals.data.length === 0}
        <p class="text-sm text-[hsl(var(--muted-foreground))]">No {statusFilter === 'all' ? '' : statusFilter} approvals.</p>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-[hsl(var(--border))] text-left text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                <th class="pb-3 pr-4 font-medium">Title</th>
                <th class="pb-3 pr-4 font-medium">Action</th>
                <th class="pb-3 pr-4 font-medium">Group</th>
                <th class="pb-3 pr-4 font-medium">Channel</th>
                <th class="pb-3 pr-4 font-medium">Created</th>
                <th class="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {#each approvals.data as a (a.approval_id)}
                <tr class="border-b border-[hsl(var(--border))]/50 hover:bg-[hsl(var(--accent))]/20 transition-colors">
                  <td class="py-3 pr-4 font-medium">{a.title}</td>
                  <td class="py-3 pr-4 font-mono text-xs text-[hsl(var(--muted-foreground))]">{a.action}</td>
                  <td class="py-3 pr-4 text-xs text-[hsl(var(--muted-foreground))]">
                    {a.group_name ?? a.agent_group_id ?? '—'}
                  </td>
                  <td class="py-3 pr-4 text-xs text-[hsl(var(--muted-foreground))]">
                    {a.channel_type ?? '—'}
                    {#if a.platform_id}
                      <span class="block font-mono">{a.platform_id}</span>
                    {/if}
                  </td>
                  <td class="py-3 pr-4 text-xs text-[hsl(var(--muted-foreground))]">{fmtDate(a.created_at)}</td>
                  <td class="py-3">
                    <span class="inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium {statusBadge(a.status)}">
                      {a.status}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

  </div>
</div>
