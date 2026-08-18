import { useId } from 'react';
import styles from './about.module.css';

export function AboutScene() {
  const uid = useId().replace(/:/g, '');
  const weave = `${uid}-weave`;
  const gold = `${uid}-gold`;

  return (
    <div className={styles.sceneWell}>
      <div className={styles.scene} aria-hidden="true">
        <div className={styles.stage}>
          <div className={styles.wall} />
          <div className={styles.window} />
          <div className={styles.table} />
          <div className={styles.tableEdge} />
          <div className={styles.floorShadow} />

          <div className={styles.bolt}>
            <span className={styles.boltCore} />
          </div>
          <div className={styles.cloth} />

          <svg className={styles.cutLine} viewBox="0 0 320 180" fill="none">
            <path
              d="M28 42 L292 38 M40 96 L280 90 M70 22 L64 158 M250 18 L258 162"
              stroke="#c9a84c"
              strokeWidth="1.2"
              strokeDasharray="5 6"
            />
          </svg>

          <div className={`${styles.piece} ${styles.pieceBody}`} />
          <div className={`${styles.piece} ${styles.pieceSleeveL}`} />
          <div className={`${styles.piece} ${styles.pieceSleeveR}`} />

          <svg className={styles.thread} viewBox="0 0 400 260" fill="none">
            <path
              d="M48 210 C 90 140, 140 80, 210 96 S 310 170, 348 64"
              stroke="#c9a84c"
              strokeWidth="1.4"
              strokeLinecap="round"
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: 'calc(1 - var(--cut))',
              }}
            />
          </svg>

          <div className={styles.spool} />

          <svg className={styles.hanger} viewBox="0 0 200 56" fill="none">
            <path
              d="M100 8 C100 2, 108 2, 108 10"
              stroke="#c9a84c"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M100 10 L22 48 H178 L100 10"
              stroke="#e5c97c"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
          </svg>

          <div className={styles.garmentWrap}>
            <svg className={styles.garment} viewBox="0 0 240 268" role="presentation">
              <defs>
                <pattern id={weave} width="8" height="8" patternUnits="userSpaceOnUse">
                  <rect width="8" height="8" fill="#164a3b" />
                  <path d="M0 8 L8 0" stroke="#1b5c4a" strokeWidth="0.6" />
                </pattern>
                <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#e5c97c" />
                  <stop offset="100%" stopColor="#c9a84c" />
                </linearGradient>
              </defs>
              <path
                d="M78 46 C78 30 98 18 120 22 C142 18 162 30 162 46
                   L172 56 L214 86 L198 98 L168 76 L170 214
                   C170 238 148 250 120 250
                   C92 250 70 238 70 214
                   L72 76 L42 98 L26 86 L68 56 Z"
                fill={`url(#${weave})`}
                stroke={`url(#${gold})`}
                strokeWidth="1.6"
              />
              <path
                d="M96 58 C108 72 132 72 144 58"
                fill="none"
                stroke="#c9a84c"
                strokeWidth="1.3"
              />
              <path
                d="M120 54 L120 236"
                stroke="#c9a84c"
                strokeWidth="0.7"
                strokeDasharray="3 5"
                opacity="0.7"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
