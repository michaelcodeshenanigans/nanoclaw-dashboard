import { error, json } from '@sveltejs/kit';
import { getGroupSessions } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw error(400, 'Invalid group id');
  }

  const sessions = getGroupSessions(id);
  return json(sessions);
};
