import Database from 'better-sqlite3';
import path from 'path';
import { existsSync } from 'fs';
import {
  replaceSearchEntriesByType,
  insertSearchEntries,
  getSearchWatermark,
  setSearchWatermark,
  type SearchEntry
} from './dashboard-db';

const BODY_MAX = 1500;
const RECENT_SESSIONS_HOURS = 48;

function openReadonly(filePath: string): Database.Database | null {
  if (!existsSync(filePath)) return null;
  try {
    const db = new Database(filePath, { readonly: true, fileMustExist: true });
    db.pragma('busy_timeout = 500');
    return db;
  } catch { return null; }
}

function getNclDb(): Database.Database | null {
  const p = process.env.NANOCLAW_DB;
  if (!p) return null;
  return openReadonly(p);
}

function sessBase(groupId: string, sessionId: string): string {
  const nclDb = process.env.NANOCLAW_DB ?? '';
  return path.join(path.dirname(nclDb), 'v2-sessions', groupId, sessionId);
}

function trunc(s: string | null | undefined): string {
  if (!s) return '';
  return s.length > BODY_MAX ? s.slice(0, BODY_MAX) + '…' : s;
}

// ─── Group indexing ──────────────────────────────────────────────────────────

function indexGroups(nclDb: Database.Database): void {
  const rows = nclDb.prepare('SELECT id, name, created_at FROM agent_groups').all() as Array<{
    id: string; name: string; created_at: string;
  }>;
  const entries: SearchEntry[] = rows.map(r => ({
    type: 'group' as const,
    entity_id: r.id,
    group_id: r.id,
    session_id: null,
    direction: null,
    ts: r.created_at,
    title: r.name,
    body: ''
  }));
  replaceSearchEntriesByType('group', entries);
}

// ─── Session indexing ────────────────────────────────────────────────────────

function indexSessions(nclDb: Database.Database): void {
  const rows = nclDb.prepare(`
    SELECT s.id, s.agent_group_id, g.name AS group_name, s.created_at
    FROM sessions s
    JOIN agent_groups g ON g.id = s.agent_group_id
    ORDER BY s.created_at DESC
    LIMIT 5000
  `).all() as Array<{ id: string; agent_group_id: string; group_name: string; created_at: string }>;

  const entries: SearchEntry[] = rows.map(r => ({
    type: 'session' as const,
    entity_id: r.id,
    group_id: r.agent_group_id,
    session_id: r.id,
    direction: null,
    ts: r.created_at,
    title: `${r.group_name} — ${r.id.slice(0, 8)}`,
    body: r.id
  }));
  replaceSearchEntriesByType('session', entries);
}

// ─── Task indexing ───────────────────────────────────────────────────────────

function indexTasks(nclDb: Database.Database): void {
  const sessions = nclDb.prepare(`
    SELECT s.id AS session_id, s.agent_group_id, g.name AS group_name
    FROM sessions s
    JOIN agent_groups g ON g.id = s.agent_group_id
    ORDER BY s.last_active DESC
    LIMIT 50
  `).all() as Array<{ session_id: string; agent_group_id: string; group_name: string }>;

  const seen = new Set<string>();
  const entries: SearchEntry[] = [];

  for (const s of sessions) {
    if (seen.has(s.agent_group_id)) continue;
    const inboundPath = path.join(sessBase(s.agent_group_id, s.session_id), 'inbound.db');
    const inDb = openReadonly(inboundPath);
    if (!inDb) continue;
    try {
      const rows = inDb.prepare(`
        SELECT series_id AS id, content, process_after
        FROM messages_in
        WHERE kind = 'task' AND series_id IS NOT NULL
        GROUP BY series_id
        ORDER BY process_after ASC
      `).all() as Array<{ id: string; content: string; process_after: string | null }>;

      for (const r of rows) {
        if (seen.has(`task:${r.id}`)) continue;
        seen.add(`task:${r.id}`);
        let title = r.id;
        let body = '';
        try {
          const parsed = JSON.parse(r.content) as { prompt?: string; text?: string };
          const raw = parsed.prompt ?? parsed.text ?? r.content;
          title = (typeof raw === 'string' ? raw : r.content).slice(0, 80);
          body = trunc(typeof raw === 'string' ? raw : r.content);
        } catch {
          title = r.content.slice(0, 80);
          body = trunc(r.content);
        }
        entries.push({
          type: 'task' as const,
          entity_id: r.id,
          group_id: s.agent_group_id,
          session_id: s.session_id,
          direction: null,
          ts: r.process_after ?? '',
          title,
          body
        });
      }
      seen.add(s.agent_group_id);
    } finally {
      try { inDb.close(); } catch {}
    }
  }
  replaceSearchEntriesByType('task', entries);
}

// ─── Message indexing (incremental) ─────────────────────────────────────────

function indexMessages(nclDb: Database.Database): void {
  const sessions = nclDb.prepare(`
    SELECT s.id AS session_id, s.agent_group_id, g.name AS group_name
    FROM sessions s
    JOIN agent_groups g ON g.id = s.agent_group_id
    WHERE s.last_active > datetime('now', '-${RECENT_SESSIONS_HOURS} hours')
    ORDER BY s.last_active DESC
    LIMIT 200
  `).all() as Array<{ session_id: string; agent_group_id: string; group_name: string }>;

  for (const s of sessions) {
    const base = sessBase(s.agent_group_id, s.session_id);

    for (const dir of ['in', 'out'] as const) {
      const filePath = path.join(base, dir === 'in' ? 'inbound.db' : 'outbound.db');
      const sessDb = openReadonly(filePath);
      if (!sessDb) continue;
      const wmKey = `msg:${s.session_id}:${dir}`;
      const watermark = getSearchWatermark(wmKey);

      try {
        const table = dir === 'in' ? 'messages_in' : 'messages_out';
        const rows = sessDb.prepare(`
          SELECT id, timestamp, content
          FROM ${table}
          WHERE timestamp > ?
          ORDER BY timestamp ASC
          LIMIT 2000
        `).all(watermark) as Array<{ id: string; timestamp: string; content: string }>;

        if (rows.length === 0) continue;

        const entries: SearchEntry[] = rows.map(r => ({
          type: 'message' as const,
          entity_id: `${s.session_id}:${dir}:${r.id}`,
          group_id: s.agent_group_id,
          session_id: s.session_id,
          direction: dir,
          ts: r.timestamp,
          title: s.group_name,
          body: trunc(r.content)
        }));

        insertSearchEntries(entries);
        setSearchWatermark(wmKey, rows[rows.length - 1].timestamp);
      } finally {
        try { sessDb.close(); } catch {}
      }
    }
  }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

let _running = false;

export async function runSearchIndex(): Promise<void> {
  if (_running) return;
  _running = true;
  try {
    const nclDb = getNclDb();
    if (!nclDb) return;
    try {
      indexGroups(nclDb);
      indexSessions(nclDb);
      indexTasks(nclDb);
      indexMessages(nclDb);
    } finally {
      try { nclDb.close(); } catch {}
    }
  } catch (err) {
    console.error('[search-indexer] error:', err);
  } finally {
    _running = false;
  }
}

let _started = false;

export function startSearchIndexer(): void {
  if (_started) return;
  _started = true;
  // Initial index after short delay to let the server finish booting
  setTimeout(() => { runSearchIndex().catch(() => {}); }, 5000);
  // Incremental every 60s
  setInterval(() => { runSearchIndex().catch(() => {}); }, 60_000);
}
