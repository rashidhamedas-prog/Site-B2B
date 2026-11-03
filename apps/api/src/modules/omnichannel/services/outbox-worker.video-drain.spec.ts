/**
 * Soft drain must not write the drained marker while a detached video transcode is in flight.
 * npx ts-node --transpile-only src/modules/omnichannel/services/outbox-worker.video-drain.spec.ts
 */
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), 'ow-video-drain-'));
  const drain = join(dir, 'w.drain');
  const drained = join(dir, 'w.drained');
  process.env.OMNICHANNEL_WORKER_DRAIN = drain;
  process.env.OMNICHANNEL_WORKER_DRAINED = drained;
  process.env.OMNICHANNEL_WORKER_HEARTBEAT = join(dir, 'w.heartbeat');
  delete process.env.OMNICHANNEL_WORKER;

  const { OutboxWorkerService } = await import('./outbox-worker.service');
  const Ctor = OutboxWorkerService as unknown as new (...args: unknown[]) => InstanceType<typeof OutboxWorkerService>;
  const worker = new Ctor(...new Array(16).fill(undefined));
  const lane = (worker as unknown as { videoLane: { run: Function; busy: boolean } }).videoLane;

  try {
    writeFileSync(drain, '1');
    let finish!: () => void;
    const job = lane.run('evt-video', () => new Promise<void>((r) => { finish = r; }), { beat: () => undefined });
    assert(lane.busy, 'video lane busy');

    await worker.tick();
    assert(!existsSync(drained), 'drain file + busy video lane → not marked drained');
    await worker.tick();
    assert(!existsSync(drained), 'still not drained on the next poll while encoding');

    finish();
    await job;
    await worker.tick();
    assert(existsSync(drained), 'idle after video job → drained');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log('outbox-worker.video-drain.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
