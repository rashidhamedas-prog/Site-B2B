import type { MutableRefObject } from 'react';
import { ABOUT_STAGES } from './about-scenes';
import { AboutScene } from './AboutScene';
import styles from './about.module.css';

export { ABOUT_STAGES };

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
              <AboutScene activeStage={index} mode="card" />
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
