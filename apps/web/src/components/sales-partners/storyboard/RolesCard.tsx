import styles from './storyboard.module.css';

function lines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => (typeof item === 'string' && item.trim() ? [item.trim()] : []));
}

export function RolesCard({ props }: { props: Record<string, unknown> }) {
  const headline = typeof props.headline === 'string' ? props.headline.trim() : '';
  const youLabel = typeof props.youLabel === 'string' && props.youLabel.trim() ? props.youLabel.trim() : 'کار شما';
  const taranomLabel =
    typeof props.taranomLabel === 'string' && props.taranomLabel.trim()
      ? props.taranomLabel.trim()
      : 'کار ترنم';
  const you = lines(props.you);
  const taranom = lines(props.taranom);
  if (!you.length && !taranom.length) return null;

  return (
    <section className={styles.block} aria-labelledby="sp-roles-h">
      <div className={styles.inner}>
        <h2 id="sp-roles-h" className={styles.title}>
          {headline || `${youLabel} / ${taranomLabel}`}
        </h2>
        <div className={styles.cols}>
          <div className={styles.col}>
            <h3 className={styles.colTitle}>{youLabel}</h3>
            <ul className={styles.list}>
              {you.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className={styles.col}>
            <h3 className={styles.colTitle}>{taranomLabel}</h3>
            <ul className={styles.list}>
              {taranom.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
