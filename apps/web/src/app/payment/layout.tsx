import { headers } from 'next/headers';
import { GoogleAnalyticsProvider } from '@/components/shared/GoogleAnalyticsProvider';
import { hostLooksRetail } from '@/lib/channel';
import { PAYMENT_REFERRER_HOSTS } from '@/lib/google';

const ignoreReferrerScript = `(function(){try{var ref=document.referrer;if(!ref)return;var host=new URL(ref).hostname.toLowerCase();var ok=${JSON.stringify(PAYMENT_REFERRER_HOSTS)};if(ok.indexOf(host)<0)return;var meta=document.createElement('meta');meta.name='referrer';meta.content='no-referrer';document.head.appendChild(meta);window.dataLayer=window.dataLayer||[];if(typeof window.gtag!=='function'){window.gtag=function(){window.dataLayer.push(arguments)};}window.gtag('set','ignore_referrer',true);}catch(e){}})();`;

/**
 * Payment return only. Keeps the original session when the referrer is an approved gateway,
 * and binds the channel GA4 stream so the return page has a page_view (no empty landing page).
 */
export default async function PaymentLayout({ children }: { children: React.ReactNode }) {
  const host = (await headers()).get('host');
  const channel = hostLooksRetail(host) ? 'RETAIL' : 'WHOLESALE';
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: ignoreReferrerScript }} />
      {children}
      <GoogleAnalyticsProvider channel={channel} />
    </>
  );
}
