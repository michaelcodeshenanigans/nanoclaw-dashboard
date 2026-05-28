import Database from 'better-sqlite3';
import type { DbStatus, Group, HealthStats } from '$lib/types';

const dbPath = process.env.NANOCLAW_DB;
if (!dbPath) {
  throw new Error(
    'NANOCLAW_DB environment variable is not set. ' +
    'Set it to the path of the NanoClaw SQLite database (e.g. /nanoclaw-data/v2.db).'
  );
}

export const db = new Database(dbPath, { readonly: true });
db.pragma('busy_timeout = 1000');

export function checkDbHealth(): DbStatus {
  try {
    db.prepare('SELECT 1').get();
    return { ok: true, path: dbPath };
  } catch (err) {
    return {
      ok: false,
      path: dbPath,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

export function getGroups(): Group[] {
  return db.prepare(`
    SELECT
      g.id,
      g.name,
      g.folder,
      g.agent_provider,
      g.created_at,
      s.container_status,
      s.last_active
    FROM agent_groups g
    LEFT JOIN sessions s ON s.id = (
      SELECT id FROM sessions
      WHERE agent_group_id = g.id
      ORDER BY last_active DESC
      LIMIT 1
    )
    ORDER BY g.name
  `).all() as Group[];
}

export function getHealthStats(): HealthStats {
  const active_sessions = (db.prepare(
    `SELECT COUNT(*) as count FROM sessions WHERE container_status = 'running'`
  ).get() as { count: number }).count;

  const running = (db.prepare(
    `SELECT COUNT(*) as count FROM sessions WHERE container_status = 'running'`
  ).get() as { count: number }).count;

  const stopped = (db.prepare(
    `SELECT COUNT(*) as count FROM sessions WHERE container_status = 'stopped'`
  ).get() as { count: number }).count;

  const error = (db.prepare(
    `SELECT COUNT(*) as count FROM sessions WHERE container_status = 'error'`
  ).get() as { count: number }).count;

  const recent_errors = (db.prepare(
    `SELECT COUNT(*) as count FROM sessions
     WHERE container_status = 'error'
     AND last_active > datetime('now', '-24 hours')`
  ).get() as { count: number }).count;

  const total_groups = (db.prepare(
    `SELECT COUNT(*) as count FROM agent_groups`
  ).get() as { count: number }).count;

  return {
    active_sessions,
    container_statuses: { running, stopped, error },
    recent_errors,
    total_groups
  };
}
