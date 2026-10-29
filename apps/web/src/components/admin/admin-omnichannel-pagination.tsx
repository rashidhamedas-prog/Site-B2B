'use client';

import { faNumber } from './admin-omnichannel-ui';

export type ListPageMeta = {
  page: number;
  limit: number;
  total: number;
};

export function parseListPageResponse<T>(raw: unknown): { items: T[]; meta: ListPageMeta } {
  if (Array.isArray(raw)) {
    return {
      items: raw as T[],
      meta: { page: 1, limit: raw.length || 20, total: raw.length },
    };
  }
  if (raw && typeof raw === 'object') {
    const row = raw as { items?: T[]; page?: number; limit?: number; total?: number };
    const items = Array.isArray(row.items) ? row.items : [];
    return {
      items,
      meta: {
        page: Math.max(1, Number(row.page) || 1),
        limit: Math.max(1, Number(row.limit) || 20),
        total: Math.max(0, Number(row.total) || items.length),
      },
    };
  }
  return { items: [], meta: { page: 1, limit: 20, total: 0 } };
}

export function AdminOmnichannelPager({
  meta,
  onPage,
  disabled,
  label = 'صفحه',
}: {
  meta: ListPageMeta;
  onPage: (page: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(meta.total / Math.max(1, meta.limit)));
  if (meta.total <= meta.limit && meta.page <= 1) {
    return (
      <p className="text-[11px] text-gray-400 mt-2">
        {faNumber(meta.total)} مورد
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-600" aria-label={label}>
      <span>
        {faNumber(meta.total)} مورد · صفحه {faNumber(meta.page)} از {faNumber(totalPages)}
      </span>
      <button
        type="button"
        className="btn btn-secondary btn-sm cursor-pointer disabled:opacity-50"
        disabled={disabled || meta.page <= 1}
        onClick={() => onPage(meta.page - 1)}
      >
        قبلی
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm cursor-pointer disabled:opacity-50"
        disabled={disabled || meta.page >= totalPages}
        onClick={() => onPage(meta.page + 1)}
      >
        بعدی
      </button>
    </div>
  );
}
