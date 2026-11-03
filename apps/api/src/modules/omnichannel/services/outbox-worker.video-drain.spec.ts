/**
 * Soft drain vs. detached video transcode:
 * - drained marker is never written while the video lane is busy;
 * - a drain request aborts the in-flight transcode (SIGKILL, cleanup, row → queued,
 *   event released without burning an attempt) and writes drained after cleanup,
 *   far inside the deploy drain timeout (120s).
 * npx ts-node --transpile-only src/modules/omnichannel/services/outbox-worker.video-drain.spec.ts
 */
import { EventEmitter } from 'events';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { PassThrough } from 'stream';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const DEPLOY_DRAIN_TIMEOUT_MS = 120_000;
const VIDEO_ID = '77777777-7777-4777-8777-777777777777';
const PRODUCT_ID = '88888888-8888-4888-8888-888888888888';

class FakeChild extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  kills: string[] = [];
  kill(sig: string) {
    this.kills.push(sig);
    setImmediate(() => this.emit('close', null));
    return true;
  }
}

const settle = () => new Promise((r) => setImmediate(r));

async function main() {
  const dir = mkdtempSync(join(tmpdir(), 'ow-video-drain-'));
  const drain = join(dir, 'w.drain');
  const drained = join(dir, 'w.drained');
  process.env.OMNICHANNEL_WORKER_DRAIN = drain;
  process.env.OMNICHANNEL_WORKER_DRAINED = drained;
  process.env.OMNICHANNEL_WORKER_HEARTBEAT = join(dir, 'w.heartbeat');
  delete process.env.OMNICHANNEL_WORKER;

  const { OutboxWorkerService, VIDEO_ABORT_WAIT_MS } = await import('./outbox-worker.service');
  const { OUTBOX_EVENT_TYPES } = await import('../omnichannel.constants');
  const { FfmpegRunner } = await import('../../upload/ffmpeg-runner');
  const { VideoTranscodeService } = await import('../../upload/video-transcode.service');
  type Worker = InstanceType<typeof OutboxWorkerService>;
  const Ctor = OutboxWorkerService as unknown as new (...args: unknown[]) => Worker;
  const internals = (w: Worker) =>
    w as unknown as { videoLane: { run: Function; busy: boolean }; maybeStartVideoJob(): Promise<void> };

  try {
    // 1) Busy lane with nothing abortable: drained must never be written mid-encode.
    {
      const worker = new Ctor(...new Array(19).fill(undefined));
      const lane = internals(worker).videoLane;
      writeFileSync(drain, '1');
      let finish!: () => void;
      const job = lane.run('evt-x', () => new Promise<void>((r) => { finish = r; }), { beat: () => undefined });
      await worker.tick();
      assert(!existsSync(drained), 'drain file + busy video lane → not marked drained');
      finish();
      await job;
      await worker.tick();
      assert(existsSync(drained), 'idle → drained');
      rmSync(drain, { force: true });
      rmSync(drained, { force: true });
    }

    // 2) Drain during a real (fake-spawned) transcode: abort, requeue, then drained.
    {
      const children: Array<{ bin: string; child: FakeChild }> = [];
      const spawn = (bin: string) => {
        const child = new FakeChild();
        children.push({ bin, child });
        if (bin === 'ffprobe') {
          setImmediate(() => {
            child.stdout.end(JSON.stringify({
              streams: [{ codec_type: 'video', width: 1920, height: 1080 }],
              format: { duration: '30' },
            }));
            setImmediate(() => child.emit('close', 0));
          });
        }
        // ffmpeg: never exits on its own (long encode) until SIGKILL.
        return child as never;
      };
      const row: Record<string, unknown> = {
        id: VIDEO_ID, productId: PRODUCT_ID, status: 'queued', srcKey: `src/${VIDEO_ID}`, deletedAt: null,
      };
      const repo = {
        async findOne() { return { ...row }; },
        async update(_id: string, patch: Record<string, unknown>) { Object.assign(row, patch); },
      };
      const store = {
        publicBucket: 'taranom-products',
        removed: [] as string[],
        async downloadToFile(_b: string, _k: string, f: string) { writeFileSync(f, 'src'); return 3; },
        async putFile() { return 1; },
        async remove(b: string, k: string) { this.removed.push(`${b}/${k}`); },
      };
      const tmpRoot = join(dir, 'tmp');
      rmSync(tmpRoot, { recursive: true, force: true });
      mkdirSync(tmpRoot);
      const transcode = new VideoTranscodeService(repo as never, store as never, {
        runner: new FfmpegRunner({ spawn: spawn as never }),
        tmpRoot,
        statfs: async () => ({ bavail: 100 * 1024 * 1024, bsize: 4096 }),
      } as never);

      const outboxCalls = { done: [] as string[], released: [] as Array<[string, unknown]>, failed: [] as string[] };
      const outbox = {
        async markDone(id: string) { outboxCalls.done.push(id); },
        async releaseDeferred(id: string, at: unknown) { outboxCalls.released.push([id, at]); },
        async markFailure(r: { id: string }) { outboxCalls.failed.push(r.id); },
      };
      let videoLeases = 0;
      const event = {
        id: 'evt-video-1', eventType: OUTBOX_EVENT_TYPES.PRODUCT_VIDEO_TRANSCODE, aggregateId: VIDEO_ID,
        payload: { videoId: VIDEO_ID, productId: PRODUCT_ID }, attempts: 1, maxAttempts: 8,
      };
      const deliveries = {
        async query(sql: string) {
          if (sql.includes(OUTBOX_EVENT_TYPES.PRODUCT_VIDEO_TRANSCODE) && sql.includes('FOR UPDATE SKIP LOCKED')) {
            videoLeases += 1;
            return videoLeases === 1 ? [[event], 1] : [[], 0];
          }
          return [];
        },
      };
      const args = new Array(19).fill(undefined);
      args[0] = outbox;
      args[8] = deliveries;
      args[18] = transcode;
      const worker = new Ctor(...args);
      const w = internals(worker);

      await w.maybeStartVideoJob();
      for (let i = 0; i < 200 && !children.some((c) => c.bin === 'ffmpeg'); i++) await settle();
      const ffmpeg = children.find((c) => c.bin === 'ffmpeg');
      assert(ffmpeg && w.videoLane.busy && row.status === 'processing', 'transcode in flight');

      writeFileSync(drain, '1');
      const t0 = Date.now();
      await worker.tick();
      const elapsed = Date.now() - t0;

      assert(ffmpeg.child.kills.includes('SIGKILL'), 'drain SIGKILLs ffmpeg');
      const after = { ...row };
      assert(after.status === 'queued' && after.errorCode == null, 'product_video back to queued');
      assert(row.srcKey === `src/${VIDEO_ID}`, 'src kept for the re-run');
      assert(readdirSync(tmpRoot).length === 0, 'tmp workdir removed');
      assert(
        outboxCalls.released.length === 1 && outboxCalls.released[0][0] === 'evt-video-1',
        'event released via releaseDeferred (attempt not burned)',
      );
      assert(outboxCalls.failed.length === 0 && outboxCalls.done.length === 0, 'not failed / not done');
      assert(!w.videoLane.busy, 'lane free after abort');
      assert(existsSync(drained), 'drained written after cleanup');
      assert(VIDEO_ABORT_WAIT_MS < DEPLOY_DRAIN_TIMEOUT_MS, 'abort wait bound < deploy drain timeout');
      assert(elapsed < VIDEO_ABORT_WAIT_MS, `drained via cleanup, not the wait bound (${elapsed}ms)`);

      // No new video jobs while draining.
      await w.maybeStartVideoJob();
      await worker.tick();
      assert(videoLeases === 1, 'no video lease while draining');
      console.log(`outbox-worker.video-drain.spec.ts: ok (abort→drained ${elapsed}ms)`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
