import { json } from '@sveltejs/kit';
import { getFlaggedAnnotations } from '$lib/server/dashboard-db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const tag = url.searchParams.get('tag') ?? undefined;
  const ratingStr = url.searchParams.get('rating');
  const rating = ratingStr !== null ? Number(ratingStr) : undefined;
  return json(getFlaggedAnnotations({ tag, rating }));
};
