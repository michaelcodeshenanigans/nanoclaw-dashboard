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
  id: string;
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

export interface GroupDetail {
  id: string;
  name: string;
  folder: string;
  agent_provider: string;
  created_at: string;
  model: string | null;
  config_json: string | null;
}

export interface Member {
  id: string;
  name: string;
  platform: string;
  platform_id: string;
  role: string;
}

export interface Destination {
  id: string;
  name: string;
  platform: string;
}

export interface SessionSummary {
  id: string;
  agent_group_id: string;
  thread_id: string | null;
  status: string | null;
  container_status: 'running' | 'stopped' | 'error' | null;
  last_active: string | null;
  created_at: string;
}

export interface SessionWithGroup {
  id: string;
  agent_group_id: string;
  messaging_group_id: string | null;
  thread_id: string | null;
  status: string | null;
  container_status: 'running' | 'stopped' | 'error' | null;
  last_active: string | null;
  created_at: string;
  group_name: string;
}

export interface ContainerState {
  current_tool: string | null;
  tool_declared_timeout_ms: number | null;
  tool_started_at: string | null;
}

export interface SessionDetail extends SessionWithGroup {
  container_state: ContainerState | null;
}

export interface Message {
  id: string;
  seq: number | null;
  kind: string;
  direction: 'in' | 'out';
  timestamp: string;
  content: string;
  platform_id: string | null;
  channel_type: string | null;
  thread_id: string | null;
}
