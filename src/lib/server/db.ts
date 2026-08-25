import Database from 'better-sqlite3';
import type { DbStatus, Group, HealthStats, GroupDetail, Member, Destination, SessionSummary, SessionWithGroup, Message, PendingApproval, UnregisteredSender, ScheduledTask, LlmCall, KpiStats, KpiPeriod, RunHistoryEntry, RunStatus, TriggerSource, TriageItem, TaskRun, FailedTaskSummary, ErrorDigestGroup, GroupConfig, McpServerConfig, ConnectionHealth, DeltaSession, DeltaApproval } from '$lib/types';

type BetterDB = InstanceType<typeof Database>;

let _db: BetterDB | null = null;
let _dbPath: string | null = null;

function getDb(): BetterDB {
  if (!_db) {
    const path = process.env.NANOCLAW_DB;
    if (!path) throw new Error('NANOCLAW_DB environment variable is not set.');
    _dbPath = path;
    _db = new Database(path, { readonly: true });
    _db.pragma('busy_timeout = 1000');
  }
  return _db;
}

export const db = new Proxy({} as BetterDB, {
  get(_, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  }
});

export function checkDbHealth(): DbStatus {
  try {
    db.prepare('SELECT 1').get();
    return { ok: true, path: _dbPath! };
  } catch (err) {
    return {
      ok: false,
      path: _dbPath!,
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

const ALLOWED_APPROVAL_STATUSES = new Set(['pending', 'approved', 'rejected', 'expired']);

export function getPendingApprovals(status = 'pending'): PendingApproval[] {
  const baseQuery = `
    SELECT
      a.approval_id,
      a.session_id,
      a.request_id,
      a.action,
      a.payload,
      a.created_at,
      a.agent_group_id,
      a.channel_type,
      a.platform_id,
      a.expires_at,
      a.status,
      a.title,
      a.options_json,
      g.name AS group_name
    FROM pending_approvals a
    LEFT JOIN agent_groups g ON g.id = a.agent_group_id
  `;

  if (status === 'all') {
    return db.prepare(baseQuery + ' ORDER BY a.created_at DESC LIMIT 100').all() as PendingApproval[];
  }

  const safeStatus = ALLOWED_APPROVAL_STATUSES.has(status) ? status : 'pending';
  return db.prepare(baseQuery + ' WHERE a.status = ? ORDER BY a.created_at DESC LIMIT 100').all(safeStatus) as PendingApproval[];
}

export interface DroppedFilters {
  agentGroupId?: string;
  channelType?: string;
}

export function getUnregisteredSenders(filters: DroppedFilters = {}): UnregisteredSender[] {
  const where: string[] = [];
  const params: string[] = [];

  if (filters.agentGroupId) {
    where.push('u.agent_group_id = ?');
    params.push(filters.agentGroupId);
  }
  if (filters.channelType) {
    where.push('u.channel_type = ?');
    params.push(filters.channelType);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  return db.prepare(`
    SELECT
      u.channel_type,
      u.platform_id,
      u.user_id,
      u.sender_name,
      u.reason,
      u.messaging_group_id,
      u.agent_group_id,
      u.message_count,
      u.first_seen,
      u.last_seen,
      g.name AS group_name
    FROM unregistered_senders u
    LEFT JOIN agent_groups g ON g.id = u.agent_group_id
    ${whereSql}
    ORDER BY u.last_seen DESC
    LIMIT 200
  `).all(...params) as UnregisteredSender[];
}

export function getLlmCalls(sessionId: string): LlmCall[] {
  const session = db.prepare(
    'SELECT id, agent_group_id FROM sessions WHERE id = ?'
  ).get(sessionId) as { id: string; agent_group_id: string } | undefined;

  if (!session) return [];

  const { outbound } = getSessionDbPair(session.agent_group_id, session.id);
  if (!outbound) return [];

  try {
    return outbound.prepare(
      'SELECT * FROM llm_calls ORDER BY turn_seq ASC, id ASC'
    ).all() as LlmCall[];
  } catch {
    return [];
  }
}

export interface RunHistoryFilters {
  status?: RunStatus;
  groupId?: string;
  triggerSource?: TriggerSource;
  since?: string;
  limit?: number;
}

function containerStatusToRunStatus(cs: string | null): RunStatus {
  if (cs === 'running') return 'running';
  if (cs === 'error') return 'failed';
  if (cs === 'stopped') return 'success';
  return 'unknown';
}

export function getRunHistory(filters: RunHistoryFilters = {}): RunHistoryEntry[] {
  const { status, groupId, triggerSource, since, limit = 200 } = filters;

  // Fetch sessions as runs
  const sessionWhere: string[] = [];
  const sessionParams: string[] = [];

  if (groupId) { sessionWhere.push('s.agent_group_id = ?'); sessionParams.push(groupId); }
  if (since) { sessionWhere.push('s.created_at >= ?'); sessionParams.push(since); }

  const sessionWhereSql = sessionWhere.length ? `WHERE ${sessionWhere.join(' AND ')}` : '';

  const sessionRows = db.prepare(`
    SELECT
      s.id,
      s.agent_group_id AS group_id,
      g.name           AS group_name,
      s.container_status,
      s.created_at     AS started_at,
      s.last_active,
      CASE
        WHEN s.last_active IS NOT NULL AND s.last_active > s.created_at
        THEN (julianday(s.last_active) - julianday(s.created_at)) * 86400.0
        ELSE NULL
      END AS duration_s
    FROM sessions s
    JOIN agent_groups g ON g.id = s.agent_group_id
    ${sessionWhereSql}
    ORDER BY s.created_at DESC
    LIMIT ?
  `).all(...sessionParams, limit) as Array<{
    id: string;
    group_id: string;
    group_name: string;
    container_status: string | null;
    started_at: string;
    last_active: string | null;
    duration_s: number | null;
  }>;

  const sessionEntries: RunHistoryEntry[] = sessionRows.map(r => ({
    id: r.id,
    run_type: 'session',
    run_status: containerStatusToRunStatus(r.container_status),
    group_id: r.group_id,
    group_name: r.group_name,
    trigger_source: 'message',
    duration_s: r.duration_s,
    turn_count: null,
    cost: null,
    started_at: r.started_at,
    last_active: r.last_active
  }));

  // Fetch scheduled tasks as runs
  let taskEntries: RunHistoryEntry[] = [];
  if (!triggerSource || triggerSource === 'scheduled') {
    try {
      const scheduledTasks = getScheduledTasks();
      taskEntries = scheduledTasks
        .filter(t => !groupId || t.agent_group_id === groupId)
        .filter(t => !since || (t.process_after ?? '') >= since)
        .map(t => ({
          id: t.id,
          run_type: 'task' as const,
          run_status: (t.status === 'pending' ? 'waiting' : 'waiting') as RunStatus,
          group_id: t.agent_group_id,
          group_name: t.group_name,
          trigger_source: 'scheduled' as const,
          duration_s: null,
          turn_count: null,
          cost: null,
          started_at: t.process_after ?? new Date().toISOString(),
          last_active: null
        }));
    } catch {
      // session DBs not accessible
    }
  }

  // Merge and filter by status/trigger
  const all = [...sessionEntries, ...taskEntries]
    .filter(r => !status || r.run_status === status)
    .filter(r => !triggerSource || r.trigger_source === triggerSource);

  // Sort merged by started_at desc, cap at limit
  return all
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, limit);
}

function queryKpiPeriod(since: string, until: string): KpiPeriod {
  const row = db.prepare(`
    SELECT
      COUNT(*) AS sessions,
      SUM(CASE WHEN container_status = 'error' THEN 1 ELSE 0 END) AS failures,
      AVG(
        CASE
          WHEN last_active IS NOT NULL AND last_active > created_at
          THEN (julianday(last_active) - julianday(created_at)) * 86400.0
          ELSE NULL
        END
      ) AS avg_duration_s
    FROM sessions
    WHERE created_at >= ? AND created_at < ?
  `).get(since, until) as { sessions: number; failures: number; avg_duration_s: number | null };

  const sessions = row.sessions ?? 0;
  const failures = row.failures ?? 0;
  return {
    sessions,
    failures,
    failure_rate: sessions > 0 ? (failures / sessions) * 100 : 0,
    avg_duration_s: row.avg_duration_s ?? null
  };
}

export function getKpiStats(): KpiStats {
  const now = new Date();
  const t7 = new Date(now.getTime() - 7 * 86400000).toISOString();
  const t14 = new Date(now.getTime() - 14 * 86400000).toISOString();
  const tNow = now.toISOString();

  return {
    current: queryKpiPeriod(t7, tNow),
    prior: queryKpiPeriod(t14, t7),
    window_days: 7,
    spend_unavailable: true
  };
}

function relativeTimeMs(ts: string): string {
  try {
    const ms = Date.now() - new Date(ts).getTime();
    const h = Math.floor(ms / 3600000);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch {
    return ts;
  }
}

export function getTriageItems(): TriageItem[] {
  const items: TriageItem[] = [];

  // 1. Pending approvals — high priority
  try {
    const approvals = getPendingApprovals('pending');
    for (const a of approvals) {
      items.push({
        item_key: `approval:${a.approval_id}`,
        item_type: 'approval',
        priority: 'high',
        title: a.title || a.action,
        description: `Action "${a.action}" is waiting for approval via ${a.channel_type ?? 'chat'}`,
        group_name: a.group_name,
        group_id: a.agent_group_id,
        occurred_at: a.created_at,
        session_id: a.session_id ?? undefined,
        approval_id: a.approval_id
      });
    }
  } catch { /* noop */ }

  // 2. Dropped / unregistered senders — low priority
  try {
    const dropped = getUnregisteredSenders();
    for (const d of dropped) {
      items.push({
        item_key: `dropped:${d.channel_type}:${d.platform_id}`,
        item_type: 'dropped',
        priority: 'low',
        title: `Dropped message from ${d.sender_name ?? d.platform_id}`,
        description: `${d.message_count} message(s) via ${d.channel_type} — reason: ${d.reason}`,
        group_name: d.group_name,
        group_id: d.agent_group_id,
        occurred_at: d.last_seen,
        channel_type: d.channel_type,
        platform_id: d.platform_id
      });
    }
  } catch { /* noop */ }

  // 3. Stalled sessions — running but last_active > 2h ago — medium priority
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
    const stalledRows = db.prepare(`
      SELECT s.id, s.agent_group_id, s.last_active, s.created_at, g.name AS group_name
      FROM sessions s
      JOIN agent_groups g ON g.id = s.agent_group_id
      WHERE s.container_status = 'running'
        AND (s.last_active IS NULL OR s.last_active < ?)
      ORDER BY s.last_active ASC
      LIMIT 50
    `).all(twoHoursAgo) as Array<{
      id: string; agent_group_id: string;
      last_active: string | null; created_at: string; group_name: string;
    }>;

    for (const s of stalledRows) {
      items.push({
        item_key: `stalled:${s.id}`,
        item_type: 'stalled',
        priority: 'medium',
        title: `Stalled session in ${s.group_name}`,
        description: s.last_active
          ? `Session running but last active ${relativeTimeMs(s.last_active)}`
          : 'Session running but has never been active',
        group_name: s.group_name,
        group_id: s.agent_group_id,
        occurred_at: s.last_active ?? s.created_at,
        session_id: s.id
      });
    }
  } catch { /* noop */ }

  // 4. Overdue scheduled tasks — process_after in the past — medium priority
  try {
    const now = new Date().toISOString();
    const allTasks = getScheduledTasks();
    for (const t of allTasks) {
      if (t.status === 'pending' && t.process_after && t.process_after < now) {
        items.push({
          item_key: `overdue:${t.id}`,
          item_type: 'overdue_task',
          priority: 'medium',
          title: `Overdue task in ${t.group_name}`,
          description: t.prompt.slice(0, 100) + (t.prompt.length > 100 ? '…' : ''),
          group_name: t.group_name,
          group_id: t.agent_group_id,
          occurred_at: t.process_after,
          task_id: t.id
        });
      }
    }
  } catch { /* noop */ }

  return items;
}

export function checkApprovalTimeout(thresholdMinutes: number, groupId: string | null): string | null {
  const cutoff = new Date(Date.now() - thresholdMinutes * 60000).toISOString();
  const row = groupId
    ? (db.prepare(`SELECT COUNT(*) AS n FROM pending_approvals WHERE status='pending' AND created_at < ? AND agent_group_id = ?`).get(cutoff, groupId) as { n: number })
    : (db.prepare(`SELECT COUNT(*) AS n FROM pending_approvals WHERE status='pending' AND created_at < ?`).get(cutoff) as { n: number });
  return row.n > 0 ? `${row.n} approval(s) pending for >${thresholdMinutes}min` : null;
}

export function checkSessionSilence(thresholdMinutes: number, groupId: string | null): string | null {
  const cutoff = new Date(Date.now() - thresholdMinutes * 60000).toISOString();
  const row = groupId
    ? (db.prepare(`SELECT COUNT(*) AS n FROM sessions WHERE container_status='running' AND (last_active IS NULL OR last_active < ?) AND agent_group_id = ?`).get(cutoff, groupId) as { n: number })
    : (db.prepare(`SELECT COUNT(*) AS n FROM sessions WHERE container_status='running' AND (last_active IS NULL OR last_active < ?)`).get(cutoff) as { n: number });
  return row.n > 0 ? `${row.n} running session(s) silent for >${thresholdMinutes}min` : null;
}

export function getScheduledTasks(): ScheduledTask[] {
  const sessions = db.prepare(`
    SELECT
      s.id AS session_id,
      s.agent_group_id,
      g.name AS group_name
    FROM sessions s
    JOIN agent_groups g ON g.id = s.agent_group_id
    ORDER BY s.last_active DESC
  `).all() as Array<{ session_id: string; agent_group_id: string; group_name: string }>;

  const seen = new Set<string>();
  const results: ScheduledTask[] = [];

  for (const session of sessions) {
    if (seen.has(session.agent_group_id)) continue;

    try {
      const { inbound } = getSessionDbPair(session.agent_group_id, session.session_id);
      if (!inbound) continue;

      const rows = inbound.prepare(`
        SELECT series_id AS id, status, process_after, recurrence, content, MAX(seq)
        FROM messages_in
        WHERE kind = 'task' AND status IN ('pending', 'paused')
        GROUP BY series_id
        ORDER BY process_after ASC
      `).all() as Array<{
        id: string;
        status: 'pending' | 'paused';
        process_after: string | null;
        recurrence: string | null;
        content: string;
      }>;

      for (const row of rows) {
        seen.add(session.agent_group_id);
        let prompt = '';
        let script: string | null = null;
        try {
          const parsed = JSON.parse(row.content) as { prompt?: string; script?: string };
          prompt = parsed.prompt ?? '';
          script = parsed.script ?? null;
        } catch {
          prompt = row.content.slice(0, 120);
        }
        results.push({
          id: row.id,
          status: row.status,
          process_after: row.process_after,
          recurrence: row.recurrence,
          prompt,
          script,
          agent_group_id: session.agent_group_id,
          group_name: session.group_name,
          session_id: session.session_id
        });
      }
    } catch {
      // session DB not accessible — skip
    }
  }

  return results;
}

export function getTaskHistory(agentGroupId: string, sessionId: string, seriesId: string): TaskRun[] {
  try {
    const { inbound } = getSessionDbPair(agentGroupId, sessionId);
    if (!inbound) return [];
    const rows = inbound.prepare(`
      SELECT seq, status, process_after, recurrence
      FROM messages_in
      WHERE kind = 'task' AND series_id = ? AND status IN ('completed', 'failed', 'processing')
      ORDER BY seq DESC
      LIMIT 50
    `).all(seriesId) as Array<{ seq: number; status: string; process_after: string | null; recurrence: string | null }>;
    return rows.map(r => ({
      seq: r.seq,
      status: r.status as TaskRun['status'],
      process_after: r.process_after,
      trigger: r.recurrence === null ? 'manual' as const : 'scheduled' as const,
    }));
  } catch {
    return [];
  }
}

const FLAP_THRESHOLD = 3;

export function isFlapping(runs: TaskRun[]): boolean {
  const settled = runs.filter(r => r.status !== 'processing');
  if (settled.length < 2) return false;
  let transitions = 0;
  for (let i = 0; i < settled.length - 1; i++) {
    if (settled[i].status !== settled[i + 1].status) transitions++;
  }
  return transitions >= FLAP_THRESHOLD;
}

export function getFailedTaskSummaries(): FailedTaskSummary[] {
  const sessions = db.prepare(`
    SELECT s.id AS session_id, s.agent_group_id, g.name AS group_name
    FROM sessions s
    JOIN agent_groups g ON g.id = s.agent_group_id
    ORDER BY s.last_active DESC
  `).all() as Array<{ session_id: string; agent_group_id: string; group_name: string }>;

  // Dedup by series_id, not by group — each task series has its own session,
  // so skipping a group after the first session would miss sibling series sessions.
  const seenSeries = new Set<string>();
  const results: FailedTaskSummary[] = [];

  for (const session of sessions) {
    try {
      const { inbound } = getSessionDbPair(session.agent_group_id, session.session_id);
      if (!inbound) continue;

      const rows = inbound.prepare(`
        SELECT series_id, COUNT(*) AS failure_count, MAX(process_after) AS last_failure, content
        FROM messages_in
        WHERE kind = 'task' AND status = 'failed'
        GROUP BY series_id
        ORDER BY last_failure DESC
      `).all() as Array<{ series_id: string; failure_count: number; last_failure: string | null; content: string }>;

      for (const row of rows) {
        if (seenSeries.has(row.series_id)) continue;
        seenSeries.add(row.series_id);

        let prompt = '';
        try {
          const parsed = JSON.parse(row.content) as { prompt?: string };
          prompt = parsed.prompt ?? '';
        } catch {
          prompt = row.content.slice(0, 120);
        }
        results.push({
          series_id: row.series_id,
          agent_group_id: session.agent_group_id,
          group_name: session.group_name,
          session_id: session.session_id,
          prompt,
          last_failure: row.last_failure,
          failure_count: row.failure_count,
        });
      }
    } catch {
      // session DB not accessible — skip
    }
  }

  return results.sort((a, b) => {
    if (!a.last_failure) return 1;
    if (!b.last_failure) return -1;
    return b.last_failure.localeCompare(a.last_failure);
  });
}

// ─── Error Digest ────────────────────────────────────────────────────────────

export function getErrorDigest(): ErrorDigestGroup[] {
  const summaries = getFailedTaskSummaries();
  const byGroup = new Map<string, ErrorDigestGroup>();
  for (const s of summaries) {
    const g = byGroup.get(s.agent_group_id);
    if (g) {
      g.failing_series++;
      g.total_failure_runs += s.failure_count;
      if (!g.last_failure || (s.last_failure && s.last_failure > g.last_failure)) {
        g.last_failure = s.last_failure;
      }
    } else {
      byGroup.set(s.agent_group_id, {
        agent_group_id: s.agent_group_id,
        group_name: s.group_name,
        failing_series: 1,
        total_failure_runs: s.failure_count,
        last_failure: s.last_failure,
      });
    }
  }
  return [...byGroup.values()].sort((a, b) => b.total_failure_runs - a.total_failure_runs);
}

// ─── Group Config (skills + MCP servers) ────────────────────────────────────

interface ContainerConfigRow {
  agent_group_id: string;
  group_name: string;
  skills: string | null;
  mcp_servers: string | null;
}

function parseGroupConfigRow(row: ContainerConfigRow): GroupConfig {
  let skills: 'all' | string[];
  try {
    const v = JSON.parse(row.skills ?? '"all"');
    skills = v === 'all' ? 'all' : Array.isArray(v) ? (v as unknown[]).filter(s => typeof s === 'string') as string[] : 'all';
  } catch { skills = 'all'; }

  let mcp_servers: Record<string, McpServerConfig>;
  try {
    const v = JSON.parse(row.mcp_servers ?? '{}');
    mcp_servers = (v && typeof v === 'object' && !Array.isArray(v)) ? v as Record<string, McpServerConfig> : {};
  } catch { mcp_servers = {}; }

  return { agent_group_id: row.agent_group_id, group_name: row.group_name, skills, mcp_servers };
}

export function getGroupConfig(agentGroupId: string): GroupConfig | null {
  const row = db.prepare(`
    SELECT g.id AS agent_group_id, g.name AS group_name,
           cc.skills, cc.mcp_servers
    FROM agent_groups g
    LEFT JOIN container_configs cc ON cc.agent_group_id = g.id
    WHERE g.id = ?
  `).get(agentGroupId) as ContainerConfigRow | undefined;
  return row ? parseGroupConfigRow(row) : null;
}

export function getAllGroupConfigs(): GroupConfig[] {
  const rows = db.prepare(`
    SELECT g.id AS agent_group_id, g.name AS group_name,
           cc.skills, cc.mcp_servers
    FROM agent_groups g
    LEFT JOIN container_configs cc ON cc.agent_group_id = g.id
    ORDER BY g.name
  `).all() as ContainerConfigRow[];
  return rows.map(parseGroupConfigRow);
}

// ─── Connections Health ───────────────────────────────────────────────────────

export function getConnectionsHealth(): ConnectionHealth[] {
  return db.prepare(`
    SELECT
      mg.id                                                  AS id,
      mg.name                                                AS name,
      mg.channel_type                                        AS platform,
      COUNT(DISTINCT mga.agent_group_id)                     AS agent_group_count,
      MAX(s.last_active)                                     AS last_active,
      SUM(CASE WHEN s.container_status = 'running' THEN 1 ELSE 0 END) AS active_sessions
    FROM messaging_groups mg
    LEFT JOIN messaging_group_agents mga ON mga.messaging_group_id = mg.id
    LEFT JOIN sessions s ON s.messaging_group_id = mg.id
    GROUP BY mg.id, mg.name, mg.channel_type
    ORDER BY last_active DESC
  `).all() as ConnectionHealth[];
}

// ─── Delta View ───────────────────────────────────────────────────────────────

export interface DeltaViewData {
  new_sessions: DeltaSession[];
  completed_since: DeltaSession[];
  new_approvals: DeltaApproval[];
}

export function getDeltaView(baselineTs: string): DeltaViewData {
  const new_sessions = db.prepare(`
    SELECT s.id, s.agent_group_id AS group_id, g.name AS group_name,
           s.container_status, s.status, s.created_at, s.last_active
    FROM sessions s
    JOIN agent_groups g ON g.id = s.agent_group_id
    WHERE s.created_at > ?
    ORDER BY s.created_at DESC
    LIMIT 50
  `).all(baselineTs) as DeltaSession[];

  const completed_since = db.prepare(`
    SELECT s.id, s.agent_group_id AS group_id, g.name AS group_name,
           s.container_status, s.status, s.created_at, s.last_active
    FROM sessions s
    JOIN agent_groups g ON g.id = s.agent_group_id
    WHERE s.created_at <= ?
      AND s.last_active > ?
      AND s.container_status IN ('stopped', 'error')
    ORDER BY s.last_active DESC
    LIMIT 50
  `).all(baselineTs, baselineTs) as DeltaSession[];

  const new_approvals = db.prepare(`
    SELECT a.approval_id, a.session_id, a.agent_group_id AS group_id,
           g.name AS group_name, a.action, a.title, a.created_at, a.status
    FROM pending_approvals a
    LEFT JOIN agent_groups g ON g.id = a.agent_group_id
    WHERE a.created_at > ? AND a.status = 'pending'
    ORDER BY a.created_at DESC
    LIMIT 50
  `).all(baselineTs) as DeltaApproval[];

  return { new_sessions, completed_since, new_approvals };
}
