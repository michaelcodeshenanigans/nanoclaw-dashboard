import { json } from '@sveltejs/kit';
import { getHealthStats } from '$lib/server/db';

export async function GET(): Promise<Response> {
  return json(getHealthStats());
}
