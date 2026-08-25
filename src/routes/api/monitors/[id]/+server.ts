import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getMonitorById, updateMonitor, deleteMonitor } from '$lib/server/dashboard-db';
import { requireRole, audit } from '$lib/server/auth';

export async function GET({ params }: RequestEvent): Promise<Response> {
  const monitor = getMonitorById(params.id!);
  if (!monitor) throw error(404, 'Monitor not found');
  return json(monitor);
}

export async function PATCH({ params, request }: RequestEvent): Promise<Response> {
  const op = requireRole(request, 'admin');
  const monitor = getMonitorById(params.id!);
  if (!monitor) throw error(404, 'Monitor not found');

  const body = await request.json() as {
    name?: string;
    enabled?: boolean;
    threshold_minutes?: number;
    target_group_id?: string | null;
    cooldown_minutes?: number;
  };

  updateMonitor(params.id!, {
    name: body.name,
    enabled: body.enabled,
    threshold_minutes: body.threshold_minutes,
    target_group_id: body.target_group_id,
    cooldown_minutes: body.cooldown_minutes
  });

  audit(op.username, 'monitor:update', 'monitor', params.id!, body);
  return json(getMonitorById(params.id!));
}

export async function DELETE({ params, request }: RequestEvent): Promise<Response> {
  const op = requireRole(request, 'admin');
  const monitor = getMonitorById(params.id!);
  if (!monitor) throw error(404, 'Monitor not found');
  deleteMonitor(params.id!);
  audit(op.username, 'monitor:delete', 'monitor', params.id!, { name: monitor.name });
  return json({ ok: true });
}
