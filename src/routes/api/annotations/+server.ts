import { json, error } from '@sveltejs/kit';
import { getAnnotation, upsertAnnotation, deleteAnnotation } from '$lib/server/dashboard-db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const targetType = url.searchParams.get('targetType');
  const targetId = url.searchParams.get('targetId');
  if (!targetType || !targetId) throw error(400, 'Missing targetType or targetId');
  return json(getAnnotation(targetType, targetId));
};

export const PUT: RequestHandler = async ({ request }) => {
  const body = await request.json() as {
    target_type: string;
    target_id: string;
    session_id?: string | null;
    display_label?: string | null;
    bookmarked?: boolean;
    rating?: number | null;
    tags?: string[];
    note?: string | null;
  };
  if (!body.target_type || !body.target_id) throw error(400, 'Missing target_type or target_id');
  if (body.rating !== undefined && body.rating !== null && ![-1, 0, 1].includes(body.rating)) {
    throw error(400, 'rating must be -1, 0, or 1');
  }
  const result = upsertAnnotation(body);
  return json(result);
};

export const DELETE: RequestHandler = async ({ url }) => {
  const targetType = url.searchParams.get('targetType');
  const targetId = url.searchParams.get('targetId');
  if (!targetType || !targetId) throw error(400, 'Missing targetType or targetId');
  deleteAnnotation(targetType, targetId);
  return new Response(null, { status: 204 });
};
