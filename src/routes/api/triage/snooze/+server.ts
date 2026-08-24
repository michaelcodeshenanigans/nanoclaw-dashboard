import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { snoozeItem } from '$lib/server/dashboard-db';

export async function POST({ request }: RequestEvent): Promise<Response> {
  const body = await request.json() as { item_key?: string; minutes?: number };
  if (!body.item_key || typeof body.item_key !== 'string') throw error(400, 'item_key required');
  const mins = typeof body.minutes === 'number' && body.minutes > 0
    ? Math.min(body.minutes, 10080) : 60;
  snoozeItem(body.item_key, mins);
  return json({ ok: true });
}
