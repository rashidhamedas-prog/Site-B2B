/**
 * npx ts-node --transpile-only src/components/admin/admin-omnichannel-labels.spec.ts
 */
import { countsTodayLineFa, modeLabelFa, opsLabelFa, statusLabelFa } from './admin-omnichannel-labels';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(modeLabelFa('LIVE') === 'زنده', 'LIVE');
assert(modeLabelFa('CANARY') === 'آزمایشی', 'CANARY');
assert(statusLabelFa('RETRY') === 'تلاش مجدد', 'RETRY');
assert(statusLabelFa('DEAD') === 'متوقف', 'DEAD');
assert(statusLabelFa('HOLD') === 'نگه‌داشته', 'HOLD');
assert(statusLabelFa('stalled') === 'گیرکرده', 'stalled');
assert(statusLabelFa('WITHDRAWN') === 'برداشته‌شده', 'WITHDRAWN');
assert(opsLabelFa('UPLOAD') === 'آپلود', 'UPLOAD');
assert(opsLabelFa('blast') === 'ارسال دسته‌ای', 'blast');
assert(countsTodayLineFa({ retry: 1, dead: 2, hold: 3, stalled: 4 }).includes('متوقف'), 'counts');

console.log('admin-omnichannel-labels.spec.ts: ok');
