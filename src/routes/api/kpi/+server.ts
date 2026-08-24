import { json } from '@sveltejs/kit';
import { getKpiStats } from '$lib/server/db';

export async function GET(): Promise<Response> {
  return json(getKpiStats());
}
