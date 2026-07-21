import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { CartProvider } from '@/lib/cart';
import { ToastProvider } from '@/components/shared/Toast';
import { FloatingContact } from '@/components/shared/FloatingContact';
import { OrganizationJsonLd } from '@/components/shared/JsonLd';
import './globals.css';

// Only Regular + Bold are preloaded (above-the-fold critical weights).
// Other weights load on demand via font-display:swap.
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
  preload: true,
  adjustFontFallback: false,
  fallback: ['Tahoma', 'Arial', 'sans-serif'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://poshaktaranom.com'),
  title: {
    default: 'پوشاک ترنم | تولیدی مانتو زنانه مشهد',
    template: '%s | پوشاک ترنم',
  },
  description:
    'تولیدی پوشاک ترنم — تولیدکننده مانتو شومیزی زنانه لینن و کتان در مشهد. فروش عمده به سراسر ایران.',
  keywords: [
    'مانتو زنانه', 'مانتو لینن', 'مانتو کتان', 'فروش عمده مانتو',
    'تولیدی مانتو مشهد', 'پوشاک ترنم', 'مانتو شومیزی',
  ],
  authors: [{ name: 'پوشاک ترنم', url: 'https://poshaktaranom.com' }],
  creator: 'پوشاک ترنم',
  publisher: 'پوشاک ترنم',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1 },
  },
  openGraph: {
    type: 'website',
    locale: 'fa_IR',
    url: 'https://poshaktaranom.com',
    siteName: 'پوشاک ترنم',
    title: 'پوشاک ترنم | تولیدی مانتو زنانه مشهد',
    description: 'تولیدکننده مانتو شومیزی زنانه لینن و کتان در مشهد. فروش عمده به سراسر ایران.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'پوشاک ترنم' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'پوشاک ترنم | تولیدی مانتو زنانه',
    description: 'فروش عمده مانتو شومیزی زنانه لینن و کتان از مشهد',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#124035',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.svg" sizes="any" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="font-sans antialiased">
        <OrganizationJsonLd />
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
