import { error } from '@sveltejs/kit';
import { getOperatorRole, writeAuditEntry } from './dashboard-db';
import type { Role, OperatorInfo } from '$lib/types';

const ROLE_RANK: Record<Role, number> = { owner: 3, admin: 2, member: 1 };

export function getOperator(request: Request): OperatorInfo {
  const username = request.headers.get('Remote-User') ?? 'anonymous';
  const groups = (request.headers.get('Remote-Groups') ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const role = getOperatorRole(username, groups);
  return { username, groups, role };
}

export function requireRole(request: Request, minRole: Role): OperatorInfo {
  const op = getOperator(request);
  if (ROLE_RANK[op.role] < ROLE_RANK[minRole]) {
    error(403, `Requires ${minRole} role — your role is ${op.role}`);
  }
  return op;
}

export function audit(actor: string, action: string, target: string | null, targetId: string | null, payload?: unknown): void {
  writeAuditEntry(actor, action, target, targetId, payload != null ? JSON.stringify(payload) : null);
}
