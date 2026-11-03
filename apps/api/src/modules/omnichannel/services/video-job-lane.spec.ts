/**
 * Single video job per worker + heartbeat during a 10-minute transcode (fake clock).
 * npx ts-node --transpile-only src/modules/omnichannel/services/video-job-lane.spec.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { OUTBOX_EVENT_TYPES } from '../omnichannel.constants';
import { LEASE_EVENT_TYPES, leaseEventTypes } from './outbox-lease';
import { VIDEO_JOB_HEARTBEAT_MS, VideoJobLane, VideoLaneBusyError, type LaneTimers } from './video-job-lane';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

class FakeClock implements LaneTimers {
  now = 0;
  private seq = 0;
  private intervals = new Map<number, { fn: () => void; ms: number; next: number }>();
  setInterval(fn: () => void, ms: number) {
    const id = ++this.seq;
    this.intervals.set(id, { fn, ms, next: this.now + ms });
    return id;
  }
  clearInterval(handle: unknown) {
    this.intervals.delete(handle as number);
  }
  get active() {
    return this.intervals.size;
  }
  advance(ms: number) {
    const end = this.now + ms;
    for (;;) {
      let due: { fn: () => void; ms: number; next: number } | null = null;
      for (const t of this.intervals.values()) if (t.next <= end && (!due || t.next < due.next)) due = t;
      if (!due) break;
      this.now = due.next;
      due.next += due.ms;
      due.fn();
    }
    this.now = end;
  }
}

async function main() {
  assert(VIDEO_JOB_HEARTBEAT_MS <= 30_000, 'heartbeat interval ≤ 30s');

  // 10-minute job: beat at least every 60s (healthcheck is find -mmin -2), lock touched.
  {
    const clock = new FakeClock();
    const lane = new VideoJobLane(clock);
    const beats: number[] = [];
    let touches = 0;
    let finish!: () => void;
    const job = lane.run(
      'evt-1',
      () => new Promise<void>((resolve) => { finish = resolve; }),
      { beat: () => beats.push(clock.now), touch: async () => { touches += 1; } },
    );
    assert(lane.busy && lane.currentId === 'evt-1', 'lane claimed synchronously');
    for (let s = 0; s < 600; s++) clock.advance(1000);
    finish();
    await job;
    assert(beats[0] === 0, 'beat at job start');
    beats.push(clock.now);
    for (let i = 1; i < beats.length; i++) {
      assert(beats[i] - beats[i - 1] <= 60_000, `gap ${beats[i] - beats[i - 1]}ms between beats`);
    }
    assert(beats.length >= 600_000 / VIDEO_JOB_HEARTBEAT_MS, `enough beats over 10 min (${beats.length})`);
    assert(touches >= 600_000 / VIDEO_JOB_HEARTBEAT_MS, 'outbox lock refreshed during job (lease reclaims after 5 min)');
    assert(clock.active === 0, 'heartbeat interval cleared after job');
    assert(!lane.busy, 'lane released');
  }

  // Busy guard + release on failure.
  {
    const clock = new FakeClock();
    const lane = new VideoJobLane(clock);
    let finish!: () => void;
    const first = lane.run('a', () => new Promise<void>((r) => { finish = r; }), { beat: () => undefined });
    let busyErr: unknown;
    try {
      await lane.run('b', async () => undefined, { beat: () => undefined });
    } catch (e) {
      busyErr = e;
    }
    assert(busyErr instanceof VideoLaneBusyError && busyErr.currentId === 'a', 'second job rejected while busy');
    finish();
    await first;
    let failed = false;
    try {
      await lane.run('c', async () => { throw new Error('boom'); }, { beat: () => undefined });
    } catch {
      failed = true;
    }
    assert(failed && !lane.busy && clock.active === 0, 'failed job releases lane + interval');
  }

  // Heartbeat throwing never breaks the job.
  {
    const lane = new VideoJobLane(new FakeClock());
    const out = await lane.run('x', async () => 42, { beat: () => { throw new Error('ro fs'); } });
    assert(out === 42, 'beat errors swallowed');
  }

  // Outbox isolation: transcode is not in the messenger/catalog batch lease and has its own case.
  {
    const t = OUTBOX_EVENT_TYPES.PRODUCT_VIDEO_TRANSCODE;
    assert(!(LEASE_EVENT_TYPES as readonly string[]).includes(t), 'not in batch lease types');
    assert(!leaseEventTypes(true).includes(t) && !leaseEventTypes(false).includes(t), 'not leased by batch');
    const src = readFileSync(join(__dirname, 'outbox-worker.service.ts'), 'utf8');
    assert(src.includes('case OUTBOX_EVENT_TYPES.PRODUCT_VIDEO_TRANSCODE:'), 'handle() has transcode case');
    assert(src.includes('buildLeaseSql([OUTBOX_EVENT_TYPES.PRODUCT_VIDEO_TRANSCODE])'), 'dedicated video lease');
    assert(src.includes('this.videoLane.busy'), 'single job guard before leasing');
    assert(src.includes('touchVideoLock'), 'lock refreshed during job');
  }

  console.log('video-job-lane.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
