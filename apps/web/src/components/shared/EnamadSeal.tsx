'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import {
  EMPTY_ENAMAD,
  enamadHasRenderable,
  normalizeEnamad,
  resolveEnamadAssets,
  type EnamadSealConfig,
} from '@/lib/enamad';

type Channel = 'WHOLESALE' | 'RETAIL';

/**
 * Renders Enamad trust seal for a channel.
 * Prefers structured <a><img> (Enamad-compliant referrerpolicy).
 * Falls back to admin HTML snippet only when id/code/image are missing.
 */
export function EnamadSeal({
  channel,
  className = '',
  size = 80,
  /** When provided (admin preview), skip network fetch. */
  config,
}: {
  channel?: Channel;
  className?: string;
  size?: number;
  config?: EnamadSealConfig | null;
}) {
  const [fetched, setFetched] = useState<EnamadSealConfig>(EMPTY_ENAMAD);
  const cfg = config ? normalizeEnamad(config) : fetched;

  useEffect(() => {
    if (config || !channel) return;
    let cancelled = false;
    apiClient
      .get<{
        business?: {
          enamadWholesale?: Partial<EnamadSealConfig>;
          enamadRetail?: Partial<EnamadSealConfig>;
        };
      }>(`/settings/public?channel=${channel}`)
      .then((s) => {
        if (cancelled) return;
        const raw =
          channel === 'RETAIL' ? s.business?.enamadRetail : s.business?.enamadWholesale;
        setFetched(normalizeEnamad(raw));
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [channel, config]);

  if (!enamadHasRenderable(cfg)) return null;

  const assets = resolveEnamadAssets(cfg);
  if (assets) {
    return (
      <a
        href={assets.href}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="origin"
        className={`inline-block leading-none ${className}`.trim()}
        aria-label="نماد اعتماد الکترونیکی"
        data-enamad={channel?.toLowerCase() || 'preview'}
      >
        {/* Enamad requires plain <img> with referrerpolicy — do not use next/image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={assets.src}
          alt="نماد اعتماد الکترونیکی"
          width={size}
          height={size}
          referrerPolicy="origin"
          style={{ cursor: 'pointer', width: size, height: 'auto', maxWidth: '100%' }}
          id={cfg.code || undefined}
        />
      </a>
    );
  }

  // Last resort: raw panel HTML (scripts will not run — Enamad seal is <a><img>)
  return (
    <div
      className={`enamad-html inline-block leading-none [&>a]:inline-block [&>a>img]:h-auto [&>a>img]:max-w-full ${className}`.trim()}
      style={{ ['--enamad-size' as string]: `${size}px` }}
      data-enamad={channel?.toLowerCase() || 'preview'}
      // Admin-only content from Enamad panel
      dangerouslySetInnerHTML={{ __html: cfg.htmlSnippet }}
    />
  );
}
