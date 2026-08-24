import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// TODO: wire session-scoped stop once NanoClaw core adds the verb (currently
// only agents can stop their own session; no external caller verb exists).
export const POST: RequestHandler = async () => {
  throw error(501, 'Session-scoped stop is not yet supported by NanoClaw core');
};
