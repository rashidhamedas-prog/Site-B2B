import {
  DEFAULT_APPLY_FORM_FIELDS,
  maskNationalId,
  resolveApplyFormFields,
  validateApplyAnswers,
  validateIranNationalId,
} from './sales-partner-apply-form';
import { resolveSalesPartnerSettings } from './sales-partner-settings';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// Valid Iranian national ID sample (checksum-valid)
const VALID_NID = '0013542419';
assert(validateIranNationalId(VALID_NID) === null, 'valid nid');
assert(validateIranNationalId('1234567890') !== null, 'invalid nid');
assert(validateIranNationalId('0000000000') !== null, 'repeated nid');
assert(maskNationalId(VALID_NID) === '******2419', 'mask nid');

const defaults = resolveApplyFormFields(undefined);
assert(defaults.length >= 12, 'default field count');
assert(defaults.every((f) => f.key !== 'phone' || (f.enabled && f.required && f.locked)), 'phone locked');

const patched = resolveApplyFormFields([
  { key: 'motivation', enabled: false, required: false, label: 'چرا', order: 1, type: 'textarea' },
  { key: 'custom_blog', enabled: true, required: true, label: 'آدرس وبلاگ', order: 200, type: 'text' },
  { key: 'displayName', enabled: false, required: false, label: 'نام', order: 1, type: 'text' },
]);
const motivation = patched.find((f) => f.key === 'motivation');
assert(motivation?.enabled === false, 'can disable motivation');
assert(patched.find((f) => f.key === 'displayName')?.enabled === true, 'cannot disable displayName');
assert(patched.some((f) => f.key === 'custom_blog' && f.required), 'custom field kept');

const settings = resolveSalesPartnerSettings({
  enabled: true,
  mode: 'LIVE',
  applyOpen: true,
  applyFormFields: patched,
});
assert(settings.applyFormFields.some((f) => f.key === 'custom_blog'), 'settings carries form fields');

const ok = validateApplyAnswers(DEFAULT_APPLY_FORM_FIELDS, {
  displayName: 'سارا',
  phone: '09151234567',
  province: 'تهران',
  city: 'تهران',
  nationalId: VALID_NID,
  salesExperience: '1_to_3y',
  primaryChannel: 'instagram',
  instagram: '@sara',
  motivation: 'فروش لباس',
  acceptTerms: true,
});
assert(ok.ok === true, 'valid apply');
if (ok.ok) {
  assert(ok.data.answers.nationalId === VALID_NID, 'nid stored');
  assert(ok.data.socialHandles.instagram === '@sara', 'social');
}

const missing = validateApplyAnswers(DEFAULT_APPLY_FORM_FIELDS, {
  displayName: 'سارا',
  phone: '09151234567',
  acceptTerms: true,
});
assert(missing.ok === false, 'required city missing');

console.log('sales-partner-apply-form.spec.ts: OK');
