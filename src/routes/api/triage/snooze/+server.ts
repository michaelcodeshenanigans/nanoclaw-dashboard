import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { snoozeItem } from '$lib/server/dashboard-db';
import { requireRole, audit } from '$lib/server/auth';

export async function POST({ request }: RequestEvent): Promise<Response> {
  const op = requireRole(request, 'admin');
  const body = await request.json() as { item_key?: string; minutes?: number };
  if (!body.item_key || typeof body.item_key !== 'string') throw error(400, 'item_key required');
  const mins = typeof body.minutes === 'number' && body.minutes > 0
    ? Math.min(body.minutes, 10080) : 60;
  snoozeItem(body.item_key, mins);
  audit(op.username, 'triage:snooze', null, body.item_key, { minutes: mins });
  return json({ ok: true });
}
