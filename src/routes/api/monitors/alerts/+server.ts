import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getMonitorAlerts } from '$lib/server/dashboard-db';

export async function GET({ url }: RequestEvent): Promise<Response> {
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200);
  const unacknowledgedOnly = url.searchParams.get('unacknowledged') === 'true';
  return json(getMonitorAlerts(limit, unacknowledgedOnly));
}
