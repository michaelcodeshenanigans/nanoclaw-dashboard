import { readFile } from 'node:fs/promises';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

function parseProcStat(content: string): { total: number; idle: number } {
  const line = content.split('\n')[0] ?? '';
  const parts = line.trim().split(/\s+/).slice(1).map(Number);
  const idle = (parts[3] ?? 0) + (parts[4] ?? 0); // idle + iowait
  const total = parts.reduce((a, b) => a + b, 0);
  return { total, idle };
}

export async function readCpuPct(): Promise<number> {
  const s1 = parseProcStat(await readFile('/proc/stat', 'utf8'));
  await new Promise<void>(r => setTimeout(r, 200));
  const s2 = parseProcStat(await readFile('/proc/stat', 'utf8'));
  const totalDelta = s2.total - s1.total;
  const idleDelta = s2.idle - s1.idle;
  if (totalDelta === 0) return 0;
  return Math.round((1 - idleDelta / totalDelta) * 1000) / 10;
}

export async function readMemory(): Promise<{ used_mb: number; total_mb: number; pct: number }> {
  const content = await readFile('/proc/meminfo', 'utf8');
  const get = (key: string): number => {
    const m = content.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'));
    return m ? parseInt(m[1], 10) : 0;
  };
  const totalKb = get('MemTotal');
  const availKb = get('MemAvailable');
  const usedKb = totalKb - availKb;
  return {
    total_mb: Math.round(totalKb / 1024),
    used_mb: Math.round(usedKb / 1024),
    pct: totalKb ? Math.round((usedKb / totalKb) * 1000) / 10 : 0
  };
}

export async function readDisk(): Promise<{ used_gb: number; total_gb: number; pct: number }> {
  const { stdout } = await execFile('df', ['-Pk', '/']);
  const parts = (stdout.trim().split('\n')[1] ?? '').trim().split(/\s+/);
  const totalKb = parseInt(parts[1] ?? '0', 10);
  const usedKb = parseInt(parts[2] ?? '0', 10);
  const pct = parseInt((parts[4] ?? '0%').replace('%', ''), 10);
  return {
    total_gb: Math.round(totalKb / 1024 / 1024 * 10) / 10,
    used_gb: Math.round(usedKb / 1024 / 1024 * 10) / 10,
    pct
  };
}
