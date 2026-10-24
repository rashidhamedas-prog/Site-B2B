import { storyCardAlt, type StoryStepCopy } from '@/lib/sales-partner-public-facts';
import { StoryArt } from './StoryArt';
import styles from './storyboard.module.css';

/** Image only. The picture already contains the heading and description; alt repeats that text for assistive tech. */
export function StoryStep({ step, eager = false }: { step: StoryStepCopy; eager?: boolean }) {
  return (
    <li className={styles.step}>
      <figure className={styles.figure}>
        <StoryArt desktopSrc={step.image} mobileSrc={step.imageMobile} alt={storyCardAlt(step)} eager={eager} />
      </figure>
    </li>
  );
}
