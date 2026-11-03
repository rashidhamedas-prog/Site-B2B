/**
 * Sandboxed ffmpeg spawn: argv, timeout → SIGKILL, bounded stderr, local paths only.
 * npx ts-node --transpile-only src/modules/upload/ffmpeg-runner.spec.ts
 */
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import type { SpawnOptions } from 'child_process';
import {
  FFMPEG_STDERR_TAIL_BYTES,
  FfmpegError,
  FfmpegRunner,
  TailBuffer,
  assertLocalMediaPath,
  parseProbeJson,
  scrubFfmpegLog,
  type SpawnFn,
} from './ffmpeg-runner';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

type Call = { bin: string; args: readonly string[]; opts: SpawnOptions; kills: string[]; child: FakeChild };

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

function fakeSpawn(behave: (child: FakeChild) => void) {
  const calls: Call[] = [];
  const spawn: SpawnFn = (bin, args, opts) => {
    const child = new FakeChild();
    calls.push({ bin, args, opts, kills: child.kills, child });
    setImmediate(() => behave(child));
    return child as never;
  };
  return { spawn, calls };
}

const abs = process.platform === 'win32' ? 'C:\\tmp\\v' : '/tmp/v';

async function main() {
  // argv sandbox + success
  {
    const { spawn, calls } = fakeSpawn((c) => c.emit('close', 0));
    const runner = new FfmpegRunner({ spawn, threads: 2 });
    await runner.transcode(`${abs}/src`, ['-c:v', 'libx264'], `${abs}/out.mp4`);
    const call = calls[0];
    assert(call.bin === 'ffmpeg', 'ffmpeg binary');
    assert(call.opts.shell === false, 'never spawn through a shell');
    assert(call.opts.windowsHide === true, 'windowsHide');
    const a = call.args.join(' ');
    assert(a.startsWith('-nostdin -hide_banner'), `stdin disabled first: ${a}`);
    assert(a.includes('-protocol_whitelist file'), 'file protocol only');
    assert(call.args.filter((x) => x === '-threads').length === 2, 'threads bound for decode + encode');
    assert(a.includes('-threads 2'), 'FFMPEG_THREADS');
    assert(call.args[call.args.length - 1] === `${abs}/out.mp4`, 'output last');
    assert(Array.isArray((call.opts.stdio as unknown[])) && (call.opts.stdio as unknown[])[0] === 'ignore', 'stdin ignored');
  }

  // timeout → SIGKILL + TIMEOUT kind
  {
    const { spawn, calls } = fakeSpawn((c) => c.stderr.write('frame=1 http://user:pw@host/x\n'));
    const runner = new FfmpegRunner({ spawn });
    let err: unknown;
    try {
      await runner.transcode(`${abs}/src`, [], `${abs}/out.mp4`, { timeoutMs: 30 });
    } catch (e) {
      err = e;
    }
    assert(err instanceof FfmpegError && err.kind === 'TIMEOUT', 'timeout surfaces as TIMEOUT');
    assert(calls[0].kills.includes('SIGKILL'), 'timeout kills with SIGKILL');
    assert(!(err as FfmpegError).stderrTail.includes('user:pw'), 'stderr tail scrubs URLs/credentials');
  }

  // abort signal → SIGKILL + ABORTED
  {
    const { spawn, calls } = fakeSpawn(() => undefined);
    const runner = new FfmpegRunner({ spawn });
    const ac = new AbortController();
    const p = runner.transcode(`${abs}/src`, [], `${abs}/out.mp4`, { signal: ac.signal, timeoutMs: 5000 });
    setTimeout(() => ac.abort(), 10);
    let err: unknown;
    try {
      await p;
    } catch (e) {
      err = e;
    }
    assert(err instanceof FfmpegError && err.kind === 'ABORTED', 'abort surfaces as ABORTED');
    assert(calls[0].kills.includes('SIGKILL'), 'abort kills with SIGKILL');
  }

  // non-zero exit → FAILED
  {
    const { spawn } = fakeSpawn((c) => {
      c.stderr.write('Invalid data found\n');
      c.emit('close', 1);
    });
    let err: unknown;
    try {
      await new FfmpegRunner({ spawn }).transcode(`${abs}/src`, [], `${abs}/o.mp4`);
    } catch (e) {
      err = e;
    }
    assert(err instanceof FfmpegError && err.kind === 'FAILED' && err.exitCode === 1, 'exit code → FAILED');
  }

  // ffprobe flags + parse
  {
    const json = JSON.stringify({
      streams: [{ codec_type: 'video', width: 640, height: 360 }, { codec_type: 'audio' }],
      format: { duration: '2.000000' },
    });
    const { spawn, calls } = fakeSpawn((c) => {
      c.stdout.end(json);
      setImmediate(() => c.emit('close', 0));
    });
    const probe = await new FfmpegRunner({ spawn }).probe(`${abs}/src`);
    assert(calls[0].bin === 'ffprobe', 'ffprobe binary');
    const a = calls[0].args.join(' ');
    assert(a.includes('-print_format json') && a.includes('-show_streams') && a.includes('-show_format'), 'probe flags');
    assert(probe.durationSec === 2 && probe.width === 640 && probe.hasVideo && probe.hasAudio, 'probe parsed');
  }

  // local paths only
  for (const bad of ['http://x/y.mp4', 'concat:a|b', '-', 'relative/file.mp4', 'pipe:0']) {
    let threw = false;
    try {
      assertLocalMediaPath(bad);
    } catch {
      threw = true;
    }
    assert(threw, `reject non-local path ${bad}`);
  }
  assertLocalMediaPath(`${abs}/ok.mp4`);

  // bounded stderr
  {
    const tail = new TailBuffer();
    for (let i = 0; i < 100; i++) tail.push(Buffer.alloc(1024, 'a'));
    assert(tail.toString().length <= FFMPEG_STDERR_TAIL_BYTES, 'stderr tail capped at 16KB');
  }
  assert(scrubFfmpegLog('secret_key=abc s3://b/k').indexOf('abc') === -1, 'scrub secrets');
  assert(!parseProbeJson('{"streams":[{"codec_type":"audio"}]}').hasVideo, 'audio-only has no video');

  console.log('ffmpeg-runner.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
