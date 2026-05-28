import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import path from 'path';

const MAX_CONNECTIONS = 50;

interface PoolEntry {
  inbound: Database.Database | null;
  outbound: Database.Database | null;
}

const pool = new Map<string, PoolEntry>();

function evictLRU(): void {
  const key = pool.keys().next().value;
  if (key === undefined) return;
  const entry = pool.get(key)!;
  try { entry.inbound?.close(); } catch {}
  try { entry.outbound?.close(); } catch {}
  pool.delete(key);
}

function openDb(filePath: string): Database.Database | null {
  if (!existsSync(filePath)) return null;
  try {
    const db = new Database(filePath, { readonly: true, fileMustExist: true });
    db.pragma('busy_timeout = 500');
    return db;
  } catch {
    return null;
  }
}

export function getSessionDbPair(
  groupId: number,
  sessionId: string
): PoolEntry {
  const cacheKey = `${groupId}:${sessionId}`;

  if (pool.has(cacheKey)) {
    const entry = pool.get(cacheKey)!;
    // Move to end = most recently used
    pool.delete(cacheKey);
    pool.set(cacheKey, entry);
    return entry;
  }

  if (pool.size >= MAX_CONNECTIONS) evictLRU();

  const dbEnvPath = process.env.NANOCLAW_DB ?? '';
  const dataDir = path.dirname(dbEnvPath);
  const sessBase = path.join(dataDir, 'v2-sessions', String(groupId), sessionId);

  const entry: PoolEntry = {
    inbound: openDb(path.join(sessBase, 'inbound.db')),
    outbound: openDb(path.join(sessBase, 'outbound.db'))
  };

  pool.set(cacheKey, entry);
  return entry;
}

export function getPoolSize(): number {
  return pool.size;
}
