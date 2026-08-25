import type { Handle } from '@sveltejs/kit';
import { startMonitorLoop } from '$lib/server/monitor-loop';
import { startSearchIndexer } from '$lib/server/search-indexer';

startMonitorLoop();
startSearchIndexer();

export const handle: Handle = async ({ event, resolve }) => {
  return resolve(event);
};
