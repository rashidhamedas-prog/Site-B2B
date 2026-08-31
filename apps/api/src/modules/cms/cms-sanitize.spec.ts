/**
 * npx ts-node --transpile-only src/modules/cms/cms-sanitize.spec.ts
 */
import { sanitizeCmsBlocks, sanitizeCmsHtml } from './cms-sanitize';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

{
  const dirty = '<p>سلام</p><script>alert(1)</script><img src=x onerror=alert(1) /><a href="javascript:alert(1)">x</a>';
  const clean = sanitizeCmsHtml(dirty);
  assert(!clean.includes('script'), 'script discarded');
  assert(!/onerror/i.test(clean), 'event handler discarded');
  assert(!/javascript:/i.test(clean), 'javascript url discarded');
  assert(clean.includes('سلام'), 'safe text kept');
}

{
  const blocks = sanitizeCmsBlocks([
    { type: 'html', props: { html: '<p>ok</p><script>steal()</script>' } },
    { type: 'text', props: { text: '<img src=x onerror=alert(1)>' } },
  ]);
  const html = JSON.stringify(blocks);
  assert(!html.includes('script'), 'block script discarded');
  assert(!/onerror/i.test(html), 'block handler discarded');
}

console.log('cms-sanitize.spec.ts: ok');
