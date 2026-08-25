<script lang="ts">
  import { createPoller, type PollState } from '$lib/poll';
  import type { RoleAssignment } from '$lib/types';

  let poll = $state<PollState<RoleAssignment[]>>({ data: null, loading: true, error: null, lastUpdated: null });
  let editUsername = $state('');
  let editRole = $state<'owner' | 'admin' | 'member'>('member');
  let saving = $state(false);
  let saveError = $state('');
  let saveOk = $state(false);

  $effect(() => {
    const p = createPoller<RoleAssignment[]>(
      signal => fetch('/api/roles', { signal }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      30000,
      s => { poll = s; }
    );
    return () => p.stop();
  });

  async function saveRole() {
    if (!editUsername.trim()) return;
    saving = true;
    saveError = '';
    saveOk = false;
    try {
      const res = await fetch(`/api/roles/${encodeURIComponent(editUsername.trim())}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: editRole })
      });
      if (!res.ok) {
        const text = await res.text();
        saveError = text || `HTTP ${res.status}`;
      } else {
        saveOk = true;
        editUsername = '';
        editRole = 'member';
      }
    } catch (err) {
      saveError = err instanceof Error ? err.message : 'Request failed';
    } finally {
      saving = false;
    }
  }

  function roleBadgeClass(role: string): string {
    if (role === 'owner') return 'bg-purple-500/20 text-purple-300';
    if (role === 'admin') return 'bg-blue-500/20 text-blue-300';
    return 'bg-zinc-700 text-zinc-300';
  }
</script>

<svelte:head><title>Roles — NanoClaw</title></svelte:head>

<div class="p-6 space-y-6">
  <h1 class="text-lg font-semibold">Operator Roles</h1>

  {#if poll.error}
    <div class="rounded-md bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">{poll.error}</div>
  {/if}

  <div class="rounded-md border border-[hsl(var(--border))] overflow-hidden">
    <table class="w-full text-sm">
      <thead class="bg-[hsl(var(--muted))]">
        <tr>
          <th class="text-left px-4 py-2.5 font-medium text-[hsl(var(--muted-foreground))]">Username</th>
          <th class="text-left px-4 py-2.5 font-medium text-[hsl(var(--muted-foreground))]">Role</th>
          <th class="text-left px-4 py-2.5 font-medium text-[hsl(var(--muted-foreground))]">Updated</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-[hsl(var(--border))]">
        {#if !poll.data || poll.data.length === 0}
          <tr><td colspan="3" class="px-4 py-6 text-center text-[hsl(var(--muted-foreground))]">No explicit role assignments.</td></tr>
        {/if}
        {#each poll.data ?? [] as a}
          <tr class="hover:bg-[hsl(var(--muted)/0.5)]">
            <td class="px-4 py-2.5 font-mono">{a.username}</td>
            <td class="px-4 py-2.5">
              <span class="text-xs px-2 py-0.5 rounded-full font-medium {roleBadgeClass(a.role)}">{a.role}</span>
            </td>
            <td class="px-4 py-2.5 text-[hsl(var(--muted-foreground))]">{a.updated_at.replace('T', ' ').slice(0, 19)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="rounded-md border border-[hsl(var(--border))] p-4 space-y-3 max-w-sm">
    <h2 class="text-sm font-medium">Assign Role</h2>
    <div class="space-y-2">
      <input
        type="text"
        placeholder="username"
        bind:value={editUsername}
        class="w-full h-9 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
      />
      <select
        bind:value={editRole}
        class="w-full h-9 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
      >
        <option value="member">member</option>
        <option value="admin">admin</option>
        <option value="owner">owner</option>
      </select>
    </div>
    <button
      onclick={saveRole}
      disabled={saving || !editUsername.trim()}
      class="h-9 px-4 rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-medium disabled:opacity-50"
    >
      {saving ? 'Saving…' : 'Save'}
    </button>
    {#if saveError}
      <p class="text-xs text-red-400">{saveError}</p>
    {/if}
    {#if saveOk}
      <p class="text-xs text-green-400">Role saved.</p>
    {/if}
    <p class="text-xs text-[hsl(var(--muted-foreground))]">
      Only owners can assign roles. Members of the admins group without an explicit mapping get admin automatically.
    </p>
  </div>
</div>
