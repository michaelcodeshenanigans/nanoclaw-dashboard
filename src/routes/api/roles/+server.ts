import { json } from '@sveltejs/kit';
import { getRoleAssignments } from '$lib/server/dashboard-db';
import { requireRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
  requireRole(request, 'admin');
  return json(getRoleAssignments());
};
