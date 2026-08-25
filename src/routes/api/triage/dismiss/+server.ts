import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { dismissItem } from '$lib/server/dashboard-db';
import { requireRole, audit } from '$lib/server/auth';

export async function POST({ request }: RequestEvent): Promise<Response> {
  const op = requireRole(request, 'admin');
  const body = await request.json() as { item_key?: string };
  if (!body.item_key || typeof body.item_key !== 'string') throw error(400, 'item_key required');
  dismissItem(body.item_key);
  audit(op.username, 'triage:dismiss', null, body.item_key);
  return json({ ok: true });
}
