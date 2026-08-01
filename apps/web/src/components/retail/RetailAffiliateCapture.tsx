'use client';

import { useEffect } from 'react';

const TOROB_COOKIE = 'taranom_torob_clid';
const TOROB_COOKIE_DAYS = 7;

function setCookie(name: string, value: string, days: number) {
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function getCookie(name: string): string | undefined {
  const key = `${encodeURIComponent(name)}=`;
  const hit = document.cookie.split(';').map((s) => s.trim()).find((s) => s.startsWith(key));
  if (!hit) return undefined;
  try {
    return decodeURIComponent(hit.slice(key.length));
  } catch {
    return hit.slice(key.length);
  }
}

/**
 * Captures CPA / Torob click ids into sessionStorage (+ 7-day cookie for Torob).
 * Supported:
 *   ?torob_clid=...     → Torob attribution (cookie 7 days)
 *   ?aff=CLICK          → generic
 *   ?src=affer&aff=...  → affer|CLICK
 *   ?yn=... / ?yektanet=...
 *   ?affer=... / ?afsona=... / ?takhfifan=... / ?tf=...
 */
export function RetailAffiliateCapture() {
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const srcHint = (q.get('src') || q.get('utm_source') || '').toLowerCase();

      const torobClid = (q.get('torob_clid') || q.get('torobClid') || '').trim();
      if (torobClid) {
        sessionStorage.setItem('taranom_torob_clid', torobClid);
        setCookie(TOROB_COOKIE, torobClid, TOROB_COOKIE_DAYS);
        // Also keep in generic aff bag for postbacks / admin visibility
        sessionStorage.setItem('taranom_aff', `torob|${torobClid}`);
      }

      const pairs: Array<[string, string | null]> = [
        ['yektanet', q.get('yn') || q.get('yektanet')],
        ['affer', q.get('affer')],
        ['afsona', q.get('afsona')],
        ['takhfifan', q.get('takhfifan') || q.get('tf')],
        ['generic', q.get('aff') || q.get('click_id') || q.get('clickId')],
      ];

      for (const [network, click] of pairs) {
        if (!click?.trim()) continue;
        let net = network;
        if (network === 'generic' && srcHint) {
          if (srcHint.includes('yektanet')) net = 'yektanet';
          else if (srcHint.includes('affer')) net = 'affer';
          else if (srcHint.includes('afsona')) net = 'afsona';
          else if (srcHint.includes('takhfifan')) net = 'takhfifan';
          else if (srcHint.includes('torob')) net = 'torob';
        }
        const value = net === 'generic' ? click.trim() : `${net}|${click.trim()}`;
        sessionStorage.setItem('taranom_aff', value);
        break;
      }
    } catch {
      /* ignore */
    }
  }, []);

  return null;
}

/** Read Torob click id for checkout (session first, then 7-day cookie). */
export function readTorobClid(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const fromSession = sessionStorage.getItem('taranom_torob_clid')?.trim();
    if (fromSession) return fromSession;
    return getCookie(TOROB_COOKIE)?.trim() || undefined;
  } catch {
    return undefined;
  }
}
