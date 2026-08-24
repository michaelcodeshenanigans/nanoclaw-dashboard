import { error, json } from '@sveltejs/kit';
import { execNcl } from '$lib/server/ncl';
import type { RequestHandler } from './$types';

// ncl has no "stop" verb; restart without --message stops the container and
// only restarts it on the next user message — effectively an emergency stop.
export const POST: RequestHandler = async ({ params }) => {
  const id = params.id;
  if (!id) throw error(400, 'Missing group id');

  try {
    const output = await execNcl(['groups', 'restart', '--id', id]);
    return json({ status: 'ok', output });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('approval-pending')) {
      return json({ status: 'approval-pending' }, { status: 202 });
    }
    throw error(500, msg);
  }
};
