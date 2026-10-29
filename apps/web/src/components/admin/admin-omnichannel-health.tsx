'use client';

/**
 * PR-1 read-only health strip: provider cards + api/worker kill-switch mismatch banner.
 * Never greens on error/unknown. No HOLD/LIVE writes, no canary send.
 * Panel-urgent: FA labels, stale lastError, per-dest cap (no max-as-sum).
 */
import { Badge, Callout, PROVIDER_META, faNumber, type Provider } from './admin-omnichannel-ui';
import { classifyErrorFreshness, errorLabelWithCodeTitle } from './admin-omnichannel-error-labels';
import { countsTodayLineFa, modeLabelFa } from './admin-omnichannel-labels';

export const HEALTH_MISMATCH_BANNER_FA =
  'ناهمخوانی kill-switch بین API و ورکر: تست موفق ولی ارسال واقعی ممکن است DEAD شود.';

export const DUAL_ROLE_CANARY_BANNER_FA =
  'این مقصد هم کانال زنده عمده و هم مقصد آزمایشی است (شناسه canary مستند). تا تصمیم مالک، تغییر خودکار اعمال نمی‌شود.';

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
    lastErrorAt?: string | null;
    countsToday: { retry: number; dead: number; hold: number; stalled: number };
    cap?: { sentToday: number; dailyCap: number; nextSlotHint?: string | null };
    capAmbiguous?: boolean;
    destinationCaps?: Array<{ destinationId?: string; dailyCap: number }>;
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
  dualRoleCanaryWarning = false,
}: {
  health: OmnichannelHealthPayload | null;
  loading?: boolean;
  error?: boolean;
  /** Documented Bale 4858359991 dual-role — warn only; never auto-clear. */
  dualRoleCanaryWarning?: boolean;
}) {
  const stripTone = healthStripTone({ health, loading, error });
  const unknown = Boolean(error || (!loading && !health));

  return (
    <section className="space-y-3" aria-label="سلامت کانال‌های انتشار" data-omni-health-strip data-tone={stripTone}>
      {(error || (!loading && !health)) && (
        <Callout tone="warn">وضعیت نامعلوم — پاسخ سلامت دریافت نشد. هرگز وضعیت سبز فرض نشود.</Callout>
      )}
      {dualRoleCanaryWarning && (
        <Callout tone="warn">
          <span data-omni-dual-role-canary>{DUAL_ROLE_CANARY_BANNER_FA}</span>
        </Callout>
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
            const freshness = classifyErrorFreshness({
              lastError: row.lastError,
              lastErrorAt: row.lastErrorAt,
              lastSuccessAt: row.lastSuccessAt,
            });
            const errUi = row.lastError ? errorLabelWithCodeTitle(row.lastError) : null;
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
                    <span title={row.effectiveMode}>{modeLabelFa(row.effectiveMode)}</span>
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
                {freshness && (
                  <p
                    className={`text-xs mt-1 line-clamp-2 ${freshness.muted ? 'text-gray-500' : 'text-red-700'}`}
                    title={errUi?.title || row.lastError || ''}
                  >
                    {freshness.displayFa}
                  </p>
                )}
                <p className="text-[11px] text-gray-500 mt-2">
                  امروز: {countsTodayLineFa(row.countsToday, faNumber)}
                </p>
                {row.capAmbiguous ? (
                  <p className="text-[11px] text-amber-800">
                    چند سقف — مقصد را انتخاب کنید
                    {row.destinationCaps?.length
                      ? ` (${row.destinationCaps.map((c) => faNumber(c.dailyCap)).join('، ')})`
                      : ''}
                  </p>
                ) : row.cap ? (
                  <p className="text-[11px] text-gray-500">
                    سقف: {faNumber(row.cap.sentToday)} از {faNumber(row.cap.dailyCap)}
                  </p>
                ) : null}
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
