<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';

  const navItems = [
    { href: '/', label: 'Overview' },
    { href: '/triage', label: 'Triage' },
    { href: '/run-history', label: 'Run History' },
    { href: '/monitors', label: 'Monitors' },
    { href: '/groups', label: 'Groups' },
    { href: '/sessions', label: 'Sessions' },
    { href: '/approvals', label: 'Approvals' },
    { href: '/dropped', label: 'Dropped' },
    { href: '/tasks', label: 'Tasks' }
  ] as const;

  let { children } = $props();
  let sidebarOpen = $state(false);
  let triageCount = $state(0);

  $effect(() => {
    function fetchCount() {
      fetch('/api/triage/count')
        .then(r => r.ok ? r.json() : { count: 0 })
        .then((d: { count: number }) => { triageCount = d.count; })
        .catch(() => {});
    }
    fetchCount();
    const iv = setInterval(fetchCount, 30000);
    return () => clearInterval(iv);
  });

  function isActive(href: string): boolean {
    if (href === '/') return page.url.pathname === '/';
    return page.url.pathname.startsWith(href);
  }

  function closeDrawer() {
    sidebarOpen = false;
  }
</script>

<svelte:head>
  <meta name="color-scheme" content="dark" />
</svelte:head>

<div class="flex h-screen overflow-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">

  <!-- Mobile header — only on small screens -->
  <div class="md:hidden fixed top-0 left-0 right-0 z-30 h-14 flex items-center justify-between px-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
    <div class="flex items-center gap-2">
      <span class="text-sm font-semibold tracking-tight">NanoClaw</span>
      <span class="text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))]">Dashboard</span>
    </div>
    <button
      onclick={() => sidebarOpen = true}
      class="flex items-center justify-center w-11 h-11 rounded-md hover:bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]"
      aria-label="Open navigation"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="2" y1="5" x2="18" y2="5"/>
        <line x1="2" y1="10" x2="18" y2="10"/>
        <line x1="2" y1="15" x2="18" y2="15"/>
      </svg>
    </button>
  </div>

  <!-- Mobile backdrop -->
  {#if sidebarOpen}
    <div
      class="md:hidden fixed inset-0 z-40 bg-black/50"
      onclick={closeDrawer}
      aria-hidden="true"
    ></div>
  {/if}

  <!-- Mobile drawer -->
  <div class="md:hidden fixed top-0 left-0 bottom-0 z-50 w-[220px] flex flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--muted))] transform transition-transform duration-200 {sidebarOpen ? 'translate-x-0' : '-translate-x-full'}">
    <div class="flex items-center gap-2 px-4 h-14 border-b border-[hsl(var(--border))] shrink-0">
      <span class="text-sm font-semibold tracking-tight">NanoClaw</span>
      <span class="text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))]">Dashboard</span>
    </div>
    <nav class="flex-1 py-4 px-2 space-y-1">
      {#each navItems as item}
        <a
          href={item.href}
          onclick={closeDrawer}
          class="flex items-center justify-between gap-3 px-3 py-2 min-h-[44px] rounded-md text-sm transition-colors
            {isActive(item.href)
              ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))] font-medium'
              : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]'}"
        >
          {item.label}
          {#if item.href === '/triage' && triageCount > 0}
            <span class="inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold h-4 min-w-[16px] px-1">{triageCount > 99 ? '99+' : triageCount}</span>
          {/if}
        </a>
      {/each}
    </nav>
    <div class="px-4 py-3 border-t border-[hsl(var(--border))] shrink-0">
      <p class="text-xs text-[hsl(var(--muted-foreground))]">v0.1.0</p>
    </div>
  </div>

  <!-- Desktop sidebar — hidden on mobile -->
  <aside class="hidden md:flex flex-col w-[220px] shrink-0 border-r border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
    <div class="flex items-center gap-2 px-4 h-14 border-b border-[hsl(var(--border))]">
      <span class="text-sm font-semibold tracking-tight">NanoClaw</span>
      <span class="text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))]">Dashboard</span>
    </div>
    <nav class="flex-1 py-4 px-2 space-y-1">
      {#each navItems as item}
        <a
          href={item.href}
          class="flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm transition-colors
            {isActive(item.href)
              ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))] font-medium'
              : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]'}"
        >
          {item.label}
          {#if item.href === '/triage' && triageCount > 0}
            <span class="inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold h-4 min-w-[16px] px-1">{triageCount > 99 ? '99+' : triageCount}</span>
          {/if}
        </a>
      {/each}
    </nav>
    <div class="px-4 py-3 border-t border-[hsl(var(--border))]">
      <p class="text-xs text-[hsl(var(--muted-foreground))]">v0.1.0</p>
    </div>
  </aside>

  <!-- Main content — top padding on mobile for fixed header -->
  <main class="flex-1 overflow-y-auto overflow-x-hidden pt-14 md:pt-0">
    {@render children()}
  </main>

</div>
