'use client';

/**
 * PR-14 order-bot inbox («صندوق ربات‌ها»). Mounted behind OMNICHANNEL_ORDER_BOT_UI.
 * Never displays tokens/secrets.
 */

import { useCallback, useEffect, useState } from 'react';

type ApiClient = {
  get: (path: string) => Promise<{ data: unknown }>;
  post: (path: string, body: unknown) => Promise<{ data: unknown }>;
};

type InboxItem = {
  id: string;
  provider?: string;
  customerLabel?: string;
  state?: string;
  tags?: string[];
  unanswered?: boolean;
  sensitive?: boolean;
  lastCustomerMessageAt?: string | null;
  orderId?: string | null;
  invoiceId?: string | null;
  destinationLabel?: string | null;
  ownerChatConfigured?: boolean;
};

export function AdminOmnichannelBotInbox(props: {
  apiClient: ApiClient;
  enabled: boolean;
  onNotice?: (msg: string) => void;
  onError?: (msg: string) => void;
}) {
  const { apiClient, enabled, onNotice, onError } = props;
  const [items, setItems] = useState<InboxItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<{
    messages?: Array<{ id: string; direction: string; bodyPreview: string; createdAt: string }>;
  } | null>(null);
  const [reply, setReply] = useState('');
  const [filterSensitive, setFilterSensitive] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const q = filterSensitive ? '?tag=sensitive' : '';
      const res = await apiClient.get(`/omnichannel/bots/inbox${q}`);
      const data = res.data as { items?: InboxItem[] };
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err: unknown) {
      onError?.(err instanceof Error ? err.message : 'خطا در بارگذاری صندوق');
    } finally {
      setLoading(false);
    }
  }, [apiClient, enabled, filterSensitive, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const openThread = async (id: string) => {
    setSelected(id);
    try {
      const res = await apiClient.get(`/omnichannel/bots/inbox/${id}`);
      setThread(res.data as typeof thread);
    } catch (err: unknown) {
      onError?.(err instanceof Error ? err.message : 'خطا در بارگذاری گفتگو');
    }
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    try {
      await apiClient.post(`/omnichannel/bots/inbox/${selected}/reply`, { text: reply.trim() });
      setReply('');
      onNotice?.('پاسخ ارسال شد');
      await openThread(selected);
      await load();
    } catch (err: unknown) {
      onError?.(err instanceof Error ? err.message : 'خطا در ارسال پاسخ');
    }
  };

  const referSocial = async () => {
    if (!selected) return;
    try {
      const res = await apiClient.post(`/omnichannel/bots/inbox/${selected}/refer-social`, {});
      const data = res.data as { forwarded?: boolean; audit?: string };
      onNotice?.(
        data.forwarded
          ? 'ارجاع به سوشال مدیا انجام شد'
          : `ارجاع ثبت شد (${data.audit || 'skipped'})`,
      );
    } catch (err: unknown) {
      onError?.(err instanceof Error ? err.message : 'خطا در ارجاع');
    }
  };

  const markAnswered = async () => {
    if (!selected) return;
    try {
      await apiClient.post(`/omnichannel/bots/inbox/${selected}/mark-answered`, {});
      onNotice?.('علامت پاسخ‌داده‌شده');
      await load();
    } catch (err: unknown) {
      onError?.(err instanceof Error ? err.message : 'خطا');
    }
  };

  if (!enabled) {
    return (
      <section data-omni-bot-inbox className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600">
        صندوق ربات‌ها غیرفعال است (OMNICHANNEL_ORDER_BOT_UI).
      </section>
    );
  }

  return (
    <section data-omni-bot-inbox className="space-y-4" aria-label="صندوق ربات‌های سفارش">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-900">صندوق ربات‌ها</h2>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-1 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={filterSensitive}
              onChange={(e) => setFilterSensitive(e.target.checked)}
            />
            فقط حساس
          </label>
          <button type="button" className="btn btn-secondary btn-sm cursor-pointer" onClick={() => void load()} disabled={loading}>
            بروزرسانی
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-600" data-omni-bot-inbox-empty>
          گفتگویی در صندوق نیست.
        </p>
      ) : (
        <ul className="space-y-2" data-omni-bot-inbox-list>
          {items.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={`w-full text-right rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                  selected === row.id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'
                }`}
                onClick={() => void openThread(row.id)}
              >
                <span className="font-medium">{row.provider}</span>
                {' · '}
                {row.customerLabel}
                {row.sensitive ? ' · حساس' : ''}
                {row.unanswered ? ' · بی‌پاسخ' : ''}
                {row.state ? ` · ${row.state}` : ''}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="space-y-3 rounded-lg border border-gray-200 p-3" data-omni-bot-inbox-thread>
          <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
            {(thread?.messages || []).map((m) => (
              <div
                key={m.id}
                className={m.direction === 'inbound' ? 'text-gray-900' : 'text-emerald-800'}
              >
                <span className="text-xs text-gray-500">{m.direction}</span>
                {' — '}
                {m.bodyPreview}
              </div>
            ))}
          </div>
          <textarea
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            rows={3}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="پاسخ ادمین…"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm cursor-pointer" onClick={() => void sendReply()}>
              ارسال پاسخ
            </button>
            <button type="button" className="btn btn-secondary btn-sm cursor-pointer" onClick={() => void referSocial()}>
              ارجاع به سوشال مدیا
            </button>
            <button type="button" className="btn btn-secondary btn-sm cursor-pointer" onClick={() => void markAnswered()}>
              علامت پاسخ‌داده‌شده
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
