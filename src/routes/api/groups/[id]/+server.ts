import { error, json } from '@sveltejs/kit';
import { getGroupById } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw error(400, 'Invalid group id');
  }

  const group = getGroupById(id);
  if (!group) {
    throw error(404, 'Group not found');
  }

  return json(group);
};
