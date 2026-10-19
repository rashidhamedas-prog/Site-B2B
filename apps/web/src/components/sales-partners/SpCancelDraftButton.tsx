'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';

const CLOSABLE = new Set(['DRAFT', 'AWAITING_CUSTOMER_CONFIRMATION']);

export function canPartnerCloseDraft(status: string) {
  return CLOSABLE.has(status);
}

export function SpCancelDraftButton<T extends { id: string; status: string }>({
  draftId,
  status,
  onDone,
}: {
  draftId: string;
  status: string;
  onDone: (next: T) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!canPartnerCloseDraft(status)) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={busy}
        className="inline-flex min-h-11 items-center rounded-xl border border-stone-300 px-3 text-sm text-stone-800 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C]"
        onClick={() => {
          const ok = window.confirm(
            'این پیش‌سفارش لغو می‌شود و لینک مشتری باطل می‌شود. اگر مشتری همین حالا تأیید کند، لغو انجام نمی‌شود.',
          );
          if (!ok) return;
          setBusy(true);
          setError(null);
          apiClient
            .post<T>(`/sales-partners/order-drafts/${draftId}/cancel`, {})
            .then(onDone)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : 'لغو انجام نشد'))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? 'در حال لغو…' : 'لغو این پیش‌سفارش'}
      </button>
      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
