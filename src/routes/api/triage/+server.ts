import { json } from '@sveltejs/kit';
import { getTriageItems } from '$lib/server/db';
import { getTriageState, isDashboardDbAvailable } from '$lib/server/dashboard-db';
import type { TriageItem } from '$lib/types';

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export async function GET(): Promise<Response> {
  const items = getTriageItems();
  const state = getTriageState();

  const filtered: TriageItem[] = items.filter(
    item => !state.dismissed.has(item.item_key) && !state.snoozed.has(item.item_key)
  );

  filtered.sort((a, b) => {
    const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pd !== 0) return pd;
    return b.occurred_at.localeCompare(a.occurred_at);
  });

  return json({
    items: filtered,
    counts: {
      total: filtered.length,
      approval: filtered.filter(i => i.item_type === 'approval').length,
      dropped: filtered.filter(i => i.item_type === 'dropped').length,
      stalled: filtered.filter(i => i.item_type === 'stalled').length,
      overdue_task: filtered.filter(i => i.item_type === 'overdue_task').length
    },
    state_available: isDashboardDbAvailable()
  });
}
