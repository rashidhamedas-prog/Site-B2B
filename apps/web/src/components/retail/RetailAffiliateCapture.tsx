'use client';

import { useEffect } from 'react';

/**
 * Captures CPA click ids from query string into sessionStorage.
 * Supported:
 *   ?aff=CLICK          → generic| or plain
 *   ?src=affer&aff=...  → affer|CLICK
 *   ?yn=... / ?yektanet=...
 *   ?affer=... / ?afsona=... / ?takhfifan=... / ?tf=...
 */
export function RetailAffiliateCapture() {
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const srcHint = (q.get('src') || q.get('utm_source') || '').toLowerCase();

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
