/**
 * VideoTranscodeService control flow with fake runner/store/repo (no ffmpeg needed).
 * npx ts-node --transpile-only src/modules/upload/video-transcode.service.spec.ts
 */
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FfmpegError, FfmpegRunner, type ProbeResult, type SpawnFn } from './ffmpeg-runner';
import {
  VIDEO_DISK_LOW_MESSAGE_FA,
  VideoTranscodeAbortedError,
  VideoTranscodeService,
  mp4OutputArgs,
  posterFrameArgs,
  webmOutputArgs,
} from './video-transcode.service';
import type { VideoObjectStorePort } from './video-object-store';
import { VIDEO_MIN_FREE_DISK_BYTES, VIDEO_SRC_BUCKET } from './video-policy';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const VIDEO_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const PREFIX = `videos/${PRODUCT_ID}/${VIDEO_ID}`;

type Row = Record<string, unknown>;

function fakeRepo(row: Row | null) {
  const updates: Row[] = [];
  return {
    row,
    updates,
    async findOne() {
      return row ? { ...row } : null;
    },
    async update(_id: string, patch: Row) {
      updates.push(patch);
      if (row) Object.assign(row, patch);
    },
  };
}

function baseRow(): Row {
  return { id: VIDEO_ID, productId: PRODUCT_ID, status: 'queued', srcKey: `src/${VIDEO_ID}`, deletedAt: null };
}

class FakeStore implements VideoObjectStorePort {
  publicBucket = 'taranom-products';
  puts: Array<{ bucket: string; key: string; contentType: string }> = [];
  removed: Array<{ bucket: string; key: string }> = [];
  downloads = 0;
  async downloadToFile(_b: string, _k: string, filePath: string) {
    this.downloads += 1;
    writeFileSync(filePath, 'src');
    return 3;
  }
  async putFile(bucket: string, key: string, _f: string, contentType: string) {
    this.puts.push({ bucket, key, contentType });
    return 100;
  }
  async remove(bucket: string, key: string) {
    this.removed.push({ bucket, key });
  }
}

/** Runner double: writes the output file; optional failure on a given output name. */
class FakeRunner extends FfmpegRunner {
  transcodes: string[] = [];
  constructor(
    private readonly probeResult: ProbeResult,
    private readonly failOn?: { suffix: string; err: Error },
  ) {
    super({ spawn: (() => { throw new Error('spawn must not be called'); }) as unknown as SpawnFn });
  }
  async probe(): Promise<ProbeResult> {
    return this.probeResult;
  }
  async transcode(_input: string, _args: readonly string[], output: string): Promise<void> {
    this.transcodes.push(output);
    if (this.failOn && output.endsWith(this.failOn.suffix)) throw this.failOn.err;
    writeFileSync(output, 'x');
  }
}

const okProbe: ProbeResult = { durationSec: 10, width: 1280, height: 720, hasVideo: true, hasAudio: true };
const bigDisk = async () => ({ bavail: 100 * 1024 * 1024, bsize: 4096 });
const noopPoster = async (_png: string, webp: string) => writeFileSync(webp, 'w');

function makeTmpRoot() {
  return mkdtempSync(join(tmpdir(), 'vts-spec-'));
}

function service(repo: ReturnType<typeof fakeRepo>, store: FakeStore, deps: Record<string, unknown>) {
  return new VideoTranscodeService(repo as never, store, deps as never);
}

async function main() {
  // Exact encoder flags from the spec.
  {
    const a = mp4OutputArgs(720, 23).join(' ');
    for (const f of [
      '-map 0:v:0', '-map 0:a:0?', '-map_metadata -1', '-c:v libx264', '-preset slow', '-crf 23',
      '-profile:v high', '-pix_fmt yuv420p', "-vf scale=-2:'trunc(min(720,ih)/2)*2'", '-c:a aac', '-b:a 96k', '-ac 2',
      '-movflags +faststart',
    ]) assert(a.includes(f), `mp4 720 flag ${f}`);
    assert(mp4OutputArgs(480, 24).join(' ').includes("-crf 24") && mp4OutputArgs(480, 24).join(' ').includes("trunc(min(480,ih)/2)*2"), 'mp4 480 crf 24');
    assert(webmOutputArgs(720).join(' ').includes("-vf scale=-2:'trunc(min(720,ih)/2)*2'"), 'webm even height');
    assert(posterFrameArgs(720).join(' ').includes("-vf scale=-2:'trunc(min(720,ih)/2)*2'"), 'poster dims match streams');
    const w = webmOutputArgs(720).join(' ');
    for (const f of ['-c:v libvpx-vp9', '-crf 33', '-b:v 0', '-row-mt 1', '-deadline good', '-cpu-used 4', '-c:a libopus', '-b:a 64k']) {
      assert(w.includes(f), `webm flag ${f}`);
    }
  }

  // DISK_LOW: no tmp files, no ffmpeg spawn, no download.
  {
    const tmpRoot = makeTmpRoot();
    let spawned = 0;
    const runner = new FfmpegRunner({ spawn: (() => { spawned += 1; throw new Error('no'); }) as unknown as SpawnFn });
    const repo = fakeRepo(baseRow());
    const store = new FakeStore();
    const svc = service(repo, store, {
      runner,
      tmpRoot,
      statfs: async () => ({ bavail: Math.floor((VIDEO_MIN_FREE_DISK_BYTES - 1) / 4096), bsize: 4096 }),
    });
    const res = await svc.process({ videoId: VIDEO_ID, productId: PRODUCT_ID });
    assert(res.status === 'failed' && res.errorCode === 'DISK_LOW', 'free<5GB → DISK_LOW');
    assert(spawned === 0, 'ffmpeg never spawned on DISK_LOW');
    assert(readdirSync(tmpRoot).length === 0, 'no file written on DISK_LOW');
    assert(store.downloads === 0 && store.puts.length === 0, 'no object store traffic on DISK_LOW');
    assert(repo.row?.status === 'failed' && repo.row?.errorCode === 'DISK_LOW', 'row failed DISK_LOW');
    assert(VIDEO_DISK_LOW_MESSAGE_FA === 'فضای سرور کافی نیست.', 'Persian DISK_LOW message');
    rmSync(tmpRoot, { recursive: true, force: true });
  }

  // TOO_LONG: probe says 61s → failed, no encode, src kept, tmp cleaned.
  {
    const tmpRoot = makeTmpRoot();
    const runner = new FakeRunner({ ...okProbe, durationSec: 61 });
    const repo = fakeRepo(baseRow());
    const store = new FakeStore();
    const res = await service(repo, store, { runner, tmpRoot, statfs: bigDisk }).process({ videoId: VIDEO_ID, productId: PRODUCT_ID });
    assert(res.status === 'failed' && res.errorCode === 'TOO_LONG', 'duration > 60 → TOO_LONG');
    assert(runner.transcodes.length === 0, 'no encode when too long');
    assert(store.removed.length === 0 && repo.row?.srcKey, 'src kept for admin retry');
    assert(readdirSync(tmpRoot).length === 0, 'tmp removed after TOO_LONG');
    rmSync(tmpRoot, { recursive: true, force: true });
  }

  // NO_VIDEO_STREAM
  {
    const tmpRoot = makeTmpRoot();
    const repo = fakeRepo(baseRow());
    const res = await service(repo, new FakeStore(), {
      runner: new FakeRunner({ ...okProbe, hasVideo: false }), tmpRoot, statfs: bigDisk,
    }).process({ videoId: VIDEO_ID, productId: PRODUCT_ID });
    assert(res.status === 'failed' && res.errorCode === 'NO_VIDEO_STREAM', 'audio-only → NO_VIDEO_STREAM');
    rmSync(tmpRoot, { recursive: true, force: true });
  }

  // TIMEOUT mid-pipeline: partial keys removed, tmp cleaned, src kept.
  {
    const tmpRoot = makeTmpRoot();
    const runner = new FakeRunner(okProbe, {
      suffix: '720.webm',
      err: new FfmpegError('TIMEOUT', 'ffmpeg timed out after 600000ms'),
    });
    const repo = fakeRepo(baseRow());
    const store = new FakeStore();
    const res = await service(repo, store, { runner, tmpRoot, statfs: bigDisk, encodePoster: noopPoster })
      .process({ videoId: VIDEO_ID, productId: PRODUCT_ID });
    assert(res.status === 'failed' && res.errorCode === 'TIMEOUT', 'timeout → TIMEOUT');
    const removed = store.removed.map((r) => r.key).sort();
    assert(
      JSON.stringify(removed) === JSON.stringify([`${PREFIX}/480.mp4`, `${PREFIX}/720.mp4`]),
      `partial outputs removed: ${removed}`,
    );
    assert(store.removed.every((r) => r.bucket === 'taranom-products'), 'partials removed from public bucket only');
    assert(readdirSync(tmpRoot).length === 0, 'tmp removed after timeout');
    assert(repo.row?.srcKey === `src/${VIDEO_ID}`, 'src kept after timeout');
    assert(repo.row?.mp4720Key == null, 'no keys persisted on failure');
    rmSync(tmpRoot, { recursive: true, force: true });
  }

  // Generic encoder failure → TRANSCODE_FAILED
  {
    const tmpRoot = makeTmpRoot();
    const repo = fakeRepo(baseRow());
    const res = await service(repo, new FakeStore(), {
      runner: new FakeRunner(okProbe, { suffix: '480.mp4', err: new FfmpegError('FAILED', 'exit 1') }),
      tmpRoot, statfs: bigDisk,
    }).process({ videoId: VIDEO_ID, productId: PRODUCT_ID });
    assert(res.status === 'failed' && res.errorCode === 'TRANSCODE_FAILED', 'encoder failure → TRANSCODE_FAILED');
    rmSync(tmpRoot, { recursive: true, force: true });
  }

  // Success: layout, content types, poster default, src deleted + srcKey nulled.
  {
    const tmpRoot = makeTmpRoot();
    const repo = fakeRepo(baseRow());
    const store = new FakeStore();
    const res = await service(repo, store, {
      runner: new FakeRunner(okProbe), tmpRoot, statfs: bigDisk, encodePoster: noopPoster,
    }).process({ videoId: VIDEO_ID, productId: PRODUCT_ID });
    assert(res.status === 'ready', 'ready');
    const keys = store.puts.map((p) => `${p.key}|${p.contentType}`);
    for (const k of [
      `${PREFIX}/720.mp4|video/mp4`,
      `${PREFIX}/480.mp4|video/mp4`,
      `${PREFIX}/720.webm|video/webm`,
      `${PREFIX}/poster-10.webp|image/webp`,
      `${PREFIX}/poster-50.webp|image/webp`,
      `${PREFIX}/poster-90.webp|image/webp`,
    ]) assert(keys.includes(k), `uploaded ${k}`);
    assert(store.puts.every((p) => p.bucket === 'taranom-products'), 'outputs in public bucket');
    const row = repo.row!;
    assert(row.status === 'ready' && row.errorCode === null, 'row ready');
    assert(row.posterKey === `${PREFIX}/poster-50.webp`, 'default poster 50%');
    assert((row.posterCandidates as string[]).length === 3, '3 poster candidates');
    assert(row.bytesOut === '600', 'bytesOut sums outputs as string');
    assert(row.durationSec === 10 && row.width === 1280 && row.height === 720, 'duration/dims saved');
    assert(
      store.removed.length === 1 && store.removed[0].bucket === VIDEO_SRC_BUCKET && store.removed[0].key === `src/${VIDEO_ID}`,
      'src removed from private bucket after success',
    );
    assert(row.srcKey === null, 'srcKey nulled');
    assert(repo.updates[0].status === 'processing', 'status processing before work');
    assert(readdirSync(tmpRoot).length === 0, 'tmp removed after success');
    rmSync(tmpRoot, { recursive: true, force: true });
  }

  // Idempotent skips.
  for (const patch of [{ status: 'ready' }, { deletedAt: new Date() }]) {
    const repo = fakeRepo({ ...baseRow(), ...patch });
    const store = new FakeStore();
    const res = await service(repo, store, { runner: new FakeRunner(okProbe), statfs: bigDisk })
      .process({ videoId: VIDEO_ID, productId: PRODUCT_ID });
    assert(res.status === 'skipped' && repo.updates.length === 0 && store.downloads === 0, `skip ${JSON.stringify(patch)}`);
  }

  // Abort (worker shutdown): cleanup, row back to queued, typed error for re-queue.
  {
    const tmpRoot = makeTmpRoot();
    const repo = fakeRepo(baseRow());
    const store = new FakeStore();
    let err: unknown;
    try {
      await service(repo, store, {
        runner: new FakeRunner(okProbe, { suffix: '480.mp4', err: new FfmpegError('ABORTED', 'aborted') }),
        tmpRoot, statfs: bigDisk,
      }).process({ videoId: VIDEO_ID, productId: PRODUCT_ID });
    } catch (e) {
      err = e;
    }
    assert(err instanceof VideoTranscodeAbortedError, 'abort rethrown as VideoTranscodeAbortedError');
    assert(repo.row?.status === 'queued' && repo.row?.errorCode == null, 'aborted job returns to queued');
    assert(store.removed.some((r) => r.key === `${PREFIX}/720.mp4`), 'abort removes partial outputs');
    assert(readdirSync(tmpRoot).length === 0, 'tmp removed after abort');
    rmSync(tmpRoot, { recursive: true, force: true });
  }

  console.log('video-transcode.service.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
