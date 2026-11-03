/**
 * Real ffmpeg pipeline on a generated 2s fixture: faststart, stripped metadata, WebP posters,
 * src removed. Skips (exit 0) when ffmpeg/ffprobe are not on PATH.
 * npx ts-node --transpile-only src/modules/upload/video-transcode.ffmpeg.spec.ts
 */
import { spawnSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { FfmpegRunner } from './ffmpeg-runner';
import type { VideoObjectStorePort } from './video-object-store';
import { VIDEO_SRC_BUCKET } from './video-policy';
import { VideoTranscodeService } from './video-transcode.service';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const VIDEO_ID = '33333333-3333-4333-8333-333333333333';
const PRODUCT_ID = '44444444-4444-4444-8444-444444444444';

function hasBin(bin: string) {
  const r = spawnSync(bin, ['-version'], { windowsHide: true, shell: false });
  return r.status === 0;
}

/** Top-level ISO-BMFF boxes in file order. */
export function topLevelBoxes(buf: Buffer): string[] {
  const out: string[] = [];
  let off = 0;
  while (off + 8 <= buf.length) {
    let size = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    if (size === 1) size = Number(buf.readBigUInt64BE(off + 8));
    else if (size === 0) size = buf.length - off;
    if (size < 8) break;
    out.push(type);
    off += size;
  }
  return out;
}

class DirStore implements VideoObjectStorePort {
  publicBucket = 'taranom-products';
  removed: string[] = [];
  constructor(private readonly root: string) {}
  path(bucket: string, key: string) {
    return join(this.root, bucket, ...key.split('/'));
  }
  seed(bucket: string, key: string, file: string) {
    mkdirSync(dirname(this.path(bucket, key)), { recursive: true });
    copyFileSync(file, this.path(bucket, key));
  }
  async downloadToFile(bucket: string, key: string, filePath: string) {
    copyFileSync(this.path(bucket, key), filePath);
    return statSync(filePath).size;
  }
  async putFile(bucket: string, key: string, filePath: string) {
    this.seed(bucket, key, filePath);
    return statSync(filePath).size;
  }
  async remove(bucket: string, key: string) {
    this.removed.push(`${bucket}/${key}`);
    rmSync(this.path(bucket, key), { force: true });
  }
}

/** 640x359 source: yuv420p needs even height, so outputs must come out 358 rather than fail. */
async function oddHeightCase(work: string) {
  const fixture = join(work, 'odd.mp4');
  const gen = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-nostdin',
    '-f', 'lavfi', '-i', 'testsrc=duration=1:size=640x359:rate=24',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv444p', '-y', fixture,
  ], { windowsHide: true, shell: false });
  assert(gen.status === 0, `odd fixture generation failed: ${gen.stderr}`);
  const store = new DirStore(join(work, 'odd-store'));
  const srcKey = `src/${VIDEO_ID}-odd`;
  store.seed(VIDEO_SRC_BUCKET, srcKey, fixture);
  const row: Record<string, unknown> = { id: VIDEO_ID, productId: PRODUCT_ID, status: 'queued', srcKey, deletedAt: null };
  const repo = {
    async findOne() { return { ...row }; },
    async update(_id: string, patch: Record<string, unknown>) { Object.assign(row, patch); },
  };
  const tmpRoot = join(work, 'odd-tmp');
  mkdirSync(tmpRoot);
  const res = await new VideoTranscodeService(repo as never, store, {
    runner: new FfmpegRunner(),
    tmpRoot,
    statfs: async () => ({ bavail: 10 * 1024 * 1024, bsize: 4096 }),
  } as never).process({ videoId: VIDEO_ID, productId: PRODUCT_ID });
  assert(res.status === 'ready', `odd-height source transcodes: ${JSON.stringify(res)} code=${row.errorCode}`);
  const prefix = `videos/${PRODUCT_ID}/${VIDEO_ID}`;
  for (const name of ['720.mp4', '480.mp4', '720.webm']) {
    const probe = spawnSync('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json',
      store.path('taranom-products', `${prefix}/${name}`),
    ], { windowsHide: true, shell: false, encoding: 'utf8' });
    const s = JSON.parse(probe.stdout).streams[0];
    assert(Number(s.height) === 358 && Number(s.width) % 2 === 0, `${name} even dims (${s.width}x${s.height})`);
  }
}

async function main() {
  if (!hasBin('ffmpeg') || !hasBin('ffprobe')) {
    console.log('video-transcode.ffmpeg.spec.ts: SKIP (ffmpeg/ffprobe not on PATH)');
    return;
  }
  const work = mkdtempSync(join(tmpdir(), 'vtf-spec-'));
  try {
    const fixture = join(work, 'fixture.mp4');
    const gen = spawnSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-nostdin',
      '-f', 'lavfi', '-i', 'testsrc=duration=2:size=640x360:rate=24',
      '-f', 'lavfi', '-i', 'sine=duration=2',
      '-metadata', 'title=SECRET-TITLE', '-metadata', 'comment=SECRET-GPS',
      '-metadata:s:v:0', 'handler_name=SECRET-HANDLER',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-shortest', '-y', fixture,
    ], { windowsHide: true, shell: false });
    assert(gen.status === 0, `fixture generation failed: ${gen.stderr}`);

    const store = new DirStore(join(work, 'store'));
    const srcKey = `src/${VIDEO_ID}`;
    store.seed(VIDEO_SRC_BUCKET, srcKey, fixture);
    const row: Record<string, unknown> = {
      id: VIDEO_ID, productId: PRODUCT_ID, status: 'queued', srcKey, deletedAt: null,
    };
    const repo = {
      async findOne() { return { ...row }; },
      async update(_id: string, patch: Record<string, unknown>) { Object.assign(row, patch); },
    };
    const tmpRoot = join(work, 'tmp');
    mkdirSync(tmpRoot);
    const svc = new VideoTranscodeService(repo as never, store, {
      runner: new FfmpegRunner(),
      tmpRoot,
      statfs: async () => ({ bavail: 10 * 1024 * 1024, bsize: 4096 }),
    } as never);

    const started = Date.now();
    const res = await svc.process({ videoId: VIDEO_ID, productId: PRODUCT_ID });
    assert(res.status === 'ready', `pipeline ready: ${JSON.stringify(res)} row=${JSON.stringify(row)}`);

    const prefix = `videos/${PRODUCT_ID}/${VIDEO_ID}`;
    for (const name of ['720.mp4', '480.mp4', '720.webm', 'poster-10.webp', 'poster-50.webp', 'poster-90.webp']) {
      assert(existsSync(store.path('taranom-products', `${prefix}/${name}`)), `output ${name}`);
    }

    for (const name of ['720.mp4', '480.mp4']) {
      const file = store.path('taranom-products', `${prefix}/${name}`);
      const boxes = topLevelBoxes(readFileSync(file));
      const moov = boxes.indexOf('moov');
      const mdat = boxes.indexOf('mdat');
      assert(moov >= 0 && mdat >= 0 && moov < mdat, `${name} faststart moov before mdat: ${boxes.join(',')}`);

      const probe = spawnSync('ffprobe', [
        '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file,
      ], { windowsHide: true, shell: false, encoding: 'utf8' });
      assert(probe.status === 0, 'ffprobe output');
      assert(!probe.stdout.includes('SECRET'), `${name} metadata stripped`);
      const json = JSON.parse(probe.stdout);
      const tags = Object.keys(json.format?.tags || {});
      for (const t of ['title', 'comment', 'creation_time']) assert(!tags.includes(t), `${name} no ${t} tag`);
      const v = json.streams.find((s: { codec_type: string }) => s.codec_type === 'video');
      const a = json.streams.find((s: { codec_type: string }) => s.codec_type === 'audio');
      assert(v.codec_name === 'h264' && v.profile === 'High' && v.pix_fmt === 'yuv420p', `${name} h264 high yuv420p`);
      assert(a && a.codec_name === 'aac' && Number(a.channels) === 2, `${name} aac stereo`);
      assert(Number(v.height) === 360, `${name} never upscales a 360p source (height ${v.height})`);
    }

    const webm = spawnSync('ffprobe', [
      '-v', 'error', '-print_format', 'json', '-show_streams',
      store.path('taranom-products', `${prefix}/720.webm`),
    ], { windowsHide: true, shell: false, encoding: 'utf8' });
    const wjson = JSON.parse(webm.stdout);
    assert(wjson.streams.some((s: { codec_name: string }) => s.codec_name === 'vp9'), 'webm vp9');
    assert(wjson.streams.some((s: { codec_name: string }) => s.codec_name === 'opus'), 'webm opus');

    for (const pct of [10, 50, 90]) {
      const buf = readFileSync(store.path('taranom-products', `${prefix}/poster-${pct}.webp`));
      assert(buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP', `poster-${pct} is WebP`);
    }

    assert(row.status === 'ready' && row.posterKey === `${prefix}/poster-50.webp`, 'row ready with default poster');
    assert(Number(row.bytesOut) > 0 && row.width === 640 && row.height === 360, 'bytes + dims saved');
    assert(Math.abs(Number(row.durationSec) - 2) < 0.2, `duration ~2s (${row.durationSec})`);
    assert(store.removed.includes(`${VIDEO_SRC_BUCKET}/${srcKey}`), 'src removed from private bucket');
    assert(!existsSync(store.path(VIDEO_SRC_BUCKET, srcKey)) && row.srcKey === null, 'src gone + srcKey null');
    assert(readdirSync(tmpRoot).length === 0, 'tmp workdir removed');
    await oddHeightCase(work);
    console.log(`video-transcode.ffmpeg.spec.ts: ok (${Date.now() - started}ms, bytesOut=${row.bytesOut})`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
