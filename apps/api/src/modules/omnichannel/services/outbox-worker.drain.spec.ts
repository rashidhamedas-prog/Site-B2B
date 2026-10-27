/**
 * Soft-drain cancel / resume state machine.
 * npx ts-node --transpile-only -r tsconfig-paths/register src/modules/omnichannel/services/outbox-worker.drain.spec.ts
 */
import {
  decideDrainTick,
  resumeDrainIfCleared,
  shouldKeepDrainPollTimer,
} from './outbox-worker-drain';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// --- resumeDrainIfCleared ---

{
  const idle = resumeDrainIfCleared({
    stopping: false,
    origin: 'none',
    drainFilePresent: false,
  });
  assert(idle.resume === false, 'idle does not resume');
  assert(idle.clearDrained === false, 'idle does not clear drained');
}

{
  const mid = resumeDrainIfCleared({
    stopping: true,
    origin: 'file',
    drainFilePresent: true,
  });
  assert(mid.resume === false, 'active file drain stays stopped');
  assert(mid.nextOrigin === 'file', 'origin stays file while flag present');
}

{
  const cancel = resumeDrainIfCleared({
    stopping: true,
    origin: 'file',
    drainFilePresent: false,
  });
  assert(cancel.resume === true, 'removing drain flag mid-flight resumes');
  assert(cancel.nextOrigin === 'none', 'origin clears on cancel');
  assert(cancel.clearDrained === true, 'cancel clears drained marker');
}

{
  const afterDrained = resumeDrainIfCleared({
    stopping: true,
    origin: 'file',
    drainFilePresent: false,
  });
  assert(afterDrained.resume === true, 'resume after drained when flag gone (deploy abort)');
}

{
  const shutdown = resumeDrainIfCleared({
    stopping: true,
    origin: 'shutdown',
    drainFilePresent: false,
  });
  assert(shutdown.resume === false, 'shutdown never resumes when drain file gone');
  assert(shutdown.nextOrigin === 'shutdown', 'shutdown origin sticky');
}

// --- decideDrainTick ---

{
  const start = decideDrainTick({
    stopping: false,
    origin: 'none',
    drainFilePresent: true,
    running: false,
  });
  assert(start.beginFileDrain === true, 'flag appears → begin file drain');
  assert(start.skipClaim === true, 'no claims while draining');
  assert(start.markDrained === true, 'idle under drain → mark drained');
  assert(start.nextOrigin === 'file', 'origin becomes file');
}

{
  const inflight = decideDrainTick({
    stopping: true,
    origin: 'file',
    drainFilePresent: true,
    running: true,
  });
  assert(inflight.beginFileDrain === false, 'already draining');
  assert(inflight.skipClaim === true, 'skip claim mid-flight');
  assert(inflight.markDrained === false, 'do not mark drained while running');
}

{
  const cancelMid = decideDrainTick({
    stopping: true,
    origin: 'file',
    drainFilePresent: false,
    running: true,
  });
  assert(cancelMid.resume === true, 'cancel mid-flight resumes');
  assert(cancelMid.skipClaim === false, 'claims allowed after cancel');
  assert(cancelMid.clearDrained === true, 'clear drained on cancel');
  assert(cancelMid.nextOrigin === 'none', 'origin cleared');
}

{
  const resumeIdle = decideDrainTick({
    stopping: true,
    origin: 'file',
    drainFilePresent: false,
    running: false,
  });
  assert(resumeIdle.resume === true, 'resume after drained marker when flag cleared');
  assert(resumeIdle.markDrained === false, 'do not re-mark drained on resume');
}

{
  const normal = decideDrainTick({
    stopping: false,
    origin: 'none',
    drainFilePresent: false,
    running: false,
  });
  assert(normal.skipClaim === false, 'normal tick claims');
  assert(normal.resume === false, 'nothing to resume');
}

{
  const shutdownTick = decideDrainTick({
    stopping: true,
    origin: 'shutdown',
    drainFilePresent: false,
    running: false,
  });
  assert(shutdownTick.resume === false, 'shutdown tick does not resume');
  assert(shutdownTick.skipClaim === true, 'shutdown skips claims');
  assert(shutdownTick.markDrained === true, 'shutdown idle marks drained');
}

// --- timer policy ---

assert(shouldKeepDrainPollTimer('file') === true, 'keep 2s timer during file drain (detect cancel)');
assert(shouldKeepDrainPollTimer('none') === true, 'keep timer when idle');
assert(shouldKeepDrainPollTimer('shutdown') === false, 'clear timer only on shutdown');

console.log('outbox-worker.drain.spec.ts: ok');
