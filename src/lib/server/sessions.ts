import path from 'node:path';
import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';
import type { ContainerState } from '$lib/types';

export function getSessionContainerState(
  groupId: number,
  sessionId: string
): ContainerState | null {
  const centralDb = process.env.NANOCLAW_DB;
  if (!centralDb) {
    return null;
  }

  const sessionDbPath = path.join(
    path.dirname(centralDb),
    'v2-sessions',
    String(groupId),
    sessionId,
    'outbound.db'
  );

  if (!existsSync(sessionDbPath)) {
    return null;
  }

  let handle: Database.Database | null = null;
  try {
    handle = new Database(sessionDbPath, { readonly: true, fileMustExist: true });
    handle.pragma('busy_timeout = 500');

    const row = handle.prepare(`
      SELECT
        current_tool,
        tool_declared_timeout_ms,
        tool_started_at
      FROM container_state
      LIMIT 1
    `).get() as ContainerState | undefined;

    return row ?? null;
  } catch (err) {
    console.error(
      `[getSessionContainerState] failed to read ${sessionDbPath}:`,
      err
    );
    return null;
  } finally {
    if (handle) {
      try {
        handle.close();
      } catch {
        /* ignore close errors */
      }
    }
  }
}
