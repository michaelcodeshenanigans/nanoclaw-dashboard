import { json, error } from '@sveltejs/kit';
import { querySearchIndex } from '$lib/server/dashboard-db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const q = url.searchParams.get('q')?.trim() ?? '';
  if (!q) throw error(400, 'q is required');
  if (q.length < 2) throw error(400, 'Query must be at least 2 characters');

  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '30', 10), 100);

  // Escape FTS5 special chars and append * for prefix matching
  const ftsQuery = q.replace(/["*^]/g, ' ').trim() + '*';

  const results = querySearchIndex(ftsQuery, limit);
  return json({ query: q, results });
};
