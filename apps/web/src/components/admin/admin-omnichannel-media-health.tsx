'use client';

/**
 * PR-11 Media Health tab («رسانه»).
 * Mounted only when status.mediaHealthUi / OMNICHANNEL_MEDIA_HEALTH_UI=true.
 * Scan never sends to messengers. Viewer: read-only (no scan button).
 */
import { useCallback, useEffect, useState } from 'react';
import { Badge, Callout, Section, faNumber } from './admin-omnichannel-ui';

export type MediaHealthIssue =
  | 'ok'
  | 'truncated'
  | 'undecodable'
  | 'oversized'
  | 'needs_replace'
  | 'unknown';

export type MediaHealthFinding = {
  mediaId: string | null;
  productId: string | null;
  sku: string | null;
  publicUrl: string;
  storageKey: string | null;
  issue: MediaHealthIssue;
  bytes: number;
  messageFa: string;
};

export type MediaHealthSummary = {
  startedAt: string | null;
  finishedAt: string | null;
  scanned: number;
  failed: number;
  actorId: string | null;
  topIssues: MediaHealthFinding[];
};

export type MediaHealthPayload = {
  summary: MediaHealthSummary;
  issues: MediaHealthFinding[];
  labels: Record<string, string>;
};

type ApiClient = {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
};

const ISSUE_FA: Record<string, string> = {
  truncated: 'JPEG ناقص (بدون EOI)',
  undecodable: 'غیرقابل‌خواندن',
  oversized: 'بزرگ‌تر از سقف کانال',
  needs_replace: 'نیاز به جایگزینی',
  ok: 'سالم',
  unknown: 'نامشخص',
};

export function mediaIssueLabelFa(issue: string | null | undefined, labels?: Record<string, string>): string {
  if (issue && labels?.[issue]) return labels[issue];
  return ISSUE_FA[String(issue || 'unknown')] || ISSUE_FA.unknown;
}

export function mediaIssueTone(issue: string | null | undefined): 'ok' | 'warn' | 'danger' | 'off' | 'info' {
  if (issue === 'ok') return 'ok';
  if (issue === 'truncated' || issue === 'undecodable') return 'danger';
  if (issue === 'oversized' || issue === 'needs_replace') return 'warn';
  return 'info';
}

export function productReplaceHref(productId: string | null | undefined): string | null {
  if (!productId) return null;
  return `/admin/products/${encodeURIComponent(productId)}`;
}

export function AdminOmnichannelMediaHealth(props: {
  apiClient: ApiClient;
  enabled: boolean;
  /** When false (VIEWER), hide scan / mark-replace actions. */
  canScan?: boolean;
  onNotice?: (msg: string) => void;
  onError?: (msg: string) => void;
}) {
  const { apiClient, enabled, canScan = true, onNotice, onError } = props;
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [payload, setPayload] = useState<MediaHealthPayload | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await apiClient.get<MediaHealthPayload>('/omnichannel/media/health');
      setPayload(data);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'خطا در بارگذاری سلامت رسانه');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [apiClient, enabled, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const runScan = async () => {
    if (!canScan) return;
    setScanning(true);
    try {
      const res = await apiClient.post<{
        findings: MediaHealthFinding[];
        nextCursor: string | null;
        summary: MediaHealthSummary;
      }>('/omnichannel/media/scan', { cursor: cursor || undefined, limit: 20 });
      setCursor(res.nextCursor);
      onNotice?.(
        res.nextCursor
          ? `اسکن شد: ${faNumber(res.findings.length)} مورد — ادامه با اسکن بعدی`
          : `اسکن کامل این صفحه: ${faNumber(res.findings.length)} مورد`,
      );
      await load();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'خطا در اسکن رسانه');
    } finally {
      setScanning(false);
    }
  };

  const markReplace = async (mediaId: string | null) => {
    if (!canScan || !mediaId) return;
    try {
      await apiClient.post(`/omnichannel/media/${mediaId}/mark-needs-replace`, {
        reason: 'operator_flag',
      });
      onNotice?.('برای جایگزینی علامت‌گذاری شد');
      await load();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'خطا در علامت‌گذاری');
    }
  };

  if (!enabled) return null;

  const issues = payload?.issues || [];
  const summary = payload?.summary;
  const neverScanned = !summary?.finishedAt && !summary?.scanned;

  return (
    <div className="space-y-4" data-omni-media-health>
      <Section
        title="سلامت رسانه"
        description="اسکن تصاویر رجیستری برای JPEG ناقص، غیرقابل‌خواندن یا بزرگ‌تر از سقف کانال (۱٫۸ مگابایت). ارسال به پیام‌رسان انجام نمی‌شود."
        actions={
          canScan ? (
            <button
              type="button"
              className="btn btn-primary btn-sm cursor-pointer"
              data-omni-media-scan
              disabled={scanning}
              onClick={() => void runScan()}
            >
              {scanning ? 'در حال اسکن…' : cursor ? 'ادامه اسکن' : 'شروع اسکن'}
            </button>
          ) : null
        }
      >
        {loading && (
          <div className="animate-pulse space-y-2" data-omni-media-health-skeleton>
            <div className="h-4 bg-gray-100 rounded w-2/3" />
            <div className="h-4 bg-gray-100 rounded w-1/2" />
            <div className="h-24 bg-gray-50 rounded" />
          </div>
        )}
        {!loading && neverScanned && (
          <Callout tone="info">هنوز اسکن نشده</Callout>
        )}
        {!loading && summary && !neverScanned && (
          <p className="text-sm text-gray-600">
            آخرین اسکن: {faNumber(summary.scanned)} بررسی‌شده · {faNumber(summary.failed)} مشکل‌دار
            {summary.finishedAt ? ` · ${new Date(summary.finishedAt).toLocaleString('fa-IR')}` : ''}
          </p>
        )}
      </Section>

      <Section title="یافته‌ها" description="اول تصاویر ناقص (کلاس ۵۰۴۷) نمایش داده می‌شوند.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-omni-media-findings>
            <thead>
              <tr className="text-xs text-gray-500">
                <th className="p-2 text-right font-medium">SKU / مالک</th>
                <th className="p-2 text-right font-medium">آدرس</th>
                <th className="p-2 text-right font-medium">وضعیت</th>
                <th className="p-2 text-right font-medium">اقدام</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((row) => {
                const href = productReplaceHref(row.productId);
                return (
                  <tr key={`${row.mediaId || row.publicUrl}-${row.issue}`} className="border-t">
                    <td className="p-2 font-mono text-xs">{row.sku || row.productId || '—'}</td>
                    <td className="p-2 font-mono text-xs break-all max-w-[16rem]" dir="ltr" title={row.publicUrl}>
                      {row.publicUrl}
                    </td>
                    <td className="p-2">
                      <Badge tone={mediaIssueTone(row.issue)}>
                        {mediaIssueLabelFa(row.issue, payload?.labels)}
                      </Badge>
                      {row.issue === 'truncated' && (
                        <span className="sr-only" data-omni-media-truncated>
                          JPEG ناقص
                        </span>
                      )}
                    </td>
                    <td className="p-2 space-x-2 space-x-reverse">
                      {href && (
                        <a
                          className="text-xs text-blue-700 underline cursor-pointer"
                          href={href}
                          data-omni-media-replace-link
                        >
                          جایگزینی تصویر
                        </a>
                      )}
                      {canScan && row.mediaId && row.issue !== 'needs_replace' && (
                        <button
                          type="button"
                          className="text-xs text-amber-800 underline cursor-pointer"
                          onClick={() => void markReplace(row.mediaId)}
                        >
                          علامت جایگزینی
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && issues.length === 0 && (
                <tr>
                  <td className="p-3 text-gray-400" colSpan={4}>
                    {neverScanned ? 'هنوز اسکن نشده' : 'مشکلی در فهرست نیست'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
