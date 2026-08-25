import Database from 'better-sqlite3';
import type { Monitor, MonitorAlert, MonitorType, Annotation, Role, AuditLogEntry, RoleAssignment, SearchResult, RetentionConfig, RetentionPreview, RetentionRun } from '$lib/types';

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
      CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
        type UNINDEXED,
        entity_id UNINDEXED,
        group_id UNINDEXED,
        session_id UNINDEXED,
        direction UNINDEXED,
        ts UNINDEXED,
        title,
        body,
        tokenize='unicode61 remove_diacritics 1'
      );
      CREATE TABLE IF NOT EXISTS search_watermark (
        key TEXT PRIMARY KEY,
        last_ts TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS retention_config (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        enabled INTEGER NOT NULL DEFAULT 0,
        window_days INTEGER NOT NULL DEFAULT 90,
        include_audit_log INTEGER NOT NULL DEFAULT 1,
        include_monitor_alerts INTEGER NOT NULL DEFAULT 1,
        include_triage INTEGER NOT NULL DEFAULT 1,
        include_search_index INTEGER NOT NULL DEFAULT 1,
        include_annotations INTEGER NOT NULL DEFAULT 0,
        schedule_days INTEGER NOT NULL DEFAULT 7,
        last_run_ts TEXT,
        last_run_summary TEXT,
        next_run_ts TEXT
      );
      INSERT OR IGNORE INTO retention_config (id) VALUES (1);
      CREATE TABLE IF NOT EXISTS retention_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL DEFAULT (datetime('now')),
        window_days INTEGER NOT NULL,
        dry_run INTEGER NOT NULL DEFAULT 0,
        summary_json TEXT NOT NULL,
        triggered_by TEXT NOT NULL DEFAULT 'auto'
      );
      CREATE TABLE IF NOT EXISTS operator_last_seen (
        username TEXT PRIMARY KEY,
        baseline_ts TEXT NOT NULL DEFAULT (datetime('now', '-1 hour')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
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

// ─── Search Index (FTS5) ─────────────────────────────────────────────────────

export type SearchEntry = Omit<SearchResult, 'rank'>;

export function querySearchIndex(query: string, limit = 20): SearchResult[] {
  const db = getDashboardDb();
  if (!db) return [];
  try {
    return db.prepare(`
      SELECT type, entity_id, group_id, session_id, direction, ts, title, body, rank
      FROM search_index
      WHERE search_index MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(query, limit) as SearchResult[];
  } catch { return []; }
}

export function replaceSearchEntriesByType(type: string, entries: SearchEntry[]): void {
  const db = getDashboardDb();
  if (!db) return;
  const del = db.prepare('DELETE FROM search_index WHERE type = ?');
  const ins = db.prepare(`
    INSERT INTO search_index (type, entity_id, group_id, session_id, direction, ts, title, body)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    del.run(type);
    for (const e of entries) {
      ins.run(e.type, e.entity_id, e.group_id, e.session_id, e.direction, e.ts, e.title, e.body);
    }
  })();
}

export function insertSearchEntries(entries: SearchEntry[]): void {
  const db = getDashboardDb();
  if (!db || entries.length === 0) return;
  const ins = db.prepare(`
    INSERT INTO search_index (type, entity_id, group_id, session_id, direction, ts, title, body)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    for (const e of entries) {
      ins.run(e.type, e.entity_id, e.group_id, e.session_id, e.direction, e.ts, e.title, e.body);
    }
  })();
}

export function getSearchWatermark(key: string): string {
  const db = getDashboardDb();
  if (!db) return '1970-01-01T00:00:00.000Z';
  const row = db.prepare('SELECT last_ts FROM search_watermark WHERE key = ?').get(key) as { last_ts: string } | undefined;
  return row?.last_ts ?? '1970-01-01T00:00:00.000Z';
}

export function setSearchWatermark(key: string, ts: string): void {
  const db = getDashboardDb();
  if (!db) return;
  db.prepare(`
    INSERT INTO search_watermark (key, last_ts) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET last_ts = excluded.last_ts
  `).run(key, ts);
}

// ─── Retention ───────────────────────────────────────────────────────────────

interface RetentionConfigRow {
  enabled: number; window_days: number;
  include_audit_log: number; include_monitor_alerts: number;
  include_triage: number; include_search_index: number; include_annotations: number;
  schedule_days: number;
  last_run_ts: string | null; last_run_summary: string | null; next_run_ts: string | null;
}

function mapRetentionConfig(r: RetentionConfigRow): RetentionConfig {
  return {
    enabled: r.enabled === 1,
    window_days: r.window_days,
    include_audit_log: r.include_audit_log === 1,
    include_monitor_alerts: r.include_monitor_alerts === 1,
    include_triage: r.include_triage === 1,
    include_search_index: r.include_search_index === 1,
    include_annotations: r.include_annotations === 1,
    schedule_days: r.schedule_days,
    last_run_ts: r.last_run_ts,
    last_run_summary: r.last_run_summary,
    next_run_ts: r.next_run_ts,
  };
}

export function getRetentionConfig(): RetentionConfig | null {
  const db = getDashboardDb();
  if (!db) return null;
  const row = db.prepare('SELECT * FROM retention_config WHERE id = 1').get() as RetentionConfigRow | undefined;
  return row ? mapRetentionConfig(row) : null;
}

export function saveRetentionConfig(cfg: Partial<Omit<RetentionConfig, 'last_run_ts' | 'last_run_summary' | 'next_run_ts'>>): void {
  const db = getDashboardDb();
  if (!db) return;
  const fields: string[] = [];
  const params: (number | string | null)[] = [];
  if (cfg.enabled !== undefined) { fields.push('enabled = ?'); params.push(cfg.enabled ? 1 : 0); }
  if (cfg.window_days !== undefined) { fields.push('window_days = ?'); params.push(cfg.window_days); }
  if (cfg.include_audit_log !== undefined) { fields.push('include_audit_log = ?'); params.push(cfg.include_audit_log ? 1 : 0); }
  if (cfg.include_monitor_alerts !== undefined) { fields.push('include_monitor_alerts = ?'); params.push(cfg.include_monitor_alerts ? 1 : 0); }
  if (cfg.include_triage !== undefined) { fields.push('include_triage = ?'); params.push(cfg.include_triage ? 1 : 0); }
  if (cfg.include_search_index !== undefined) { fields.push('include_search_index = ?'); params.push(cfg.include_search_index ? 1 : 0); }
  if (cfg.include_annotations !== undefined) { fields.push('include_annotations = ?'); params.push(cfg.include_annotations ? 1 : 0); }
  if (cfg.schedule_days !== undefined) { fields.push('schedule_days = ?'); params.push(cfg.schedule_days); }
  if (!fields.length) return;
  params.push(1);
  db.prepare(`UPDATE retention_config SET ${fields.join(', ')} WHERE id = ?`).run(...params);
}

export function recordRetentionRun(windowDays: number, dryRun: boolean, summary: RetentionPreview, triggeredBy: string): void {
  const db = getDashboardDb();
  if (!db) return;
  const summaryJson = JSON.stringify(summary);
  db.prepare(`
    INSERT INTO retention_runs (window_days, dry_run, summary_json, triggered_by)
    VALUES (?, ?, ?, ?)
  `).run(windowDays, dryRun ? 1 : 0, summaryJson, triggeredBy);
  if (!dryRun) {
    const schedRow = db.prepare('SELECT schedule_days FROM retention_config WHERE id = 1').get() as { schedule_days: number } | undefined;
    const schedDays = schedRow?.schedule_days ?? 7;
    const nextRun = new Date(Date.now() + schedDays * 86400000).toISOString();
    db.prepare(`
      UPDATE retention_config SET last_run_ts = datetime('now'), last_run_summary = ?, next_run_ts = ? WHERE id = 1
    `).run(summaryJson, nextRun);
  }
}

export function getRetentionRuns(limit = 20): RetentionRun[] {
  const db = getDashboardDb();
  if (!db) return [];
  return (db.prepare('SELECT * FROM retention_runs ORDER BY ts DESC LIMIT ?').all(limit) as Array<{
    id: number; ts: string; window_days: number; dry_run: number; summary_json: string; triggered_by: string;
  }>).map(r => ({ ...r, dry_run: r.dry_run === 1 }));
}

export function dryRunRetention(windowDays: number, cfg: RetentionConfig): RetentionPreview {
  const db = getDashboardDb();
  const cutoff = new Date(Date.now() - windowDays * 86400000).toISOString();
  if (!db) return { audit_log: 0, monitor_alerts: 0, triage: 0, search_index: 0, annotations: 0, total: 0, cutoff, dry_run: true };

  const count = (sql: string, ...params: unknown[]) =>
    (db.prepare(sql).get(...params) as { n: number }).n;

  const audit_log = cfg.include_audit_log
    ? count('SELECT COUNT(*) AS n FROM audit_log WHERE ts < ?', cutoff) : 0;
  const monitor_alerts = cfg.include_monitor_alerts
    ? count('SELECT COUNT(*) AS n FROM monitor_alerts WHERE acknowledged = 1 AND fired_at < ?', cutoff) : 0;
  const triage = cfg.include_triage
    ? count('SELECT COUNT(*) AS n FROM triage_dismiss WHERE dismissed_at < ?', cutoff) +
      count('SELECT COUNT(*) AS n FROM triage_snooze WHERE created_at < ?', cutoff) : 0;
  const search_index = cfg.include_search_index
    ? count("SELECT COUNT(*) AS n FROM search_index WHERE type = 'message' AND ts < ?", cutoff) : 0;
  const annotations = cfg.include_annotations
    ? count('SELECT COUNT(*) AS n FROM annotations WHERE updated_at < ?', cutoff) : 0;
  const total = audit_log + monitor_alerts + triage + search_index + annotations;
  return { audit_log, monitor_alerts, triage, search_index, annotations, total, cutoff, dry_run: true };
}

export function applyRetention(windowDays: number, cfg: RetentionConfig): RetentionPreview {
  const db = getDashboardDb();
  const cutoff = new Date(Date.now() - windowDays * 86400000).toISOString();
  if (!db) return { audit_log: 0, monitor_alerts: 0, triage: 0, search_index: 0, annotations: 0, total: 0, cutoff, dry_run: false };

  let audit_log = 0, monitor_alerts = 0, triage = 0, search_index = 0, annotations = 0;

  db.transaction(() => {
    if (cfg.include_audit_log)
      audit_log = (db.prepare('DELETE FROM audit_log WHERE ts < ?').run(cutoff)).changes;
    if (cfg.include_monitor_alerts)
      monitor_alerts = (db.prepare('DELETE FROM monitor_alerts WHERE acknowledged = 1 AND fired_at < ?').run(cutoff)).changes;
    if (cfg.include_triage) {
      triage += (db.prepare('DELETE FROM triage_dismiss WHERE dismissed_at < ?').run(cutoff)).changes;
      triage += (db.prepare('DELETE FROM triage_snooze WHERE created_at < ?').run(cutoff)).changes;
    }
    if (cfg.include_search_index) {
      search_index = (db.prepare("DELETE FROM search_index WHERE type = 'message' AND ts < ?").run(cutoff)).changes;
      db.prepare('DELETE FROM search_watermark WHERE key LIKE ? AND last_ts < ?').run('msg:%', cutoff);
    }
    if (cfg.include_annotations)
      annotations = (db.prepare('DELETE FROM annotations WHERE updated_at < ?').run(cutoff)).changes;
  })();

  const total = audit_log + monitor_alerts + triage + search_index + annotations;
  return { audit_log, monitor_alerts, triage, search_index, annotations, total, cutoff, dry_run: false };
}

// ─── Delta View — per-operator last-seen baseline ────────────────────────────

export function ensureOperatorBaseline(username: string): string {
  const db = getDashboardDb();
  if (!db) return new Date(Date.now() - 3600000).toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO operator_last_seen (username, baseline_ts, updated_at)
    VALUES (?, datetime('now', '-1 hour'), datetime('now'))
  `).run(username);
  const row = db.prepare('SELECT baseline_ts FROM operator_last_seen WHERE username = ?').get(username) as { baseline_ts: string } | undefined;
  return row?.baseline_ts ?? new Date(Date.now() - 3600000).toISOString();
}

export function markOperatorSeen(username: string): void {
  const db = getDashboardDb();
  if (!db) return;
  db.prepare(`
    INSERT INTO operator_last_seen (username, baseline_ts, updated_at)
    VALUES (?, datetime('now'), datetime('now'))
    ON CONFLICT(username) DO UPDATE SET baseline_ts = datetime('now'), updated_at = datetime('now')
  `).run(username);
}
