'use client';

import { useEffect } from 'react';
import { apiClient } from '@/lib/api';

type MarketingPublic = {
  yektanetPixelId?: string;
  metaPixelId?: string;
  adroScriptUrl?: string;
  adroAccountId?: string;
  afferScriptUrl?: string;
  afsonaScriptUrl?: string;
  takhfifanScriptUrl?: string;
};

function appendScript(id: string, src: string) {
  if (document.getElementById(id) || !src) return;
  const el = document.createElement('script');
  el.id = id;
  el.async = true;
  el.src = src;
  document.head.appendChild(el);
}

function appendInline(id: string, code: string) {
  if (document.getElementById(id) || !code) return;
  const el = document.createElement('script');
  el.id = id;
  el.innerHTML = code;
  document.head.appendChild(el);
}

/**
 * Injects marketplace / affiliate / retargeting pixels into <head> for all retail pages.
 * IDs & script URLs come from admin Settings → پیکسل / افیلیت.
 */
export function RetailPixels() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await apiClient.get<{ marketing?: MarketingPublic }>('/settings/public');
        if (cancelled) return;
        const m = s.marketing ?? {};

        const yid = m.yektanetPixelId?.trim();
        if (yid) {
          appendScript('yektanet-pixel', `https://cdn.yektanet.com/rg_woebegone/core/${encodeURIComponent(yid)}.js`);
        }

        const mid = m.metaPixelId?.trim();
        if (mid) {
          appendInline(
            'meta-pixel',
            `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');fbq('init','${mid.replace(/'/g, '')}');fbq('track','PageView');`,
          );
        }

        // Adro retargeting — paste script URL from https://adro.co/advertisers panel into head.
        const adroSrc = m.adroScriptUrl?.trim();
        if (adroSrc) appendScript('adro-pixel', adroSrc);
        const adroAcc = m.adroAccountId?.trim();
        if (adroAcc && !document.getElementById('adro-account')) {
          appendInline(
            'adro-account',
            `window.__ADRO_ACCOUNT_ID__=${JSON.stringify(adroAcc)};`,
          );
        }

        if (m.afferScriptUrl?.trim()) appendScript('affer-pixel', m.afferScriptUrl.trim());
        if (m.afsonaScriptUrl?.trim()) appendScript('afsona-pixel', m.afsonaScriptUrl.trim());
        if (m.takhfifanScriptUrl?.trim()) appendScript('takhfifan-pixel', m.takhfifanScriptUrl.trim());
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
