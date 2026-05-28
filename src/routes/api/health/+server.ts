import { json } from '@sveltejs/kit';
import { checkDbHealth } from '$lib/server/db';
import { checkNclHealth } from '$lib/server/ncl';
import type { HealthStatus } from '$lib/types';

export async function GET(): Promise<Response> {
  const db = checkDbHealth();
  const ncl = checkNclHealth();
  const status = db.ok && ncl.ok ? 'ok' : 'degraded';

  const body: HealthStatus = {
    status,
    db,
    ncl,
    ts: new Date().toISOString()
  };

  return json(body, { status: status === 'ok' ? 200 : 503 });
}
