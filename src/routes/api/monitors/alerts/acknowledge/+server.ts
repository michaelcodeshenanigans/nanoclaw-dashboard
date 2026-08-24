import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { acknowledgeAlert, acknowledgeAllAlerts } from '$lib/server/dashboard-db';

export async function POST({ request }: RequestEvent): Promise<Response> {
  const body = await request.json() as { id?: number; all?: boolean };
  if (body.all === true) {
    acknowledgeAllAlerts();
    return json({ ok: true });
  }
  if (typeof body.id !== 'number') throw error(400, 'id or all required');
  acknowledgeAlert(body.id);
  return json({ ok: true });
}
