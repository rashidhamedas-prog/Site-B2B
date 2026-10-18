'use client';

import { useRef, useState } from 'react';
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';

type ImportSummary = {
  dryRun: boolean;
  applied: number;
  totalRows: number;
  matched: number;
  changed: number;
  skipped: number;
  errors: number;
  errorSamples?: Array<{ excelRow: number; sku: string; message: string }>;
  changeSamples?: Array<{
    excelRow: number;
    sku: string;
    before: {
      wholesalePrice: number;
      retailPrice: number | null;
    };
    after: {
      wholesalePrice: number;
      retailPrice: number | null;
    };
  }>;
};

function toman(irr: number | null | undefined): string {
  if (irr == null) return '—';
  return Math.round(Number(irr) / 10).toLocaleString('fa-IR');
}

export function AdminExcelPriceImport({ onApplied }: { onApplied?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'template' | 'preview' | 'apply' | null>(null);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);

  const downloadTemplate = async () => {
    setBusy('template');
    setError('');
    try {
      await apiClient.download('/products/admin/price-template.xlsx', 'taranom-price-template.xlsx');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'دانلود قالب ناموفق بود');
    } finally {
      setBusy(null);
    }
  };

  const runImport = async (dryRun: boolean) => {
    if (!file) {
      setError('ابتدا فایل اکسل را انتخاب کنید');
      return;
    }
    setBusy(dryRun ? 'preview' : 'apply');
    setError('');
    if (!dryRun) setResult(null);
    try {
      const data = await apiClient.uploadPriceImportExcel(file, dryRun);
      if (dryRun) {
        setPreview(data);
        setResult(null);
      } else {
        setResult(data);
        setPreview(data);
        onApplied?.();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'آپلود اکسل ناموفق بود');
    } finally {
      setBusy(null);
    }
  };

  const summary = result || preview;

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600">
          <FileSpreadsheet className="h-4 w-4 text-amber-700" />
          آپدیت قیمت اکسل
        </span>
        <button
          type="button"
          disabled={busy !== null}
          onClick={downloadTemplate}
          className="btn btn-sm btn-secondary inline-flex items-center gap-1.5"
        >
          {busy === 'template' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          قالب راهنما
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => {
            const next = e.target.files?.[0] || null;
            setFile(next);
            setPreview(null);
            setResult(null);
            setError('');
          }}
        />
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => inputRef.current?.click()}
          className="btn btn-sm btn-secondary inline-flex items-center gap-1.5"
        >
          <Upload className="h-3.5 w-3.5" />
          {file ? 'تغییر فایل' : 'انتخاب فایل'}
        </button>
        <button
          type="button"
          disabled={busy !== null || !file}
          onClick={() => runImport(true)}
          className="btn btn-sm btn-secondary inline-flex items-center gap-1.5"
        >
          {busy === 'preview' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          پیش‌نمایش
        </button>
        <button
          type="button"
          disabled={busy !== null || !file || !preview || preview.changed < 1}
          onClick={() => runImport(false)}
          className={cn('btn btn-sm inline-flex items-center gap-1.5', 'btn-primary')}
          title={
            !preview?.changed
              ? 'ابتدا پیش‌نمایش بگیرید؛ ردیف معتبر برای تغییر لازم است'
              : preview.errors
                ? 'ردیف‌های خطادار رد می‌شوند؛ فقط ردیف‌های معتبر اعمال می‌شوند'
                : 'اعمال تغییرات قیمت'
          }
        >
          {busy === 'apply' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          اعمال قیمت‌ها
        </button>
      </div>
      {file ? (
        <p className="text-xs text-gray-500">
          فایل: <span className="font-medium text-gray-700">{file.name}</span>
        </p>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {summary ? (
        <div className="w-full max-w-xl rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-gray-700">
          <p className="font-medium text-gray-900">
            {result ? 'اعمال شد' : 'پیش‌نمایش'} — ردیف {summary.totalRows.toLocaleString('fa-IR')}، تغییر{' '}
            {summary.changed.toLocaleString('fa-IR')}، رد{' '}
            {summary.errors.toLocaleString('fa-IR')}، بدون تغییر {summary.skipped.toLocaleString('fa-IR')}
            {result ? `، نوشته‌شده ${summary.applied.toLocaleString('fa-IR')}` : ''}
          </p>
          {summary.changeSamples?.length ? (
            <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto">
              {summary.changeSamples.slice(0, 8).map((c) => (
                <li key={`${c.excelRow}-${c.sku}`}>
                  ردیف {c.excelRow} · {c.sku}: عمده {toman(c.before.wholesalePrice)}→
                  {toman(c.after.wholesalePrice)} / تکی {toman(c.before.retailPrice)}→
                  {toman(c.after.retailPrice)}
                </li>
              ))}
            </ul>
          ) : null}
          {summary.errorSamples?.length ? (
            <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-red-700">
              {summary.errorSamples.slice(0, 12).map((e) => (
                <li key={`${e.excelRow}-${e.message}`}>{e.message}</li>
              ))}
            </ul>
          ) : null}
          {preview && preview.errors > 0 ? (
            <p className="mt-2 text-amber-900">
              ردیف‌های خطادار نوشته نمی‌شوند؛ فقط {preview.changed.toLocaleString('fa-IR')} تغییر معتبر اعمال
              می‌شود.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
