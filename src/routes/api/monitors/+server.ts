import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getMonitors, createMonitor } from '$lib/server/dashboard-db';
import { requireRole, audit } from '$lib/server/auth';
import type { MonitorType } from '$lib/types';

const VALID_TYPES = new Set<MonitorType>(['approval_timeout', 'session_silence']);

export async function GET(): Promise<Response> {
  return json(getMonitors());
}

export async function POST({ request }: RequestEvent): Promise<Response> {
  const op = requireRole(request, 'admin');
  const body = await request.json() as {
    name?: string;
    type?: string;
    threshold_minutes?: number;
    target_group_id?: string;
    cooldown_minutes?: number;
  };

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) throw error(400, 'name required');
  if (!body.type || !VALID_TYPES.has(body.type as MonitorType)) throw error(400, 'type must be approval_timeout or session_silence');
  const threshold = typeof body.threshold_minutes === 'number' && body.threshold_minutes > 0
    ? Math.min(body.threshold_minutes, 10080) : 30;
  const cooldown = typeof body.cooldown_minutes === 'number' && body.cooldown_minutes > 0
    ? Math.min(body.cooldown_minutes, 10080) : 60;

  const monitor = createMonitor({
    name: body.name.trim(),
    type: body.type as MonitorType,
    threshold_minutes: threshold,
    target_group_id: body.target_group_id ?? undefined,
    cooldown_minutes: cooldown
  });
  audit(op.username, 'monitor:create', 'monitor', monitor.id, { name: monitor.name, type: monitor.type });
  return json(monitor, { status: 201 });
}
