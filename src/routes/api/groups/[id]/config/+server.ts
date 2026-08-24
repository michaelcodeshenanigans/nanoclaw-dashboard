import { error, json } from '@sveltejs/kit';
import { getGroupConfig } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const config = getGroupConfig(params.id);
  if (!config) throw error(404, 'Group not found');
  return json(config);
};
