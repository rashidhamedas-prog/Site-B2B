'use client';

/**
 * PR-13 unanswered alerts strip/tab («هشدارها»).
 * Mounted only when status.unansweredAlertsUi / OMNICHANNEL_UNANSWERED_ALERTS_UI=true.
 * Never fabricates owner chat ids — empty owner shows Persian settings hint.
 */
import { useCallback, useEffect, useState } from 'react';
import { Badge, Callout, faNumber } from './admin-omnichannel-ui';

export type OmnichannelAlertItem = {
  id: string;
  type: string;
  destinationId: string;
  conversationId: string;
  severity: string;
  status: string;
  createdAt: string;
  createdAtTehran: string | null;
  notifiedOwnerAt: string | null;
  panelSeenAt: string | null;
  destinationLabel: string | null;
  provider: string | null;
  ownerChatConfigured: boolean;
  notifyErrorCode: string | null;
  ageSec: number | null;
  settingsHint: string | null;
};

export type AlertsListPayload = {
  openCount: number;
  items: OmnichannelAlertItem[];
};

type ApiClientLike = {
  get: (path: string) => Promise<{ data: AlertsListPayload }>;
  post: (path: string, body?: unknown) => Promise<unknown>;
};

export function alertAgeLabel(ageSec: number | null | undefined): string {
  if (ageSec == null || !Number.isFinite(ageSec)) return '—';
  const s = Math.max(0, Math.floor(ageSec));
  if (s < 60) return `${faNumber(s)} ثانیه`;
  const m = Math.floor(s / 60);
  return `${faNumber(m)} دقیقه`;
}

export function AdminOmnichannelAlerts(props: {
  apiClient: ApiClientLike;
  enabled: boolean;
  onOpenSettings?: () => void;
  onNotice?: (msg: string) => void;
  onError?: (msg: string) => void;
}) {
  const { apiClient, enabled, onOpenSettings, onNotice, onError } = props;
  const [payload, setPayload] = useState<AlertsListPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [unknown, setUnknown] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await apiClient.get('/omnichannel/alerts?status=open');
      setPayload(res.data);
      setUnknown(false);
    } catch {
      setUnknown(true);
      setPayload(null);
      onError?.('بارگذاری هشدارها ناموفق بود');
    } finally {
      setLoading(false);
    }
  }, [apiClient, enabled, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const ack = async (id: string) => {
    try {
      await apiClient.post(`/omnichannel/alerts/${id}/ack`, {});
      onNotice?.('هشدار به‌عنوان دیده‌شده ثبت شد');
      await load();
    } catch {
      onError?.('ثبت دیده‌شدن هشدار ناموفق بود');
    }
  };

  const resolve = async (id: string) => {
    try {
      await apiClient.post(`/omnichannel/alerts/${id}/resolve`, {});
      onNotice?.('هشدار بسته شد');
      await load();
    } catch {
      onError?.('بستن هشدار ناموفق بود');
    }
  };

  if (!enabled) return null;

  const items = payload?.items || [];
  const openCount = payload?.openCount ?? 0;

  return (
    <section data-omni-alerts className="space-y-3" aria-label="هشدارهای بی‌پاسخ">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900">هشدارها</h2>
          {openCount > 0 && (
            <Badge tone="danger">
              {faNumber(openCount)} باز
            </Badge>
          )}
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm cursor-pointer"
          onClick={() => void load()}
          disabled={loading}
        >
          تازه‌سازی
        </button>
      </div>

      {unknown && (
        <Callout tone="warn">وضعیت هشدارها نامعلوم است — اتصال API را بررسی کنید.</Callout>
      )}

      {!unknown && !loading && items.length === 0 && (
        <Callout tone="ok">هشدار بی‌پاسخ بازی نیست.</Callout>
      )}

      <ul className="space-y-2" data-omni-alerts-list>
        {items.map((item) => (
          <li
            key={item.id}
            data-omni-alert-row
            className="rounded-xl border border-gray-200 bg-white p-3 space-y-2"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-900">
                  {item.destinationLabel || 'مقصد'}
                  {item.provider ? ` · ${item.provider}` : ''}
                </p>
                <p className="text-xs text-gray-600">
                  سن تقریبی: {alertAgeLabel(item.ageSec)}
                  {item.createdAtTehran ? ` · ثبت (تهران): ${item.createdAtTehran}` : ''}
                </p>
                <p className="text-xs text-gray-600">
                  اطلاع به مالک:{' '}
                  {item.notifiedOwnerAt
                    ? 'ارسال شد'
                    : item.ownerChatConfigured
                      ? item.notifyErrorCode || 'در صف / ناموفق'
                      : 'فقط پنل (آی‌دی مالک خالی)'}
                </p>
              </div>
              <Badge tone={item.status === 'acked' ? 'warn' : 'danger'}>
                {item.status === 'acked' ? 'دیده‌شده' : 'باز'}
              </Badge>
            </div>

            {!item.ownerChatConfigured && item.settingsHint && (
              <div data-omni-alert-owner-hint>
                <Callout tone="warn">
                  <p className="text-sm">{item.settingsHint}</p>
                  {onOpenSettings && (
                    <button
                      type="button"
                      className="mt-2 text-sm underline cursor-pointer"
                      onClick={onOpenSettings}
                    >
                      باز کردن تنظیمات کانال
                    </button>
                  )}
                </Callout>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {item.status === 'open' && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm cursor-pointer"
                  onClick={() => void ack(item.id)}
                >
                  دیدم
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary btn-sm cursor-pointer"
                onClick={() => void resolve(item.id)}
              >
                رسیدگی شد
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
