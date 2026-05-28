<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';

  const navItems = [
    { href: '/', label: 'Overview' },
    { href: '/groups', label: 'Groups' },
    { href: '/sessions', label: 'Sessions' },
    { href: '/approvals', label: 'Approvals' },
    { href: '/dropped', label: 'Dropped' },
    { href: '/tasks', label: 'Tasks' }
  ] as const;

  let { children } = $props();

  function isActive(href: string): boolean {
    if (href === '/') return page.url.pathname === '/';
    return page.url.pathname.startsWith(href);
  }
</script>

<svelte:head>
  <meta name="color-scheme" content="dark" />
</svelte:head>

<div class="flex h-screen overflow-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
  <aside class="flex flex-col w-[220px] shrink-0 border-r border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
    <div class="flex items-center gap-2 px-4 h-14 border-b border-[hsl(var(--border))]">
      <span class="text-sm font-semibold tracking-tight">NanoClaw</span>
      <span class="text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))]">Dashboard</span>
    </div>
    <nav class="flex-1 py-4 px-2 space-y-1">
      {#each navItems as item}
        <a
          href={item.href}
          class="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
            {isActive(item.href)
              ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))] font-medium'
              : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]'}"
        >
          {item.label}
        </a>
      {/each}
    </nav>
    <div class="px-4 py-3 border-t border-[hsl(var(--border))]">
      <p class="text-xs text-[hsl(var(--muted-foreground))]">v0.1.0</p>
    </div>
  </aside>
  <main class="flex-1 overflow-y-auto">
    {@render children()}
  </main>
</div>
