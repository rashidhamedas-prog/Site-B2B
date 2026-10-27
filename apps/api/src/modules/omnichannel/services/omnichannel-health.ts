/**
 * Read-only Omnichannel health for admin (PR-1). Assembles api vs worker kill-switch,
 * heartbeat/drain, and per-provider cards. Never enables connectors or sends.
 */
import { existsSync, readFileSync } from 'fs';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { tehranDayStart } from '../../../lib/tehran-time';
import { AppSettingEntity } from '../../settings/entities/app-setting.entity';
import { redactProviderError } from '../adapters/telegram-errors';
import {
  OMNICHANNEL_PROVIDERS,
  isOmnichannelProvider,
  isOmnichannelProviderEnabled,
  type AutoPublishMode,
  type OmnichannelProvider,
} from '../omnichannel.constants';
import { resolveDestinationPublishSettings } from '../destination-publish-settings';
import { ChannelConnectionEntity } from '../entities/channel-connection.entity';
import { ChannelDestinationEntity } from '../entities/channel-destination.entity';
import { PublicationDeliveryEntity } from '../entities/publication-delivery.entity';
import {
  OMNICHANNEL_SETTINGS_KEY,
  parseStoredOmnichannelSettings,
  readDestinationVerification,
  type StoredOmnichannelSettings,
} from '../oos-policy';
import {
  heartbeatPath,
  listDisabledProviders,
  providerGatePath,
  type ProviderGateSnapshot,
} from './outbox-worker-provider-gate';

export const WORKER_HEARTBEAT_STALE_SEC = 300;
const STALLED_MS = 5 * 60 * 1000;

export type KillSwitchSide = {
  connectorsEnabled: boolean;
  disabledProviders: OmnichannelProvider[];
};

export type OmnichannelHealthWorker = {
  heartbeatAt: string | null;
  heartbeatAgeSec: number | null;
  stale: boolean;
  drain: boolean;
};

export type OmnichannelProviderHealth = {
  provider: OmnichannelProvider;
  effectiveMode: AutoPublishMode;
  modeSource: 'destination' | 'connection' | 'app_settings' | 'none';
  emergencyHold: false;
  killSwitchApi: boolean;
  killSwitchWorker: boolean | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  countsToday: { retry: number; dead: number; hold: number; stalled: number };
  cap?: { sentToday: number; dailyCap: number; nextSlotHint?: string | null };
  quiet?: { startHour: number; endHour: number } | null;
  botRights?: {
    canPost?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    checkedAt?: string;
  } | null;
};

export type OmnichannelHealthDto = {
  generatedAt: string;
  worker: OmnichannelHealthWorker;
  killSwitch: {
    api: KillSwitchSide;
    worker: KillSwitchSide | null;
    mismatch: boolean;
  };
  providers: OmnichannelProviderHealth[];
  telegramEgress?: {
    host: string | null;
    mediaUploadMode: string | null;
    pingP95Ms: null;
    pingSuccess24h: null;
    lastPingError: null;
  };
};

export type ProviderHealthInput = {
  provider: OmnichannelProvider;
  connections: Array<{
    status: string;
    publishSettings: unknown;
    channel: 'RETAIL' | 'WHOLESALE';
  }>;
  destinations: Array<{
    enabled: boolean;
    publishSettings: unknown;
    settings: Record<string, unknown> | null;
    connectionStatus: string;
    connectionPublishSettings: unknown;
    channel: 'RETAIL' | 'WHOLESALE';
  }>;
  lastSuccessAt: string | null;
  lastError: string | null;
  countsToday: { retry: number; dead: number; hold: number; stalled: number };
  sentToday: number;
};

function modeRank(mode: AutoPublishMode): number {
  if (mode === 'LIVE') return 2;
  if (mode === 'CANARY') return 1;
  return 0;
}

export function killSwitchFromEnv(env: NodeJS.ProcessEnv = process.env): KillSwitchSide {
  return {
    connectorsEnabled: env.OMNICHANNEL_CONNECTORS_ENABLED === 'true',
    disabledProviders: listDisabledProviders(env),
  };
}

/** True only when worker snapshot is present and differs from api. Missing → false (unknown, not green). */
export function computeKillSwitchMismatch(
  api: KillSwitchSide,
  worker: KillSwitchSide | null,
): boolean {
  if (!worker) return false;
  if (api.connectorsEnabled !== worker.connectorsEnabled) return true;
  const left = [...api.disabledProviders].sort().join(',');
  const right = [...worker.disabledProviders].sort().join(',');
  return left !== right;
}

export function redactHealthError(message: string | null | undefined): string | null {
  if (message == null || message === '') return null;
  return redactProviderError(String(message));
}

export function parseHeartbeatFile(
  raw: string | null,
  now = new Date(),
  staleSec = WORKER_HEARTBEAT_STALE_SEC,
): Pick<OmnichannelHealthWorker, 'heartbeatAt' | 'heartbeatAgeSec' | 'stale'> {
  if (raw == null || String(raw).trim() === '') {
    return { heartbeatAt: null, heartbeatAgeSec: null, stale: true };
  }
  const ms = Number(String(raw).trim());
  if (!Number.isFinite(ms) || ms <= 0) {
    return { heartbeatAt: null, heartbeatAgeSec: null, stale: true };
  }
  const ageSec = Math.max(0, Math.floor((now.getTime() - ms) / 1000));
  return {
    heartbeatAt: new Date(ms).toISOString(),
    heartbeatAgeSec: ageSec,
    stale: ageSec > staleSec,
  };
}

export function parseProviderGateSnapshot(raw: string | null): KillSwitchSide | null {
  if (raw == null || String(raw).trim() === '') return null;
  try {
    const parsed = JSON.parse(String(raw)) as Partial<ProviderGateSnapshot>;
    if (typeof parsed.connectorsEnabled !== 'boolean') return null;
    const disabled = Array.isArray(parsed.disabledProviders)
      ? parsed.disabledProviders
        .map((item) => String(item).trim().toUpperCase())
        .filter(isOmnichannelProvider)
      : [];
    return {
      connectorsEnabled: parsed.connectorsEnabled,
      disabledProviders: disabled,
    };
  } catch {
    return null;
  }
}

export function telegramEgressHost(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = String(env.TELEGRAM_API_URL || '').trim();
  if (!raw) return null;
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const host = new URL(withScheme).hostname;
    return host || null;
  } catch {
    return null;
  }
}

export function resolveProviderEffectiveMode(
  input: ProviderHealthInput,
  globalFallback: StoredOmnichannelSettings,
  providerEnabled: boolean,
): { effectiveMode: AutoPublishMode; modeSource: OmnichannelProviderHealth['modeSource'] } {
  let best: AutoPublishMode = 'OFF';
  let source: OmnichannelProviderHealth['modeSource'] = 'none';
  let hasActive = false;

  for (const dest of input.destinations) {
    if (dest.connectionStatus === 'ACTIVE') hasActive = true;
    const resolved = resolveDestinationPublishSettings(
      dest.publishSettings,
      dest.connectionPublishSettings,
      globalFallback,
      dest.channel,
    );
    let mode = resolved.automation.mode;
    let modeSource: OmnichannelProviderHealth['modeSource'] =
      resolved.source === 'destination'
        ? 'destination'
        : resolved.source === 'connection'
          ? 'connection'
          : 'app_settings';
    // Architect: LIVE default when ACTIVE+enabled and no local channel settings yet.
    if (
      resolved.source === 'global_fallback'
      && dest.connectionStatus === 'ACTIVE'
      && providerEnabled
    ) {
      mode = 'LIVE';
      modeSource = 'none';
    }
    if (modeRank(mode) >= modeRank(best)) {
      best = mode;
      source = modeSource;
    }
  }

  if (input.destinations.length === 0) {
    for (const conn of input.connections) {
      if (conn.status === 'ACTIVE') hasActive = true;
    }
    if (hasActive && providerEnabled) {
      return { effectiveMode: 'LIVE', modeSource: 'none' };
    }
    return { effectiveMode: 'OFF', modeSource: 'none' };
  }

  if (best === 'OFF' && hasActive && providerEnabled && source === 'none') {
    return { effectiveMode: 'LIVE', modeSource: 'none' };
  }
  return { effectiveMode: best, modeSource: source };
}

function pickBotRights(
  destinations: ProviderHealthInput['destinations'],
): OmnichannelProviderHealth['botRights'] {
  let best: OmnichannelProviderHealth['botRights'] = null;
  for (const dest of destinations) {
    if (!dest.enabled) continue;
    const verified = readDestinationVerification(dest.settings);
    if (!verified) continue;
    const candidate = {
      canPost: verified.canPost,
      canEdit: verified.canEdit,
      canDelete: verified.canDelete,
      checkedAt: verified.checkedAt,
    };
    if (!best || (candidate.checkedAt && (!best.checkedAt || candidate.checkedAt > best.checkedAt))) {
      best = candidate;
    }
  }
  return best;
}

function pickCapQuiet(
  input: ProviderHealthInput,
  globalFallback: StoredOmnichannelSettings,
): Pick<OmnichannelProviderHealth, 'cap' | 'quiet'> {
  let dailyCap = 0;
  let quiet: OmnichannelProviderHealth['quiet'] = null;
  for (const dest of input.destinations) {
    if (!dest.enabled && dest.connectionStatus !== 'ACTIVE') continue;
    const resolved = resolveDestinationPublishSettings(
      dest.publishSettings,
      dest.connectionPublishSettings,
      globalFallback,
      dest.channel,
    );
    if (resolved.automation.dailyCap > dailyCap) dailyCap = resolved.automation.dailyCap;
    if (
      resolved.automation.quietStartHour != null
      && resolved.automation.quietEndHour != null
      && !quiet
    ) {
      quiet = {
        startHour: resolved.automation.quietStartHour,
        endHour: resolved.automation.quietEndHour,
      };
    }
  }
  if (dailyCap <= 0) return { quiet };
  return {
    cap: { sentToday: input.sentToday, dailyCap, nextSlotHint: null },
    quiet,
  };
}

export function assembleProviderHealth(
  input: ProviderHealthInput,
  api: KillSwitchSide,
  worker: KillSwitchSide | null,
  globalFallback: StoredOmnichannelSettings,
): OmnichannelProviderHealth {
  const killSwitchApi = !api.connectorsEnabled || api.disabledProviders.includes(input.provider);
  const killSwitchWorker = worker == null
    ? null
    : (!worker.connectorsEnabled || worker.disabledProviders.includes(input.provider));
  const providerEnabled = !killSwitchApi;
  const { effectiveMode, modeSource } = resolveProviderEffectiveMode(
    input,
    globalFallback,
    providerEnabled,
  );
  const { cap, quiet } = pickCapQuiet(input, globalFallback);
  return {
    provider: input.provider,
    effectiveMode,
    modeSource,
    emergencyHold: false,
    killSwitchApi,
    killSwitchWorker,
    lastSuccessAt: input.lastSuccessAt,
    lastError: redactHealthError(input.lastError),
    countsToday: input.countsToday,
    ...(cap ? { cap } : {}),
    quiet: quiet ?? null,
    botRights: pickBotRights(input.destinations),
  };
}

export function assembleOmnichannelHealth(input: {
  now?: Date;
  api: KillSwitchSide;
  workerKillSwitch: KillSwitchSide | null;
  heartbeatRaw: string | null;
  drain: boolean;
  providers: ProviderHealthInput[];
  globalFallback?: StoredOmnichannelSettings;
  env?: NodeJS.ProcessEnv;
}): OmnichannelHealthDto {
  const now = input.now ?? new Date();
  const heartbeat = parseHeartbeatFile(input.heartbeatRaw, now);
  const mismatch = computeKillSwitchMismatch(input.api, input.workerKillSwitch);
  const globalFallback = input.globalFallback ?? {};
  const env = input.env ?? process.env;
  return {
    generatedAt: now.toISOString(),
    worker: {
      ...heartbeat,
      drain: input.drain,
    },
    killSwitch: {
      api: input.api,
      worker: input.workerKillSwitch,
      mismatch,
    },
    providers: OMNICHANNEL_PROVIDERS.map((provider) => {
      const facts = input.providers.find((row) => row.provider === provider) || {
        provider,
        connections: [],
        destinations: [],
        lastSuccessAt: null,
        lastError: null,
        countsToday: { retry: 0, dead: 0, hold: 0, stalled: 0 },
        sentToday: 0,
      };
      return assembleProviderHealth(facts, input.api, input.workerKillSwitch, globalFallback);
    }),
    telegramEgress: {
      host: telegramEgressHost(env),
      mediaUploadMode: env.TELEGRAM_MEDIA_UPLOAD_MODE
        ? String(env.TELEGRAM_MEDIA_UPLOAD_MODE)
        : null,
      pingP95Ms: null,
      pingSuccess24h: null,
      lastPingError: null,
    },
  };
}

function readTextFile(path: string): string | null {
  try {
    if (!existsSync(path)) return null;
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function drainFlagPresent(env: NodeJS.ProcessEnv = process.env): boolean {
  const drain = env.OMNICHANNEL_WORKER_DRAIN || '/tmp/omnichannel-worker.drain';
  const drained = env.OMNICHANNEL_WORKER_DRAINED || '/tmp/omnichannel-worker.drained';
  return existsSync(drain) || existsSync(drained);
}

@Injectable()
export class OmnichannelHealthService {
  constructor(
    @InjectRepository(ChannelConnectionEntity)
    private readonly connections: Repository<ChannelConnectionEntity>,
    @InjectRepository(ChannelDestinationEntity)
    private readonly destinations: Repository<ChannelDestinationEntity>,
    @InjectRepository(PublicationDeliveryEntity)
    private readonly deliveries: Repository<PublicationDeliveryEntity>,
    @InjectRepository(AppSettingEntity)
    private readonly appSettings: Repository<AppSettingEntity>,
  ) {}

  async getHealth(env: NodeJS.ProcessEnv = process.env): Promise<OmnichannelHealthDto> {
    const now = new Date();
    const api = killSwitchFromEnv(env);
    const workerKillSwitch = parseProviderGateSnapshot(readTextFile(providerGatePath(env)));
    const heartbeatRaw = readTextFile(heartbeatPath(env));
    const [conns, dests, globalFallback, deliveryFacts] = await Promise.all([
      this.connections.find(),
      this.destinations.find(),
      this.loadGlobal(),
      this.loadDeliveryFacts(now),
    ]);
    const connById = new Map(conns.map((row) => [row.id, row]));
    const providers: ProviderHealthInput[] = OMNICHANNEL_PROVIDERS.map((provider) => {
      const providerConns = conns.filter((row) => row.provider === provider);
      const providerDests = dests
        .map((dest) => {
          const conn = connById.get(dest.connectionId);
          if (!conn || conn.provider !== provider) return null;
          return {
            enabled: dest.enabled,
            publishSettings: dest.publishSettings,
            settings: (dest.settings || null) as Record<string, unknown> | null,
            connectionStatus: conn.status,
            connectionPublishSettings: conn.publishSettings,
            channel: (conn.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL') as 'RETAIL' | 'WHOLESALE',
          };
        })
        .filter((row): row is NonNullable<typeof row> => row != null);
      const facts = deliveryFacts[provider];
      return {
        provider,
        connections: providerConns.map((row) => ({
          status: row.status,
          publishSettings: row.publishSettings,
          channel: (row.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL') as 'RETAIL' | 'WHOLESALE',
        })),
        destinations: providerDests,
        lastSuccessAt: facts?.lastSuccessAt ?? null,
        lastError: facts?.lastError ?? null,
        countsToday: facts?.countsToday ?? { retry: 0, dead: 0, hold: 0, stalled: 0 },
        sentToday: facts?.sentToday ?? 0,
      };
    });

    return assembleOmnichannelHealth({
      now,
      api,
      workerKillSwitch,
      heartbeatRaw,
      drain: drainFlagPresent(env),
      providers,
      globalFallback,
      env,
    });
  }

  private async loadGlobal(): Promise<StoredOmnichannelSettings> {
    try {
      const row = await this.appSettings.findOne({ where: { key: OMNICHANNEL_SETTINGS_KEY } });
      return parseStoredOmnichannelSettings(row?.value);
    } catch {
      return {};
    }
  }

  private async loadDeliveryFacts(now: Date): Promise<Record<OmnichannelProvider, {
    lastSuccessAt: string | null;
    lastError: string | null;
    countsToday: { retry: number; dead: number; hold: number; stalled: number };
    sentToday: number;
  }>> {
    const empty = () => ({
      lastSuccessAt: null as string | null,
      lastError: null as string | null,
      countsToday: { retry: 0, dead: 0, hold: 0, stalled: 0 },
      sentToday: 0,
    });
    const out: Record<OmnichannelProvider, ReturnType<typeof empty>> = {
      TELEGRAM: empty(),
      BALE: empty(),
      RUBIKA: empty(),
    };
    try {
      const dayStart = tehranDayStart(now);
      const rows: Array<{
        provider: string;
        status: string;
        lastError: string | null;
        sentAt: Date | null;
        updatedAt: Date;
        createdAt: Date;
      }> = await this.deliveries
        .createQueryBuilder('d')
        .innerJoin('d.destination', 'dest')
        .innerJoin('dest.connection', 'conn')
        .select('conn.provider', 'provider')
        .addSelect('d.status', 'status')
        .addSelect('d.lastError', 'lastError')
        .addSelect('d.sentAt', 'sentAt')
        .addSelect('d.updatedAt', 'updatedAt')
        .addSelect('d.createdAt', 'createdAt')
        .orderBy('d.updatedAt', 'DESC')
        .limit(5000)
        .getRawMany();

      for (const row of rows) {
        if (!isOmnichannelProvider(row.provider)) continue;
        const bucket = out[row.provider];
        const status = String(row.status || '').toUpperCase();
        const updatedAt = row.updatedAt ? new Date(row.updatedAt) : null;
        const sentAt = row.sentAt ? new Date(row.sentAt) : null;
        const createdAt = row.createdAt ? new Date(row.createdAt) : null;
        if (status === 'SUCCEEDED' && sentAt && !bucket.lastSuccessAt) {
          bucket.lastSuccessAt = sentAt.toISOString();
        }
        if (row.lastError && !bucket.lastError && status !== 'SUCCEEDED') {
          bucket.lastError = row.lastError;
        }
        const inToday = Boolean(
          (updatedAt && updatedAt >= dayStart)
          || (createdAt && createdAt >= dayStart)
          || (sentAt && sentAt >= dayStart),
        );
        if (!inToday) continue;
        if (status === 'RETRY') bucket.countsToday.retry += 1;
        else if (status === 'DEAD') bucket.countsToday.dead += 1;
        else if (status === 'HOLD') bucket.countsToday.hold += 1;
        else if (
          status === 'PROCESSING'
          && updatedAt
          && now.getTime() - updatedAt.getTime() > STALLED_MS
        ) {
          bucket.countsToday.stalled += 1;
        }
        if (status === 'SUCCEEDED' && sentAt && sentAt >= dayStart) {
          bucket.sentToday += 1;
        }
      }
    } catch {
      /* health stays readable with zeros when deliveries table is unavailable */
    }
    return out;
  }
}

/** Exported for phase-acceptance / gates that mirror readiness. */
export function providerKillSwitchApi(
  provider: OmnichannelProvider,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return !isOmnichannelProviderEnabled(provider)
    || listDisabledProviders(env).includes(provider)
    || env.OMNICHANNEL_CONNECTORS_ENABLED !== 'true';
}
