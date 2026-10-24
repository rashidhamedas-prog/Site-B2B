import type { CSSProperties } from 'react';
import {
  STORY_FRAME,
  parseStorySteps,
  type StoryStepCopy,
} from '@/lib/sales-partner-public-facts';
import { SpStoryCtaBeacon, StoryCarousel } from './StoryCarousel';
import { StoryStep } from './StoryStep';
import styles from './storyboard.module.css';

const frameStyle = {
  '--sp-mobile-ratio': `${STORY_FRAME.mobile.width} / ${STORY_FRAME.mobile.height}`,
  '--sp-desktop-ratio': `${STORY_FRAME.desktop.width} / ${STORY_FRAME.desktop.height}`,
} as CSSProperties;

export function Storyboard({ props }: { props: Record<string, unknown> }) {
  const headline = typeof props.headline === 'string' ? props.headline.trim() : '';
  const eyebrow = typeof props.eyebrow === 'string' ? props.eyebrow.trim() : '';
  const body = typeof props.body === 'string' ? props.body.trim() : '';
  const steps = parseStorySteps(props.steps);
  if (!headline && steps.length === 0) return null;

  return (
    <section className={styles.section} style={frameStyle} aria-labelledby="sp-story-h">
      <div className={styles.inner}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        {headline ? (
          <h2 id="sp-story-h" className={styles.title}>
            {headline}
          </h2>
        ) : (
          <h2 id="sp-story-h" className={styles.title}>
            مراحل همکاری
          </h2>
        )}
        {body ? <p className={styles.intro}>{body}</p> : null}
        {steps.length ? (
          <StoryCarousel count={steps.length}>
            <ol className={styles.steps}>
              {steps.map((step: StoryStepCopy, index) => (
                <StoryStep key={`${step.n}-${step.title}`} step={step} eager={index === 0} />
              ))}
            </ol>
          </StoryCarousel>
        ) : null}
      </div>
      <SpStoryCtaBeacon />
    </section>
  );
}
