import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'مانتو و شومیز زنانه',
  description:
    'جدیدترین مانتو و شومیزهای ترنم را تکی ببینید و سفارش دهید — همان دوخت کارگاهی، برای خودتان.',
  alternates: { canonical: 'https://www.poshaktaranom.ir/products' },
  openGraph: {
    title: 'محصولات فروشگاه ترنم',
    description: 'خرید تکی مانتو لینن و کتان از تولیدی مشهد.',
    url: 'https://www.poshaktaranom.ir/products',
  },
};

export default function RetailProductsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
