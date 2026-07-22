import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { FloatingContact } from '@/components/shared/FloatingContact';
import { ScrollToTop } from '@/components/shared/ScrollToTop';
import { ThemeRuntime } from '@/components/wholesale/ThemeRuntime';

export default function WholesaleLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeRuntime />
      <Header />
      <main>{children}</main>
      <Footer />
      <FloatingContact />
      <ScrollToTop />
    </>
  );
}
