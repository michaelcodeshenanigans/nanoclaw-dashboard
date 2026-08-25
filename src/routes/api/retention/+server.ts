import { json, error } from '@sveltejs/kit';
import {
  getRetentionConfig,
  saveRetentionConfig,
  dryRunRetention,
  applyRetention,
  recordRetentionRun,
  getRetentionRuns
} from '$lib/server/dashboard-db';
import { requireRole, audit } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
  requireRole(request, 'admin');
  const cfg = getRetentionConfig();
  const runs = getRetentionRuns(10);
  return json({ config: cfg, runs });
};

export const POST: RequestHandler = async ({ request }) => {
  const op = requireRole(request, 'owner');
  const body = await request.json() as {
    action?: 'save' | 'dry-run' | 'apply';
    config?: Partial<{
      enabled: boolean;
      window_days: number;
      include_audit_log: boolean;
      include_monitor_alerts: boolean;
      include_triage: boolean;
      include_search_index: boolean;
      include_annotations: boolean;
      schedule_days: number;
    }>;
  };

  const action = body.action ?? 'save';
  const cfg = getRetentionConfig();
  if (!cfg) throw error(503, 'Dashboard DB not available');

  if (action === 'save') {
    if (body.config) {
      if (body.config.window_days !== undefined && (body.config.window_days < 1 || body.config.window_days > 3650)) {
        throw error(400, 'window_days must be 1–3650');
      }
      if (body.config.schedule_days !== undefined && (body.config.schedule_days < 1 || body.config.schedule_days > 365)) {
        throw error(400, 'schedule_days must be 1–365');
      }
      saveRetentionConfig(body.config);
      audit(op.username, 'retention:config', null, null, body.config);
    }
    return json({ ok: true, config: getRetentionConfig() });
  }

  const effectiveCfg = body.config ? { ...cfg, ...body.config } : cfg;
  const windowDays = effectiveCfg.window_days;

  if (action === 'dry-run') {
    const preview = dryRunRetention(windowDays, effectiveCfg);
    recordRetentionRun(windowDays, true, preview, op.username);
    return json(preview);
  }

  if (action === 'apply') {
    const result = applyRetention(windowDays, effectiveCfg);
    recordRetentionRun(windowDays, false, result, op.username);
    audit(op.username, 'retention:apply', null, null, { window_days: windowDays, deleted: result.total });
    return json(result);
  }

  throw error(400, 'action must be save, dry-run, or apply');
};
