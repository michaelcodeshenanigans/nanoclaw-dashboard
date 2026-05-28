import { error, json } from '@sveltejs/kit';
import { execNcl } from '$lib/server/ncl';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
  const groupId = params.id;
  if (!groupId) throw error(400, 'Missing group id');

  let body: { rebuild?: boolean; message?: string } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine
  }

  const args = ['groups', 'restart', '--id', groupId];
  if (body.rebuild) args.push('--rebuild');
  if (body.message && body.message.trim()) {
    args.push('--message', body.message.trim());
  }

  try {
    const output = await execNcl(args);
    return json({ status: 'ok', output });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('approval-pending')) {
      return json({ status: 'approval-pending' }, { status: 202 });
    }
    throw error(500, msg);
  }
};
