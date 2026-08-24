import Database from 'better-sqlite3';
import type { Monitor, MonitorAlert, MonitorType } from '$lib/types';

type DB = InstanceType<typeof Database>;

export type { Monitor, MonitorAlert };

let _dashboardDb: DB | null = null;
let _attempted = false;

function getDashboardDb(): DB | null {
  if (_attempted) return _dashboardDb;
  _attempted = true;

  const path = process.env.DASHBOARD_DB;
  if (!path) return null;

  try {
    _dashboardDb = new Database(path);
    _dashboardDb.pragma('journal_mode = WAL');
    _dashboardDb.pragma('busy_timeout = 3000');
    _dashboardDb.exec(`
      CREATE TABLE IF NOT EXISTS triage_snooze (
        item_key TEXT PRIMARY KEY,
        snoozed_until TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS triage_dismiss (
        item_key TEXT PRIMARY KEY,
        dismissed_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS monitors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        threshold_minutes INTEGER NOT NULL DEFAULT 30,
        target_group_id TEXT,
        cooldown_minutes INTEGER NOT NULL DEFAULT 60,
        last_fired_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS monitor_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        monitor_id TEXT NOT NULL,
        monitor_name TEXT NOT NULL,
        fired_at TEXT NOT NULL DEFAULT (datetime('now')),
        condition_met TEXT NOT NULL,
        push_status TEXT NOT NULL DEFAULT 'skipped',
        acknowledged INTEGER NOT NULL DEFAULT 0
      );
    `);
    // Seed default monitors on first boot
    _dashboardDb.exec(`
      INSERT OR IGNORE INTO monitors (id, name, type, threshold_minutes, cooldown_minutes)
      VALUES
        ('default-approval-timeout', 'Approval Timeout', 'approval_timeout', 30, 60),
        ('default-session-silence', 'Session Silence', 'session_silence', 120, 60);
    `);
    return _dashboardDb;
  } catch (err) {
    console.error('[dashboard-db] failed to open:', err);
    return null;
  }
}

export function isDashboardDbAvailable(): boolean {
  return getDashboardDb() !== null;
}

export function snoozeItem(itemKey: string, minutes: number): void {
  const db = getDashboardDb();
  if (!db) return;
  const until = new Date(Date.now() + minutes * 60000).toISOString();
  db.prepare(`
    INSERT INTO triage_snooze (item_key, snoozed_until)
    VALUES (?, ?)
    ON CONFLICT(item_key) DO UPDATE SET snoozed_until = excluded.snoozed_until, created_at = datetime('now')
  `).run(itemKey, until);
}

export function dismissItem(itemKey: string): void {
  const db = getDashboardDb();
  if (!db) return;
  db.prepare(`
    INSERT OR REPLACE INTO triage_dismiss (item_key, dismissed_at)
    VALUES (?, datetime('now'))
  `).run(itemKey);
}

export function restoreItem(itemKey: string): void {
  const db = getDashboardDb();
  if (!db) return;
  db.prepare('DELETE FROM triage_snooze WHERE item_key = ?').run(itemKey);
  db.prepare('DELETE FROM triage_dismiss WHERE item_key = ?').run(itemKey);
}

// ─── Monitor CRUD ──────────────────────────────────────────────────────────

interface MonitorRow {
  id: string; name: string; type: string; enabled: number;
  threshold_minutes: number; target_group_id: string | null;
  cooldown_minutes: number; last_fired_at: string | null; created_at: string;
}

function mapMonitorRow(r: MonitorRow): Monitor {
  return { ...r, type: r.type as MonitorType, enabled: r.enabled === 1 };
}

export function getMonitors(): Monitor[] {
  const db = getDashboardDb();
  if (!db) return [];
  return (db.prepare('SELECT * FROM monitors ORDER BY created_at ASC').all() as MonitorRow[]).map(mapMonitorRow);
}

export function getMonitorById(id: string): Monitor | null {
  const db = getDashboardDb();
  if (!db) return null;
  const r = db.prepare('SELECT * FROM monitors WHERE id = ?').get(id) as MonitorRow | undefined;
  return r ? mapMonitorRow(r) : null;
}

export function createMonitor(data: { name: string; type: MonitorType; threshold_minutes: number; target_group_id?: string; cooldown_minutes?: number }): Monitor {
  const db = getDashboardDb();
  if (!db) throw new Error('Dashboard DB not available');
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO monitors (id, name, type, threshold_minutes, target_group_id, cooldown_minutes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, data.name, data.type, data.threshold_minutes, data.target_group_id ?? null, data.cooldown_minutes ?? 60);
  return mapMonitorRow(db.prepare('SELECT * FROM monitors WHERE id = ?').get(id) as Parameters<typeof mapMonitorRow>[0]);
}

export function updateMonitor(id: string, data: Partial<{ name: string; enabled: boolean; threshold_minutes: number; target_group_id: string | null; cooldown_minutes: number }>): void {
  const db = getDashboardDb();
  if (!db) return;
  if (data.name !== undefined) db.prepare('UPDATE monitors SET name = ? WHERE id = ?').run(data.name, id);
  if (data.enabled !== undefined) db.prepare('UPDATE monitors SET enabled = ? WHERE id = ?').run(data.enabled ? 1 : 0, id);
  if (data.threshold_minutes !== undefined) db.prepare('UPDATE monitors SET threshold_minutes = ? WHERE id = ?').run(data.threshold_minutes, id);
  if (data.target_group_id !== undefined) db.prepare('UPDATE monitors SET target_group_id = ? WHERE id = ?').run(data.target_group_id, id);
  if (data.cooldown_minutes !== undefined) db.prepare('UPDATE monitors SET cooldown_minutes = ? WHERE id = ?').run(data.cooldown_minutes, id);
}

export function deleteMonitor(id: string): void {
  const db = getDashboardDb();
  if (!db) return;
  db.prepare('DELETE FROM monitors WHERE id = ?').run(id);
}

export function updateMonitorLastFired(id: string): void {
  const db = getDashboardDb();
  if (!db) return;
  db.prepare(`UPDATE monitors SET last_fired_at = datetime('now') WHERE id = ?`).run(id);
}

// ─── Alert log ─────────────────────────────────────────────────────────────

export function recordAlert(monitorId: string, monitorName: string, conditionMet: string): void {
  const db = getDashboardDb();
  if (!db) return;
  db.prepare(`
    INSERT INTO monitor_alerts (monitor_id, monitor_name, condition_met)
    VALUES (?, ?, ?)
  `).run(monitorId, monitorName, conditionMet);
}

export function getMonitorAlerts(limit = 50, unacknowledgedOnly = false): MonitorAlert[] {
  const db = getDashboardDb();
  if (!db) return [];
  const where = unacknowledgedOnly ? 'WHERE acknowledged = 0' : '';
  return (db.prepare(`SELECT * FROM monitor_alerts ${where} ORDER BY fired_at DESC LIMIT ?`).all(limit) as Array<{
    id: number; monitor_id: string; monitor_name: string; fired_at: string;
    condition_met: string; push_status: string; acknowledged: number;
  }>).map(r => ({ ...r, push_status: r.push_status as MonitorAlert['push_status'], acknowledged: r.acknowledged === 1 }));
}

export function acknowledgeAlert(id: number): void {
  const db = getDashboardDb();
  if (!db) return;
  db.prepare('UPDATE monitor_alerts SET acknowledged = 1 WHERE id = ?').run(id);
}

export function acknowledgeAllAlerts(): void {
  const db = getDashboardDb();
  if (!db) return;
  db.prepare('UPDATE monitor_alerts SET acknowledged = 1 WHERE acknowledged = 0').run();
}

// ─── Triage state ──────────────────────────────────────────────────────────

export interface TriageState {
  snoozed: Set<string>;
  dismissed: Set<string>;
}

export function getTriageState(): TriageState {
  const db = getDashboardDb();
  if (!db) return { snoozed: new Set(), dismissed: new Set() };

  const snoozedRows = db.prepare(
    `SELECT item_key FROM triage_snooze WHERE snoozed_until > datetime('now')`
  ).all() as Array<{ item_key: string }>;

  const dismissedRows = db.prepare(
    `SELECT item_key FROM triage_dismiss`
  ).all() as Array<{ item_key: string }>;

  return {
    snoozed: new Set(snoozedRows.map(r => r.item_key)),
    dismissed: new Set(dismissedRows.map(r => r.item_key))
  };
}
