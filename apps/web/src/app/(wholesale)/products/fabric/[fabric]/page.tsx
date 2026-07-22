import type { Metadata } from 'next';
import { ProductCatalog } from '@/components/wholesale/ProductCatalog';
import { redirect } from 'next/navigation';

const FABRIC_SLUGS: Record<string, string> = {
  linen: 'لینن',
  cotton: 'کتان',
  mazerati: 'مازاراتی',
  shawl: 'شال',
  memory: 'مموری',
  wool: 'پشمی',
  footer: 'فوتر',
  'linen-cotton': 'لینن‌کتان',
  viscose: 'ویسکوز',
  'لینن': 'لینن',
  'کتان': 'کتان',
};

type Props = { params: Promise<{ fabric: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { fabric: slug } = await params;
  const fabric = FABRIC_SLUGS[decodeURIComponent(slug)] ?? decodeURIComponent(slug);
  const title = `شومیزی زنانه ${fabric} — خرید عمده | پوشاک ترنم مشهد`;
  const description = `عمده‌فروشی شومیزی و مانتو ${fabric} مستقیم از تولیدی ترنم در مشهد. فیلتر پارچه ${fabric}.`;
  return {
    title,
    description,
    alternates: {
      canonical: `https://poshaktaranom.com/products/fabric/${encodeURIComponent(slug)}`,
    },
  };
}

export default async function FabricFilterPage({ params }: Props) {
  const { fabric: slug } = await params;
  const fabric = FABRIC_SLUGS[decodeURIComponent(slug)];
  if (!fabric && !slug) redirect('/products');
  const value = fabric ?? decodeURIComponent(slug);
  return <ProductCatalog searchParams={{ fabric: value }} />;
}
