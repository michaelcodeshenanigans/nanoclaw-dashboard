import { json } from '@sveltejs/kit';
import { getPendingApprovals } from '$lib/server/db';

export function GET({ url }: { url: URL }): Response {
  const status = url.searchParams.get('status') ?? 'pending';
  const approvals = getPendingApprovals(status);
  return json(approvals);
}
