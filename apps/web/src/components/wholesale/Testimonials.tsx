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
    color: 'bg-pink-100 text-pink-700',
  },
  {
    id: 2,
    name: 'مریم احمدی',
    business: 'گالری پوشاک مریم',
    city: 'اصفهان',
    rating: 5,
    text: 'مانتوهای لینن ترنم در بوتیک ما بهترین فروش را دارند. طرح‌ها خاص و متفاوت هستند و رقبا نمی‌توانند پیدا کنند. سیستم آنلاین سفارش‌گیری هم خیلی راحت شده — دیگر نیازی به تلفن نیست.',
    avatar: 'م',
    color: 'bg-purple-100 text-purple-700',
  },
  {
    id: 3,
    name: 'زهرا کریمی',
    business: 'پوشاک زیبا',
    city: 'مشهد',
    rating: 5,
    text: 'از وقتی با ترنم آشنا شدم، دیگر از جای دیگری خرید نمی‌کنم. قیمت مستقیم کارخانه، کیفیت درجه یک، و تنوع رنگ و سایز. ویزیتور حضوری هم هر ماه می‌آید و آخرین مدل‌ها را نشان می‌دهد.',
    avatar: 'ز',
    color: 'bg-green-100 text-green-700',
  },
  {
    id: 4,
    name: 'سمیرا حسینی',
    business: 'بوتیک آناهیتا',
    city: 'شیراز',
    rating: 5,
    text: 'پنل مشتری خیلی کار ما را ساده کرده. فاکتور، وضعیت سفارش، سابقه خرید — همه در یک جا. مانتوهای کتان امسال خیلی خوب فروختند. حتما برای فصل پاییز هم سفارش می‌دهم.',
    avatar: 'س',
    color: 'bg-blue-100 text-blue-700',
  },
  {
    id: 5,
    name: 'نگار محمدی',
    business: 'گالری مد نگار',
    city: 'تبریز',
    rating: 5,
    text: 'دوخت و کیفیت محصولات ترنم واقعاً ممتاز است. لینن‌هایشان خیلی راحت هستند و مشتریان بازار می‌آیند. قیمت‌گذاری منصفانه و تخفیف مشتریان دائمی هم خیلی خوب است.',
    avatar: 'ن',
    color: 'bg-amber-100 text-amber-700',
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
        <div className="text-center mb-12">
          <h2 className="section-title">نظر مشتریان</h2>
          <p className="section-subtitle">بوتیک‌داران سراسر ایران درباره ترنم چه می‌گویند</p>
        </div>

        <div className="relative">
          {/* Desktop: 3 cards */}
          <div className="hidden md:grid grid-cols-3 gap-6">
            {visible.map((t, i) => (
              <div
                key={t.id}
                className={`card p-6 transition-all duration-300 ${i === 1 ? 'ring-2 ring-primary shadow-lg -translate-y-1' : 'opacity-80'}`}
              >
                <Quote className="h-8 w-8 text-primary/20 mb-3" />
                <p className="text-sm text-gray-600 leading-relaxed mb-5 line-clamp-4">{t.text}</p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${t.color}`}>
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.business} · {t.city}</p>
                  </div>
                  <div className="mr-auto flex gap-0.5">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-secondary text-secondary" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile: single card */}
          <div className="md:hidden">
            <div className="card p-6">
              <Quote className="h-8 w-8 text-primary/20 mb-3" />
              <p className="text-sm text-gray-600 leading-relaxed mb-5">{testimonials[current].text}</p>
              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${testimonials[current].color}`}>
                  {testimonials[current].avatar}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{testimonials[current].name}</p>
                  <p className="text-xs text-gray-400">{testimonials[current].business} · {testimonials[current].city}</p>
                </div>
                <div className="mr-auto flex gap-0.5">
                  {Array.from({ length: testimonials[current].rating }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-secondary text-secondary" />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={prev}
              className="h-9 w-9 rounded-full border border-gray-200 flex items-center justify-center hover:bg-primary hover:text-white hover:border-primary transition-colors"
              aria-label="قبلی"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="flex gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`h-2 rounded-full transition-all ${i === current ? 'w-6 bg-primary' : 'w-2 bg-gray-200'}`}
                  aria-label={`نظر ${i + 1}`}
                />
              ))}
            </div>

            <button
              onClick={next}
              className="h-9 w-9 rounded-full border border-gray-200 flex items-center justify-center hover:bg-primary hover:text-white hover:border-primary transition-colors"
              aria-label="بعدی"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Trust bar */}
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4 border-t border-gray-100 pt-10">
          {[
            { label: 'مشتری فعال', value: '+۲۰۰' },
            { label: 'شهر در ایران', value: '+۳۰' },
            { label: 'سال تجربه', value: '۱۰+' },
            { label: 'مدل در کاتالوگ', value: '+۵۰' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-extrabold text-primary">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
