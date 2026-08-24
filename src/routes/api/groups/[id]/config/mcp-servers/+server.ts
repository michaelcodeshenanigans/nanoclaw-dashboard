import { error, json } from '@sveltejs/kit';
import { execNcl } from '$lib/server/ncl';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
  const groupId = params.id;
  if (!groupId) throw error(400, 'Missing group id');

  let body: { name?: string; command?: string; url?: string } = {};
  try { body = await request.json(); } catch { /* empty body */ }

  const { name, command, url } = body;
  if (!name?.trim()) throw error(400, 'name is required');
  if (!command?.trim() && !url?.trim()) throw error(400, 'Either command or url is required');

  const args = ['groups', 'config', 'add-mcp-server', '--id', groupId, '--name', name.trim()];
  if (command?.trim()) args.push('--command', command.trim());
  else if (url?.trim()) args.push('--url', url.trim());

  try {
    const output = await execNcl(args);
    return json({ status: 'ok', output });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('approval-pending')) return json({ status: 'approval-pending' }, { status: 202 });
    throw error(500, msg);
  }
};

export const DELETE: RequestHandler = async ({ params, request }) => {
  const groupId = params.id;
  if (!groupId) throw error(400, 'Missing group id');

  let body: { name?: string } = {};
  try { body = await request.json(); } catch { /* empty body */ }

  const { name } = body;
  if (!name?.trim()) throw error(400, 'name is required');

  const args = ['groups', 'config', 'remove-mcp-server', '--id', groupId, '--name', name.trim()];

  try {
    const output = await execNcl(args);
    return json({ status: 'ok', output });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('approval-pending')) return json({ status: 'approval-pending' }, { status: 202 });
    throw error(500, msg);
  }
};
