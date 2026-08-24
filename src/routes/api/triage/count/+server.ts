import { json } from '@sveltejs/kit';
import { getTriageItems } from '$lib/server/db';
import { getTriageState } from '$lib/server/dashboard-db';

export async function GET(): Promise<Response> {
  const items = getTriageItems();
  const state = getTriageState();
  const count = items.filter(
    item => !state.dismissed.has(item.item_key) && !state.snoozed.has(item.item_key)
  ).length;
  return json({ count });
}
