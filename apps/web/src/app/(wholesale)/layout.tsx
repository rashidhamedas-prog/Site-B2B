import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { FloatingContact } from '@/components/shared/FloatingContact';
import { ScrollToTop } from '@/components/shared/ScrollToTop';

export default function WholesaleLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      <FloatingContact />
      <ScrollToTop />
    </>
  );
}
