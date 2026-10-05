'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui';
import {
  CATALOG_SEARCH_DEBOUNCE_MS,
  CATALOG_SEARCH_MAX,
  nextCatalogSearchCommit,
  reconcileCatalogSearchDraft,
} from '@/lib/admin-catalog-search';

export function AdminCatalogSearch({
  urlQ,
  refreshing,
  onCommit,
}: {
  urlQ: string;
  refreshing?: boolean;
  onCommit: (q: string) => void;
}) {
  const [draft, setDraft] = useState(urlQ);
  const draftRef = useRef(urlQ);
  const focusedRef = useRef(false);
  const composingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlQRef = useRef(urlQ);
  const onCommitRef = useRef(onCommit);
  urlQRef.current = urlQ;
  onCommitRef.current = onCommit;

  const remember = (value: string) => {
    draftRef.current = value;
    setDraft(value);
  };

  useEffect(() => {
    setDraft((current) => {
      const next = reconcileCatalogSearchDraft(current, urlQ, focusedRef.current);
      draftRef.current = next;
      return next;
    });
  }, [urlQ]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const schedule = (value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const next = nextCatalogSearchCommit(value, urlQRef.current, false);
      if (next === null) return;
      onCommitRef.current(next);
    }, CATALOG_SEARCH_DEBOUNCE_MS);
  };

  const flush = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const next = nextCatalogSearchCommit(draftRef.current, urlQRef.current, false);
    if (next === null) return;
    onCommitRef.current(next);
  };

  return (
    <div className="w-72">
      <Input
        id="admin-product-search"
        type="search"
        placeholder="جستجو نام، SKU، پارچه..."
        value={draft}
        maxLength={CATALOG_SEARCH_MAX}
        autoComplete="off"
        spellCheck={false}
        aria-label="جستجو نام، SKU یا جنس پارچه"
        aria-busy={refreshing || undefined}
        rightIcon={<Search className="h-4 w-4" />}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          flush();
        }}
        onCompositionStart={() => {
          composingRef.current = true;
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
        }}
        onCompositionEnd={(e) => {
          composingRef.current = false;
          const value = e.currentTarget.value;
          remember(value);
          schedule(value);
        }}
        onChange={(e) => {
          const value = e.target.value;
          remember(value);
          const native = e.nativeEvent;
          const ime =
            composingRef.current ||
            ('isComposing' in native && Boolean((native as InputEvent).isComposing));
          if (ime) return;
          schedule(value);
        }}
      />
    </div>
  );
}
