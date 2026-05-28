import { json } from '@sveltejs/kit';
import { getScheduledTasks } from '$lib/server/db';

export function GET(): Response {
  const tasks = getScheduledTasks();
  return json(tasks);
}
