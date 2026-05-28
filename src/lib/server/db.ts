import Database from 'better-sqlite3';
import type { DbStatus, Group, HealthStats, GroupDetail, Member, Destination, SessionSummary, SessionWithGroup, Message } from '$lib/types';

const _dbPath = process.env.NANOCLAW_DB;
if (!_dbPath) {
  throw new Error(
    'NANOCLAW_DB environment variable is not set. ' +
    'Set it to the path of the NanoClaw SQLite database (e.g. /nanoclaw-data/v2.db).'
  );
}
const dbPath: string = _dbPath;

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

export function getGroupById(id: string): GroupDetail | null {
  const row = db.prepare(`
    SELECT
      id,
      name,
      folder,
      agent_provider,
      created_at,
      model,
      config_json
    FROM agent_groups
    WHERE id = ?
  `).get(id) as GroupDetail | undefined;

  return row ?? null;
}

export function getGroupMembers(groupId: string): Member[] {
  return db.prepare(`
    SELECT
      u.id        AS id,
      u.name      AS name,
      u.platform  AS platform,
      u.platform_id AS platform_id,
      m.role      AS role
    FROM agent_group_members m
    JOIN users u ON u.id = m.user_id
    WHERE m.agent_group_id = ?
    ORDER BY u.name
  `).all(groupId) as Member[];
}

export function getGroupDestinations(groupId: string): Destination[] {
  try {
    return db.prepare(`
      SELECT
        mg.id       AS id,
        mg.name     AS name,
        mg.platform AS platform
      FROM messaging_group_agents mga
      JOIN messaging_groups mg ON mg.id = mga.messaging_group_id
      WHERE mga.agent_group_id = ?
      ORDER BY mg.name
    `).all(groupId) as Destination[];
  } catch (err) {
    console.error('[getGroupDestinations] schema mismatch, returning []:', err);
    return [];
  }
}

export function getGroupSessions(groupId: string): SessionSummary[] {
  return db.prepare(`
    SELECT
      id,
      agent_group_id,
      thread_id,
      status,
      container_status,
      last_active,
      created_at
    FROM sessions
    WHERE agent_group_id = ?
    ORDER BY last_active DESC
    LIMIT 50
  `).all(groupId) as SessionSummary[];
}

export interface SessionFilters {
  groupId?: string;
  containerStatus?: string;
  since?: string;
}

export function getSessions(filters: SessionFilters = {}): SessionWithGroup[] {
  const where: string[] = [];
  const params: Array<string> = [];

  if (typeof filters.groupId === 'string' && filters.groupId.length > 0) {
    where.push('s.agent_group_id = ?');
    params.push(filters.groupId);
  }
  if (typeof filters.containerStatus === 'string' && filters.containerStatus.length > 0) {
    where.push('s.container_status = ?');
    params.push(filters.containerStatus);
  }
  if (typeof filters.since === 'string' && filters.since.length > 0) {
    where.push('s.last_active >= ?');
    params.push(filters.since);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  return db.prepare(`
    SELECT
      s.id                 AS id,
      s.agent_group_id     AS agent_group_id,
      s.messaging_group_id AS messaging_group_id,
      s.thread_id          AS thread_id,
      s.status             AS status,
      s.container_status   AS container_status,
      s.last_active        AS last_active,
      s.created_at         AS created_at,
      g.name               AS group_name
    FROM sessions s
    JOIN agent_groups g ON g.id = s.agent_group_id
    ${whereSql}
    ORDER BY s.last_active DESC
    LIMIT 200
  `).all(...params) as SessionWithGroup[];
}

export function getSessionById(id: string): SessionWithGroup | null {
  const row = db.prepare(`
    SELECT
      s.id                 AS id,
      s.agent_group_id     AS agent_group_id,
      s.messaging_group_id AS messaging_group_id,
      s.thread_id          AS thread_id,
      s.status             AS status,
      s.container_status   AS container_status,
      s.last_active        AS last_active,
      s.created_at         AS created_at,
      g.name               AS group_name
    FROM sessions s
    JOIN agent_groups g ON g.id = s.agent_group_id
    WHERE s.id = ?
  `).get(id) as SessionWithGroup | undefined;

  return row ?? null;
}

import { getSessionDbPair } from '$lib/server/session-db-pool';

export interface GetSessionMessagesOpts {
  search?: string;
  kind?: string;
  since?: string;
  until?: string;
  limit?: number;
}

export function getSessionMessages(
  groupId: string,
  sessionId: string,
  opts: GetSessionMessagesOpts = {}
): Message[] {
  const { search, kind, since, until, limit = 200 } = opts;
  const cap = Math.min(limit, 500);

  try {
    const { inbound, outbound } = getSessionDbPair(groupId, sessionId);

    const buildWhere = (extra: string[] = []): string => {
      const clauses: string[] = [...extra];
      if (kind) clauses.push('kind = ?');
      if (since) clauses.push('timestamp >= ?');
      if (until) clauses.push('timestamp <= ?');
      if (search) clauses.push("content LIKE ?");
      return clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
    };

    const buildParams = (extra: unknown[] = []): unknown[] => {
      const params: unknown[] = [...extra];
      if (kind) params.push(kind);
      if (since) params.push(since);
      if (until) params.push(until);
      if (search) params.push(`%${search}%`);
      return params;
    };

    const inParams = buildParams();
    inParams.push(cap);

    const outParams = buildParams();
    outParams.push(cap);

    const inRows: Message[] = inbound
      ? (inbound.prepare(
          `SELECT id, seq, kind, timestamp, content, platform_id, channel_type, thread_id
           FROM messages_in ${buildWhere()} ORDER BY timestamp ASC LIMIT ?`
        ).all(inParams) as Array<Omit<Message, 'direction'>>).map(r => ({ ...r, direction: 'in' as const }))
      : [];

    const outRows: Message[] = outbound
      ? (outbound.prepare(
          `SELECT id, seq, kind, timestamp, content, platform_id, channel_type, thread_id
           FROM messages_out ${buildWhere()} ORDER BY timestamp ASC LIMIT ?`
        ).all(outParams) as Array<Omit<Message, 'direction'>>).map(r => ({ ...r, direction: 'out' as const }))
      : [];

    // Merge and sort by timestamp, then cap
    return [...inRows, ...outRows]
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .slice(0, cap);
  } catch (err) {
    console.error('[getSessionMessages] error:', err);
    return [];
  }
}
