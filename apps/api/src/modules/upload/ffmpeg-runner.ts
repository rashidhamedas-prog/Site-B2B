import { spawn as nodeSpawn, type ChildProcess, type SpawnOptions } from 'child_process';
import { isAbsolute } from 'path';
import { FFMPEG_THREADS, FFMPEG_TIMEOUT_MS } from './video-policy';

export const FFPROBE_TIMEOUT_MS = 30_000;
export const FFMPEG_STDERR_TAIL_BYTES = 16 * 1024;
const FFPROBE_STDOUT_MAX_BYTES = 1024 * 1024;

export type FfmpegFailureKind = 'TIMEOUT' | 'FAILED' | 'ABORTED';

export class FfmpegError extends Error {
  constructor(
    readonly kind: FfmpegFailureKind,
    message: string,
    readonly exitCode: number | null = null,
    readonly stderrTail = '',
  ) {
    super(message);
    this.name = 'FfmpegError';
  }
}

export type SpawnFn = (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess;

export interface FfmpegRunnerOptions {
  spawn?: SpawnFn;
  ffmpegBin?: string;
  ffprobeBin?: string;
  threads?: number;
}

export interface RunOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ProbeResult {
  durationSec: number;
  width: number | null;
  height: number | null;
  hasVideo: boolean;
  hasAudio: boolean;
}

/** Never let a URL or credential-shaped token reach logs or the DB. */
export function scrubFfmpegLog(text: string): string {
  return text
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '[url]')
    .replace(/(access[_-]?key|secret[_-]?key|password|token)=\S+/gi, '$1=[redacted]');
}

/** Bounded ring of the last `cap` bytes written to a stream. */
export class TailBuffer {
  private chunks: Buffer[] = [];
  private size = 0;

  constructor(private readonly cap = FFMPEG_STDERR_TAIL_BYTES) {}

  push(chunk: Buffer | string): void {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    this.chunks.push(buf);
    this.size += buf.length;
    while (this.size > this.cap && this.chunks.length) {
      const over = this.size - this.cap;
      const head = this.chunks[0];
      if (head.length <= over) {
        this.chunks.shift();
        this.size -= head.length;
      } else {
        this.chunks[0] = head.subarray(over);
        this.size -= over;
      }
    }
  }

  toString(): string {
    return scrubFfmpegLog(Buffer.concat(this.chunks).toString('utf8'));
  }
}

/** Inputs/outputs must be plain local files: no protocol prefixes, no pipes, no stdin. */
export function assertLocalMediaPath(path: string): string {
  if (!path || !isAbsolute(path) || /^[a-z][a-z0-9+.-]+:/i.test(path.replace(/^[a-z]:[\\/]/i, ''))) {
    throw new FfmpegError('FAILED', 'media path must be an absolute local file path');
  }
  if (path === '-' || path.includes('\0')) {
    throw new FfmpegError('FAILED', 'media path must be an absolute local file path');
  }
  return path;
}

/**
 * Sandboxed ffmpeg/ffprobe execution: argv array only (no shell), no stdin,
 * file protocol only, bounded stderr, SIGKILL on timeout or abort.
 */
export class FfmpegRunner {
  private readonly spawnFn: SpawnFn;
  readonly ffmpegBin: string;
  readonly ffprobeBin: string;
  readonly threads: number;

  constructor(opts: FfmpegRunnerOptions = {}) {
    this.spawnFn = opts.spawn ?? (nodeSpawn as SpawnFn);
    this.ffmpegBin = opts.ffmpegBin ?? 'ffmpeg';
    this.ffprobeBin = opts.ffprobeBin ?? 'ffprobe';
    this.threads = opts.threads ?? FFMPEG_THREADS;
  }

  /**
   * Run one ffmpeg job. `input` is read as the only input; `outputArgs` are the
   * codec/filter flags; `output` is the destination file (overwritten).
   */
  async transcode(
    input: string,
    outputArgs: readonly string[],
    output: string,
    opts: RunOptions & { inputArgs?: readonly string[] } = {},
  ): Promise<void> {
    const threads = String(this.threads);
    const args = [
      '-nostdin',
      '-hide_banner',
      '-loglevel', 'error',
      '-protocol_whitelist', 'file',
      '-threads', threads,
      ...(opts.inputArgs ?? []),
      '-i', assertLocalMediaPath(input),
      ...outputArgs,
      '-threads', threads,
      '-y', assertLocalMediaPath(output),
    ];
    await this.exec(this.ffmpegBin, args, opts.timeoutMs ?? FFMPEG_TIMEOUT_MS, opts.signal, 0);
  }

  async probe(input: string, opts: RunOptions = {}): Promise<ProbeResult> {
    const args = [
      '-hide_banner',
      '-v', 'error',
      '-protocol_whitelist', 'file',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      assertLocalMediaPath(input),
    ];
    const stdout = await this.exec(
      this.ffprobeBin,
      args,
      opts.timeoutMs ?? FFPROBE_TIMEOUT_MS,
      opts.signal,
      FFPROBE_STDOUT_MAX_BYTES,
    );
    return parseProbeJson(stdout);
  }

  private exec(
    bin: string,
    args: string[],
    timeoutMs: number,
    signal: AbortSignal | undefined,
    stdoutMaxBytes: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new FfmpegError('ABORTED', `${bin} aborted before start`));
        return;
      }
      let child: ChildProcess;
      try {
        child = this.spawnFn(bin, args, {
          shell: false,
          windowsHide: true,
          stdio: ['ignore', stdoutMaxBytes > 0 ? 'pipe' : 'ignore', 'pipe'],
        });
      } catch (err) {
        reject(new FfmpegError('FAILED', `${bin} spawn failed: ${err instanceof Error ? err.message : String(err)}`));
        return;
      }
      const stderr = new TailBuffer();
      const stdout: Buffer[] = [];
      let stdoutBytes = 0;
      let killedFor: FfmpegFailureKind | null = null;
      let settled = false;

      const kill = (why: FfmpegFailureKind) => {
        if (killedFor) return;
        killedFor = why;
        try {
          child.kill('SIGKILL');
        } catch {
          /* already gone */
        }
      };
      const timer = setTimeout(() => kill('TIMEOUT'), timeoutMs);
      const onAbort = () => kill('ABORTED');
      signal?.addEventListener('abort', onAbort, { once: true });

      child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk));
      child.stdout?.on('data', (chunk: Buffer) => {
        stdoutBytes += chunk.length;
        if (stdoutBytes > stdoutMaxBytes) {
          kill('FAILED');
          return;
        }
        stdout.push(chunk);
      });

      const finish = (err: FfmpegError | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        if (err) reject(err);
        else resolve(Buffer.concat(stdout).toString('utf8'));
      };

      child.once('error', (err) => {
        finish(new FfmpegError('FAILED', `${bin} failed to start: ${err.message}`, null, stderr.toString()));
      });
      child.once('close', (code) => {
        if (killedFor === 'TIMEOUT') {
          finish(new FfmpegError('TIMEOUT', `${bin} timed out after ${timeoutMs}ms`, code, stderr.toString()));
        } else if (killedFor === 'ABORTED') {
          finish(new FfmpegError('ABORTED', `${bin} aborted`, code, stderr.toString()));
        } else if (killedFor === 'FAILED') {
          finish(new FfmpegError('FAILED', `${bin} output exceeded limit`, code, stderr.toString()));
        } else if (code !== 0) {
          finish(new FfmpegError('FAILED', `${bin} exited with code ${code}`, code, stderr.toString()));
        } else {
          finish(null);
        }
      });
    });
  }
}

export function parseProbeJson(raw: string): ProbeResult {
  let json: {
    streams?: Array<{ codec_type?: string; width?: number; height?: number; duration?: string }>;
    format?: { duration?: string };
  };
  try {
    json = JSON.parse(raw || '{}');
  } catch {
    throw new FfmpegError('FAILED', 'ffprobe returned invalid JSON');
  }
  const streams = Array.isArray(json.streams) ? json.streams : [];
  const video = streams.find((s) => s.codec_type === 'video');
  const hasAudio = streams.some((s) => s.codec_type === 'audio');
  const durations = [json.format?.duration, video?.duration]
    .map((d) => Number(d))
    .filter((d) => Number.isFinite(d) && d > 0);
  return {
    durationSec: durations.length ? durations[0] : 0,
    width: video?.width ? Number(video.width) : null,
    height: video?.height ? Number(video.height) : null,
    hasVideo: !!video,
    hasAudio,
  };
}
