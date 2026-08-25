import type { Handle } from '@sveltejs/kit';
import { startSearchIndexer } from '$lib/server/search-indexer';

startSearchIndexer();

export const handle: Handle = async ({ event, resolve }) => {
  return resolve(event);
};
