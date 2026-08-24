import { json, error } from '@sveltejs/kit';
import { getTaskHistory, isFlapping } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
  const id = params.id;
  if (!id) throw error(400, 'Missing series_id');

  const groupId = url.searchParams.get('groupId');
  const sessionId = url.searchParams.get('sessionId');
  if (!groupId || !sessionId) throw error(400, 'Missing groupId or sessionId');

  const runs = getTaskHistory(groupId, sessionId, id);
  return json({ runs, flapping: isFlapping(runs) });
};
