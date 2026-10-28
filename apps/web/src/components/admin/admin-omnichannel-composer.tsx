'use client';

/**
 * PR-9 Composer wizard («انتشار جدید»).
 * Mounted only when status.composerUi / OMNICHANNEL_COMPOSER_UI=true.
 * No default destination ticks. Live send requires reason; bulk needs Owner+goRef.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Badge,
  Callout,
  PROVIDER_META,
  destinationReady,
  faNumber,
  type Channel,
  type Connection,
  type Destination,
  type Provider,
} from './admin-omnichannel-ui';

export type ComposerApiClient = {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
};

type ProductHit = {
  id: string;
  sku: string;
  name: string;
  thumbnailUrl: string | null;
  available: boolean;
};

type PlanDest = {
  destinationId: string;
  channel: string;
  provider: string;
  action: 'CREATE' | 'UPDATE' | 'SKIP';
  liveHint?: { providerMessageId: string; publicationId: string };
  renderedPreview: string;
  capRemaining: number;
  quietConflict: boolean;
  slotAtTehran: string | null;
  skipReason?: string;
};

type PlanPayload = {
  dryRun: true;
  plan: {
    destinations: PlanDest[];
    summary: {
      createCount: number;
      updateCount: number;
      skipCount: number;
      quietConflictCount: number;
    };
  };
};

const STEPS = [
  { id: 1, label: 'محصول' },
  { id: 2, label: 'مقصد' },
  { id: 3, label: 'کپشن' },
  { id: 4, label: 'رسانه' },
  { id: 5, label: 'زمان' },
  { id: 6, label: 'پیش‌نمایش' },
  { id: 7, label: 'تأیید' },
] as const;

const CAPTION_LIMIT: Record<string, number> = {
  TELEGRAM: 4096,
  BALE: 1024,
  RUBIKA: 4096,
};

export function selectedDestinationDefaults(): Set<string> {
  return new Set();
}

export function canAdvanceComposerStep(input: {
  step: number;
  productId: string | null;
  freePost: boolean;
  freeCaption: string;
  selectedIds: Set<string>;
  reason: string;
}): boolean {
  if (input.step === 1) {
    if (input.freePost) return input.freeCaption.trim().length > 0;
    return Boolean(input.productId);
  }
  if (input.step === 2) return input.selectedIds.size > 0;
  if (input.step === 7) return input.reason.trim().length > 0;
  return true;
}

type Props = {
  apiClient: ComposerApiClient;
  enabled: boolean;
  destinations: Destination[];
  connections: Connection[];
  freePostEnabled?: boolean;
  initialProductId?: string | null;
  initialChannel?: Channel;
  onNotice?: (msg: string) => void;
  onError?: (msg: string) => void;
};

export function AdminOmnichannelComposer({
  apiClient,
  enabled,
  destinations,
  connections,
  freePostEnabled = false,
  initialProductId = null,
  initialChannel = 'RETAIL',
  onNotice,
  onError,
}: Props) {
  const [step, setStep] = useState(1);
  const [channel, setChannel] = useState<Channel>(initialChannel);
  const [freePost, setFreePost] = useState(false);
  const [freeCaption, setFreeCaption] = useState('');
  const [freeMediaUrl, setFreeMediaUrl] = useState('');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [productId, setProductId] = useState<string | null>(initialProductId);
  const [productLabel, setProductLabel] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => selectedDestinationDefaults());
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [includePrice, setIncludePrice] = useState<Record<string, boolean>>({});
  const [sendMode, setSendMode] = useState<'now' | 'next_slot' | 'scheduled'>('next_slot');
  const [scheduledAt, setScheduledAt] = useState('');
  const [plan, setPlan] = useState<PlanPayload['plan'] | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [goRef, setGoRef] = useState('');

  const connById = useMemo(() => new Map(connections.map((c) => [c.id, c])), [connections]);
  const readyDests = useMemo(
    () => destinations.filter((d) => {
      const conn = connById.get(d.connectionId);
      if (!conn || conn.status !== 'ACTIVE' || !d.enabled || !destinationReady(d)) return false;
      const destChannel = conn.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
      return destChannel === channel;
    }),
    [channel, connById, destinations],
  );
  const providerOf = (dest: Destination): Provider => {
    const raw = connById.get(dest.connectionId)?.provider;
    return (raw === 'BALE' || raw === 'RUBIKA' || raw === 'TELEGRAM' ? raw : 'TELEGRAM');
  };

  useEffect(() => {
    if (!enabled) return;
    if (initialProductId) {
      setProductId(initialProductId);
      setFreePost(false);
      setStep(1);
    }
  }, [enabled, initialProductId]);

  useEffect(() => {
    if (!enabled || freePost || !q.trim()) {
      if (!q.trim()) setHits([]);
      return;
    }
    const t = setTimeout(() => {
      void apiClient
        .get<{ items: ProductHit[] }>(
          `/omnichannel/composer/products?channel=${channel}&q=${encodeURIComponent(q.trim())}&limit=20`,
        )
        .then((res) => setHits(res.items || []))
        .catch((err: unknown) => onError?.(err instanceof Error ? err.message : 'جستجو ناموفق'));
    }, 300);
    return () => clearTimeout(t);
  }, [apiClient, channel, enabled, freePost, onError, q]);

  const toggleDest = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const runPlan = useCallback(async () => {
    setBusy(true);
    try {
      const destinationIds = [...selectedIds];
      const body = {
        preview: freePost
          ? {
              channel,
              sourceType: 'FREE_POST',
              caption: freeCaption,
              mediaUrl: freeMediaUrl || undefined,
            }
          : {
              channel,
              sourceType: 'PRODUCT',
              sourceId: productId,
            },
        destinationIds,
        options: {
          sendMode,
          scheduledAt: sendMode === 'scheduled' ? scheduledAt || undefined : undefined,
          captionOverrides: captions,
          includePrice,
        },
      };
      const res = await apiClient.post<PlanPayload>('/omnichannel/composer/plan', body);
      setPlan(res.plan);
      onNotice?.('برنامه خشک آماده است (بدون ارسال به پیام‌رسان)');
      return res.plan;
    } catch (err: unknown) {
      onError?.(err instanceof Error ? err.message : 'برنامه خشک ناموفق');
      return null;
    } finally {
      setBusy(false);
    }
  }, [
    apiClient,
    captions,
    channel,
    freeCaption,
    freeMediaUrl,
    freePost,
    includePrice,
    onError,
    onNotice,
    productId,
    scheduledAt,
    selectedIds,
    sendMode,
  ]);

  const submitLive = useCallback(async () => {
    if (!reason.trim()) {
      onError?.('دلیل انتشار الزامی است');
      return;
    }
    setBusy(true);
    try {
      await apiClient.post('/omnichannel/publications', {
        preview: freePost
          ? {
              channel,
              sourceType: 'FREE_POST',
              caption: freeCaption,
              mediaUrl: freeMediaUrl || undefined,
            }
          : {
              channel,
              sourceType: 'PRODUCT',
              sourceId: productId,
            },
        dryRun: false,
        destinationIds: [...selectedIds],
        sendMode,
        scheduledAt: sendMode === 'scheduled' ? scheduledAt || undefined : undefined,
        captionOverrides: captions,
        includePrice,
        reason: reason.trim(),
      });
      setConfirmOpen(false);
      onNotice?.('در صف انتشار قرار گرفت');
    } catch (err: unknown) {
      onError?.(err instanceof Error ? err.message : 'ارسال زنده ناموفق');
    } finally {
      setBusy(false);
    }
  }, [
    apiClient,
    captions,
    channel,
    freeCaption,
    freeMediaUrl,
    freePost,
    includePrice,
    onError,
    onNotice,
    productId,
    reason,
    scheduledAt,
    selectedIds,
    sendMode,
  ]);

  const submitBulk = useCallback(async () => {
    if (!bulkCategoryId.trim() || !reason.trim() || !goRef.trim()) {
      onError?.('دسته، دلیل و goRef برای انتشار گروهی لازم است');
      return;
    }
    setBusy(true);
    try {
      await apiClient.post('/omnichannel/publications/requeue-by-category', {
        channel,
        categoryId: bulkCategoryId.trim(),
        reason: reason.trim(),
        goRef: goRef.trim(),
        confirm: true,
        dryRun: false,
        destinationId: [...selectedIds][0] || undefined,
      });
      onNotice?.('انتشار گروهی در صف قرار گرفت');
    } catch (err: unknown) {
      onError?.(err instanceof Error ? err.message : 'انتشار گروهی ناموفق');
    } finally {
      setBusy(false);
    }
  }, [apiClient, bulkCategoryId, channel, goRef, onError, onNotice, reason, selectedIds]);

  if (!enabled) return null;

  const canNext = canAdvanceComposerStep({
    step,
    productId,
    freePost,
    freeCaption,
    selectedIds,
    reason,
  });

  return (
    <section className="space-y-4" data-omni-composer aria-label="ویزارد انتشار جدید">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">انتشار جدید</h2>
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={bulkMode}
            onChange={(e) => setBulkMode(e.target.checked)}
            data-omni-composer-bulk
          />
          انتشار گروهی (Owner)
        </label>
      </div>

      {bulkMode ? (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4" data-omni-composer-bulk-panel>
          <Callout tone="warn">ارسال گروهی زنده فقط با نقش Owner و goRef کتبی.</Callout>
          <label className="block text-sm">
            شناسه دسته
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={bulkCategoryId}
              onChange={(e) => setBulkCategoryId(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            کانال
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel)}
            >
              <option value="RETAIL">تکی</option>
              <option value="WHOLESALE">عمده</option>
            </select>
          </label>
          <label className="block text-sm">
            دلیل
            <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <label className="block text-sm">
            goRef
            <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={goRef} onChange={(e) => setGoRef(e.target.value)} />
          </label>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void submitBulk()}>
            ارسال گروهی زنده
          </button>
        </div>
      ) : (
        <>
          <ol className="flex flex-wrap gap-1" data-omni-composer-stepper>
            {STEPS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs cursor-pointer ${
                    step === s.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                  onClick={() => setStep(s.id)}
                >
                  {faNumber(s.id)}. {s.label}
                </button>
              </li>
            ))}
          </ol>

          {step === 1 && (
            <StepBox title="① محصول یا پست آزاد">
              <div className="flex flex-wrap gap-3 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  کانال
                  <select
                    className="rounded-lg border px-2 py-1"
                    value={channel}
                    onChange={(e) => {
                      setChannel(e.target.value as Channel);
                      setSelectedIds(selectedDestinationDefaults());
                    }}
                    data-omni-composer-channel
                  >
                    <option value="RETAIL">تکی</option>
                    <option value="WHOLESALE">عمده</option>
                  </select>
                </label>
                {freePostEnabled && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={freePost} onChange={(e) => setFreePost(e.target.checked)} data-omni-composer-free-post />
                    پست آزاد
                  </label>
                )}
              </div>
              {freePost ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    rows={4}
                    placeholder="متن پست آزاد"
                    value={freeCaption}
                    onChange={(e) => setFreeCaption(e.target.value)}
                  />
                  <input
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="آدرس تصویر (اختیاری)"
                    value={freeMediaUrl}
                    onChange={(e) => setFreeMediaUrl(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">مقاله تلگرام در این ویزارد غیرفعال است.</p>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <input
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="جستجوی SKU یا نام…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    data-omni-composer-product-search
                  />
                  {productId && (
                    <p className="text-sm text-emerald-700">
                      انتخاب‌شده: {productLabel || productId}
                    </p>
                  )}
                  <ul className="max-h-56 overflow-auto divide-y rounded-lg border">
                    {hits.map((hit) => (
                      <li key={hit.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 px-3 py-2 text-right text-sm hover:bg-gray-50 cursor-pointer"
                          onClick={() => {
                            setProductId(hit.id);
                            setProductLabel(`${hit.sku} — ${hit.name}`);
                          }}
                        >
                          {hit.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={hit.thumbnailUrl} alt="" className="h-10 w-10 rounded object-cover" />
                          ) : (
                            <span className="h-10 w-10 rounded bg-gray-100" />
                          )}
                          <span className="flex-1">
                            <span className="font-medium">{hit.sku}</span>
                            <span className="block text-xs text-gray-500">{hit.name}</span>
                          </span>
                          <Badge tone={hit.available ? 'ok' : 'off'}>{hit.available ? 'موجود' : 'ناموجود'}</Badge>
                        </button>
                      </li>
                    ))}
                    {!hits.length && q.trim() && (
                      <li className="px-3 py-4 text-center text-xs text-gray-400">نتیجه‌ای نیست</li>
                    )}
                  </ul>
                </div>
              )}
            </StepBox>
          )}

          {step === 2 && (
            <StepBox title="② مقصدها — هیچ‌کدام پیش‌فرض تیک نیست">
              <ul className="space-y-2" data-omni-composer-destinations>
                {readyDests.map((dest) => {
                  const provider = providerOf(dest);
                  const meta = PROVIDER_META[provider];
                  return (
                    <li key={dest.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(dest.id)}
                          onChange={() => toggleDest(dest.id)}
                          data-omni-composer-dest-check
                        />
                        <span>{meta?.label || provider}</span>
                        <span className="text-xs text-gray-500">{dest.displayName || dest.id.slice(0, 8)}</span>
                      </label>
                    </li>
                  );
                })}
                {!readyDests.length && (
                  <li className="text-sm text-gray-400">مقصد آماده‌ای برای این کانال نیست</li>
                )}
              </ul>
            </StepBox>
          )}

          {step === 3 && (
            <StepBox title="③ کپشن و قیمت (پیش‌فرض خاموش)">
              {[...selectedIds].map((id) => {
                const dest = readyDests.find((d) => d.id === id);
                const provider = dest ? providerOf(dest) : 'TELEGRAM';
                const limit = CAPTION_LIMIT[provider] || 4096;
                const value = captions[id] || '';
                return (
                  <div key={id} className="mb-3 rounded-lg border p-3">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span>{PROVIDER_META[provider as Provider]?.label || provider}</span>
                      <span className="text-xs text-gray-500">{faNumber(value.length)} / {faNumber(limit)}</span>
                    </div>
                    <textarea
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      rows={3}
                      maxLength={limit}
                      value={value}
                      placeholder="خالی = قالب مقصد"
                      onChange={(e) => setCaptions((prev) => ({ ...prev, [id]: e.target.value }))}
                    />
                    <label className="mt-2 flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includePrice[id] === true}
                        onChange={(e) => setIncludePrice((prev) => ({ ...prev, [id]: e.target.checked }))}
                        data-omni-composer-price
                      />
                      نمایش قیمت در کپشن
                    </label>
                  </div>
                );
              })}
            </StepBox>
          )}

          {step === 4 && (
            <StepBox title="④ رسانه">
              <Callout tone="info">
                اسکن/فشرده‌سازی کامل در PR-11. فعلاً تصویر محصول از کاتالوگ نمایش داده می‌شود؛ اگر نباشد هشدار می‌گیرید.
              </Callout>
              {productId && productLabel ? (
                <p className="mt-2 text-sm">محصول: {productLabel}</p>
              ) : freePost && freeMediaUrl ? (
                <p className="mt-2 text-sm break-all">رسانه: {freeMediaUrl}</p>
              ) : (
                <p className="mt-2 text-sm text-amber-700">تصویر مشخص نشده — ارسال ممکن است فقط متن باشد.</p>
              )}
            </StepBox>
          )}

          {step === 5 && (
            <StepBox title="⑤ زمان ارسال">
              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={sendMode === 'next_slot'} onChange={() => setSendMode('next_slot')} />
                  slot بعدی (با رعایت سقف و سکوت)
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={sendMode === 'now'} onChange={() => setSendMode('now')} data-omni-composer-send-now />
                  اکنون (اگر سکوت باشد خطا)
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={sendMode === 'scheduled'} onChange={() => setSendMode('scheduled')} />
                  زمان‌بندی
                </label>
                {sendMode === 'scheduled' && (
                  <input
                    type="datetime-local"
                    className="rounded-lg border px-3 py-2 text-sm"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                )}
                {plan?.destinations[0] && (
                  <p className="text-xs text-gray-600">
                    سقف نمونه: {faNumber(plan.destinations[0].capRemaining)} باقی‌مانده · اسلات:{' '}
                    {plan.destinations[0].slotAtTehran || '—'}
                  </p>
                )}
              </div>
            </StepBox>
          )}

          {step === 6 && (
            <StepBox title="⑥ پیش‌نمایش خشک">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy || selectedIds.size === 0}
                onClick={() => void runPlan()}
                data-omni-composer-dry-run
              >
                اجرای برنامه خشک
              </button>
              {plan && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-gray-600">
                    ایجاد {faNumber(plan.summary.createCount)} · ویرایش {faNumber(plan.summary.updateCount)} · رد{' '}
                    {faNumber(plan.summary.skipCount)}
                  </p>
                  {plan.destinations.map((d) => (
                    <div
                      key={d.destinationId}
                      className={`rounded-lg border p-3 text-sm ${
                        d.action === 'UPDATE' ? 'border-amber-300 bg-amber-50/50' : 'bg-white'
                      }`}
                      data-omni-composer-plan-card
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={d.action === 'SKIP' ? 'off' : d.action === 'UPDATE' ? 'info' : 'ok'}>
                          {d.action}
                        </Badge>
                        <span>{PROVIDER_META[d.provider as Provider]?.label || d.provider}</span>
                        {d.quietConflict && <Badge tone="danger">تعارض سکوت</Badge>}
                        {d.action === 'UPDATE' && (
                          <span className="text-xs text-amber-700">قبلاً ارسال شده ← ویرایش؟</span>
                        )}
                      </div>
                      <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-xs text-gray-700">
                        {d.renderedPreview || '—'}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </StepBox>
          )}

          {step === 7 && (
            <StepBox title="⑦ تأیید Publisher">
              <Callout tone="info">ارسال تکی زنده برای Publisher بدون goRef مجاز است. گروهی Owner+goRef می‌خواهد.</Callout>
              <label className="mt-3 block text-sm">
                دلیل (الزامی)
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  data-omni-composer-reason
                />
              </label>
              <button
                type="button"
                className="btn btn-primary btn-sm mt-3"
                disabled={busy || !reason.trim() || selectedIds.size === 0}
                onClick={() => setConfirmOpen(true)}
                data-omni-composer-confirm-open
              >
                باز کردن تأیید نهایی
              </button>
            </StepBox>
          )}

          <div className="flex justify-between">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={step <= 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
            >
              قبل
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={step >= 7 || !canNext}
              onClick={async () => {
                if (step === 5) await runPlan();
                setStep((s) => Math.min(7, s + 1));
              }}
            >
              بعد
            </button>
          </div>
        </>
      )}

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          data-omni-composer-confirm-modal
        >
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
            <h3 className="text-sm font-semibold">تأیید ارسال زنده</h3>
            <p className="mt-2 text-sm text-gray-600">
              {faNumber(selectedIds.size)} مقصد · حالت {sendMode} · دلیل: {reason}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirmOpen(false)}>
                انصراف
              </button>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void submitLive()}>
                ارسال به صف
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function StepBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}
