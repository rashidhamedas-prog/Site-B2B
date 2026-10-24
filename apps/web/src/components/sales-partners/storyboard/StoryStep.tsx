import { formatTomanFa, storyCardAlt, type StoryStepCopy } from '@/lib/sales-partner-public-facts';
import { StoryArt } from './StoryArt';
import styles from './storyboard.module.css';

/**
 * Desktop (from 768px) shows the text-free photo and the brief copy in HTML.
 * Mobile keeps the baked-text card: the caption is hidden and the alt carries the copy.
 */
export function StoryStep({ step, eager = false }: { step: StoryStepCopy; eager?: boolean }) {
  const aside = step.aside;
  return (
    <li className={styles.step}>
      <figure className={styles.figure}>
        <StoryArt
          desktopSrc={step.image}
          mobileSrc={step.imageMobile}
          alt={step.imageAlt}
          eager={eager}
        />
        <figcaption className={styles.caption}>
          <p className={styles.stepNo}>{formatTomanFa(step.n)}</p>
          <h3 className={styles.cardTitle}>{step.title}</h3>
          {step.body ? <p className={styles.cardBody}>{step.body}</p> : null}
          {aside && (aside.title || aside.body) ? (
            <p className={styles.cardBody}>
              {aside.title ? <span className={styles.asideLabel}>{aside.title}. </span> : null}
              {aside.body}
            </p>
          ) : null}
        </figcaption>
        <p className={styles.mobileCopy}>{storyCardAlt(step)}</p>
      </figure>
    </li>
  );
}
