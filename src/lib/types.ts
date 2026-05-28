export interface DbStatus {
  ok: boolean;
  path: string;
  error?: string;
}

export interface NclStatus {
  ok: boolean;
  socket: string;
  error?: string;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  db: DbStatus;
  ncl: NclStatus;
  ts: string;
}
