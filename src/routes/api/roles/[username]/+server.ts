import { json, error } from '@sveltejs/kit';
import { setOperatorRole, getOperatorRole } from '$lib/server/dashboard-db';
import { requireRole, audit } from '$lib/server/auth';
import type { Role } from '$lib/types';
import type { RequestHandler } from './$types';

const VALID_ROLES = new Set<Role>(['owner', 'admin', 'member']);

export const PUT: RequestHandler = async ({ params, request }) => {
  const op = requireRole(request, 'owner');
  const username = params.username;
  if (!username?.trim()) throw error(400, 'username required');

  const body = await request.json() as { role?: string };
  if (!body.role || !VALID_ROLES.has(body.role as Role)) {
    throw error(400, 'role must be owner, admin, or member');
  }
  const newRole = body.role as Role;
  const oldRole = getOperatorRole(username, []);
  setOperatorRole(username, newRole);
  audit(op.username, 'role:set', 'user', username, { from: oldRole, to: newRole });
  return json({ username, role: newRole });
};
