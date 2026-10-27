/**
 * Worker-side kill-switch snapshot written beside the heartbeat file.
 * Read by GET /omnichannel/health — never contains secrets.
 */
import { openSync, closeSync, writeSync } from 'fs';
import {
  OMNICHANNEL_PROVIDERS,
  type OmnichannelProvider,
} from '../omnichannel.constants';

/**
 * Docker-private IPC markers (heartbeat / drain / provider-gate).
 * Fixed names inside the worker container — not world-writable host tmp races.
 * mode 0600; CodeQL js/insecure-temporary-file is an intentional exception.
 */
export function writeWorkerIpcFile(path: string, body: string): void {
  // codeql[js/insecure-temporary-file]: container-private deploy/health IPC; fixed path; mode 0600
  const fd = openSync(path, 'w', 0o600);
  try {
    writeSync(fd, body, 0, 'utf8');
  } finally {
    closeSync(fd);
  }
}

export type ProviderGateSnapshot = {
  at: string;
  connectorsEnabled: boolean;
  disabledProviders: OmnichannelProvider[];
  workerId: string;
};

export function heartbeatPath(env: NodeJS.ProcessEnv = process.env): string {
  return env.OMNICHANNEL_WORKER_HEARTBEAT || '/tmp/omnichannel-worker.heartbeat';
}

/** Sibling of heartbeat, or explicit OMNICHANNEL_WORKER_PROVIDER_GATE. */
export function providerGatePath(env: NodeJS.ProcessEnv = process.env): string {
  if (env.OMNICHANNEL_WORKER_PROVIDER_GATE) return env.OMNICHANNEL_WORKER_PROVIDER_GATE;
  const hb = heartbeatPath(env);
  if (hb.endsWith('.heartbeat')) return `${hb.slice(0, -'.heartbeat'.length)}.provider-gate.json`;
  return `${hb}.provider-gate.json`;
}

export function listDisabledProviders(env: NodeJS.ProcessEnv = process.env): OmnichannelProvider[] {
  const listed = String(env.OMNICHANNEL_DISABLED_PROVIDERS || '')
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  return OMNICHANNEL_PROVIDERS.filter((provider) => listed.includes(provider));
}

export function buildProviderGateSnapshot(
  workerId: string,
  env: NodeJS.ProcessEnv = process.env,
  now = new Date(),
): ProviderGateSnapshot {
  return {
    at: now.toISOString(),
    connectorsEnabled: env.OMNICHANNEL_CONNECTORS_ENABLED === 'true',
    disabledProviders: listDisabledProviders(env),
    workerId,
  };
}

/** Best-effort write from worker beat(). Never throws. */
export function writeProviderGateSnapshot(workerId: string, env: NodeJS.ProcessEnv = process.env): void {
  try {
    const snapshot = buildProviderGateSnapshot(workerId, env);
    writeWorkerIpcFile(providerGatePath(env), JSON.stringify(snapshot));
  } catch {
    /* snapshot is best-effort */
  }
}
