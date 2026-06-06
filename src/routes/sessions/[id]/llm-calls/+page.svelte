<script lang="ts">
  import { page } from '$app/stores';
  import { createPoller, type PollState } from '$lib/poll';
  import type { LlmCall } from '$lib/types';
  import { format } from 'date-fns';

  const id = $page.params.id;

  let calls = $state<PollState<LlmCall[]>>({ data: null, loading: true, error: null, lastUpdated: null });
  let expandedId = $state<number | null>(null);

  $effect(() => {
    const p = createPoller<LlmCall[]>(
      signal => fetch(`/api/sessions/${id}/llm-calls`, { signal })
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      10000,
      s => { calls = s; }
    );
    return () => p.stop();
  });

  function fmt(ts: string): string {
    try { return format(new Date(ts), 'HH:mm:ss'); } catch { return ts; }
  }

  function preview(text: string | null): string {
    if (!text) return '—';
    const trimmed = text.trim().replace(/\n/g, ' ');
    return trimmed.length > 80 ? trimmed.slice(0, 80) + '…' : trimmed;
  }

  function toggleExpand(callId: number) {
    expandedId = expandedId === callId ? null : callId;
  }
</script>

<svelte:head><title>LLM Calls · Session {id} · NanoClaw</title></svelte:head>

<div class="mx-auto flex max-w-6xl flex-col gap-6 p-6">
  <div class="flex items-center gap-4">
    <a href="/sessions/{id}" class="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
      ← Session
    </a>
    <h1 class="text-2xl font-semibold text-[hsl(var(--foreground))]">LLM Calls</h1>
    <span class="text-sm text-[hsl(var(--muted-foreground))] font-mono">{id}</span>
  </div>

  <section class="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
    {#if calls.loading && !calls.data}
      <p class="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
    {:else if calls.error}
      <p class="text-sm text-red-500">Failed to load LLM calls: {calls.error}</p>
    {:else if !calls.data || calls.data.length === 0}
      <div class="py-12 text-center">
        <p class="text-sm text-[hsl(var(--muted-foreground))]">No LLM call data recorded yet.</p>
        <p class="text-xs text-[hsl(var(--muted-foreground))] mt-2">LLM calls are logged once the agent-runner is updated to Phase 10A.</p>
      </div>
    {:else}
      <div class="mb-3 text-xs text-[hsl(var(--muted-foreground))]">
        {calls.data.length} call{calls.data.length !== 1 ? 's' : ''}
        {#if calls.lastUpdated}· updated {calls.lastUpdated.toLocaleTimeString()}{/if}
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-[hsl(var(--border))] text-left text-[hsl(var(--muted-foreground))] text-xs uppercase tracking-wide">
              <th class="pb-3 pr-4 font-medium">#</th>
              <th class="pb-3 pr-4 font-medium">Time</th>
              <th class="pb-3 pr-4 font-medium">Model</th>
              <th class="pb-3 pr-4 font-medium text-right">In</th>
              <th class="pb-3 pr-4 font-medium text-right">Out</th>
              <th class="pb-3 pr-4 font-medium text-right">ms</th>
              <th class="pb-3 font-medium">Thinking</th>
            </tr>
          </thead>
          <tbody>
            {#each calls.data as call (call.id)}
              <tr class="border-b border-[hsl(var(--border))]/50 hover:bg-[hsl(var(--accent))]/20 transition-colors">
                <td class="py-3 pr-4 font-mono text-xs text-[hsl(var(--muted-foreground))]">{call.turn_seq}</td>
                <td class="py-3 pr-4 font-mono text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">{fmt(call.timestamp)}</td>
                <td class="py-3 pr-4 text-xs text-[hsl(var(--muted-foreground))]">{call.model ?? '—'}</td>
                <td class="py-3 pr-4 text-xs text-right font-mono">{call.input_tokens ?? '—'}</td>
                <td class="py-3 pr-4 text-xs text-right font-mono">{call.output_tokens ?? '—'}</td>
                <td class="py-3 pr-4 text-xs text-right font-mono text-[hsl(var(--muted-foreground))]">{call.duration_ms ?? '—'}</td>
                <td class="py-3">
                  {#if call.thinking_text}
                    <div class="flex items-start gap-2">
                      <button
                        onclick={() => toggleExpand(call.id)}
                        class="shrink-0 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                        aria-label="Toggle thinking"
                      >
                        {expandedId === call.id ? '▼' : '▶'}
                      </button>
                      <span class="text-xs text-[hsl(var(--muted-foreground))] truncate max-w-sm" title={call.thinking_text}>
                        {preview(call.thinking_text)}
                      </span>
                    </div>
                  {:else}
                    <span class="text-xs text-[hsl(var(--muted-foreground))]">—</span>
                  {/if}
                </td>
              </tr>
              {#if expandedId === call.id && call.thinking_text}
                <tr class="border-b border-[hsl(var(--border))]/50">
                  <td colspan="7" class="px-4 pb-4 pt-1">
                    <pre class="text-xs bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-96 overflow-y-auto">{call.thinking_text}</pre>
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
</div>
