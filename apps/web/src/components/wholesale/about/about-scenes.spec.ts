/**
 * npx tsx src/components/wholesale/about/about-scenes.spec.ts
 */
import { ABOUT_STAGES, aboutSceneIndex } from './about-scenes';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(ABOUT_STAGES.length === 4, 'four process stills');

const srcs = ABOUT_STAGES.map((stage) => stage.src);
assert(new Set(srcs).size === srcs.length, 'each stage has its own image');
assert(srcs.every((src) => src.startsWith('/about/process/') && src.endsWith('.webp')), 'local webp stills');

assert(ABOUT_STAGES[0].alt.includes('طاقه'), 'fabric still names the bolt');
assert(ABOUT_STAGES[1].alt.includes('قیچی'), 'cut still names the shears');
assert(ABOUT_STAGES[2].alt.includes('چرخ'), 'sew still names the machine');
assert(ABOUT_STAGES[3].alt.includes('چوب‌لباسی'), 'ready still names the rail');

assert(aboutSceneIndex(-3) === 0, 'negative stage clamps to fabric');
assert(aboutSceneIndex(99) === 3, 'overflow stage clamps to wholesale');
assert(aboutSceneIndex(Number.NaN) === 0, 'invalid stage clamps to fabric');

console.log('about-scenes.spec.ts ok');
