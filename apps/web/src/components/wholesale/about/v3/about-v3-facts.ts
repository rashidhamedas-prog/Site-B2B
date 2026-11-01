import { toPersianDigits } from '@taranom/persian-utils';
import { BUSINESS_FACTS, yearsOfOperationFa } from '@/lib/business-facts';

export const FOUNDED_FA = toPersianDigits(BUSINESS_FACTS.foundedSolarYear);
export const TEAM_FA = toPersianDigits(BUSINESS_FACTS.teamSize);
export const MIN_ORDER_FA = toPersianDigits(BUSINESS_FACTS.minOrderPerModel);
export const CUSTOMERS_FA = `+${toPersianDigits(BUSINESS_FACTS.activeCustomers)}`;
export const MODELS_FA = `+${toPersianDigits(BUSINESS_FACTS.activeModels)}`;
export const YEARS_FA = yearsOfOperationFa();
