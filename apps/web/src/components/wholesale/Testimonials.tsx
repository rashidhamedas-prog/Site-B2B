'use client';

import { useState } from 'react';
import { Star, ChevronRight, ChevronLeft, Quote } from 'lucide-react';

const testimonials = [
  {
    id: 1,
    name: 'فاطمه رضایی',
    business: 'بوتیک گلستان',
    city: 'تهران',
    rating: 5,
    text: 'بیش از ۳ سال است که از ترنم خرید می‌کنم. کیفیت پارچه و دوخت مانتوها فوق‌العاده است. مشتریانم همیشه از جنس و طرح‌ها راضی هستند. پشتیبانی سریع و ارسال به موقع هم از مزایای بزرگ این تولیدی است.',
    avatar: 'ف',
  },
  {
    id: 2,
    name: 'مریم احمدی',
    business: 'گالری پوشاک مریم',
    city: 'اصفهان',
    rating: 5,
    text: 'مانتوهای لینن ترنم در بوتیک ما بهترین فروش را دارند. طرح‌ها خاص و متفاوت هستند و رقبا نمی‌توانند پیدا کنند. سیستم آنلاین سفارش‌گیری هم خیلی راحت شده — دیگر نیازی به تلفن نیست.',
    avatar: 'م',
  },
  {
    id: 3,
    name: 'زهرا کریمی',
    business: 'پوشاک زیبا',
    city: 'مشهد',
    rating: 5,
    text: 'از وقتی با ترنم آشنا شدم، دیگر از جای دیگری خرید نمی‌کنم. قیمت مستقیم کارخانه، کیفیت درجه یک، و تنوع رنگ و سایز. ویزیتور حضوری هم هر ماه می‌آید و آخرین مدل‌ها را نشان می‌دهد.',
    avatar: 'ز',
  },
  {
    id: 4,
    name: 'سمیرا حسینی',
    business: 'بوتیک آناهیتا',
    city: 'شیراز',
    rating: 5,
    text: 'پنل مشتری خیلی کار ما را ساده کرده. فاکتور، وضعیت سفارش، سابقه خرید — همه در یک جا. مانتوهای کتان امسال خیلی خوب فروختند. حتما برای فصل پاییز هم سفارش می‌دهم.',
    avatar: 'س',
  },
  {
    id: 5,
    name: 'نگار محمدی',
    business: 'گالری مد نگار',
    city: 'تبریز',
    rating: 5,
    text: 'دوخت و کیفیت محصولات ترنم واقعاً ممتاز است. لینن‌هایشان خیلی راحت هستند و مشتریان بازار می‌آیند. قیمت‌گذاری منصفانه و تخفیف مشتریان دائمی هم خیلی خوب است.',
    avatar: 'ن',
  },
];

export function Testimonials() {
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
          <p className="mb-3 text-sm font-semibold tracking-wide text-secondary-dark">نظر مشتریان</p>
          <h2 className="section-title">بوتیک‌داران چه می‌گویند</h2>
          <p className="section-subtitle mx-auto mb-0">
            تجربه واقعی عمده‌فروشان سراسر ایران از همکاری با ترنم
          </p>
        </div>

        <div className="relative">
          <div className="hidden gap-6 md:grid md:grid-cols-3">
            {visible.map((t, i) => (
              <article
                key={t.id}
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
                      {t.business} · {t.city}
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
                    {testimonials[current].business} · {testimonials[current].city}
                  </p>
                </div>
                <div className="mr-auto flex gap-0.5">
                  {Array.from({ length: testimonials[current].rating }).map((_, idx) => (
                    <Star key={idx} className="h-3.5 w-3.5 fill-secondary text-secondary" />
                  ))}
                </div>
              </div>
            </article>
          </div>

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
        </div>

        <div className="mt-14 grid grid-cols-2 gap-6 border-t border-[color:var(--color-border)] pt-12 sm:grid-cols-4">
          {[
            { label: 'مشتری فعال', value: '+۲۰۰' },
            { label: 'شهر در ایران', value: '+۳۰' },
            { label: 'سال تجربه', value: '۱۰+' },
            { label: 'مدل در کاتالوگ', value: '+۵۰' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-extrabold tracking-tight text-primary">{stat.value}</p>
              <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
