import { error, json } from '@sveltejs/kit';
import { getGroupMembers } from '$lib/server/db';
import { execNcl } from '$lib/server/ncl';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
  const id = params.id;
  if (!id) throw error(400, 'Invalid group id');

  const members = getGroupMembers(id);
  return json(members);
};

export const POST: RequestHandler = async ({ params, request }) => {
  const groupId = params.id;
  if (!groupId) throw error(400, 'Missing group id');

  let body: { user?: string } = {};
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body');
  }

  if (!body.user || typeof body.user !== 'string' || !body.user.trim()) {
    throw error(400, 'user is required (format: platform:identifier)');
  }

  try {
    const output = await execNcl(['members', 'add', '--user', body.user.trim(), '--agent-group-id', groupId]);
    return json({ status: 'ok', output }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('approval-pending')) {
      return json({ status: 'approval-pending' }, { status: 202 });
    }
    throw error(500, msg);
  }
};
