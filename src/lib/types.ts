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

export interface HostHealth {
  cpu_pct: number;
  mem: { used_mb: number; total_mb: number; pct: number };
  disk: { used_gb: number; total_gb: number; pct: number };
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

export interface UnregisteredSender {
  channel_type: string;
  platform_id: string;
  user_id: string | null;
  sender_name: string | null;
  reason: string;
  messaging_group_id: string | null;
  agent_group_id: string | null;
  message_count: number;
  first_seen: string;
  last_seen: string;
  group_name: string | null;
}

export interface ScheduledTask {
  id: string;
  status: 'pending' | 'paused';
  process_after: string | null;
  recurrence: string | null;
  prompt: string;
  script: string | null;
  agent_group_id: string;
  group_name: string;
  session_id: string;
}

export type AnnotationTargetType = 'session' | 'message';

export interface Annotation {
  id: number;
  target_type: AnnotationTargetType;
  target_id: string;
  session_id: string | null;
  display_label: string | null;
  bookmarked: boolean;
  rating: -1 | 0 | 1 | null;
  tags: string[];
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface FailedTaskSummary {
  series_id: string;
  agent_group_id: string;
  group_name: string;
  session_id: string;
  prompt: string;
  last_failure: string | null;
  failure_count: number;
}

export interface TaskRun {
  seq: number;
  status: 'completed' | 'failed' | 'processing';
  process_after: string | null;
  trigger: 'scheduled' | 'manual';
}

export interface TaskHistoryResponse {
  runs: TaskRun[];
  flapping: boolean;
}

export interface LlmCall {
  id: number;
  turn_seq: number;
  timestamp: string;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  thinking_text: string | null;
  duration_ms: number | null;
}

export type RunStatus = 'running' | 'success' | 'failed' | 'waiting' | 'dropped' | 'unknown';
export type TriggerSource = 'message' | 'scheduled' | 'manual';

export interface RunHistoryEntry {
  id: string;
  run_type: 'session' | 'task';
  run_status: RunStatus;
  group_id: string;
  group_name: string;
  trigger_source: TriggerSource;
  duration_s: number | null;
  turn_count: number | null;
  cost: null;
  started_at: string;
  last_active: string | null;
}

export interface KpiPeriod {
  sessions: number;
  failures: number;
  failure_rate: number;
  avg_duration_s: number | null;
}

export interface KpiStats {
  current: KpiPeriod;
  prior: KpiPeriod;
  window_days: 7;
  spend_unavailable: true;
}

export type MonitorType = 'approval_timeout' | 'session_silence';
export type MonitorPushStatus = 'pending' | 'sent' | 'skipped' | 'failed';

export interface Monitor {
  id: string;
  name: string;
  type: MonitorType;
  enabled: boolean;
  threshold_minutes: number;
  target_group_id: string | null;
  cooldown_minutes: number;
  last_fired_at: string | null;
  created_at: string;
}

export interface MonitorAlert {
  id: number;
  monitor_id: string;
  monitor_name: string;
  fired_at: string;
  condition_met: string;
  push_status: MonitorPushStatus;
  acknowledged: boolean;
}

export type TriageItemType = 'approval' | 'dropped' | 'stalled' | 'overdue_task';
export type TriagePriority = 'high' | 'medium' | 'low';

export interface TriageItem {
  item_key: string;
  item_type: TriageItemType;
  priority: TriagePriority;
  title: string;
  description: string;
  group_name: string | null;
  group_id: string | null;
  occurred_at: string;
  // type-specific
  session_id?: string;
  approval_id?: string;
  channel_type?: string;
  platform_id?: string;
  task_id?: string;
}

export interface TriageCounts {
  total: number;
  approval: number;
  dropped: number;
  stalled: number;
  overdue_task: number;
}

export interface TriageResponse {
  items: TriageItem[];
  counts: TriageCounts;
  state_available: boolean;
}

export interface PendingApproval {
  approval_id: string;
  session_id: string | null;
  request_id: string;
  action: string;
  payload: string;
  created_at: string;
  agent_group_id: string | null;
  channel_type: string | null;
  platform_id: string | null;
  expires_at: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  title: string;
  options_json: string;
  group_name: string | null;
}
