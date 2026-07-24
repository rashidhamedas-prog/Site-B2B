'use client';

import { useEffect } from 'react';
import { apiClient } from '@/lib/api';

/** Injects Yektanet / Meta pixels when configured in admin marketing settings. */
export function RetailPixels() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await apiClient.get<{
          marketing?: { yektanetPixelId?: string; metaPixelId?: string };
        }>('/settings/public');
        if (cancelled) return;
        const yid = s.marketing?.yektanetPixelId?.trim();
        const mid = s.marketing?.metaPixelId?.trim();

        if (yid && !document.getElementById('yektanet-pixel')) {
          const s1 = document.createElement('script');
          s1.id = 'yektanet-pixel';
          s1.async = true;
          s1.src = `https://cdn.yektanet.com/rg_woebegone/core/${encodeURIComponent(yid)}.js`;
          document.head.appendChild(s1);
        }

        if (mid && !document.getElementById('meta-pixel')) {
          const s2 = document.createElement('script');
          s2.id = 'meta-pixel';
          s2.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');fbq('init','${mid.replace(/'/g, '')}');fbq('track','PageView');`;
          document.head.appendChild(s2);
        }
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
