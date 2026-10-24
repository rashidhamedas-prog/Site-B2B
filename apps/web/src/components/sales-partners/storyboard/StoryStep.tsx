import { formatTomanFa, type StoryStepCopy } from '@/lib/sales-partner-public-facts';
import { StoryArt } from './StoryArt';
import styles from './storyboard.module.css';

/** Text-free photo at every width. The brief copy sits in the caption; the alt describes the scene. */
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
      </figure>
    </li>
  );
}
