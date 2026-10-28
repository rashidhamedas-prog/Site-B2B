import { SALES_PARTNER_PROFILE_STATUSES } from '../../sales-partner/sales-partner-policy';
import { WHOLESALE_REFERRAL_PARTNER_STATUSES } from '../../wholesale-referral/wholesale-referral-policy';
import { AUDIENCE_SOURCE_PRIORITY, type AudienceContact, type AudienceSource } from './audience.types';

export const SEGMENT_FIELDS = [
  'source',
  'province',
  'city',
  'orderStatus',
  'lastOrderAt',
  'orderCount',
  'customerSegment',
  'partnerStatus',
  'referralStatus',
  'createdAt',
] as const;

export type SegmentField = (typeof SEGMENT_FIELDS)[number];

const FIELD_OPS: Record<SegmentField, readonly string[]> = {
  source: ['in'],
  province: ['in'],
  city: ['in'],
  orderStatus: ['any-in'],
  lastOrderAt: ['before', 'after', 'withinDays', 'never'],
  orderCount: ['gte', 'lte'],
  customerSegment: ['in'],
  partnerStatus: ['in'],
  referralStatus: ['in'],
  createdAt: ['before', 'after'],
};

export type SegmentRule = {
  field: SegmentField;
  op: string;
  value: unknown;
};

export class SegmentRuleError extends Error {
  readonly code = 'SMS_SEGMENT_INVALID';
}

export function normalizeFa(value: string): string {
  return String(value || '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function asStringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new SegmentRuleError(`bad value for ${field}`);
  }
  return value.map((item) => String(item));
}

function asNumber(value: unknown, field: string): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) throw new SegmentRuleError(`bad number for ${field}`);
  return n;
}

function asDate(value: unknown, field: string): Date {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) throw new SegmentRuleError(`bad date for ${field}`);
  return date;
}

/** Flat AND rules only. OR, nesting, and unknown fields are rejected. */
export function parseSegmentRules(input: unknown): SegmentRule[] {
  if (input == null) return [];
  if (!Array.isArray(input)) throw new SegmentRuleError('rules must be a flat AND array');
  const rules: SegmentRule[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new SegmentRuleError('rule must be an object');
    }
    const obj = raw as Record<string, unknown>;
    if ('or' in obj || 'rules' in obj || 'group' in obj || 'AND' in obj || 'OR' in obj) {
      throw new SegmentRuleError('nested rules are not allowed');
    }
    const field = String(obj.field || '');
    const op = String(obj.op || '');
    if (!(SEGMENT_FIELDS as readonly string[]).includes(field)) {
      throw new SegmentRuleError(`unknown field ${field}`);
    }
    const typed = field as SegmentField;
    if (!FIELD_OPS[typed].includes(op)) throw new SegmentRuleError(`bad op ${op} for ${field}`);
    if (op === 'in' || op === 'any-in') asStringList(obj.value, field);
    else if (op === 'gte' || op === 'lte' || op === 'withinDays') asNumber(obj.value, field);
    else if (op === 'before' || op === 'after') asDate(obj.value, field);
    if (typed === 'source') {
      for (const item of asStringList(obj.value, field)) {
        if (!(AUDIENCE_SOURCE_PRIORITY as readonly string[]).includes(item)) {
          throw new SegmentRuleError(`bad source ${item}`);
        }
      }
    }
    if (typed === 'customerSegment') {
      for (const item of asStringList(obj.value, field)) {
        if (!['VIP', 'A', 'B', 'C'].includes(item)) throw new SegmentRuleError(`bad segment ${item}`);
      }
    }
    if (typed === 'partnerStatus') {
      for (const item of asStringList(obj.value, field)) {
        if (!(SALES_PARTNER_PROFILE_STATUSES as readonly string[]).includes(item)) {
          throw new SegmentRuleError(`bad partner status ${item}`);
        }
      }
    }
    if (typed === 'referralStatus') {
      for (const item of asStringList(obj.value, field)) {
        if (!(WHOLESALE_REFERRAL_PARTNER_STATUSES as readonly string[]).includes(item)) {
          throw new SegmentRuleError(`bad referral status ${item}`);
        }
      }
    }
    rules.push({ field: typed, op, value: obj.value });
  }
  return rules;
}

export type AudienceCityOption = string | { value: string; count: number };

export function audienceFieldCatalog(cities: Array<string | { city: string; count: number }>) {
  const cityValues: AudienceCityOption[] = cities.map((item) => {
    if (typeof item === 'string') return item;
    return { value: item.city, count: Number(item.count) || 0 };
  });
  return {
    fields: SEGMENT_FIELDS.map((field) => ({
      field,
      ops: [...FIELD_OPS[field]],
      values:
        field === 'source'
          ? [...AUDIENCE_SOURCE_PRIORITY]
          : field === 'customerSegment'
            ? ['VIP', 'A', 'B', 'C']
            : field === 'partnerStatus'
              ? [...SALES_PARTNER_PROFILE_STATUSES]
              : field === 'referralStatus'
                ? [...WHOLESALE_REFERRAL_PARTNER_STATUSES]
                : field === 'city'
                  ? cityValues
                  : undefined,
    })),
    combine: 'AND' as const,
  };
}

function listHas(rule: SegmentRule, value?: string | null, normalize = false): boolean {
  const list = asStringList(rule.value, rule.field);
  const current = value || '';
  if (!normalize) return list.includes(current);
  const norm = normalizeFa(current);
  return list.some((item) => normalizeFa(item) === norm);
}

function partnerOnly(contact: AudienceContact): boolean {
  return contact.sources.length > 0 && contact.sources.every((source) => source === 'SALES_PARTNER' || source === 'WHOLESALE_REFERRAL');
}

export type RuleMatch = { pass: boolean; notApplicable: boolean };

export function matchContactRule(contact: AudienceContact, rule: SegmentRule, now = new Date()): RuleMatch {
  if ((rule.field === 'city' || rule.field === 'province') && partnerOnly(contact) && !contact.city && !contact.province) {
    return { pass: false, notApplicable: true };
  }
  if (rule.field === 'source') {
    return { pass: contact.sources.some((source) => listHas(rule, source)), notApplicable: false };
  }
  if (rule.field === 'city') return { pass: listHas(rule, contact.city, true), notApplicable: false };
  if (rule.field === 'province') return { pass: listHas(rule, contact.province, true), notApplicable: false };
  if (rule.field === 'customerSegment') return { pass: listHas(rule, contact.customerSegment), notApplicable: false };
  if (rule.field === 'partnerStatus') {
    if (!contact.partnerStatus) return { pass: true, notApplicable: false };
    return { pass: listHas(rule, contact.partnerStatus), notApplicable: false };
  }
  if (rule.field === 'referralStatus') {
    if (!contact.referralStatus) return { pass: true, notApplicable: false };
    return { pass: listHas(rule, contact.referralStatus), notApplicable: false };
  }
  if (rule.field === 'orderStatus') {
    const wanted = asStringList(rule.value, rule.field);
    return { pass: wanted.some((status) => contact.orderStatuses.includes(status)), notApplicable: false };
  }
  if (rule.field === 'orderCount') {
    const n = asNumber(rule.value, rule.field);
    const pass = rule.op === 'gte' ? contact.orderCount >= n : contact.orderCount <= n;
    return { pass, notApplicable: false };
  }
  if (rule.field === 'lastOrderAt') {
    if (rule.op === 'never') return { pass: !contact.lastOrderAt, notApplicable: false };
    if (!contact.lastOrderAt) return { pass: false, notApplicable: false };
    const at = new Date(contact.lastOrderAt);
    if (rule.op === 'withinDays') {
      const days = asNumber(rule.value, rule.field);
      return { pass: now.getTime() - at.getTime() <= days * 86_400_000, notApplicable: false };
    }
    const boundary = asDate(rule.value, rule.field);
    const pass = rule.op === 'before' ? at < boundary : at > boundary;
    return { pass, notApplicable: false };
  }
  if (rule.field === 'createdAt') {
    const createdAt = (contact as AudienceContact & { createdAt?: string | null }).createdAt;
    if (!createdAt) return { pass: true, notApplicable: false };
    const boundary = asDate(rule.value, rule.field);
    const at = new Date(createdAt);
    const pass = rule.op === 'before' ? at < boundary : at > boundary;
    return { pass, notApplicable: false };
  }
  return { pass: false, notApplicable: false };
}

export function contactMatchesRules(contact: AudienceContact, rules: SegmentRule[], now = new Date()): RuleMatch {
  let notApplicable = false;
  for (const rule of rules) {
    const result = matchContactRule(contact, rule, now);
    if (result.notApplicable) notApplicable = true;
    if (!result.pass) return { pass: false, notApplicable };
  }
  return { pass: true, notApplicable };
}

export function isAudienceSourceList(value: unknown): value is AudienceSource[] {
  return Array.isArray(value) && value.every((item) => (AUDIENCE_SOURCE_PRIORITY as readonly string[]).includes(String(item)));
}
