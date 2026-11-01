import Image from 'next/image';
import Link from 'next/link';
/** S7 — `section#cta` is the only trigger of the /about dialog. */
export function AboutPlacesCta() {
  return (
    <section className="av3-section av3-dark" id="cta" aria-labelledby="about-s7">
      <div className="av3-wrap av3-cta-grid">
        <figure>
          <Image
            src="/about/v3/about-cta-showroom.jpg"
            alt="تصویرسازی: نمایندهٔ فروش رگال مانتو را به یک بوتیک‌دار نشان می‌دهد"
            width={1600}
            height={1200}
            sizes="(min-width:1024px) 50vw, 100vw"
            quality={75}
            loading="lazy"
            className="av3-img av3-cta-img"
          />
          <figcaption className="av3-caption">تصویرسازی؛ نشانی واقعی دفتر پخش در متن</figcaption>
        </figure>
        <div className="av3-body">
          <h2 id="about-s7">مکان‌های ترنم و شروع همکاری عمده</h2>
          <p>
            برای ساختن یک ویترین ماندگار آماده‌اید؟ دفتر پخش عمده در محدودهٔ میدان ۱۷ شهریور است؛
            بوتیک‌ها می‌توانند مدل‌ها را ببینند، سفارش ثبت کنند و ارسال را از همین نقطه پیگیری کنند.
            اینستاگرام: @toliditaranom
          </p>
          <p>
            <b>کارگاه تولید:</b> مشهد، بلوار نبوت، میدان عسگریه، خیابان قائمی، پلاک ۱۳۷؛ ملک ویلایی ۲۵۰
            متر، دو طبقه.
          </p>
          <p>
            <b>دفتر پخش:</b> مشهد، میدان ۱۷ شهریور، پاساژ کیمیا، طبقه منفی ۱، پلاک ۱۳۳
          </p>
          <p>بازدید از خط برش و دوخت با هماهنگی تیم فروش انجام می‌شود.</p>
          <div className="av3-row">
            <Link className="av3-btn av3-btn-ghost" href="/wholesale">
              شرایط همکاری عمده با ترنم
            </Link>
            <Link className="av3-btn av3-btn-ghost" href="/contact">
              تماس با تیم فروش ترنم
            </Link>
          </div>
          <p>
            <Link className="av3-link" href="/products">
              دیدن کاتالوگ عمده مانتو و شومیز
            </Link>
          </p>
          <p>
            <a className="av3-link" href="https://www.poshaktaranom.ir/">
              فروشگاه خرده‌فروشی پوشاک ترنم
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
