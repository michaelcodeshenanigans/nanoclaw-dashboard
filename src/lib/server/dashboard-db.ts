import Database from 'better-sqlite3';

type DB = InstanceType<typeof Database>;

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
