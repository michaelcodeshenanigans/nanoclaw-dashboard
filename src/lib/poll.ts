export interface PollState<T> {
  readonly data: T | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly lastUpdated: Date | null;
}

export function createPoller<T>(
  fetchFn: (signal: AbortSignal) => Promise<T>,
  intervalMs = 5000
): PollState<T> {
  let data = $state<T | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let lastUpdated = $state<Date | null>(null);

  $effect(() => {
    let abortController = new AbortController();

    async function poll() {
      try {
        const result = await fetchFn(abortController.signal);
        data = result;
        error = null;
        lastUpdated = new Date();
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        error = err instanceof Error ? err.message : String(err);
      } finally {
        loading = false;
      }
    }

    poll();

    const id = setInterval(() => {
      abortController.abort();
      abortController = new AbortController();
      poll();
    }, intervalMs);

    return () => {
      abortController.abort();
      clearInterval(id);
    };
  });

  return {
    get data() { return data; },
    get loading() { return loading; },
    get error() { return error; },
    get lastUpdated() { return lastUpdated; }
  };
}
