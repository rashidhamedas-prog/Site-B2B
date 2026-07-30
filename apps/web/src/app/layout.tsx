import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { headers } from 'next/headers';
import { CartProvider } from '@/lib/cart';
import { ToastProvider } from '@/components/shared/Toast';
import { FloatingContact } from '@/components/shared/FloatingContact';
import {
  GtmBodyNoscript,
  GtmHeadScript,
  resolveGtmIdForHost,
} from '@/components/shared/GoogleTagManager';
import { resolveGscVerification } from '@/lib/google-seo';
import './globals.css';

// All weights available; preload disabled so Next doesn't preload every file.
// Critical Regular + Bold are preloaded manually in <head>.
const vazirmatn = localFont({
  src: [
    { path: '../../public/fonts/Vazirmatn-Regular.woff2',   weight: '400', style: 'normal' },
    { path: '../../public/fonts/Vazirmatn-Medium.woff2',    weight: '500', style: 'normal' },
    { path: '../../public/fonts/Vazirmatn-SemiBold.woff2',  weight: '600', style: 'normal' },
    { path: '../../public/fonts/Vazirmatn-Bold.woff2',      weight: '700', style: 'normal' },
    { path: '../../public/fonts/Vazirmatn-ExtraBold.woff2', weight: '800', style: 'normal' },
  ],
  variable: '--font-vazirmatn',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  fallback: ['Tahoma', 'Arial', 'sans-serif'],
});

export async function generateMetadata(): Promise<Metadata> {
  const google = await resolveGscVerification();
  return {
    metadataBase: new URL('https://poshaktaranom.com'),
    title: {
      default: 'پوشاک ترنم | تولیدی مانتو زنانه مشهد',
      template: '%s | پوشاک ترنم',
    },
    description:
      'از کارگاه خودمان در مشهد مانتو و شومیز لینن و کتان می‌دوزیم و عمده می‌فرستیم برای بوتیک‌ها و فروشنده‌ها در سراسر ایران.',
    keywords: [
      'مانتو زنانه',
      'مانتو لینن',
      'فروش عمده مانتو',
      'تولیدی مانتو مشهد',
      'پوشاک ترنم',
    ],
    authors: [{ name: 'پوشاک ترنم', url: 'https://poshaktaranom.com' }],
    creator: 'پوشاک ترنم',
    publisher: 'پوشاک ترنم',
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large' },
    },
    openGraph: {
      type: 'website',
      locale: 'fa_IR',
      url: 'https://poshaktaranom.com',
      siteName: 'پوشاک ترنم',
      title: 'پوشاک ترنم | تولیدی مانتو زنانه مشهد',
      description:
        'مانتو شومیزی لینن و کتان، دوخت داخل کارگاه خودمان — فروش عمده با حداقل سفارش منطقی به سراسر ایران.',
      images: [{ url: '/og-wholesale.jpg', width: 1200, height: 630, alt: 'پوشاک ترنم — تولیدی مانتو مشهد' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'پوشاک ترنم | تولیدی مانتو زنانه',
      description: 'فروش عمده مانتو و شومیز از کارگاه مشهد',
      images: ['/og-wholesale.jpg'],
    },
    ...(google ? { verification: { google } } : {}),
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#124035',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host');
  const gtmId = resolveGtmIdForHost(host);
  // Explicit <head> meta — Next metadata `verification` can be dropped when a
  // custom <head> is present; GSC needs this tag in the initial HTML head.
  const gsc = await resolveGscVerification();

  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <head>
        <link
          rel="preload"
          href="/fonts/Vazirmatn-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Vazirmatn-Bold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <GtmHeadScript gtmId={gtmId} />
        {gsc ? (
          <meta name="google-site-verification" content={gsc} />
        ) : null}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.svg" sizes="any" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="font-sans antialiased">
        <GtmBodyNoscript gtmId={gtmId} />
        <ToastProvider>
          <CartProvider>
            {children}
            <FloatingContact />
          </CartProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
