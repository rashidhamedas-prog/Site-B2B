import { promises as fsp } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ProductVideoEntity } from '../product/entities/product-video.entity';
import { FfmpegError, FfmpegRunner, type ProbeResult } from './ffmpeg-runner';
import { MAX_INPUT_PIXELS, type SharpFactory, withSharpSlot } from './image-processor';
import { VideoObjectStore, type VideoObjectStorePort } from './video-object-store';
import {
  VIDEO_MAX_BYTES,
  VIDEO_MAX_SEC,
  VIDEO_MIN_FREE_DISK_BYTES,
  VIDEO_SRC_BUCKET,
  VIDEO_WEBM,
  type ProductVideoErrorCode,
  type ProductVideoTranscodePayload,
} from './video-policy';

export const VIDEO_DISK_LOW_MESSAGE_FA = 'فضای سرور کافی نیست.';

export const VIDEO_POSTER_QUALITY = 80;
export const VIDEO_POSTER_POINTS = [10, 50, 90] as const;
export const VIDEO_DEFAULT_POSTER_POINT = 50;

/** yuv420p (libx264/libvpx) needs even dimensions; an odd source height under the cap would fail. */
export function evenScaleFilter(height: number): string {
  return `scale=-2:'trunc(min(${height},ih)/2)*2'`;
}

/** Encoder flags from the phase-02 spec. */
export function mp4OutputArgs(height: number, crf: number): string[] {
  return [
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-map_metadata', '-1',
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', String(crf),
    '-profile:v', 'high',
    '-pix_fmt', 'yuv420p',
    '-vf', evenScaleFilter(height),
    '-c:a', 'aac',
    '-b:a', '96k',
    '-ac', '2',
    '-movflags', '+faststart',
  ];
}

export function webmOutputArgs(height: number): string[] {
  return [
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-map_metadata', '-1',
    '-c:v', 'libvpx-vp9',
    '-crf', '33',
    '-b:v', '0',
    '-row-mt', '1',
    '-deadline', 'good',
    '-cpu-used', '4',
    '-pix_fmt', 'yuv420p',
    '-vf', evenScaleFilter(height),
    '-c:a', 'libopus',
    '-b:a', '64k',
    '-ac', '2',
  ];
}

export function posterFrameArgs(height: number): string[] {
  return [
    '-map', '0:v:0',
    '-map_metadata', '-1',
    '-frames:v', '1',
    '-vf', `scale=-2:'min(${height},ih)'`,
    '-f', 'image2',
    '-c:v', 'png',
  ];
}

export function videoOutputPrefix(productId: string, videoId: string): string {
  return `videos/${productId}/${videoId}`;
}

export type VideoTranscodeResult =
  | { status: 'ready'; bytesOut: number }
  | { status: 'failed'; errorCode: ProductVideoErrorCode }
  | { status: 'skipped'; reason: string };

/** Thrown when the worker aborts the job (shutdown). Event must be re-queued, not failed. */
export class VideoTranscodeAbortedError extends Error {
  constructor() {
    super('video transcode aborted');
    this.name = 'VideoTranscodeAbortedError';
  }
}

class VideoJobFailure extends Error {
  constructor(readonly code: ProductVideoErrorCode, message: string) {
    super(message);
  }
}

export interface VideoTranscodeDeps {
  runner?: FfmpegRunner;
  statfs?: (path: string) => Promise<{ bavail: number | bigint; bsize: number | bigint }>;
  tmpRoot?: string;
  /** WebP encoder; defaults to sharp q80. */
  encodePoster?: (pngPath: string, webpPath: string) => Promise<void>;
}

export const VIDEO_TRANSCODE_DEPS = Symbol('VIDEO_TRANSCODE_DEPS');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function sharpPoster(pngPath: string, webpPath: string): Promise<void> {
  await withSharpSlot(async () => {
    const sharp = require('sharp') as SharpFactory;
    await sharp(pngPath, { limitInputPixels: MAX_INPUT_PIXELS })
      .timeout({ seconds: 20 })
      .webp({ quality: VIDEO_POSTER_QUALITY })
      .toFile(webpPath);
  });
}

@Injectable()
export class VideoTranscodeService {
  private readonly logger = new Logger(VideoTranscodeService.name);
  private readonly runner: FfmpegRunner;
  private readonly statfs: NonNullable<VideoTranscodeDeps['statfs']>;
  private readonly tmpRoot: string;
  private readonly encodePoster: NonNullable<VideoTranscodeDeps['encodePoster']>;

  constructor(
    @InjectRepository(ProductVideoEntity)
    private readonly videos: Repository<ProductVideoEntity>,
    @Inject(VideoObjectStore)
    private readonly store: VideoObjectStorePort,
    @Optional() @Inject(VIDEO_TRANSCODE_DEPS) deps?: VideoTranscodeDeps,
  ) {
    this.runner = deps?.runner ?? new FfmpegRunner();
    this.statfs = deps?.statfs ?? ((p) => fsp.statfs(p));
    this.tmpRoot = deps?.tmpRoot ?? tmpdir();
    this.encodePoster = deps?.encodePoster ?? sharpPoster;
  }

  async freeTmpBytes(): Promise<number> {
    const s = await this.statfs(this.tmpRoot);
    return Number(s.bavail) * Number(s.bsize);
  }

  async process(
    payload: ProductVideoTranscodePayload,
    opts: { signal?: AbortSignal } = {},
  ): Promise<VideoTranscodeResult> {
    const videoId = String(payload?.videoId || '');
    if (!UUID_RE.test(videoId)) return { status: 'skipped', reason: 'invalid videoId' };
    const row = await this.videos.findOne({ where: { id: videoId }, withDeleted: true });
    if (!row) return { status: 'skipped', reason: 'video not found' };
    if (row.deletedAt) return { status: 'skipped', reason: 'video deleted' };
    if (row.status === 'ready') return { status: 'skipped', reason: 'already ready' };
    const productId = String(row.productId || '');
    if (!UUID_RE.test(productId) || (payload.productId && payload.productId !== productId)) {
      return { status: 'skipped', reason: 'product mismatch' };
    }
    if (!row.srcKey) return this.fail(videoId, 'TRANSCODE_FAILED', 'source key missing');

    let free: number;
    try {
      free = await this.freeTmpBytes();
    } catch (err) {
      return this.fail(videoId, 'DISK_LOW', `statfs failed: ${errText(err)}`);
    }
    if (free < VIDEO_MIN_FREE_DISK_BYTES) {
      return this.fail(videoId, 'DISK_LOW', `${VIDEO_DISK_LOW_MESSAGE_FA} free=${free}`);
    }

    const signal = opts.signal;
    const uploaded: string[] = [];
    let workDir: string | null = null;
    try {
      workDir = await fsp.mkdtemp(join(this.tmpRoot, 'taranom-video-'));
      await this.videos.update(videoId, { status: 'processing', errorCode: null });

      const srcPath = join(workDir, 'src');
      try {
        await this.store.downloadToFile(VIDEO_SRC_BUCKET, row.srcKey, srcPath, VIDEO_MAX_BYTES);
      } catch (err) {
        throw new VideoJobFailure('TRANSCODE_FAILED', `source download failed: ${errText(err)}`);
      }
      this.checkAborted(signal);

      let probe: ProbeResult;
      try {
        probe = await this.runner.probe(srcPath, { signal });
      } catch (err) {
        if (err instanceof FfmpegError && err.kind === 'ABORTED') throw err;
        throw new VideoJobFailure('PROBE_FAILED', `probe failed: ${errText(err)}`);
      }
      if (!probe.hasVideo) throw new VideoJobFailure('NO_VIDEO_STREAM', 'no video stream');
      if (!(probe.durationSec > 0)) throw new VideoJobFailure('PROBE_FAILED', 'duration unknown');
      if (probe.durationSec > VIDEO_MAX_SEC) {
        throw new VideoJobFailure('TOO_LONG', `duration ${probe.durationSec}s > ${VIDEO_MAX_SEC}s`);
      }

      const prefix = videoOutputPrefix(productId, videoId);
      const bucket = this.store.publicBucket;
      let bytesOut = 0;
      const put = async (file: string, key: string, contentType: string) => {
        this.checkAborted(signal);
        uploaded.push(key);
        bytesOut += await this.store.putFile(bucket, key, file, contentType);
      };

      const mp4720 = join(workDir, '720.mp4');
      await this.runner.transcode(srcPath, mp4OutputArgs(720, 23), mp4720, { signal });
      await put(mp4720, `${prefix}/720.mp4`, 'video/mp4');

      const mp4480 = join(workDir, '480.mp4');
      await this.runner.transcode(srcPath, mp4OutputArgs(480, 24), mp4480, { signal });
      await put(mp4480, `${prefix}/480.mp4`, 'video/mp4');

      let webmKey: string | null = null;
      if (VIDEO_WEBM) {
        const webm = join(workDir, '720.webm');
        await this.runner.transcode(srcPath, webmOutputArgs(720), webm, { signal });
        webmKey = `${prefix}/720.webm`;
        await put(webm, webmKey, 'video/webm');
      }

      const posterKeys: string[] = [];
      for (const pct of VIDEO_POSTER_POINTS) {
        const at = ((probe.durationSec * pct) / 100).toFixed(3);
        const png = join(workDir, `poster-${pct}.png`);
        const webp = join(workDir, `poster-${pct}.webp`);
        await this.runner.transcode(srcPath, posterFrameArgs(720), png, { signal, inputArgs: ['-ss', at] });
        await this.encodePoster(png, webp);
        const key = `${prefix}/poster-${pct}.webp`;
        await put(webp, key, 'image/webp');
        posterKeys.push(key);
      }

      let outW = probe.width;
      let outH = probe.height;
      try {
        const out = await this.runner.probe(mp4720, { signal });
        outW = out.width ?? outW;
        outH = out.height ?? outH;
      } catch {
        /* dimensions are advisory; source dims are the fallback */
      }

      this.checkAborted(signal);
      await this.videos.update(videoId, {
        status: 'ready',
        errorCode: null,
        mp4720Key: `${prefix}/720.mp4`,
        mp4480Key: `${prefix}/480.mp4`,
        webm720Key: webmKey,
        posterCandidates: posterKeys,
        posterKey: `${prefix}/poster-${VIDEO_DEFAULT_POSTER_POINT}.webp`,
        durationSec: Math.round(probe.durationSec * 100) / 100,
        width: outW,
        height: outH,
        bytesOut: String(bytesOut),
      });
      uploaded.length = 0;

      try {
        await this.store.remove(VIDEO_SRC_BUCKET, row.srcKey);
        await this.videos.update(videoId, { srcKey: null });
      } catch (err) {
        this.logger.warn(`video ${videoId} ready; source cleanup deferred: ${errText(err)}`);
      }
      return { status: 'ready', bytesOut };
    } catch (err) {
      await this.removeKeys(uploaded);
      if (isAbort(err)) {
        await this.videos.update(videoId, { status: 'queued' }).catch(() => undefined);
        throw new VideoTranscodeAbortedError();
      }
      const code: ProductVideoErrorCode =
        err instanceof VideoJobFailure
          ? err.code
          : err instanceof FfmpegError && err.kind === 'TIMEOUT'
            ? 'TIMEOUT'
            : 'TRANSCODE_FAILED';
      const detail = err instanceof FfmpegError && err.stderrTail ? ` | ${err.stderrTail.slice(-500)}` : '';
      return this.fail(videoId, code, `${errText(err)}${detail}`);
    } finally {
      if (workDir) await fsp.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private checkAborted(signal?: AbortSignal) {
    if (signal?.aborted) throw new FfmpegError('ABORTED', 'aborted');
  }

  private async removeKeys(keys: string[]) {
    for (const key of keys) {
      try {
        await this.store.remove(this.store.publicBucket, key);
      } catch (err) {
        this.logger.warn(`partial video output not removed key=${key}: ${errText(err)}`);
      }
    }
  }

  private async fail(
    videoId: string,
    code: ProductVideoErrorCode,
    detail: string,
  ): Promise<VideoTranscodeResult> {
    this.logger.warn(`video ${videoId} failed ${code}: ${detail.slice(0, 800)}`);
    await this.videos.update(videoId, { status: 'failed', errorCode: code });
    return { status: 'failed', errorCode: code };
  }
}

function isAbort(err: unknown): boolean {
  return (err instanceof FfmpegError && err.kind === 'ABORTED') || err instanceof VideoTranscodeAbortedError;
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
