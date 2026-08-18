import { toPersianDigits } from '@taranom/persian-utils';
import styles from './about.module.css';

export const ABOUT_STAGES = [
  {
    title: 'انتخاب پارچه',
    body: 'هر مدل از بررسی لینن و کتان شروع می‌شود؛ پارچه‌هایی که سبک می‌مانند، فرم ویترین را نگه می‌دارند و برای کار روزانه بوتیک مناسب‌اند. طاقه خام روی میز برش، نقطه آغاز همکاری با فروشنده است.',
  },
  {
    title: 'طراحی و برش',
    body: 'الگو در کارگاه مشهد روی پارچه می‌نشیند و برش داخل مجموعه انجام می‌شود. هدف، سایزبندی منظم و جزئیاتی است که روی مانکن فروشگاه خوانا بماند؛ نه دوخت نمایشی جدا از خط تولید.',
  },
  {
    title: 'دوخت و کنترل کیفیت',
    body: 'قطعه‌ها به هم می‌رسند، دوخت صنعتی انجام می‌شود و پیش از بسته‌بندی کنترل می‌شود. این فاصله کوتاه بین کارگاه و دفتر پخش کمک می‌کند فروشنده مدل را با اطمینان به ویترین ببرد.',
  },
  {
    title: 'آماده برای فروش عمده',
    body: 'لباس از کارگاه به دفتر پخش محدوده ۱۷ شهریور، پاساژ کیمیا می‌رسد. از آنجا می‌توانید مدل را ببینید، سفارش عمده ثبت کنید و ارسال به سراسر ایران را پیگیری کنید.',
  },
] as const;

export function AboutStory({
  activeStage,
  hideInactive = false,
}: {
  activeStage: number;
  hideInactive?: boolean;
}) {
  return (
    <div className={styles.stages}>
      {ABOUT_STAGES.map((stage, index) => {
        const isActive = index === activeStage;
        return (
          <article
            key={stage.title}
            className={styles.stageCopy}
            data-active={isActive}
            aria-hidden={hideInactive && !isActive}
          >
            <span className={styles.stageIndex}>
              {toPersianDigits(index + 1)} از {toPersianDigits(ABOUT_STAGES.length)}
            </span>
            <h2 className={styles.stageTitle}>{stage.title}</h2>
            <p className={styles.stageBody}>{stage.body}</p>
          </article>
        );
      })}
    </div>
  );
}
