import {
  SP_COMMISSION_PERCENT,
  SP_MIN_PAYOUT_TOMAN,
  computeEarningExample,
  formatTomanFa,
  renderEarningRepeatNote,
} from '@/lib/sales-partner-public-facts';
import styles from './storyboard.module.css';

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function EarningExample({ props }: { props: Record<string, unknown> }) {
  const badge = typeof props.badge === 'string' ? props.badge.trim() : '';
  const story = typeof props.story === 'string' ? props.story.trim() : '';
  const disclaimer = typeof props.disclaimer === 'string' ? props.disclaimer.trim() : '';
  const repeatNote = typeof props.repeatNote === 'string' ? props.repeatNote : '';
  const items = Array.isArray(props.items)
    ? props.items.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const record = item as Record<string, unknown>;
        const label = typeof record.label === 'string' ? record.label.trim() : '';
        const priceToman = num(record.priceToman, NaN);
        if (!label || !Number.isFinite(priceToman)) return [];
        return [{ label, priceToman }];
      })
    : [];
  if (!items.length && !story) return null;

  const discountPercent = num(props.discountPercent, 10);
  const commissionPercent = num(props.commissionPercent, SP_COMMISSION_PERCENT);
  const minPayoutToman = num(props.minPayoutToman, SP_MIN_PAYOUT_TOMAN);
  const figures = computeEarningExample({
    items,
    discountPercent,
    commissionPercent,
    minPayoutToman,
  });
  const percentLabel = formatTomanFa(commissionPercent);
  const discountLabel = formatTomanFa(discountPercent);

  return (
    <section className={styles.block} aria-labelledby="sp-earn-h">
      <div className={`${styles.inner} ${styles.card}`}>
        <h2 id="sp-earn-h" className={styles.badge}>
          {badge || 'مثال — قیمت‌ها فرضی است'}
        </h2>
        {story ? <p className={styles.story}>{story}</p> : null}
        <table className={styles.table}>
          <caption>مثال محاسبهٔ پورسانت (فرضی)</caption>
          <thead>
            <tr>
              <th scope="col">مورد</th>
              <th scope="col">تومان</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">جمع کالاها</th>
              <td>
                <bdi dir="ltr">{formatTomanFa(figures.sum)}</bdi>
              </td>
            </tr>
            <tr>
              <th scope="row">{`تخفیف ${discountLabel}٪`}</th>
              <td>
                <bdi dir="ltr">{`−${formatTomanFa(figures.discount)}`}</bdi>
              </td>
            </tr>
            <tr>
              <th scope="row">مبنای پورسانت</th>
              <td>
                <bdi dir="ltr">{formatTomanFa(figures.base)}</bdi>
              </td>
            </tr>
            <tr>
              <th scope="row">هزینه ارسال</th>
              <td>حساب نمی‌شود</td>
            </tr>
            <tr className={styles.emphasis}>
              <th scope="row">{`پورسانت ${percentLabel}٪`}</th>
              <td>
                <bdi dir="ltr">{formatTomanFa(figures.commission)}</bdi>
              </td>
            </tr>
          </tbody>
        </table>
        {repeatNote ? (
          <p className={styles.repeat}>
            {renderEarningRepeatNote(repeatNote, figures.repeat, minPayoutToman)}
          </p>
        ) : null}
        {disclaimer ? <p className={styles.disclaimer}>{disclaimer}</p> : null}
      </div>
    </section>
  );
}
