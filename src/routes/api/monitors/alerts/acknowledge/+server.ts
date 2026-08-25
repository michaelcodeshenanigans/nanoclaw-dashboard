import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { acknowledgeAlert, acknowledgeAllAlerts } from '$lib/server/dashboard-db';
import { requireRole, audit } from '$lib/server/auth';

export async function POST({ request }: RequestEvent): Promise<Response> {
  const op = requireRole(request, 'admin');
  const body = await request.json() as { id?: number; all?: boolean };
  if (body.all === true) {
    acknowledgeAllAlerts();
    audit(op.username, 'monitor:acknowledge', 'monitor', null, { all: true });
    return json({ ok: true });
  }
  if (typeof body.id !== 'number') throw error(400, 'id or all required');
  acknowledgeAlert(body.id);
  audit(op.username, 'monitor:acknowledge', 'monitor_alert', String(body.id));
  return json({ ok: true });
}
