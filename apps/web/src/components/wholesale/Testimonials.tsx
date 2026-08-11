'use client';

import { useState } from 'react';
import { Star, ChevronRight, ChevronLeft, Quote } from 'lucide-react';
import { toPersianDigits } from '@taranom/persian-utils';
import { BUSINESS_FACTS, yearsOfOperationFa } from '@/lib/business-facts';

export interface TestimonialItem {
  id?: number | string;
  name: string;
  business?: string;
  city?: string;
  rating?: number;
  text: string;
  avatar?: string;
}

export function Testimonials({
  eyebrow = 'نظر مشتریان',
  headline = 'بوتیک‌داران چه می‌گویند',
  body = 'تجربه واقعی عمده‌فروشان سراسر ایران از همکاری با ترنم',
  items,
  footerStats,
}: {
  eyebrow?: string;
  headline?: string;
  body?: string;
  items?: TestimonialItem[];
  footerStats?: Array<{ value: string; label: string }>;
}) {
  const testimonials =
    items?.length
      ? items.map((t, i) => ({
          id: t.id ?? i,
          name: t.name,
          business: t.business ?? '',
          city: t.city ?? '',
          rating: t.rating ?? 5,
          text: t.text,
          avatar: t.avatar || t.name?.[0] || '·',
        }))
      : [
          {
            id: 1,
            name: 'فاطمه رضایی',
            business: 'بوتیک گلستان',
            city: 'تهران',
            rating: 5,
            text: 'بیش از ۳ سال است که از ترنم خرید می‌کنم. کیفیت پارچه و دوخت مانتوها فوق‌العاده است.',
            avatar: 'ف',
          },
        ];

  const stats =
    footerStats?.length
      ? footerStats
      : [
          { label: 'مشتری فعال', value: `+${toPersianDigits(BUSINESS_FACTS.activeCustomers)}` },
          { label: 'شهر در ایران', value: '+۳۰' },
          { label: 'سال تجربه', value: yearsOfOperationFa() },
          { label: 'مدل در کاتالوگ', value: `+${toPersianDigits(BUSINESS_FACTS.activeModels)}` },
        ];

  const [current, setCurrent] = useState(0);
  const prev = () => setCurrent((c) => (c - 1 + testimonials.length) % testimonials.length);
  const next = () => setCurrent((c) => (c + 1) % testimonials.length);

  const visible = [
    testimonials[current],
    testimonials[(current + 1) % testimonials.length],
    testimonials[(current + 2) % testimonials.length],
  ];

  return (
    <section className="section bg-white">
      <div className="container-site">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          {eyebrow ? (
            <p className="mb-3 text-sm font-semibold tracking-wide text-secondary-dark">{eyebrow}</p>
          ) : null}
          {headline ? <h2 className="section-title">{headline}</h2> : null}
          {body ? <p className="section-subtitle mx-auto mb-0">{body}</p> : null}
        </div>

        <div className="relative">
          <div className="hidden gap-6 md:grid md:grid-cols-3">
            {visible.map((t, i) => (
              <article
                key={`${t.id}-${i}`}
                className={`rounded-2xl border border-[color:var(--color-border)] bg-surface-page p-6 transition-all duration-250 ${
                  i === 1 ? 'border-primary/20 shadow-lg md:-translate-y-1' : 'opacity-90'
                }`}
              >
                <Quote className="mb-4 h-7 w-7 text-primary/25" />
                <p className="mb-6 line-clamp-4 text-sm leading-relaxed text-gray-600">{t.text}</p>
                <div className="flex items-center gap-3 border-t border-[color:var(--color-border)] pt-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary">
                    {t.avatar}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">{t.name}</p>
                    <p className="truncate text-xs text-gray-400">
                      {[t.business, t.city].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="mr-auto flex gap-0.5">
                    {Array.from({ length: t.rating }).map((_, idx) => (
                      <Star key={idx} className="h-3.5 w-3.5 fill-secondary text-secondary" />
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="md:hidden">
            <article className="rounded-2xl border border-[color:var(--color-border)] bg-surface-page p-6">
              <Quote className="mb-4 h-7 w-7 text-primary/25" />
              <p className="mb-6 text-sm leading-relaxed text-gray-600">{testimonials[current].text}</p>
              <div className="flex items-center gap-3 border-t border-[color:var(--color-border)] pt-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary">
                  {testimonials[current].avatar}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{testimonials[current].name}</p>
                  <p className="text-xs text-gray-400">
                    {[testimonials[current].business, testimonials[current].city]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </div>
            </article>
          </div>

          {testimonials.length > 1 ? (
            <div className="mt-10 flex items-center justify-center gap-4">
              <button
                onClick={prev}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[color:var(--color-border)] transition-colors duration-200 hover:border-primary hover:bg-primary hover:text-white"
                aria-label="قبلی"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="flex gap-2">
                {testimonials.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    className={`h-2 cursor-pointer rounded-full transition-all duration-250 ${
                      i === current ? 'w-7 bg-primary' : 'w-2 bg-gray-200 hover:bg-gray-300'
                    }`}
                    aria-label={`نظر ${i + 1}`}
                  />
                ))}
              </div>
              <button
                onClick={next}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[color:var(--color-border)] transition-colors duration-200 hover:border-primary hover:bg-primary hover:text-white"
                aria-label="بعدی"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>

        {stats.length > 0 ? (
          <div className="mt-14 grid grid-cols-2 gap-6 border-t border-[color:var(--color-border)] pt-12 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-extrabold tracking-tight text-primary">{stat.value}</p>
                <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
