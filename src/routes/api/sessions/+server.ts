import { json } from '@sveltejs/kit';
import { getSessions } from '$lib/server/db';
import type { RequestHandler } from './$types';

const ALLOWED_STATUSES = new Set(['running', 'stopped', 'error']);

export const GET: RequestHandler = ({ url }) => {
  const rawGroupId = url.searchParams.get('groupId');
  const rawStatus = url.searchParams.get('containerStatus');
  const rawSince = url.searchParams.get('since');

  const filters: {
    groupId?: string;
    containerStatus?: string;
    since?: string;
  } = {};

  if (rawGroupId !== null && rawGroupId.length > 0) {
    filters.groupId = rawGroupId;
  }

  if (rawStatus !== null && ALLOWED_STATUSES.has(rawStatus)) {
    filters.containerStatus = rawStatus;
  }

  if (rawSince !== null && rawSince.length > 0) {
    filters.since = rawSince;
  }

  const sessions = getSessions(filters);
  return json(sessions);
};
