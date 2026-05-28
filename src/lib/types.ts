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

export interface Group {
  id: number;
  name: string;
  folder: string;
  agent_provider: string;
  created_at: string;
  container_status: 'running' | 'stopped' | 'error' | null;
  last_active: string | null;
}

export interface ContainerStatusCounts {
  running: number;
  stopped: number;
  error: number;
}

export interface HealthStats {
  active_sessions: number;
  container_statuses: ContainerStatusCounts;
  recent_errors: number;
  total_groups: number;
}
