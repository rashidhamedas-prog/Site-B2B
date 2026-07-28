/**
 * Official Google Tag Manager snippets for Next.js App Router.
 * Script goes in <head>; noscript iframe goes immediately after <body>.
 *
 * Defaults:
 * - wholesale (.com): GTM-M3LQFGZV
 * - retail (.ir): GTM-NKBCGQJV
 * Override via NEXT_PUBLIC_GTM_WHOLESALE_ID / NEXT_PUBLIC_GTM_RETAIL_ID.
 */

import { sanitizeGtmId } from '@/lib/google';
import { hostLooksRetail } from '@/lib/channel';

const DEFAULT_WHOLESALE_GTM = 'GTM-M3LQFGZV';
const DEFAULT_RETAIL_GTM = 'GTM-NKBCGQJV';

export function resolveGtmIdForHost(host: string | null): string {
  if (hostLooksRetail(host)) {
    return (
      sanitizeGtmId(process.env.NEXT_PUBLIC_GTM_RETAIL_ID) ||
      sanitizeGtmId(DEFAULT_RETAIL_GTM)
    );
  }
  return (
    sanitizeGtmId(process.env.NEXT_PUBLIC_GTM_WHOLESALE_ID) ||
    sanitizeGtmId(DEFAULT_WHOLESALE_GTM)
  );
}

/** Inline GTM bootstrap — place as first child inside <head>. */
export function GtmHeadScript({ gtmId }: { gtmId: string }) {
  const id = sanitizeGtmId(gtmId);
  if (!id) return null;
  return (
    <script
      id="gtm-head"
      dangerouslySetInnerHTML={{
        __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${id}');`,
      }}
    />
  );
}

/** GTM noscript iframe — place as first child inside <body>. */
export function GtmBodyNoscript({ gtmId }: { gtmId: string }) {
  const id = sanitizeGtmId(gtmId);
  if (!id) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${id}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
