import { error, json } from '@sveltejs/kit';
import { getSessionById } from '$lib/server/db';
import { getSessionContainerState } from '$lib/server/sessions';
import type { RequestHandler } from './$types';
import type { SessionDetail } from '$lib/types';

export const GET: RequestHandler = ({ params }) => {
  const id = params.id;
  if (!id || typeof id !== 'string') {
    throw error(400, 'Invalid session id');
  }

  const session = getSessionById(id);
  if (!session) {
    throw error(404, 'Session not found');
  }

  const container_state = getSessionContainerState(session.agent_group_id, session.id);

  const detail: SessionDetail = {
    ...session,
    container_state
  };

  return json(detail);
};
