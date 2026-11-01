import Image from 'next/image';
import { toPersianDigits } from '@taranom/persian-utils';
import { AboutProcessMotion } from './AboutProcessMotion';
import { TEAM_FA } from './about-v3-facts';

const CAPTION = 'تصویرسازی فرایند، نه عکس کارگاه';

const STEPS = [
  {
    title: 'انتخاب پارچه',
    body: 'هر مدل از بررسی پارچهٔ فصل شروع می‌شود؛ لینن و کتان در تابستان، دورس و کتون و مموری در پاییز و زمستان. پارچه‌ای که فرم ویترین را نگه دارد و برای کار روزانهٔ بوتیک مناسب باشد. طاقهٔ خام روی میز برش، نقطهٔ آغاز همکاری با فروشنده است.',
    src: '/about/v3/about-process-1-fabric.jpg',
    alt: 'تصویرسازی: انتخاب توپ‌های پارچهٔ سبز و کرم روی میز چوبی',
  },
  {
    title: 'الگو و برش',
    body: 'الگو در کارگاه مشهد روی پارچه می‌نشیند و برش داخل مجموعه انجام می‌شود. هدف، سایزبندی منظم و جزئیاتی است که روی مانکن فروشگاه خوانا بماند؛ نه دوخت نمایشی جدا از خط تولید.',
    src: '/about/v3/about-process-2-cutting.jpg',
    alt: 'تصویرسازی: برش پارچهٔ کرم روی الگوی کاغذی با قیچی خیاطی',
  },
  {
    title: 'دوخت',
    body: `تیم ${TEAM_FA} نفرهٔ تولید، قطعه‌ها را با دوخت صنعتی به هم می‌رساند. فاصلهٔ کوتاه کارگاه تا دفتر پخش کمک می‌کند فروشنده مدل را با اطمینان به ویترین ببرد.`,
    src: '/about/v3/about-process-3-sewing.jpg',
    alt: 'تصویرسازی: دوخت پارچهٔ لینن سبز با چرخ خیاطی صنعتی',
  },
  {
    title: 'کنترل کیفیت',
    body: 'کنترل کیفیت داخل کارگاه خودمان انجام می‌شود؛ هر کار پیش از بسته‌بندی بررسی می‌شود و بعد به دفتر پخش محدودهٔ ۱۷ شهریور، پاساژ کیمیا می‌رسد.',
    src: '/about/v3/about-process-4-qc.jpg',
    alt: 'تصویرسازی: بررسی دوخت و دکمهٔ مانتوی لینن کرم روی چوب‌لباسی',
  },
] as const;

/** S2 — desktop: sticky header column; GSAP crossfade is progressive enhancement only. */
export function AboutProcess() {
  return (
    <section className="av3-section av3-dark" id="process" aria-labelledby="about-s2" data-about-process="">
      <div className="av3-wrap av3-process-grid">
        <header className="av3-process-head">
          <p className="av3-eyebrow">کارگاه مشهد</p>
          <h2 id="about-s2">مراحل تولید در کارگاه مشهد: از طاقهٔ پارچه تا مانتوی آمادهٔ ویترین</h2>
        </header>
        <ol className="av3-steps">
          {STEPS.map((step, index) => (
            <li key={step.src} className="av3-step" data-about-step="">
              <figure>
                <Image
                  src={step.src}
                  alt={step.alt}
                  width={1600}
                  height={2000}
                  sizes="(min-width:1024px) 45vw, 100vw"
                  quality={75}
                  loading="lazy"
                  className="av3-img av3-step-img"
                  data-about-step-img=""
                />
                <figcaption className="av3-caption">{CAPTION}</figcaption>
              </figure>
              <div>
                <span className="av3-num" aria-hidden="true">
                  {toPersianDigits(index + 1).padStart(2, '۰')}
                </span>
                <h3>{step.title}</h3>
                <p className="av3-body">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <AboutProcessMotion />
    </section>
  );
}
