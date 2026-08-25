import { error, json } from '@sveltejs/kit';
import { execNcl } from '$lib/server/ncl';
import { requireRole, audit } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
  const op = requireRole(request, 'admin');
  const id = params.id;
  if (!id) throw error(400, 'Missing series_id');

  try {
    const output = await execNcl(['tasks', 'run', '--id', id]);
    audit(op.username, 'task:run', 'task', id);
    return json({ status: 'ok', output });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('approval-pending')) {
      audit(op.username, 'task:run', 'task', id, { pending: true });
      return json({ status: 'approval-pending' }, { status: 202 });
    }
    throw error(500, msg);
  }
};
