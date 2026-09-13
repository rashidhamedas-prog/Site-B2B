import { metadataForCmsPage } from '@/lib/cms/fetch';
import { RETAIL_ORIGIN } from '@/lib/seo-origins';

export async function generateMetadata() {
  return metadataForCmsPage('RETAIL', 'returns', {
    title: 'مرجوعی و تعویض سایز',
    description:
      'اگر سایز جور نبود، از حساب کاربری درخواست تعویض یا مرجوعی ثبت کنید. شرایط شفاف، بدون حرف اضافه.',
    canonical: `${RETAIL_ORIGIN}/returns`,
  });
}

export default function RetailReturnsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
