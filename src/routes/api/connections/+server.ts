import { json } from '@sveltejs/kit';
import { getConnectionsHealth } from '$lib/server/db';

export const GET = (): Response => json(getConnectionsHealth());
