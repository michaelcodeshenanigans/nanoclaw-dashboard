import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLlmCalls } from '$lib/server/db';

export const GET: RequestHandler = ({ params }) => {
  const calls = getLlmCalls(params.id);
  return json(calls);
};
