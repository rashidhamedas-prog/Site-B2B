/**
 * npx ts-node --transpile-only src/components/admin/admin-omnichannel-error-labels.spec.ts
 * (run from apps/web) or via repo unit runner if wired.
 */
import {
  classifyErrorFreshness,
  errorLabel,
  errorTechnicalCode,
} from './admin-omnichannel-error-labels';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

{
  const msg = 'QueryFailedError: inconsistent types deduced for parameter $2';
  assert(errorLabel(msg).includes('پایگاه‌داده'), '42P08 fa');
  assert(errorTechnicalCode(msg).includes('inconsistent types') || errorTechnicalCode(msg) === '42P08', 'code');
}

{
  assert(errorLabel('uncertain_after_timeout').includes('تایم‌اوت') || errorLabel('uncertain_after_timeout').includes('معلوم نیست'), 'uncertain');
  assert(errorLabel('superseded_duplicate').includes('تکراری'), 'superseded');
  assert(errorLabel('held_by_ops_no_live_until_canary_go').includes('canary'), 'held');
  assert(errorLabel('WEBPAGE_CURL_FAILED').includes('تصویر'), 'webp');
}

{
  const stale = classifyErrorFreshness({
    lastError: 'validate_failed',
    lastErrorAt: '2026-10-20T10:00:00.000Z',
    lastSuccessAt: '2026-10-28T12:00:00.000Z',
  });
  assert(stale?.stale === true && stale.muted === true && stale.displayFa.includes('آرشیو'), 'stale archive');

  const current = classifyErrorFreshness({
    lastError: 'uncertain_after_timeout',
    lastErrorAt: '2026-10-28T14:00:00.000Z',
    lastSuccessAt: '2026-10-28T12:00:00.000Z',
  });
  assert(current?.stale === false && current.displayFa.includes('آخرین خطا'), 'current error');
}

console.log('admin-omnichannel-error-labels.spec.ts: ok');
