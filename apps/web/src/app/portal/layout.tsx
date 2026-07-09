import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'پنل مشتری | پوشاک ترنم', template: '%s | پنل مشتری ترنم' },
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
