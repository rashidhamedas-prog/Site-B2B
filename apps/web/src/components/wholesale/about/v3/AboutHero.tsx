import Link from 'next/link';
import { getImageProps } from 'next/image';
import { MIN_ORDER_FA } from './about-v3-facts';

export const ABOUT_H1 = 'درباره پوشاک ترنم؛ تولیدی مستقیم مانتو در مشهد';
export const ABOUT_LEAD = 'از کارگاه تا سفارش بوتیک';

const HERO_ALT =
  'تصویرسازی: طراح با مانتوی لینن سبز پارچهٔ لینن کرم را کنار پنجره بالا گرفته است';

/** S0 — the LCP. Art-directed with one `<picture>` so only one hero file downloads. */
export function AboutHero() {
  const common = { alt: HERO_ALT, sizes: '100vw', quality: 75, priority: true } as const;
  const {
    props: { srcSet: desktopSrcSet },
  } = getImageProps({ ...common, src: '/about/v3/about-hero-desktop.jpg', width: 2560, height: 1440 });
  const { props: mobile } = getImageProps({
    ...common,
    src: '/about/v3/about-hero-mobile.jpg',
    width: 1080,
    height: 1350,
  });

  return (
    <section className="av3-hero" aria-labelledby="about-h1">
      <picture>
        <source media="(min-width:768px)" srcSet={desktopSrcSet} sizes="100vw" />
        <img
          {...mobile}
          alt={HERO_ALT}
          fetchPriority="high"
          loading="eager"
          className="av3-hero-img"
          data-about-hero=""
        />
      </picture>
      <div className="av3-wrap">
        <div className="av3-hero-copy">
          <p className="av3-eyebrow">پوشاک ترنم مشهد · تولیدی</p>
          <h1 id="about-h1">{ABOUT_H1}</h1>
          <p className="av3-hero-sub">{ABOUT_LEAD}</p>
          <p className="av3-hero-lede">
            انتخاب پارچه، برش و دوخت در کارگاه مشهد انجام می‌شود و سفارش از دفتر پخش پاساژ کیمیا به
            بوتیک می‌رسد. حداقل سفارش هر مدل از {MIN_ORDER_FA} عدد است.
          </p>
          <div className="av3-row">
            <Link className="av3-btn" href="/wholesale">
              شرایط همکاری عمده با ترنم
            </Link>
            <Link className="av3-btn av3-btn-ghost" href="/products">
              کاتالوگ عمده مانتو و شومیز
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
