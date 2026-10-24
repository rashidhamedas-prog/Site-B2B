import { toPersianDigits } from '@taranom/persian-utils';
import styles from './storyboard.module.css';

export function MoneyTimeline({ props }: { props: Record<string, unknown> }) {
  const headline = typeof props.headline === 'string' ? props.headline.trim() : '';
  const note = typeof props.note === 'string' ? props.note.trim() : '';
  const stages = Array.isArray(props.stages)
    ? props.stages.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const record = item as Record<string, unknown>;
        const title = typeof record.title === 'string' ? record.title.trim() : '';
        const body = typeof record.body === 'string' ? record.body.trim() : '';
        if (!title && !body) return [];
        return [{ title, body }];
      })
    : [];
  if (!headline && stages.length === 0) return null;

  return (
    <section className={styles.block} aria-labelledby="sp-money-h">
      <div className={styles.inner}>
        {headline ? (
          <h2 id="sp-money-h" className={styles.title}>
            {headline}
          </h2>
        ) : null}
        {stages.length ? (
          <ol className={styles.stages}>
            {stages.map((stage, index) => (
              <li key={`${stage.title}-${index}`} className={styles.stage}>
                <span className={styles.num} aria-hidden="true">
                  {toPersianDigits(index + 1)}
                </span>
                {stage.title ? <h3 className={styles.stageTitle}>{stage.title}</h3> : null}
                {stage.body ? <p className={styles.stageBody}>{stage.body}</p> : null}
              </li>
            ))}
          </ol>
        ) : null}
        {note ? <p className={styles.note}>{note}</p> : null}
      </div>
    </section>
  );
}
