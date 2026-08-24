import type { Handle } from '@sveltejs/kit';
import { startMonitorLoop } from '$lib/server/monitor-loop';

startMonitorLoop();

export const handle: Handle = async ({ event, resolve }) => {
  return resolve(event);
};
