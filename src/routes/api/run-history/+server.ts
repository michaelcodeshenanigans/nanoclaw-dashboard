import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getRunHistory } from '$lib/server/db';
import type { RunStatus, TriggerSource } from '$lib/types';

const VALID_STATUSES = new Set<RunStatus>(['running', 'success', 'failed', 'waiting', 'dropped', 'unknown']);
const VALID_TRIGGERS = new Set<TriggerSource>(['message', 'scheduled', 'manual']);

export async function GET({ url }: RequestEvent): Promise<Response> {
  const statusParam = url.searchParams.get('status') ?? undefined;
  const groupId = url.searchParams.get('groupId') ?? undefined;
  const triggerParam = url.searchParams.get('trigger') ?? undefined;
  const since = url.searchParams.get('since') ?? undefined;
  const limitParam = url.searchParams.get('limit');

  const status = statusParam && VALID_STATUSES.has(statusParam as RunStatus)
    ? (statusParam as RunStatus) : undefined;
  const triggerSource = triggerParam && VALID_TRIGGERS.has(triggerParam as TriggerSource)
    ? (triggerParam as TriggerSource) : undefined;
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 500) : 200;

  return json(getRunHistory({ status, groupId, triggerSource, since, limit }));
}
