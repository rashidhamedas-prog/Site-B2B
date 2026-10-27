'use client';

/**
 * PR-1 read-only health strip: provider cards + api/worker kill-switch mismatch banner.
 * Never greens on error/unknown. No HOLD/LIVE writes, no canary send.
 */
import { Badge, Callout, PROVIDER_META, faNumber, type Provider } from './admin-omnichannel-ui';

export const HEALTH_MISMATCH_BANNER_FA =
  'ناهمخوانی kill-switch بین API و ورکر: تست موفق ولی ارسال واقعی ممکن است DEAD شود.';

export type OmnichannelHealthPayload = {
  generatedAt: string;
  worker: {
    heartbeatAt: string | null;
    heartbeatAgeSec: number | null;
    stale: boolean;
    drain: boolean;
  };
  killSwitch: {
    api: { connectorsEnabled: boolean; disabledProviders: Provider[] };
    worker: { connectorsEnabled: boolean; disabledProviders: Provider[] } | null;
    mismatch: boolean;
  };
  providers: Array<{
    provider: Provider;
    effectiveMode: 'OFF' | 'CANARY' | 'LIVE';
    modeSource: 'destination' | 'connection' | 'app_settings' | 'none';
    emergencyHold: boolean;
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
  }>;
  telegramEgress?: {
    host: string | null;
    mediaUploadMode: string | null;
    pingP95Ms: null;
    pingSuccess24h: null;
    lastPingError: null;
  };
};

export type HealthTone = 'ok' | 'warn' | 'danger' | 'off' | 'unknown';

/** Card tone: never 'ok' when health is missing, loading failed, or provider unknown. */
export function providerHealthCardTone(
  provider: OmnichannelHealthPayload['providers'][number] | null | undefined,
  opts: { healthUnknown?: boolean; workerStale?: boolean } = {},
): HealthTone {
  if (opts.healthUnknown || !provider) return 'unknown';
  if (provider.killSwitchApi || provider.killSwitchWorker === true) return 'danger';
  if (provider.killSwitchWorker === null) return 'unknown';
  if (opts.workerStale) return 'warn';
  if (provider.countsToday.dead > 0 || provider.countsToday.stalled > 0) return 'warn';
  if (provider.effectiveMode === 'OFF') return 'off';
  if (provider.effectiveMode === 'CANARY') return 'warn';
  return 'ok';
}

export function healthStripTone(input: {
  health: OmnichannelHealthPayload | null;
  loading?: boolean;
  error?: boolean;
}): HealthTone {
  if (input.loading) return 'unknown';
  if (input.error || !input.health) return 'unknown';
  if (input.health.killSwitch.mismatch) return 'danger';
  if (input.health.worker.stale) return 'warn';
  return 'ok';
}

const TONE_CLASS: Record<HealthTone, string> = {
  ok: 'border-emerald-200 bg-emerald-50/60',
  warn: 'border-amber-200 bg-amber-50/70',
  danger: 'border-red-200 bg-red-50/70',
  off: 'border-gray-200 bg-gray-50',
  unknown: 'border-gray-300 bg-gray-100',
};

function modeLabel(mode: string): string {
  if (mode === 'LIVE') return 'LIVE';
  if (mode === 'CANARY') return 'CANARY';
  return 'OFF';
}

function relativeShort(iso: string | null): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${faNumber(sec)}ث پیش`;
  if (sec < 3600) return `${faNumber(Math.floor(sec / 60))}د پیش`;
  if (sec < 86400) return `${faNumber(Math.floor(sec / 3600))}س پیش`;
  return `${faNumber(Math.floor(sec / 86400))}ر پیش`;
}

export function AdminOmnichannelHealth({
  health,
  loading = false,
  error = false,
}: {
  health: OmnichannelHealthPayload | null;
  loading?: boolean;
  error?: boolean;
}) {
  const stripTone = healthStripTone({ health, loading, error });
  const unknown = Boolean(error || (!loading && !health));

  return (
    <section className="space-y-3" aria-label="سلامت کانال‌های انتشار" data-omni-health-strip data-tone={stripTone}>
      {(error || (!loading && !health)) && (
        <Callout tone="warn">وضعیت نامعلوم — پاسخ سلامت دریافت نشد. هرگز وضعیت سبز فرض نشود.</Callout>
      )}
      {health?.killSwitch.mismatch && (
        <Callout tone="danger">
          <span data-omni-health-mismatch>{HEALTH_MISMATCH_BANNER_FA}</span>
        </Callout>
      )}
      {health?.worker.stale && !unknown && (
        <Callout tone="warn">
          heartbeat ورکر قدیمی است
          {health.worker.heartbeatAgeSec != null ? ` (${faNumber(health.worker.heartbeatAgeSec)}ث)` : ''}
          {health.worker.drain ? ' · drain فعال' : ''}.
        </Callout>
      )}
      {loading && !health && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" aria-busy="true">
          {(['TELEGRAM', 'BALE', 'RUBIKA'] as Provider[]).map((provider) => (
            <div key={provider} className={`rounded-xl border p-3 animate-pulse ${TONE_CLASS.unknown}`}>
              <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-28 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      )}
      {health && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {health.providers.map((row) => {
            const meta = PROVIDER_META[row.provider];
            const tone = providerHealthCardTone(row, {
              healthUnknown: unknown,
              workerStale: health.worker.stale,
            });
            return (
              <article
                key={row.provider}
                className={`rounded-xl border p-3 ${TONE_CLASS[tone]}`}
                data-provider={row.provider}
                data-health-tone={tone}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-gray-900">{meta?.label || row.provider}</h3>
                  <Badge tone={tone === 'ok' ? 'ok' : tone === 'danger' ? 'danger' : tone === 'warn' ? 'warn' : 'off'}>
                    {modeLabel(row.effectiveMode)}
                  </Badge>
                </div>
                <p className="text-xs text-gray-600 leading-5">
                  منبع: {row.modeSource === 'none' ? 'پیش‌فرض' : row.modeSource}
                  {row.killSwitchApi ? ' · kill API' : ''}
                  {row.killSwitchWorker === true ? ' · kill ورکر' : ''}
                  {row.killSwitchWorker === null ? ' · ورکر نامعلوم' : ''}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  آخرین موفقیت: {relativeShort(row.lastSuccessAt)}
                </p>
                {row.lastError && (
                  <p className="text-xs text-red-700 mt-1 line-clamp-2" title={row.lastError}>
                    خطا: {row.lastError}
                  </p>
                )}
                <p className="text-[11px] text-gray-500 mt-2">
                  امروز: RETRY {faNumber(row.countsToday.retry)} · DEAD {faNumber(row.countsToday.dead)}
                  {' '}· HOLD {faNumber(row.countsToday.hold)} · stalled {faNumber(row.countsToday.stalled)}
                </p>
                {row.cap && (
                  <p className="text-[11px] text-gray-500">
                    سقف: {faNumber(row.cap.sentToday)} از {faNumber(row.cap.dailyCap)}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
      {health?.telegramEgress?.host && (
        <p className="text-[11px] text-gray-400">
          مسیر تلگرام: {health.telegramEgress.host}
          {health.telegramEgress.mediaUploadMode ? ` · media=${health.telegramEgress.mediaUploadMode}` : ''}
        </p>
      )}
    </section>
  );
}
