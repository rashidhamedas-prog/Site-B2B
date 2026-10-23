import assert from 'node:assert/strict';
import {
  BUSINESS_FACTS,
  companyProductionYearsTitle,
  currentSolarYear,
  yearsOfOperation,
  yearsOfOperationFa,
} from './business-facts';
import { alignCompanyProductionFeature, alignCompanyProductionStat } from './company-year-claim';

const tehran = (iso: string) => new Date(iso);

const aban1405 = tehran('2026-10-23T08:30:00Z');
const beforeNowruz1405 = tehran('2026-03-20T08:30:00Z');
const nowruz1405 = tehran('2026-03-21T08:30:00Z');
const january1405 = tehran('2027-01-15T08:30:00Z');

assert.equal(BUSINESS_FACTS.foundedSolarYear, 1394);
assert.equal(currentSolarYear(aban1405), 1405);
assert.equal(yearsOfOperation(aban1405), 11);
assert.equal(yearsOfOperationFa(aban1405), '۱۱+');
assert.equal(companyProductionYearsTitle(aban1405), '۱۱+ سال فعالیت تولیدی');

assert.equal(currentSolarYear(beforeNowruz1405), 1404);
assert.equal(yearsOfOperation(beforeNowruz1405), 10);

assert.equal(currentSolarYear(nowruz1405), 1405);
assert.equal(yearsOfOperation(nowruz1405), 11);

// Gregorian New Year must not add a production year before Nowruz.
assert.equal(currentSolarYear(january1405), 1405);
assert.equal(yearsOfOperation(january1405), 11);
assert.notEqual(
  yearsOfOperation(january1405),
  new Date('2027-01-15T08:30:00Z').getUTCFullYear() - 2015
);

assert.notEqual(yearsOfOperation(aban1405), 14);
assert.equal(companyProductionYearsTitle(aban1405).includes('۱۴'), false);
assert.equal(companyProductionYearsTitle(aban1405).includes('تجربه'), false);

const feature = alignCompanyProductionFeature(
  {
    title: '۱۴ سال تجربه تولیدی',
    description:
      'از ۱۳۹۴ تا امروز، تامین‌کننده بوتیک‌ها در مشهد و سراسر ایران با کلکسیون‌های فصلی مستمر.',
  },
  aban1405
);
assert.equal(feature.title, '۱۱+ سال فعالیت تولیدی');
assert.equal(feature.description.includes('۱۳۹۴'), true);
assert.equal(feature.title.includes('۱۴'), false);
assert.equal(feature.title.includes('تجربه تولیدی'), false);

const refreshed = alignCompanyProductionFeature(
  { title: '۱۰+ سال فعالیت تولیدی', description: 'از ۱۳۹۴' },
  aban1405
);
assert.equal(refreshed.title, '۱۱+ سال فعالیت تولیدی');

const founder = alignCompanyProductionFeature(
  {
    title: 'داستان بنیان‌گذار',
    description:
      'با بیش از ۱۰ سال تجربه در بازاریابی و مدیریت فروش پوشاک، حامد رشید تولیدی را راه انداخت.',
  },
  aban1405
);
assert.equal(founder.title, 'داستان بنیان‌گذار');
assert.equal(founder.description.includes('بازاریابی'), true);
assert.equal(founder.description.includes('حامد'), true);

const untouched = alignCompanyProductionFeature(
  { title: 'ضمانت شستشوی آنزیمی', description: 'کنترل کیفیت' },
  aban1405
);
assert.equal(untouched.title, 'ضمانت شستشوی آنزیمی');

const workshop = alignCompanyProductionFeature(
  { title: 'تولید ۰ تا ۱۰۰ داخل کارگاه', description: 'برش تا بسته‌بندی' },
  aban1405
);
assert.equal(workshop.title, 'تولید ۰ تا ۱۰۰ داخل کارگاه');

const activity = alignCompanyProductionFeature(
  { title: 'فعالیت تولیدی مستمر', description: 'کلکسیون فصلی' },
  aban1405
);
assert.equal(activity.title, 'فعالیت تولیدی مستمر');

const stat = alignCompanyProductionStat(
  { value: '۱۰+', label: 'سال تجربه', sublabel: 'در بازار پوشاک', icon: 'years' },
  aban1405
);
assert.equal(stat.value, '۱۱+');
assert.equal(stat.label, 'سال فعالیت تولیدی');
assert.equal(stat.sublabel, 'در مشهد');
assert.equal(stat.icon, 'years');

const footer = alignCompanyProductionStat({ value: '۱۰+', label: 'سال تجربه' }, aban1405);
assert.equal(footer.value, '۱۱+');
assert.equal(footer.label, 'سال فعالیت تولیدی');
assert.equal('sublabel' in footer, false);

const customers = alignCompanyProductionStat(
  { value: '+۲۰۰', label: 'مشتری فعال', sublabel: 'در سراسر ایران' },
  aban1405
);
assert.equal(customers.value, '+۲۰۰');
assert.equal(customers.label, 'مشتری فعال');
assert.equal(customers.sublabel, 'در سراسر ایران');

console.log('business-facts.spec.ts: ok');
