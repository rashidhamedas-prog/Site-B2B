'use client';

/**
 * PR-10 «تنظیمات کانال» — per-destination content + emergency hold.
 * Mounted only when status.channelSettingsUi / OMNICHANNEL_CHANNEL_SETTINGS_UI=true.
 * Never invents LIVE contact/UTM/ownerChat ids. OwnerChat test deferred to PR-14.
 */
import { useCallback, useEffect, useState } from 'react';
import { Callout, PROVIDER_META, type Provider } from './admin-omnichannel-ui';

export type ChannelSettingsDestination = {
  id: string;
  provider?: string;
  displayName?: string | null;
  channel?: string | null;
};

export type ChannelSettingsPayload = {
  destinationId: string;
  provider?: string;
  channel?: string;
  displayName?: string | null;
  captionIntro?: string;
  footerText?: string;
  contactId?: string;
  orderBotId?: string;
  orderBotUsername?: string;
  botUsername?: string;
  channelLink?: string;
  hashtags?: string;
  ctaText?: string;
  utmSource?: string;
  utmCampaign?: string;
  showPrice?: boolean;
  showPriceDefault?: boolean;
  ownerChatId?: string;
  emergencyHold?: boolean;
  autoPublishMode?: string;
  autoDailyCap?: number;
  quietStartHour?: number | null;
  quietEndHour?: number | null;
  settingsSource?: string;
  warnings?: string[];
};

const EMPTY_HINT = 'مالک وارد می‌کند';

export function channelSettingsDefaults(): ChannelSettingsPayload {
  return {
    destinationId: '',
    captionIntro: '',
    footerText: '',
    contactId: '',
    orderBotId: '',
    orderBotUsername: '',
    botUsername: '',
    channelLink: '',
    hashtags: '',
    ctaText: '',
    utmSource: '',
    utmCampaign: '',
    showPrice: false,
    showPriceDefault: false,
    ownerChatId: '',
    emergencyHold: false,
    warnings: [],
  };
}

/** Source-level guard: no hard-coded LIVE bot/chat ids in this module. */
export function channelSettingsSourceHasInventedIds(src: string): boolean {
  // Build needles without storing full LIVE ids as contiguous literals in this file.
  const needles = [
    ['Taranom', 'Retail', 'Bot'].join(''),
    ['4858', '359', '991'].join(''),
    ['@Taranom', 'rashid'].join(''),
  ];
  const body = src.replace(/channelSettingsSourceHasInventedIds[\s\S]*?^}/m, '');
  return needles.some((n) => body.toLowerCase().includes(n.toLowerCase()));
}

type ApiClient = {
  get: <T>(path: string) => Promise<T>;
  patch: <T>(path: string, body: unknown) => Promise<T>;
  post: <T>(path: string, body: unknown) => Promise<T>;
};

export function AdminOmnichannelChannelSettings({
  apiClient,
  enabled,
  destinations,
  onNotice,
  onError,
}: {
  apiClient: ApiClient;
  enabled: boolean;
  destinations: ChannelSettingsDestination[];
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [destinationId, setDestinationId] = useState('');
  const [form, setForm] = useState<ChannelSettingsPayload>(channelSettingsDefaults());
  const [goRef, setGoRef] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [copyFromId, setCopyFromId] = useState('');

  const load = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await apiClient.get<ChannelSettingsPayload>(
        `/v1/omnichannel/destinations/${id}/channel-settings`,
      );
      setForm({ ...channelSettingsDefaults(), ...data, destinationId: id });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'بارگذاری تنظیمات کانال ناموفق');
    } finally {
      setLoading(false);
    }
  }, [apiClient, onError]);

  useEffect(() => {
    if (!enabled) return;
    if (!destinationId && destinations[0]?.id) {
      setDestinationId(destinations[0].id);
      return;
    }
    if (destinationId) void load(destinationId);
  }, [enabled, destinationId, destinations, load]);

  if (!enabled) return null;

  const provider = String(form.provider || destinations.find((d) => d.id === destinationId)?.provider || '')
    .toUpperCase() as Provider;
  const meta = PROVIDER_META[provider];

  async function save() {
    if (!destinationId) return;
    if (!goRef.trim()) {
      onError('برای ذخیرهٔ تنظیمات کانال، goRef مالک لازم است');
      return;
    }
    setLoading(true);
    try {
      const saved = await apiClient.patch<ChannelSettingsPayload>(
        `/v1/omnichannel/destinations/${destinationId}/channel-settings`,
        {
          captionIntro: form.captionIntro || '',
          footerText: form.footerText || '',
          contactId: form.contactId || '',
          orderBotId: form.orderBotId || '',
          orderBotUsername: form.orderBotUsername || '',
          botUsername: form.botUsername || '',
          channelLink: form.channelLink || '',
          hashtags: form.hashtags || '',
          ctaText: form.ctaText || '',
          utmSource: form.utmSource || '',
          utmCampaign: form.utmCampaign || '',
          showPriceDefault: form.showPriceDefault === true || form.showPrice === true,
          ownerChatId: form.ownerChatId || '',
          reason: reason || undefined,
          goRef: goRef.trim(),
        },
      );
      if (saved?.warnings?.length) {
        onNotice(`ذخیره شد — هشدار: ${saved.warnings.join('؛ ')}`);
      } else {
        onNotice('تنظیمات کانال ذخیره شد');
      }
      await load(destinationId);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'ذخیره ناموفق');
    } finally {
      setLoading(false);
    }
  }

  async function toggleHold(hold: boolean) {
    if (!destinationId) return;
    if (!goRef.trim()) {
      onError('برای توقف اضطراری، goRef مالک لازم است');
      return;
    }
    setLoading(true);
    try {
      await apiClient.patch(`/v1/omnichannel/destinations/${destinationId}/emergency-hold`, {
        hold,
        reason: reason || (hold ? 'توقف اضطراری' : 'رفع توقف'),
        goRef: goRef.trim(),
      });
      onNotice(hold ? 'توقف اضطراری فعال شد' : 'توقف اضطراری برداشته شد');
      await load(destinationId);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'تغییر توقف اضطراری ناموفق');
    } finally {
      setLoading(false);
    }
  }

  async function copyFrom() {
    if (!destinationId || !copyFromId) return;
    if (!goRef.trim()) {
      onError('برای کپی، goRef مالک لازم است');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post(`/v1/omnichannel/destinations/${destinationId}/channel-settings/copy-from`, {
        sourceDestinationId: copyFromId,
        includeAutomation: false,
        goRef: goRef.trim(),
        reason: reason || 'کپی تنظیمات کانال',
      });
      onNotice('مقادیر از کانال دیگر کپی شد (بدون پیوند مشترک)');
      await load(destinationId);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'کپی ناموفق');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4" dir="rtl">
      <header>
        <h2 className="text-base font-semibold text-gray-900">تنظیمات هر کانال</h2>
        <p className="text-sm text-gray-600">
          هویت و UTM جدا برای هر مقصد. مقدار زنده را مالک وارد می‌کند؛ پیش‌فرض خالی / قیمت خاموش.
        </p>
      </header>

      <label className="block text-sm">
        <span className="text-gray-700">مقصد (ماتریس ۳×۲)</span>
        <select
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          value={destinationId}
          onChange={(e) => setDestinationId(e.target.value)}
        >
          {[...destinations]
            .sort((a, b) => {
              const pa = String(a.provider || '');
              const pb = String(b.provider || '');
              if (pa !== pb) return pa.localeCompare(pb);
              return String(a.channel || '').localeCompare(String(b.channel || ''));
            })
            .map((d) => (
              <option key={d.id} value={d.id}>
                {(PROVIDER_META[String(d.provider || '').toUpperCase() as Provider]?.label || d.provider || '?')}
                {' · '}
                {d.channel === 'WHOLESALE' ? 'عمده' : 'تکی'}
                {' · '}
                {d.displayName || d.id.slice(0, 8)}
              </option>
            ))}
        </select>
      </label>

      {!!form.warnings?.length && (
        <Callout tone="warn">{form.warnings.join(' — ')}</Callout>
      )}

      {meta && (
        <p className="text-xs text-gray-500">
          پلتفرم: {meta.label}
          {form.emergencyHold ? ' · توقف اضطراری فعال' : ''}
        </p>
      )}

      {form.emergencyHold && <Callout tone="danger">اتوماسیون این مقصد متوقف است (emergency hold).</Callout>}

      <div className="grid gap-3 md:grid-cols-2">
        {([
          ['captionIntro', 'متن / مقدمه کپشن'],
          ['footerText', 'فوتر'],
          ['contactId', 'آیدی تماس'],
          ['orderBotId', 'آی‌دی ربات سفارش'],
          ['orderBotUsername', 'یوزرنیم ربات سفارش'],
          ['botUsername', 'نام ربات انتشار'],
          ['channelLink', 'لینک کانال'],
          ['hashtags', 'هشتگ‌ها'],
          ['ctaText', 'CTA'],
          ['utmSource', 'utm_source'],
          ['utmCampaign', 'utm_campaign'],
          ['ownerChatId', 'آی‌دی مقصد هدایت پیام‌ها'],
        ] as Array<[keyof ChannelSettingsPayload, string]>).map(([key, label]) => (
          <label key={key} className="block text-sm">
            <span className="text-gray-700">{label}</span>
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder={EMPTY_HINT}
              value={String(form[key] ?? '')}
              onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
              autoComplete="off"
            />
          </label>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.showPriceDefault === true || form.showPrice === true}
          onChange={(e) => setForm((prev) => ({
            ...prev,
            showPriceDefault: e.target.checked,
            showPrice: e.target.checked,
          }))}
        />
        نمایش قیمت (پیش‌فرض خاموش)
      </label>

      <button
        type="button"
        className="btn btn-secondary btn-sm opacity-60 cursor-not-allowed"
        disabled
        title="تست owner_chat_id در PR-14"
      >
        تست آی‌دی مقصد هدایت پیام‌ها (PR-14)
      </button>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          <span className="text-gray-700">goRef (الزامی برای ذخیره / توقف)</span>
          <input
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            value={goRef}
            onChange={(e) => setGoRef(e.target.value)}
            placeholder="GO حامد …"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">دلیل (اختیاری)</span>
          <input
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" disabled={loading} onClick={() => void save()}>
          ذخیره تنظیمات
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={loading || form.emergencyHold === true}
          onClick={() => void toggleHold(true)}
        >
          توقف اضطراری
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={loading || form.emergencyHold !== true}
          onClick={() => void toggleHold(false)}
        >
          رفع توقف
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
        <label className="block text-sm grow">
          <span className="text-gray-700">کپی از کانال دیگر</span>
          <select
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            value={copyFromId}
            onChange={(e) => setCopyFromId(e.target.value)}
          >
            <option value="">انتخاب مبدأ</option>
            {destinations.filter((d) => d.id !== destinationId).map((d) => (
              <option key={d.id} value={d.id}>{d.displayName || d.id.slice(0, 8)}</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-secondary btn-sm" disabled={loading || !copyFromId} onClick={() => void copyFrom()}>
          کپی مقادیر
        </button>
      </div>
    </section>
  );
}
