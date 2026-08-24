import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getMonitorById, updateMonitor, deleteMonitor } from '$lib/server/dashboard-db';

export async function GET({ params }: RequestEvent): Promise<Response> {
  const monitor = getMonitorById(params.id!);
  if (!monitor) throw error(404, 'Monitor not found');
  return json(monitor);
}

export async function PATCH({ params, request }: RequestEvent): Promise<Response> {
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

  return json(getMonitorById(params.id!));
}

export async function DELETE({ params }: RequestEvent): Promise<Response> {
  const monitor = getMonitorById(params.id!);
  if (!monitor) throw error(404, 'Monitor not found');
  deleteMonitor(params.id!);
  return json({ ok: true });
}
