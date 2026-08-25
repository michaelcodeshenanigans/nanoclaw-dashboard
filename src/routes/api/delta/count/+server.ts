import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getOperator } from '$lib/server/auth';
import { ensureOperatorBaseline } from '$lib/server/dashboard-db';
import { getDeltaView } from '$lib/server/db';

export const GET: RequestHandler = async ({ request }) => {
  const op = getOperator(request);
  try {
    const baseline_ts = ensureOperatorBaseline(op.username);
    const data = getDeltaView(baseline_ts);
    const total = data.new_sessions.length + data.completed_since.length + data.new_approvals.length;
    return json({ total });
  } catch {
    return json({ total: 0 });
  }
};
