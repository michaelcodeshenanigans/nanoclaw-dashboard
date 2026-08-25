import { getRetentionConfig, applyRetention, recordRetentionRun } from './dashboard-db';

let _started = false;

function checkAndRun(): void {
  try {
    const cfg = getRetentionConfig();
    if (!cfg || !cfg.enabled) return;
    if (!cfg.next_run_ts) return;
    if (new Date(cfg.next_run_ts) > new Date()) return;
    const result = applyRetention(cfg.window_days, cfg);
    recordRetentionRun(cfg.window_days, false, result, 'auto');
  } catch (err) {
    console.error('[retention-scheduler] error:', err);
  }
}

export function startRetentionScheduler(): void {
  if (_started) return;
  _started = true;
  // Check once an hour whether a scheduled prune is due
  setTimeout(checkAndRun, 10_000);
  setInterval(checkAndRun, 60 * 60 * 1000);
}
