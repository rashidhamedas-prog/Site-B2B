import {
  COMPANY_PRODUCTION_YEARS_CLAIM,
  COMPANY_PRODUCTION_YEARS_STAT,
  yearsOfOperationFa,
} from './business-facts.ts';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const claim = yearsOfOperationFa();

assert(claim === 'بیش از ۱۰ سال فعالیت تولیدی', 'locked claim phrase');
assert(claim === COMPANY_PRODUCTION_YEARS_CLAIM, 'helper matches constant');
assert(
  `${COMPANY_PRODUCTION_YEARS_STAT.value} ${COMPANY_PRODUCTION_YEARS_STAT.label}` === claim,
  'stat value + label compose the locked claim',
);
assert(COMPANY_PRODUCTION_YEARS_STAT.value === 'بیش از ۱۰', 'stat value');
assert(COMPANY_PRODUCTION_YEARS_STAT.label === 'سال فعالیت تولیدی', 'stat label');
assert(COMPANY_PRODUCTION_YEARS_STAT.sublabel === 'در مشهد', 'mashhad sublabel');
assert(!claim.includes('+'), 'no plus counter');
assert(!claim.includes('۱۱'), 'no eleven');
assert(!claim.includes('۱۴'), 'no fourteen');
assert(!COMPANY_PRODUCTION_YEARS_STAT.value.includes('+'), 'stat value has no plus');

console.log('business-facts.spec.mts: ok');
