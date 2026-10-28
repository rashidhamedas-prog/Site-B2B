'use client';

/**
 * PR-8 coverage matrix tab («پوشش و تکرار»).
 * Mounted only when status.coverageUi / OMNICHANNEL_COVERAGE_UI=true.
 * Never greens on API error — grey «نامعلوم».
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Badge, Callout, PROVIDER_META, faNumber, type Provider } from './admin-omnichannel-ui';

export type CoverageFilter =
  | 'all'
  | 'duplicate'
  | 'gap_rubika_not_bale'
  | 'gap_bale_not_rubika'
  | 'out_of_panel'
  | 'missing_reason';

export type CoverageCell = {
  state: 'live' | 'none' | 'withdrawn' | 'out_of_panel' | 'pending';
  liveCount: number;
  messageIds: string[];
  deliveryIds: string[];
  sentAtTehran: string | null;
  updatedAtTehran: string | null;
  link: string | null;
  duplicateOf: string[];
  absenceReason: string | null;
  missingKind: 'never' | 'deleted_remotely' | null;
};

export type CoverageDestinationMeta = {
  destinationId: string;
  provider: string;
  channel?: string | null;
  displayName?: string | null;
};

export type CoverageRow = {
  productId: string;
  sku: string;
  name: string;
  thumbnailUrl: string | null;
  cells: Record<string, CoverageCell>;
  flags: { duplicate: boolean; outOfPanel: boolean; missingReason: boolean };
};

export type CoverageSummary = {
  telegramLive: number;
  rubikaLive: number;
  baleLive: number;
  duplicateProducts: number;
  gapRubikaNotBale: number;
  gapBaleNotRubika: number;
  outOfPanel: number;
  missingReason: number;
};

export type CoverageListPayload = {
  page: number;
  limit: number;
  total: number;
  summary: CoverageSummary;
  destinations: CoverageDestinationMeta[];
  rows: CoverageRow[];
};

const FILTERS: Array<{ id: CoverageFilter; label: string }> = [
  { id: 'all', label: 'همه' },
  { id: 'duplicate', label: 'تکراری' },
  { id: 'gap_rubika_not_bale', label: 'روبیکا هست، بله نیست' },
  { id: 'gap_bale_not_rubika', label: 'بله هست، روبیکا نیست' },
  { id: 'out_of_panel', label: 'خارج از پنل' },
  { id: 'missing_reason', label: 'بدون دلیل' },
];

const COLUMN_ORDER: Provider[] = ['TELEGRAM', 'RUBIKA', 'BALE'];

export function primaryDestByProvider(
  destinations: CoverageDestinationMeta[],
): Partial<Record<Provider, CoverageDestinationMeta>> {
  const out: Partial<Record<Provider, CoverageDestinationMeta>> = {};
  for (const dest of destinations) {
    const p = String(dest.provider || '').toUpperCase() as Provider;
    if (!COLUMN_ORDER.includes(p)) continue;
    if (!out[p]) out[p] = dest;
  }
  return out;
}

export function cellTone(cell: CoverageCell | null | undefined, unknown = false): 'ok' | 'warn' | 'danger' | 'off' | 'info' {
  if (unknown || !cell) return 'info';
  if (cell.liveCount > 1) return 'danger';
  if (cell.state === 'out_of_panel') return 'danger';
  if (cell.state === 'live') return 'ok';
  if (cell.state === 'pending') return 'warn';
  if (cell.state === 'withdrawn') return 'off';
  return 'off';
}

export function cellLabel(cell: CoverageCell | null | undefined, unknown = false): string {
  if (unknown || !cell) return 'نامعلوم';
  if (cell.liveCount > 1) return `تکراری ×${faNumber(cell.liveCount)}`;
  if (cell.state === 'out_of_panel') return 'خارج از پنل ⛔';
  if (cell.state === 'live') return 'زنده ✓';
  if (cell.state === 'pending') return 'در صف';
  if (cell.state === 'withdrawn') return cell.missingKind === 'deleted_remotely' ? 'حذف‌شده' : 'برداشته';
  return 'بدون پوشش';
}

type ApiClient = {
  get: <T>(path: string) => Promise<T>;
  put: <T>(path: string, body: unknown) => Promise<T>;
};

export type AdminOmnichannelCoverageProps = {
  apiClient: ApiClient;
  enabled: boolean;
  onOpenDeletePlan?: (deliveryId: string) => void | Promise<void>;
  onPublishProduct?: (productId: string) => void;
};

export function AdminOmnichannelCoverage({
  apiClient,
  enabled,
  onOpenDeletePlan,
  onPublishProduct,
}: AdminOmnichannelCoverageProps) {
  const [filter, setFilter] = useState<CoverageFilter>('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [data, setData] = useState<CoverageListPayload | null>(null);
  const [reasonFor, setReasonFor] = useState<{ productId: string; destinationId?: string | null; sku: string } | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
        filter,
      });
      if (q.trim()) params.set('q', q.trim());
      const res = await apiClient.get<CoverageListPayload>(`/omnichannel/coverage?${params}`);
      setData(res);
    } catch {
      setData(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [apiClient, enabled, filter, page, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo(
    () => primaryDestByProvider(data?.destinations || []),
    [data?.destinations],
  );

  if (!enabled) return null;

  async function saveReason() {
    if (!reasonFor || !reasonText.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      await apiClient.put(`/omnichannel/coverage/${reasonFor.productId}/absence-reason`, {
        destinationId: reasonFor.destinationId || null,
        reason: reasonText.trim(),
      });
      setReasonFor(null);
      setReasonText('');
      setNotice('دلیل ثبت شد');
      await load();
    } catch {
      setNotice('ثبت دلیل ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  const summary = data?.summary;
  const unknown = error || (!loading && !data);

  return (
    <div className="space-y-4" data-omni-coverage>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">پوشش و تکرار</h2>
          <p className="text-sm text-gray-500">محصول × تلگرام / روبیکا / بله — زمان‌ها به وقت تهران</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" disabled={loading} onClick={() => void load()}>
          تازه‌سازی
        </button>
      </div>

      {error && <Callout tone="danger">وضعیت نامعلوم — دریافت ماتریس پوشش ناموفق بود</Callout>}
      {notice && <Callout tone={notice.includes('ناموفق') ? 'danger' : 'ok'}>{notice}</Callout>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm" data-omni-coverage-summary>
        <SummaryChip label="تلگرام" value={unknown ? null : summary?.telegramLive} />
        <SummaryChip label="روبیکا" value={unknown ? null : summary?.rubikaLive} />
        <SummaryChip label="بله" value={unknown ? null : summary?.baleLive} />
        <SummaryChip label="اختلاف بی‌دلیل" value={unknown ? null : summary?.missingReason} danger />
      </div>

      <div className="flex flex-wrap gap-2 items-center" role="toolbar" aria-label="فیلتر پوشش">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            data-omni-coverage-filter={f.id}
            className={`px-3 py-1 rounded-lg text-sm border ${filter === f.id ? 'bg-white border-gray-400 font-medium shadow-sm' : 'bg-gray-50 border-transparent text-gray-600'}`}
            onClick={() => { setFilter(f.id); setPage(1); }}
          >
            {f.label}
            {f.id === 'duplicate' && summary && summary.duplicateProducts > 0 && (
              <span className="mr-1 text-red-600">({faNumber(summary.duplicateProducts)})</span>
            )}
          </button>
        ))}
        <input
          className="input input-sm min-w-[10rem]"
          placeholder="جست‌وجوی SKU / نام"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); void load(); } }}
        />
      </div>

      {loading && !data && (
        <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-400 text-sm">
          در حال بارگذاری ماتریس…
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm" dir="rtl">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="sticky right-0 bg-gray-50 px-3 py-2 text-right font-medium min-w-[9rem]">SKU</th>
              {COLUMN_ORDER.map((provider) => (
                <th key={provider} className="px-3 py-2 text-right font-medium min-w-[8rem]">
                  {PROVIDER_META[provider].label}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">اقدام</th>
            </tr>
          </thead>
          <tbody>
            {(data?.rows || []).map((row) => (
              <tr key={row.productId} className="border-t border-gray-100 align-top">
                <td className="sticky right-0 bg-white px-3 py-2">
                  <div className="font-medium text-gray-900">{row.sku}</div>
                  <div className="text-xs text-gray-500 line-clamp-1">{row.name}</div>
                  {row.flags.duplicate && (
                    <span data-omni-coverage-dup-badge className="mt-1 inline-block">
                      <Badge tone="danger">تکراری</Badge>
                    </span>
                  )}
                  {row.flags.outOfPanel && <Badge tone="danger">خارج از پنل</Badge>}
                </td>
                {COLUMN_ORDER.map((provider) => {
                  const dest = columns[provider];
                  const cell = dest ? row.cells[dest.destinationId] : null;
                  const tone = cellTone(cell, unknown);
                  return (
                    <td key={provider} className="px-3 py-2">
                      <Badge tone={tone}>{cellLabel(cell, unknown)}</Badge>
                      {cell?.sentAtTehran && (
                        <div className="mt-1 text-[11px] text-gray-500">{cell.sentAtTehran}</div>
                      )}
                      {cell?.messageIds?.length ? (
                        <div className="mt-1 text-[11px] text-gray-500 font-mono break-all">
                          {cell.messageIds.slice(0, 3).join(', ')}
                          {cell.messageIds.length > 3 ? '…' : ''}
                        </div>
                      ) : null}
                      {cell?.link && (
                        <a className="mt-1 block text-[11px] text-blue-600 underline" href={cell.link} target="_blank" rel="noreferrer">
                          لینک
                        </a>
                      )}
                      {cell?.absenceReason && (
                        <div className="mt-1 text-[11px] text-amber-700">دلیل: {cell.absenceReason}</div>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2 space-y-1">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm w-full"
                    onClick={() => {
                      setReasonFor({ productId: row.productId, sku: row.sku, destinationId: null });
                      setReasonText('');
                    }}
                  >
                    ثبت دلیل
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm w-full"
                    title="انتشار تکی کامل در PR-9"
                    disabled={!onPublishProduct}
                    onClick={() => onPublishProduct?.(row.productId)}
                  >
                    انتشار جدا
                  </button>
                  {row.flags.duplicate && (() => {
                    const firstDupDelivery = Object.values(row.cells)
                      .find((c) => c.liveCount > 1)?.deliveryIds?.[0];
                    return (
                      <button
                        type="button"
                        className="btn btn-sm w-full border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                        disabled={!firstDupDelivery || !onOpenDeletePlan}
                        onClick={() => firstDupDelivery && onOpenDeletePlan?.(firstDupDelivery)}
                      >
                        حذف نسخه‌های قدیمی
                      </button>
                    );
                  })()}
                </td>
              </tr>
            ))}
            {!loading && data && data.rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-400">ردیفی با این فیلتر نیست</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > data.limit && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>قبلی</button>
          <span>صفحه {faNumber(page)} از {faNumber(Math.ceil(data.total / data.limit) || 1)}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={page * data.limit >= data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            بعدی
          </button>
        </div>
      )}

      {reasonFor && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal>
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg space-y-3">
            <h3 className="font-semibold">ثبت دلیل عدم‌پوشش — {reasonFor.sku}</h3>
            <textarea
              className="input w-full min-h-[6rem]"
              maxLength={500}
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="مثلاً: کانال بله هنوز برای این دسته فعال نیست"
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setReasonFor(null)}>انصراف</button>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy || !reasonText.trim()} onClick={() => void saveReason()}>
                ذخیره
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryChip({ label, value, danger }: { label: string; value: number | null | undefined; danger?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${danger ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-semibold text-gray-900">{value == null ? 'نامعلوم' : faNumber(value)}</div>
    </div>
  );
}

export function CoverageUnknownFallback(): ReactNode {
  return <Callout tone="danger">وضعیت نامعلوم</Callout>;
}
