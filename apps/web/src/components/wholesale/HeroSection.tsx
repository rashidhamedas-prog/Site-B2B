import Link from 'next/link';
import { Button } from '@/components/ui';
import { ArrowLeft } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative flex min-h-[88vh] items-end overflow-hidden bg-primary-dark text-white lg:min-h-[92vh]">
      {/* Full-bleed atmosphere */}
      <div className="absolute inset-0 bg-gradient-hero-soft" />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M0 40h80M40 0v80'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '80px 80px',
        }}
      />
      <div className="bg-grain absolute inset-0" />

      {/* Soft gold wash — atmospheric, not overlay badge */}
      <div className="pointer-events-none absolute -left-24 top-1/4 h-[28rem] w-[28rem] rounded-full bg-secondary/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-white/5 blur-3xl" />

      <div className="container-site relative z-10 pb-16 pt-28 sm:pb-20 lg:pb-28 lg:pt-32">
        <div className="max-w-3xl">
          <p className="reveal mb-5 text-sm font-semibold tracking-[0.18em] text-secondary">
            پوشاک ترنم
          </p>

          <h1 className="reveal reveal-delay-1 mb-6 text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl">
            مانتو زنانه
            <br />
            مستقیم از تولیدی
            <br />
            <span className="text-secondary">به بوتیک شما</span>
          </h1>

          <p className="reveal reveal-delay-2 mb-10 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
            تولیدکننده مانتو شومیزی لینن و کتان در مشهد — بیش از ده سال تجربه، فروش عمده به سراسر ایران.
          </p>

          <div className="reveal reveal-delay-3 flex flex-wrap gap-3 sm:gap-4">
            <Link href="/products" className="cursor-pointer">
              <Button
                size="lg"
                variant="secondary"
                leftIcon={<ArrowLeft className="h-5 w-5 rtl-flip" />}
              >
                مشاهده محصولات
              </Button>
            </Link>
            <Link href="/portal/register" className="cursor-pointer">
              <Button
                size="lg"
                variant="outline"
                className="border-white/40 text-white hover:border-white hover:bg-white hover:text-primary"
              >
                ثبت‌نام عمده‌فروش
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
