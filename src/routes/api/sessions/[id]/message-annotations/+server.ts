import { json } from '@sveltejs/kit';
import { getMessageAnnotationsForSession } from '$lib/server/dashboard-db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  return json(getMessageAnnotationsForSession(params.id));
};
