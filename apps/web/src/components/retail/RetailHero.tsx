'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';

export function RetailHero() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <section className="relative isolate overflow-hidden bg-[var(--retail-primary-dark)] text-white">
      {/* fabric-like textured green + gold flares (mockup) */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 40% 60% at 8% 40%, rgba(201,168,76,0.22), transparent 55%),
            radial-gradient(ellipse 35% 50% at 92% 55%, rgba(201,168,76,0.18), transparent 50%),
            linear-gradient(165deg, #0c271e 0%, #124035 42%, #1a4d3e 100%)
          `,
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        }}
        aria-hidden
      />

      <div
        className={`relative mx-auto grid min-h-[min(92vh,820px)] max-w-[1200px] items-end gap-8 px-4 pt-10 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-6 lg:px-8 lg:pt-6 transition-all duration-700 ${
          ready ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Text — right in RTL */}
        <div className="order-2 pb-12 text-center lg:order-1 lg:pb-20 lg:text-right">
          <div className="mb-5 flex items-center justify-center gap-3 lg:justify-start">
            <span className="retail-gold-line" />
            <span className="text-sm font-medium text-[var(--retail-gold)]">زیبایی در هارمونی با شما</span>
            <span className="retail-gold-line" />
            <svg className="h-4 w-4 text-[var(--retail-gold)]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2l1.2 4.5L18 8l-4.2 1.8L12 14l-1.8-4.2L6 8l4.8-1.5L12 2z" />
            </svg>
          </div>

          <h1 className="text-[clamp(1.85rem,4.2vw,3.15rem)] font-extrabold leading-[1.45] tracking-tight">
            استایل شما، امضای{' '}
            <span className="text-[var(--retail-gold)]">ترنم</span>
          </h1>

          <p className="mx-auto mt-5 max-w-md text-[15px] leading-8 text-white/75 lg:mx-0">
            کالکشن جدید مانتو و شومیز زنانه — دوخت تولیدی، پارچه‌های لینن و کتان، ارسال سریع به سراسر ایران.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link
              href="/retail/products"
              className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-gradient-to-l from-[#A88530] to-[var(--retail-gold)] px-6 py-3 text-sm font-extrabold text-[#1a1a1a] shadow-lg transition hover:brightness-105"
            >
              مشاهده جدیدترین‌ها
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link
              href="/retail/collections"
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[var(--retail-gold)]/70 bg-[var(--retail-primary-dark)]/40 px-6 py-3 text-sm font-bold text-[var(--retail-gold)] transition hover:bg-white/5"
            >
              مشاهده مجموعه
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Model — left in RTL = second column visually on left in LTR grid... 
            In RTL grid, first column is on the right. So order-1 text is right, order-2 image is left. Good. */}
        <div className="order-1 relative mx-auto flex h-[min(58vh,560px)] w-full max-w-md items-end justify-center lg:order-2 lg:mx-0 lg:h-[min(86vh,760px)] lg:max-w-none">
          <div className="absolute bottom-0 h-[85%] w-[78%] rounded-[40%_40%_12%_12%/28%_28%_8%_8%] bg-[radial-gradient(circle_at_50%_30%,rgba(201,168,76,0.15),transparent_60%)]" aria-hidden />
          <Image
            src="/retail/hero-model.png"
            alt="مدل پوشاک ترنم"
            width={720}
            height={960}
            priority
            className="relative z-[1] h-full w-auto max-w-full object-contain object-bottom drop-shadow-[0_20px_40px_rgba(0,0,0,0.35)]"
          />
        </div>
      </div>
    </section>
  );
}
