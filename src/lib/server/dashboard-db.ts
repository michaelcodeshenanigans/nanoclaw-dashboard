import Database from 'better-sqlite3';
import type { Monitor, MonitorAlert, MonitorType, Annotation, Role, AuditLogEntry, RoleAssignment } from '$lib/types';

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
      CREATE TABLE IF NOT EXISTS annotations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_type TEXT NOT NULL CHECK(target_type IN ('session', 'message')),
        target_id TEXT NOT NULL,
        session_id TEXT,
        display_label TEXT,
        bookmarked INTEGER NOT NULL DEFAULT 0,
        rating INTEGER CHECK(rating IN (-1, 0, 1)),
        tags TEXT NOT NULL DEFAULT '[]',
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_annotations_target
        ON annotations(target_type, target_id);
      CREATE TABLE IF NOT EXISTS operator_roles (
        username TEXT PRIMARY KEY,
        role TEXT NOT NULL DEFAULT 'member',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT,
        target_id TEXT,
        payload_json TEXT,
        ts TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log (actor);
      CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log (action);
      CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON audit_log (ts);
    `);
    // Seed michael as owner on first boot
    _dashboardDb.exec(`
      INSERT OR IGNORE INTO operator_roles (username, role) VALUES ('michael', 'owner');
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

// ─── Annotations ────────────────────────────────────────────────────────────

interface AnnotationRow {
  id: number;
  target_type: string;
  target_id: string;
  session_id: string | null;
  display_label: string | null;
  bookmarked: number;
  rating: number | null;
  tags: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

function mapAnnotationRow(r: AnnotationRow): Annotation {
  return {
    id: r.id,
    target_type: r.target_type as Annotation['target_type'],
    target_id: r.target_id,
    session_id: r.session_id,
    display_label: r.display_label,
    bookmarked: r.bookmarked === 1,
    rating: r.rating as Annotation['rating'],
    tags: JSON.parse(r.tags) as string[],
    note: r.note,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export function getAnnotation(targetType: string, targetId: string): Annotation | null {
  const db = getDashboardDb();
  if (!db) return null;
  const row = db.prepare(
    'SELECT * FROM annotations WHERE target_type = ? AND target_id = ?'
  ).get(targetType, targetId) as AnnotationRow | undefined;
  return row ? mapAnnotationRow(row) : null;
}

export function upsertAnnotation(data: {
  target_type: string;
  target_id: string;
  session_id?: string | null;
  display_label?: string | null;
  bookmarked?: boolean;
  rating?: number | null;
  tags?: string[];
  note?: string | null;
}): Annotation | null {
  const db = getDashboardDb();
  if (!db) return null;

  const existing = getAnnotation(data.target_type, data.target_id);
  if (existing) {
    db.prepare(`
      UPDATE annotations SET
        bookmarked = COALESCE(?, bookmarked),
        rating = ?,
        tags = COALESCE(?, tags),
        note = ?,
        display_label = COALESCE(?, display_label),
        updated_at = datetime('now')
      WHERE target_type = ? AND target_id = ?
    `).run(
      data.bookmarked !== undefined ? (data.bookmarked ? 1 : 0) : null,
      data.rating !== undefined ? data.rating : existing.rating,
      data.tags !== undefined ? JSON.stringify(data.tags) : null,
      data.note !== undefined ? data.note : existing.note,
      data.display_label ?? null,
      data.target_type,
      data.target_id
    );
  } else {
    db.prepare(`
      INSERT INTO annotations (target_type, target_id, session_id, display_label, bookmarked, rating, tags, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.target_type,
      data.target_id,
      data.session_id ?? null,
      data.display_label ?? null,
      data.bookmarked ? 1 : 0,
      data.rating ?? null,
      JSON.stringify(data.tags ?? []),
      data.note ?? null
    );
  }
  return getAnnotation(data.target_type, data.target_id);
}

export function deleteAnnotation(targetType: string, targetId: string): void {
  const db = getDashboardDb();
  if (!db) return;
  db.prepare('DELETE FROM annotations WHERE target_type = ? AND target_id = ?').run(targetType, targetId);
}

export function getMessageAnnotationsForSession(sessionId: string): Record<string, Annotation> {
  const db = getDashboardDb();
  if (!db) return {};
  const rows = db.prepare(
    `SELECT * FROM annotations WHERE target_type = 'message' AND session_id = ?`
  ).all(sessionId) as AnnotationRow[];
  const result: Record<string, Annotation> = {};
  for (const row of rows) result[row.target_id] = mapAnnotationRow(row);
  return result;
}

export function getFlaggedAnnotations(filter?: { tag?: string; rating?: number }): Annotation[] {
  const db = getDashboardDb();
  if (!db) return [];

  let rows = db.prepare(
    `SELECT * FROM annotations
     WHERE bookmarked = 1 OR rating IS NOT NULL OR (note IS NOT NULL AND note != '') OR tags != '[]'
     ORDER BY updated_at DESC`
  ).all() as AnnotationRow[];

  let annotations = rows.map(mapAnnotationRow);

  if (filter?.tag) {
    const tag = filter.tag.toLowerCase();
    annotations = annotations.filter(a => a.tags.some(t => t.toLowerCase() === tag));
  }
  if (filter?.rating !== undefined) {
    annotations = annotations.filter(a => a.rating === filter.rating);
  }

  return annotations;
}

// ─── Operator Roles ──────────────────────────────────────────────────────────

export function getOperatorRole(username: string, groups: string[]): Role {
  const db = getDashboardDb();
  if (!db) return 'member';
  const row = db.prepare('SELECT role FROM operator_roles WHERE username = ?').get(username) as { role: string } | undefined;
  if (row) return row.role as Role;
  // Auto-grant admin to Authelia admins group members with no explicit mapping
  if (groups.includes('admins')) return 'admin';
  return 'member';
}

export function getRoleAssignments(): RoleAssignment[] {
  const db = getDashboardDb();
  if (!db) return [];
  return db.prepare('SELECT username, role, updated_at FROM operator_roles ORDER BY username').all() as RoleAssignment[];
}

export function setOperatorRole(username: string, role: Role): void {
  const db = getDashboardDb();
  if (!db) throw new Error('Dashboard DB not available');
  db.prepare(`
    INSERT INTO operator_roles (username, role, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(username) DO UPDATE SET role = excluded.role, updated_at = excluded.updated_at
  `).run(username, role);
}

// ─── Audit Log ──────────────────────────────────────────────────────────────

export function writeAuditEntry(actor: string, action: string, target: string | null, targetId: string | null, payloadJson: string | null = null): void {
  const db = getDashboardDb();
  if (!db) return;
  db.prepare(`
    INSERT INTO audit_log (actor, action, target, target_id, payload_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(actor, action, target, targetId, payloadJson);
}

export function getAuditLog(opts: { actor?: string; action?: string; limit?: number; offset?: number } = {}): AuditLogEntry[] {
  const db = getDashboardDb();
  if (!db) return [];
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.actor) { where.push('actor = ?'); params.push(opts.actor); }
  if (opts.action) { where.push('action LIKE ?'); params.push(`${opts.action}%`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = opts.limit ?? 200;
  const offset = opts.offset ?? 0;
  params.push(limit, offset);
  return db.prepare(`SELECT * FROM audit_log ${whereSql} ORDER BY ts DESC LIMIT ? OFFSET ?`).all(...params) as AuditLogEntry[];
}

export function getAuditActors(): string[] {
  const db = getDashboardDb();
  if (!db) return [];
  return (db.prepare('SELECT DISTINCT actor FROM audit_log ORDER BY actor').all() as { actor: string }[]).map(r => r.actor);
}
