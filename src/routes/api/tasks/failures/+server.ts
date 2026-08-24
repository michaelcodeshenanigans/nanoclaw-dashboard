import { json } from '@sveltejs/kit';
import { getFailedTaskSummaries } from '$lib/server/db';

export function GET(): Response {
  return json(getFailedTaskSummaries());
}
