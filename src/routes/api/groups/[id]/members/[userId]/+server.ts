import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { execNcl } from '$lib/server/ncl';
import { requireRole, audit } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, request }) => {
  const op = requireRole(request, 'admin');
  const { id: groupId, userId } = params;
  if (!groupId) throw error(400, 'Missing group id');
  if (!userId) throw error(400, 'Missing user id');

  // Look up user's platform and platform_id to construct --user flag
  const user = db.prepare(
    'SELECT platform, platform_id FROM users WHERE id = ?'
  ).get(userId) as { platform: string; platform_id: string } | undefined;

  if (!user) throw error(404, 'User not found');

  const userFlag = `${user.platform}:${user.platform_id}`;

  try {
    const output = await execNcl(['members', 'remove', '--user', userFlag, '--agent-group-id', groupId]);
    audit(op.username, 'member:remove', 'group', groupId, { user: userFlag });
    return json({ status: 'ok', output });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('approval-pending')) {
      return json({ status: 'approval-pending' }, { status: 202 });
    }
    throw error(500, msg);
  }
};
