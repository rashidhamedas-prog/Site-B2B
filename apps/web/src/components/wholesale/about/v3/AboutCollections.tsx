import Image from 'next/image';
import Link from 'next/link';

const CAPTION = 'تصویرسازی حال‌وهوا؛ محصول واقعی در صفحهٔ دسته';

const COLLECTIONS = [
  {
    title: 'کاپشن و لباس زمستانی',
    href: '/category/winter-wear',
    label: 'خرید عمده کاپشن و لباس زمستانی زنانه',
    src: '/about/v3/about-collection-winter.jpg',
    alt: 'تصویرسازی: مدل با کاپشن بلند سبز لایکودوزی‌شده با طرح دوخت هندسی',
  },
  {
    title: 'کالکشن پاییزی',
    href: '/category/autumn',
    label: 'خرید عمده کالکشن پاییزی لباس زنانه',
    src: '/about/v3/about-collection-autumn.jpg',
    alt: 'تصویرسازی: مدل با شومیز کرم کمربنددار و شلوار زیتونی',
  },
  {
    title: 'بامبر و کاپشن بامبری',
    href: '/category/bamber',
    label: 'خرید عمده بامبر و کاپشن بامبری زنانه',
    src: '/about/v3/about-collection-bamber.jpg',
    alt: 'تصویرسازی: مدل با بامبر کوتاه سبز با کش مچ و کمر',
  },
] as const;

/** S4 — native horizontal scroll-snap rail. */
export function AboutCollections() {
  return (
    <section className="av3-section av3-wrap" id="collections" aria-labelledby="about-s4">
      <p className="av3-eyebrow">کالکشن‌ها</p>
      <h2 id="about-s4" className="reveal">
        کالکشن‌های عمدهٔ پاییز و زمستان ترنم
      </h2>
      <p className="av3-body reveal">
        هر فصل مدل‌های جدید به بازار عرضه می‌شود. مدل‌های پاییز و زمستان را در این سه دسته ببینید؛
        تابستان، تمرکز ما روی مانتو شومیزی لینن است.
      </p>
      <ul className="av3-rail" tabIndex={0} aria-label="کالکشن‌ها، به افقی اسکرول کنید" data-about-rail="">
        {COLLECTIONS.map((item) => (
          <li key={item.href} className="av3-card">
            <figure>
              <Image
                src={item.src}
                alt={item.alt}
                width={1200}
                height={1600}
                sizes="(min-width:1024px) 30vw, (min-width:768px) 45vw, 85vw"
                quality={75}
                loading="lazy"
                className="av3-img av3-card-img"
              />
              <figcaption className="av3-caption">{CAPTION}</figcaption>
            </figure>
            <h3>{item.title}</h3>
            <Link className="av3-link" href={item.href} aria-label={`دیدن مدل‌ها؛ ${item.label}`}>
              دیدن مدل‌ها
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
