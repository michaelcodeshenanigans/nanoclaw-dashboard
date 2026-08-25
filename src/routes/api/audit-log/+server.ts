import { json } from '@sveltejs/kit';
import { getAuditLog, getAuditActors } from '$lib/server/dashboard-db';
import { requireRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url }) => {
  requireRole(request, 'admin');
  const actor = url.searchParams.get('actor') ?? undefined;
  const action = url.searchParams.get('action') ?? undefined;
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '200', 10), 500);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
  const actors = getAuditActors();
  const entries = getAuditLog({ actor, action, limit, offset });
  return json({ entries, actors });
};
