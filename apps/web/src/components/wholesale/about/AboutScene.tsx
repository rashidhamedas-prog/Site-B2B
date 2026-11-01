import Image from 'next/image';
import { ABOUT_STAGES, aboutSceneIndex } from './about-scenes';
import styles from './about.module.css';

export function AboutScene({
  activeStage,
  mode = 'sticky',
}: {
  activeStage: number;
  mode?: 'sticky' | 'card';
}) {
  const stage = aboutSceneIndex(activeStage);
  const frames = mode === 'card' ? [stage] : ABOUT_STAGES.map((_, index) => index);

  return (
    <figure className={styles.sceneWell} data-stage={stage}>
      <div className={styles.sceneFrame}>
        {frames.map((index) => {
          const scene = ABOUT_STAGES[index];
          const visible = index === stage;
          return (
            <div key={scene.src} className={styles.layer} data-layer={index} aria-hidden={visible ? undefined : true}>
              <Image
                src={scene.src}
                alt={visible ? scene.alt : ''}
                fill
                sizes={mode === 'sticky' ? '(min-width: 1024px) 36vw, 100vw' : '(max-width: 1023px) 100vw, 36vw'}
                quality={70}
                priority={mode === 'sticky' && index === 0}
                className={styles.scenePhoto}
              />
            </div>
          );
        })}
        <div className={styles.sceneLabel} aria-hidden="true">
          <em>{ABOUT_STAGES[stage].kicker}</em>
        </div>
      </div>
    </figure>
  );
}
