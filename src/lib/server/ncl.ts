import { execFile as execFileCb } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import type { NclStatus } from '$lib/types';

const execFile = promisify(execFileCb);

const NCL_SOCKET = process.env.NCL_SOCKET ?? '/ncl.sock';
const NCL_BIN = process.env.NCL_BIN ?? 'ncl';

export function checkNclHealth(): NclStatus {
  if (existsSync(NCL_SOCKET)) {
    return { ok: true, socket: NCL_SOCKET };
  }
  return {
    ok: false,
    socket: NCL_SOCKET,
    error: `ncl socket not found at ${NCL_SOCKET}. Is NanoClaw running and the socket volume mounted?`
  };
}

export async function execNcl(args: string[]): Promise<string> {
  const { stdout } = await execFile(NCL_BIN, args, {
    env: { ...process.env, NCL_SOCKET }
  });
  return stdout.trim();
}
