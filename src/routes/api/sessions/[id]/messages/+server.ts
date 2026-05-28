import { error, json } from '@sveltejs/kit';
import { getSessionMessages } from '$lib/server/db';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url }) => {
  const sessionId = params.id;
  if (!sessionId) throw error(400, 'Missing session id');

  // Look up agent_group_id from the central DB
  const row = db.prepare(
    'SELECT agent_group_id FROM sessions WHERE id = ?'
  ).get(sessionId) as { agent_group_id: string } | undefined;

  if (!row) throw error(404, 'Session not found');

  const search = url.searchParams.get('search') ?? undefined;
  const kind = url.searchParams.get('kind') ?? undefined;
  const since = url.searchParams.get('since') ?? undefined;
  const until = url.searchParams.get('until') ?? undefined;
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 200, 500) : 200;

  const messages = getSessionMessages(row.agent_group_id, sessionId, {
    search,
    kind,
    since,
    until,
    limit
  });

  return json(messages);
};
