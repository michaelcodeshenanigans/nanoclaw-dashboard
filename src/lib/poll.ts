export interface PollState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function createPoller<T>(
  fetchFn: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
  onUpdate: (state: PollState<T>) => void
): { stop(): void } {
  let stopped = false;
  let abortController = new AbortController();
  let lastData: T | null = null;

  async function poll(): Promise<void> {
    try {
      const result = await fetchFn(abortController.signal);
      if (stopped) return;
      lastData = result;
      onUpdate({ data: result, loading: false, error: null, lastUpdated: new Date() });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (stopped) return;
      onUpdate({
        data: lastData,
        loading: false,
        error: err instanceof Error ? err.message : String(err),
        lastUpdated: null
      });
    }
  }

  poll();
  const id = setInterval(() => {
    abortController.abort();
    abortController = new AbortController();
    poll();
  }, intervalMs);

  return {
    stop() {
      stopped = true;
      abortController.abort();
      clearInterval(id);
    }
  };
}
