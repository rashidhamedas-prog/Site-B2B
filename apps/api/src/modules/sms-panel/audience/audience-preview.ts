import { countSmsParts } from '../domain/parts';
import { ensureOptOutFooter, type SmsMessageClass } from '../domain/template';
import type { AudienceContact } from './audience.types';
import { contactMatchesRules, type SegmentRule } from './segment-rules';

const WORST_VAR = 'ن'.repeat(80);

export function worstCaseSmsBody(text: string, messageClass: SmsMessageClass): string {
  const filled = String(text || '').replace(/\{(\w+)\}/g, () => WORST_VAR);
  return ensureOptOutFooter(filled, messageClass);
}

export type AudiencePreview = {
  total: number;
  duplicates: number;
  optedOut: number;
  blacklisted: number;
  noConsent: number;
  invalid: number;
  notApplicable: number;
  final: number;
  partsPerMsg: number;
  totalParts: number;
  availableCredit: number;
  creditOk: boolean;
  unitPricePerPart: number | null;
  estimatedCost: number | null;
  sample: AudienceContact[];
  recipients: AudienceContact[];
};

export function readUnitPrice(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = (raw as Record<string, unknown>).unitPricePerPart;
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/** Send funnel after merge. Opt-out and blacklist cannot be disabled. */
export function previewAudience(input: {
  contacts: AudienceContact[];
  duplicateExtras: number;
  invalid: number;
  rules: SegmentRule[];
  messageClass: SmsMessageClass;
  text: string;
  availableCredit: number;
  unitPricePerPart: number | null;
  now?: Date;
}): AudiencePreview {
  let notApplicable = 0;
  const matched: AudienceContact[] = [];
  for (const contact of input.contacts) {
    const result = contactMatchesRules(contact, input.rules, input.now);
    if (result.notApplicable && !result.pass) {
      notApplicable += 1;
      continue;
    }
    if (result.pass) matched.push(contact);
  }

  let optedOut = 0;
  let blacklisted = 0;
  let noConsent = 0;
  const finalRows: AudienceContact[] = [];
  for (const contact of matched) {
    if (contact.optedOut) {
      optedOut += 1;
      continue;
    }
    if (contact.blacklisted) {
      blacklisted += 1;
      continue;
    }
    if (input.messageClass === 'PROMO' && !contact.promoConsent) {
      noConsent += 1;
      continue;
    }
    finalRows.push(contact);
  }

  const partsPerMsg = countSmsParts(worstCaseSmsBody(input.text, input.messageClass));
  const final = finalRows.length;
  const totalParts = final * partsPerMsg;
  const price = input.unitPricePerPart;
  return {
    total: input.contacts.length + input.duplicateExtras + input.invalid,
    duplicates: input.duplicateExtras,
    optedOut,
    blacklisted,
    noConsent,
    invalid: input.invalid,
    notApplicable,
    final,
    partsPerMsg,
    totalParts,
    availableCredit: input.availableCredit,
    creditOk: totalParts <= input.availableCredit,
    unitPricePerPart: price,
    estimatedCost: price == null ? null : final * partsPerMsg * price,
    sample: finalRows.slice(0, 20),
    recipients: finalRows,
  };
}
