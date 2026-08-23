import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { CartProvider } from '@/lib/cart';
import { ToastProvider } from '@/components/shared/Toast';
import { DeferredGtm } from '@/components/shared/DeferredGtm';
import { resolveGscTokensForRootHead } from '@/lib/google-seo';
import './globals.css';

/** Public HTML can be ISR. User-specific routes (cart/checkout/account) stay dynamic via their own trees. */
export const revalidate = 60;

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
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#124035',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Do not call headers()/cookies() here — that forces every HTML route to
  // `Cache-Control: no-store` and blocks Home ISR. GTM resolves the host in
  // the browser; GSC tokens are emitted for both channels (dual-host app).
  const gscTokens = await resolveGscTokensForRootHead();

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
        <DeferredGtm />
        {gscTokens.map((token) => (
          <meta key={token} name="google-site-verification" content={token} />
        ))}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.svg" sizes="any" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="font-sans antialiased">
        <ToastProvider>
          <CartProvider>
            {children}
          </CartProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
