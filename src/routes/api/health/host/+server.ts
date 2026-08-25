import { json } from '@sveltejs/kit';
import { readCpuPct, readMemory, readDisk, readRaid } from '$lib/server/host-health';
import type { HostHealth } from '$lib/types';

export const GET = async (): Promise<Response> => {
  try {
    const [cpu_pct, mem, disk, raid] = await Promise.all([readCpuPct(), readMemory(), readDisk(), readRaid()]);
    const body: HostHealth = { cpu_pct, mem, disk, raid, ts: new Date().toISOString() };
    return json(body);
  } catch (err) {
    return json({ error: String(err) }, { status: 500 });
  }
};
