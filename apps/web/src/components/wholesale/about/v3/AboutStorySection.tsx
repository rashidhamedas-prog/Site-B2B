import Image from 'next/image';
import Link from 'next/link';
import { FOUNDED_FA, TEAM_FA } from './about-v3-facts';

/** S1 */
export function AboutStorySection() {
  return (
    <section className="av3-section av3-wrap" aria-labelledby="about-s1" data-about-story="">
      <p className="av3-eyebrow">داستان ما</p>
      <h2 id="about-s1" className="reveal">
        داستان ترنم: تولیدی‌ای که از {FOUNDED_FA} در مشهد از صفر ساخته شد
      </h2>
      <div className="av3-story-grid">
        <div className="av3-body">
          <p>
            پوشاک ترنم در سال {FOUNDED_FA} توسط حامد رشید از صفر پایه‌گذاری شد. با بیش از ۱۰ سال تجربه
            در بازاریابی و مدیریت فروش پوشاک، حامد تصمیم گرفت تولیدی خودش را راه‌اندازی کند که بر
            کیفیت پارچه و طراحی مدرن تمرکز داشته باشد.
          </p>
          <p>
            تخصص ما مانتو شومیزی زنانه اسپرت از جنس لینن و کتان است؛ پارچه‌هایی که تهویهٔ مناسب
            دارند، سبک‌اند و برای آب‌وهوای ایران مناسب هستند. امروز با تیمی {TEAM_FA} نفره، هر فصل
            مدل‌های جدید را به بازار عرضه می‌کنیم.
          </p>
          <p>
            <Link className="av3-link" href="/about/hamed-rashid">
              آشنایی با حامد رشید، بنیان‌گذار ترنم
            </Link>
          </p>
        </div>
        <figure>
          <Image
            src="/about/v3/about-story.jpg"
            alt="تصویرسازی: دو خیاط زن در حال برش پارچه و دوخت با چرخ صنعتی"
            width={1600}
            height={2000}
            sizes="(min-width:1024px) 40vw, 100vw"
            quality={75}
            loading="lazy"
            className="av3-img av3-story-img"
          />
          <figcaption className="av3-caption">تصویرسازی؛ عکس واقعی کارگاه یا تیم نیست</figcaption>
        </figure>
      </div>
    </section>
  );
}
