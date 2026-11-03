/**
 * One long-running media job per worker process, with a heartbeat that keeps the
 * container healthcheck (`find heartbeat -mmin -2`) green and the outbox lock fresh
 * (lease re-claims PROCESSING rows whose lock is older than 5 minutes).
 */
export const VIDEO_JOB_HEARTBEAT_MS = 20_000;

export class VideoLaneBusyError extends Error {
  constructor(readonly currentId: string) {
    super('video lane busy');
    this.name = 'VideoLaneBusyError';
  }
}

export interface LaneTimers {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

const realTimers: LaneTimers = {
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (h) => clearInterval(h as NodeJS.Timeout),
};

export interface LaneHooks {
  beat: () => void;
  /** Refresh the outbox row lock; failures are swallowed. */
  touch?: () => Promise<void>;
}

export class VideoJobLane {
  private current: string | null = null;

  constructor(
    private readonly timers: LaneTimers = realTimers,
    private readonly intervalMs = VIDEO_JOB_HEARTBEAT_MS,
  ) {}

  get busy(): boolean {
    return this.current !== null;
  }

  get currentId(): string | null {
    return this.current;
  }

  /** Claims the lane synchronously; throws VideoLaneBusyError if another job holds it. */
  async run<T>(id: string, work: () => Promise<T>, hooks: LaneHooks): Promise<T> {
    if (this.current !== null) throw new VideoLaneBusyError(this.current);
    this.current = id;
    const pulse = () => {
      try {
        hooks.beat();
      } catch {
        /* heartbeat is best-effort */
      }
      void hooks.touch?.().catch(() => undefined);
    };
    pulse();
    const handle = this.timers.setInterval(pulse, this.intervalMs);
    try {
      return await work();
    } finally {
      this.timers.clearInterval(handle);
      this.current = null;
      try {
        hooks.beat();
      } catch {
        /* best-effort */
      }
    }
  }
}
