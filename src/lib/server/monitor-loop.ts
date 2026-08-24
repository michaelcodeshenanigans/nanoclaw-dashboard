import { checkApprovalTimeout, checkSessionSilence } from '$lib/server/db';
import { getMonitors, recordAlert, updateMonitorLastFired } from '$lib/server/dashboard-db';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let _started = false;

export function startMonitorLoop(): void {
  if (_started) return;
  _started = true;
  // Initial check after 15s (let server finish booting)
  setTimeout(runChecks, 15000);
  setInterval(runChecks, CHECK_INTERVAL_MS);
}

function runChecks(): void {
  try {
    const monitors = getMonitors();
    const now = new Date().toISOString();

    for (const monitor of monitors) {
      if (!monitor.enabled) continue;

      // Cooldown gate
      if (monitor.last_fired_at) {
        const cooldownUntil = new Date(
          new Date(monitor.last_fired_at).getTime() + monitor.cooldown_minutes * 60000
        ).toISOString();
        if (now < cooldownUntil) continue;
      }

      let conditionMet: string | null = null;
      try {
        if (monitor.type === 'approval_timeout') {
          conditionMet = checkApprovalTimeout(monitor.threshold_minutes, monitor.target_group_id);
        } else if (monitor.type === 'session_silence') {
          conditionMet = checkSessionSilence(monitor.threshold_minutes, monitor.target_group_id);
        }
      } catch (err) {
        console.error(`[monitor-loop] check failed for ${monitor.id}:`, err);
      }

      if (conditionMet) {
        recordAlert(monitor.id, monitor.name, conditionMet);
        updateMonitorLastFired(monitor.id);
        console.log(`[monitor-loop] alert fired: ${monitor.name} — ${conditionMet}`);
      }
    }
  } catch (err) {
    console.error('[monitor-loop] runChecks error:', err);
  }
}
