/**
 * Soft-drain helpers for the omnichannel outbox worker.
 * File drain (deploy) is cancelable when the drain flag disappears.
 * Shutdown drain (SIGTERM / onModuleDestroy) never resumes.
 */

export type DrainOrigin = 'none' | 'file' | 'shutdown';

export type ResumeDrainInput = {
  stopping: boolean;
  origin: DrainOrigin;
  drainFilePresent: boolean;
};

export type ResumeDrainResult = {
  resume: boolean;
  nextOrigin: DrainOrigin;
  /** Unlink drained marker after a canceled / aborted file drain. */
  clearDrained: boolean;
};

/**
 * If a cancelable file drain is active and the drain flag is gone, resume claiming.
 * Shutdown origin never resumes.
 */
export function resumeDrainIfCleared(input: ResumeDrainInput): ResumeDrainResult {
  if (!input.stopping) {
    return { resume: false, nextOrigin: input.origin, clearDrained: false };
  }
  if (input.origin === 'shutdown') {
    return { resume: false, nextOrigin: 'shutdown', clearDrained: false };
  }
  if (input.drainFilePresent) {
    return {
      resume: false,
      nextOrigin: input.origin === 'none' ? 'file' : input.origin,
      clearDrained: false,
    };
  }
  // Drain file removed mid-flight or after drained marker — resume.
  return { resume: true, nextOrigin: 'none', clearDrained: true };
}

export type DecideDrainTickInput = {
  stopping: boolean;
  origin: DrainOrigin;
  drainFilePresent: boolean;
  running: boolean;
};

export type DecideDrainTickResult = {
  beginFileDrain: boolean;
  skipClaim: boolean;
  markDrained: boolean;
  resume: boolean;
  clearDrained: boolean;
  nextOrigin: DrainOrigin;
};

/**
 * One tick of the soft-drain state machine (before leasing work).
 * Call after reading the drain flag from disk.
 */
export function decideDrainTick(input: DecideDrainTickInput): DecideDrainTickResult {
  const resumed = resumeDrainIfCleared({
    stopping: input.stopping,
    origin: input.origin,
    drainFilePresent: input.drainFilePresent,
  });
  if (resumed.resume) {
    return {
      beginFileDrain: false,
      skipClaim: false,
      markDrained: false,
      resume: true,
      clearDrained: resumed.clearDrained,
      nextOrigin: 'none',
    };
  }

  if (input.drainFilePresent && input.origin !== 'shutdown') {
    const already = input.stopping && input.origin === 'file';
    return {
      beginFileDrain: !already,
      skipClaim: true,
      markDrained: !input.running,
      resume: false,
      clearDrained: false,
      nextOrigin: 'file',
    };
  }

  if (input.stopping) {
    return {
      beginFileDrain: false,
      skipClaim: true,
      markDrained: !input.running,
      resume: false,
      clearDrained: false,
      nextOrigin: input.origin,
    };
  }

  return {
    beginFileDrain: false,
    skipClaim: false,
    markDrained: false,
    resume: false,
    clearDrained: false,
    nextOrigin: 'none',
  };
}

/**
 * Keep the 2s poll timer during file soft-drain so cancel (flag unlink) is observed.
 * Clear the timer only for process shutdown.
 */
export function shouldKeepDrainPollTimer(origin: DrainOrigin): boolean {
  return origin !== 'shutdown';
}
