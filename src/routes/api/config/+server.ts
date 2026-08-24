import { json } from '@sveltejs/kit';
import { getAllGroupConfigs } from '$lib/server/db';

export const GET = (): Response => json(getAllGroupConfigs());
