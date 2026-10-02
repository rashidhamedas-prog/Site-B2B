import type { MutableRefObject } from 'react';
import { AboutScene } from './AboutScene';
import styles from './about.module.css';

export const ABOUT_STAGES = [
  {
    kicker: 'کارگاه',
    title: 'انتخاب پارچه',
    body: 'هر مدل از بررسی لینن و کتان شروع می‌شود؛ پارچه‌هایی که سبک می‌مانند، فرم ویترین را نگه می‌دارند و برای کار روزانه بوتیک مناسب‌اند. طاقه خام روی میز برش، نقطه آغاز همکاری با فروشنده است.',
  },
  {
    kicker: 'الگو',
    title: 'طراحی و برش',
    body: 'الگو در کارگاه مشهد روی پارچه می‌نشیند و برش داخل مجموعه انجام می‌شود. هدف، سایزبندی منظم و جزئیاتی است که روی مانکن فروشگاه خوانا بماند؛ نه دوخت نمایشی جدا از خط تولید.',
  },
  {
    kicker: 'خط تولید',
    title: 'دوخت و کنترل کیفیت',
    body: 'قطعه‌ها به هم می‌رسند، دوخت صنعتی انجام می‌شود و پیش از بسته‌بندی کنترل می‌شود. این فاصله کوتاه بین کارگاه و دفتر پخش کمک می‌کند فروشنده مدل را با اطمینان به ویترین ببرد.',
  },
  {
    kicker: 'عمده',
    title: 'آماده برای فروش عمده',
    body: 'لباس از کارگاه به دفتر پخش محدوده ۱۷ شهریور، پاساژ کیمیا می‌رسد. از آنجا می‌توانید مدل را ببینید، سفارش عمده ثبت کنید و ارسال به سراسر ایران را پیگیری کنید.',
  },
] as const;

export function AboutStory({
  activeStage,
  stepRefs,
}: {
  activeStage: number;
  stepRefs: MutableRefObject<(HTMLElement | null)[]>;
}) {
  return (
    <div className={styles.steps} role="list">
      {ABOUT_STAGES.map((stage, index) => {
        const isActive = index === activeStage;
        return (
          <article
            key={stage.title}
            ref={(node) => {
              stepRefs.current[index] = node;
            }}
            className={styles.step}
            data-active={isActive}
            data-step={index}
            role="listitem"
            aria-current={isActive ? 'step' : undefined}
          >
            <div className={styles.stepScene}>
              <AboutScene activeStage={index} />
            </div>
            <div className={styles.stepCopy}>
              <div className={styles.stepMeta}>
                <span className={styles.stageKicker}>{stage.kicker}</span>
              </div>
              <h2 className={styles.stageTitle}>{stage.title}</h2>
              <p className={styles.stageBody}>{stage.body}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
