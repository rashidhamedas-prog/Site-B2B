import { categoryUniqueMessage } from './category-unique';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(
  categoryUniqueMessage({
    code: '23505',
    detail: 'Key (name)=(شومیز) already exists.',
  }) === 'این نام فارسی قبلاً برای یک دسته فعال استفاده شده است',
  'name unique',
);

assert(
  categoryUniqueMessage({
    driverError: { code: '23505', detail: 'Key (slug)=(autumn) already exists.' },
  }) === 'این اسلاگ قبلاً برای یک دسته فعال استفاده شده است',
  'slug unique nested driver',
);

assert(categoryUniqueMessage({ code: '23503', detail: 'fk' }) === null, 'other sql ignored');

console.log('category-unique.spec: OK');
