import Database from 'better-sqlite3';
import type { DbStatus } from '$lib/types';

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
