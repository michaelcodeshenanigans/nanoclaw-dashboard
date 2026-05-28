import { json } from '@sveltejs/kit';
import { getGroups } from '$lib/server/db';

export async function GET(): Promise<Response> {
  return json(getGroups());
}
