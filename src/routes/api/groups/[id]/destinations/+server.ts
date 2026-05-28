import { error, json } from '@sveltejs/kit';
import { getGroupDestinations } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
  const id = params.id;
  if (!id) throw error(400, 'Invalid group id');

  const destinations = getGroupDestinations(id);
  return json(destinations);
};
