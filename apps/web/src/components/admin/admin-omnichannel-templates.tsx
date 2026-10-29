'use client';

/**
 * PR-10 «قالب‌ها» — version list + editor + activate (Owner+goRef) + preview dry-run.
 * Mounted when status.templatesUi / OMNICHANNEL_TEMPLATES_UI=true.
 */
import { useCallback, useEffect, useState } from 'react';
import { Callout } from './admin-omnichannel-ui';

export type TemplateRow = {
  id: string;
  destinationId?: string | null;
  channel?: string;
  eventType?: string;
  version?: number;
  enabled?: boolean;
  body?: string;
};

type ApiClient = {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body: unknown) => Promise<T>;
  patch: <T>(path: string, body: unknown) => Promise<T>;
};

export function templateActivateVisible(role: 'VIEWER' | 'PUBLISHER' | 'OWNER' | string | null | undefined): boolean {
  return String(role || '').toUpperCase() === 'OWNER' || !role;
}

export function AdminOmnichannelTemplates({
  apiClient,
  enabled,
  destinations,
  actorRole,
  onNotice,
  onError,
}: {
  apiClient: ApiClient;
  enabled: boolean;
  destinations: Array<{ id: string; displayName?: string | null; provider?: string }>;
  actorRole?: string | null;
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [destinationId, setDestinationId] = useState('');
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [body, setBody] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [goRef, setGoRef] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [loading, setLoading] = useState(false);
  const canActivate = templateActivateVisible(actorRole);

  const load = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const list = await apiClient.get<TemplateRow[]>(`/v1/omnichannel/templates?destinationId=${encodeURIComponent(id)}`);
      const scoped = (list || []).filter((row) => row.destinationId === id || !row.destinationId);
      setRows(scoped);
      const active = scoped.find((row) => row.enabled && row.destinationId === id) || scoped[0];
      if (active) {
        setSelectedId(active.id);
        setBody(String(active.body || ''));
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'بارگذاری قالب‌ها ناموفق');
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

  async function saveVersion() {
    if (!destinationId) return;
    if (/ضد\s*آب/.test(body)) {
      onError('ادعای «ضدآب» در قالب مجاز نیست');
      return;
    }
    setLoading(true);
    try {
      const dest = destinations.find((d) => d.id === destinationId);
      const channel = 'RETAIL';
      await apiClient.post('/v1/omnichannel/templates', {
        destinationId,
        provider: 'MASTER',
        channel,
        eventType: 'product.published',
        body,
        enabled: false,
        version: Math.max(1, ...rows.map((r) => Number(r.version) || 0)) + 1,
      });
      onNotice(`نسخهٔ جدید برای ${dest?.displayName || destinationId.slice(0, 8)} ذخیره شد (پیش‌نویس)`);
      await load(destinationId);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'ذخیره قالب ناموفق');
    } finally {
      setLoading(false);
    }
  }

  async function activate() {
    if (!selectedId) return;
    if (!canActivate) {
      onError('فعال‌سازی فقط برای Owner است');
      return;
    }
    if (!goRef.trim()) {
      onError('برای فعال‌سازی، goRef مالک لازم است');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post(`/v1/omnichannel/templates/${selectedId}/activate`, {
        goRef: goRef.trim(),
        reason: 'فعال‌سازی قالب',
      });
      onNotice('قالب فعال شد');
      await load(destinationId);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'فعال‌سازی ناموفق');
    } finally {
      setLoading(false);
    }
  }

  async function preview() {
    setLoading(true);
    try {
      const res = await apiClient.post<{ rendered?: { text?: string }; text?: string }>('/v1/omnichannel/preview', {
        destinationId,
        channel: 'RETAIL',
        body,
      });
      setPreviewText(String(res?.rendered?.text || res?.text || JSON.stringify(res)).slice(0, 4000));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'پیش‌نمایش ناموفق');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4" dir="rtl">
      <header>
        <h2 className="text-base font-semibold text-gray-900">قالب‌ها</h2>
        <p className="text-sm text-gray-600">
          ذخیره نسخهٔ پیش‌نویس (Publisher) و فعال‌سازی جدا (Owner+goRef). پیش‌نمایش بدون ارسال زنده.
        </p>
      </header>

      <label className="block text-sm">
        <span className="text-gray-700">مقصد</span>
        <select
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          value={destinationId}
          onChange={(e) => setDestinationId(e.target.value)}
        >
          {destinations.map((d) => (
            <option key={d.id} value={d.id}>{d.displayName || d.id.slice(0, 8)}</option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2 text-sm">
          <p className="font-medium text-gray-800">نسخه‌ها</p>
          <ul className="max-h-64 space-y-1 overflow-auto rounded-lg border border-gray-100 p-2">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`w-full rounded px-2 py-1 text-start cursor-pointer ${selectedId === row.id ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                  onClick={() => {
                    setSelectedId(row.id);
                    setBody(String(row.body || ''));
                  }}
                >
                  v{row.version ?? '?'} {row.enabled ? '· فعال' : '· پیش‌نویس'}
                  {!row.destinationId ? ' · سراسری' : ''}
                </button>
              </li>
            ))}
            {!rows.length && <li className="text-gray-500">قالبی نیست</li>}
          </ul>
          <p className="text-xs text-gray-500">توکن‌ها: {'{name}'} {'{sku}'} {'{minOrder}'} {'{price}'} {'{pdpUrl}/{url}'} {'{contactId}'}</p>
        </div>

        <div className="space-y-2 lg:col-span-1">
          <label className="block text-sm">
            <span className="text-gray-700">بدنه قالب</span>
            <textarea
              className="mt-1 h-56 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          {/ضد\s*آب/.test(body) && (
            <Callout tone="danger">ادعای «ضدآب» در قالب مجاز نیست و سرور ذخیره را رد می‌کند.</Callout>
          )}
        </div>

        <div className="space-y-2 text-sm">
          <p className="font-medium text-gray-800">پیش‌نمایش (خشک)</p>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-2 text-xs">
            {previewText || 'هنوز پیش‌نمایش نگرفته‌اید'}
          </pre>
          <button type="button" className="btn btn-secondary btn-sm" disabled={loading} onClick={() => void preview()}>
            پیش‌نمایش
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <button type="button" className="btn btn-primary btn-sm" disabled={loading} onClick={() => void saveVersion()}>
          ذخیره نسخهٔ جدید
        </button>
        {canActivate && (
          <>
            <label className="block text-sm">
              <span className="text-gray-700">goRef</span>
              <input
                className="mt-1 rounded-lg border border-gray-300 px-3 py-2"
                value={goRef}
                onChange={(e) => setGoRef(e.target.value)}
                placeholder="GO حامد …"
              />
            </label>
            <button type="button" className="btn btn-secondary btn-sm" disabled={loading || !selectedId} onClick={() => void activate()}>
              فعال‌سازی
            </button>
          </>
        )}
        {!canActivate && (
          <p className="text-xs text-amber-700">دکمهٔ فعال‌سازی فقط برای Owner نمایش داده می‌شود.</p>
        )}
      </div>
    </section>
  );
}
