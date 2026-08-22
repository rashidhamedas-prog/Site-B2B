'use client';

import { useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';

type Channel = 'WHOLESALE' | 'RETAIL' | 'ALL';

const OPTIONS: Array<{ channel: Channel; label: string }> = [
  { channel: 'WHOLESALE', label: 'عمده' },
  { channel: 'RETAIL', label: 'تکی' },
  { channel: 'ALL', label: 'کامل' },
];

export function AdminExcelExportButtons({
  kind,
}: {
  kind: 'products' | 'categories';
}) {
  const [busy, setBusy] = useState<Channel | null>(null);
  const [error, setError] = useState('');

  const path =
    kind === 'products' ? '/products/admin/export.xlsx' : '/categories/admin/export.xlsx';
  const fallback =
    kind === 'products' ? 'taranom-products.xlsx' : 'taranom-categories.xlsx';

  const download = async (channel: Channel) => {
    setBusy(channel);
    setError('');
    try {
      await apiClient.download(`${path}?channel=${channel}`, fallback);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'دانلود اکسل ناموفق بود');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col items-stretch gap-1 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600">
          <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
          خروجی اکسل
        </span>
        {OPTIONS.map((opt) => (
          <button
            key={opt.channel}
            type="button"
            disabled={busy !== null}
            onClick={() => download(opt.channel)}
            className={cn(
              'btn btn-sm inline-flex items-center gap-1.5',
              opt.channel === 'ALL' ? 'btn-primary' : 'btn-secondary',
            )}
          >
            {busy === opt.channel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {opt.label}
          </button>
        ))}
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
