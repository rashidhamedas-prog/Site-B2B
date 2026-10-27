import { maskMobile, normalizeIranMobileStrict } from '../domain/phone';
import {
  type AudienceContact,
  type AudienceHit,
  type AudiencePhoneKind,
  type AudienceSource,
  masksAudiencePhone,
  sourcePriority,
} from './audience.types';

export type MergeAudienceInput = {
  hits: AudienceHit[];
  optedOutPhones?: Iterable<string>;
  blacklistedPhones?: Iterable<string>;
};

export type MergeAudienceResult = {
  contacts: AudienceContact[];
  invalid: string[];
};

function phoneSet(values?: Iterable<string>): Set<string> {
  const out = new Set<string>();
  if (!values) return out;
  for (const raw of values) {
    const phone = normalizeIranMobileStrict(raw);
    if (phone) out.add(phone);
  }
  return out;
}

function emptyContact(phone: string): AudienceContact & { _priority: number; _consentPriority: number } {
  return {
    phone,
    sources: [],
    phoneKinds: [],
    name: '',
    orderCount: 0,
    orderStatuses: [],
    promoConsent: false,
    consentSource: null,
    optedOut: false,
    blacklisted: false,
    _priority: 99,
    _consentPriority: 99,
  };
}

function pushUnique<T>(list: T[], value: T) {
  if (!list.includes(value)) list.push(value);
}

/** Pure dedupe. Opt-out and an active blacklist always beat promo consent. */
export function mergeAudienceHits(input: MergeAudienceInput): MergeAudienceResult {
  const optedOut = phoneSet(input.optedOutPhones);
  const blacklisted = phoneSet(input.blacklistedPhones);
  const invalid: string[] = [];
  const byPhone = new Map<string, ReturnType<typeof emptyContact>>();

  for (const hit of input.hits) {
    const phone = normalizeIranMobileStrict(hit.phoneRaw);
    if (!phone) {
      if (hit.phoneRaw) invalid.push(String(hit.phoneRaw));
      continue;
    }
    const row = byPhone.get(phone) || emptyContact(phone);
    const priority = sourcePriority(hit.source);
    pushUnique(row.sources, hit.source);
    pushUnique<AudiencePhoneKind>(row.phoneKinds, hit.phoneKind);

    const better = priority < row._priority;
    const same = priority === row._priority;
    if (better || (same && !row.name && hit.name)) {
      row._priority = priority;
      row.name = hit.name || row.name;
      row.city = hit.city;
      row.province = hit.province;
      row.customerSegment = hit.customerSegment;
      row.partnerStatus = hit.partnerStatus;
      row.referralStatus = hit.referralStatus;
      row.lastOrderAt = hit.lastOrderAt ?? null;
      row.orderCount = hit.orderCount || 0;
      row.orderStatuses = [...(hit.orderStatuses || [])];
      if (hit.customerId) row.customerId = hit.customerId;
      if (hit.salesPartnerId) row.salesPartnerId = hit.salesPartnerId;
      if (hit.referralPartnerId) row.referralPartnerId = hit.referralPartnerId;
    } else {
      if (!row.customerId && hit.customerId) row.customerId = hit.customerId;
      if (!row.salesPartnerId && hit.salesPartnerId) row.salesPartnerId = hit.salesPartnerId;
      if (!row.referralPartnerId && hit.referralPartnerId) row.referralPartnerId = hit.referralPartnerId;
    }

    if (hit.promoConsent && priority < row._consentPriority) {
      row._consentPriority = priority;
      row.promoConsent = true;
      row.consentSource = hit.consentSource || null;
    } else if (hit.promoConsent && !row.promoConsent) {
      row.promoConsent = true;
      row.consentSource = hit.consentSource || null;
    }

    byPhone.set(phone, row);
  }

  const contacts: AudienceContact[] = [];
  for (const row of byPhone.values()) {
    row.sources.sort((a, b) => sourcePriority(a) - sourcePriority(b));
    row.optedOut = optedOut.has(row.phone);
    row.blacklisted = blacklisted.has(row.phone);
    if (row.optedOut || row.blacklisted) row.promoConsent = false;
    const { _priority, _consentPriority, ...contact } = row;
    void _priority;
    void _consentPriority;
    contacts.push(contact);
  }
  contacts.sort((a, b) => a.phone.localeCompare(b.phone));
  return { contacts, invalid };
}

export function presentAudienceContact(contact: AudienceContact, role?: string | null): AudienceContact {
  if (!masksAudiencePhone(role)) return contact;
  return { ...contact, phone: maskMobile(contact.phone) };
}

export function presentAudienceContacts(contacts: AudienceContact[], role?: string | null): AudienceContact[] {
  return contacts.map((row) => presentAudienceContact(row, role));
}

export async function settleSources<T>(
  loaders: Record<AudienceSource, () => Promise<T[]>>,
): Promise<{ rows: T[]; partialSources: AudienceSource[] }> {
  const sources = Object.keys(loaders) as AudienceSource[];
  const settled = await Promise.all(
    sources.map(async (source) => {
      try {
        const rows = await loaders[source]();
        return { source, rows };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'source failed';
        return { source, error: message };
      }
    }),
  );
  const rows: T[] = [];
  const partialSources: AudienceSource[] = [];
  for (const item of settled) {
    if ('error' in item) partialSources.push(item.source);
    else rows.push(...item.rows);
  }
  return { rows, partialSources };
}
