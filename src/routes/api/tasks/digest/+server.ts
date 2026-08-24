import { json } from '@sveltejs/kit';
import { getErrorDigest } from '$lib/server/db';

export const GET = (): Response => json(getErrorDigest());
