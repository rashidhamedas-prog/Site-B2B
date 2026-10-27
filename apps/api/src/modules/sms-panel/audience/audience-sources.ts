import { customerChannelSql, isRetailCustomerType } from '../../customer/customer-channel';
import { SETTLED_ORDER_STATUSES } from '../../customer-marketing/customer-marketing.constants';
import { normalizeIranMobileStrict } from '../domain/phone';
import {
  type AudienceHit,
  type AudienceSource,
  PARTNER_CONSENT_SOURCE_DEFAULT,
} from './audience.types';

export type AudienceDb = {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
};

const SEARCH_CAP = 200;

export function likeContains(raw: string): string {
  const escaped = String(raw || '').replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return `%${escaped}%`;
}

/** Active blacklist for the audience view. Expired rows do not apply. Scope ALL and PROMO block the contact. */
export function isBlacklistActive(
  row: { expiresAt?: Date | string | null; scope?: string | null },
  now = new Date(),
): boolean {
  if (row.expiresAt) {
    const at = new Date(row.expiresAt).getTime();
    if (Number.isFinite(at) && at <= now.getTime()) return false;
  }
  const scope = String(row.scope || 'ALL').toUpperCase();
  return scope === 'ALL' || scope === 'PROMO';
}

export function customerHasSmsPromoConsent(
  rows: Array<{ channel?: string | null; status?: string | null; source?: string | null }>,
): { ok: boolean; source: string | null } {
  const hit = rows.find(
    (row) => String(row.channel || '').toUpperCase() === 'SMS' && String(row.status || '').toUpperCase() === 'GRANTED',
  );
  return { ok: !!hit, source: hit?.source ? String(hit.source) : null };
}

export function audienceSourceForCustomerType(type?: string | null): 'WHOLESALE' | 'RETAIL' {
  return isRetailCustomerType(type) ? 'RETAIL' : 'WHOLESALE';
}

export function defaultPartnerPromoConsent(now = new Date()) {
  return {
    smsPromoConsent: true as const,
    smsPromoConsentSource: PARTNER_CONSENT_SOURCE_DEFAULT,
    smsPromoConsentAt: now,
  };
}

/** Inbound لغو11 / 12 stays on the phone. The stored partner flag is not rewritten. */
export function partnerConsentAfterInbound(row: {
  smsPromoConsent: boolean;
  smsPromoConsentSource: string;
}): { smsPromoConsent: boolean; smsPromoConsentSource: string } {
  return {
    smsPromoConsent: row.smsPromoConsent,
    smsPromoConsentSource: row.smsPromoConsentSource,
  };
}

type CustomerRow = {
  id: string;
  phone: string;
  phone2?: string | null;
  businessName?: string | null;
  ownerName?: string | null;
  type?: string | null;
  segment?: string | null;
  province?: string | null;
  city?: string | null;
};

type OrderAgg = {
  customerId: string;
  orderCount: number;
  lastOrderAt: Date | string | null;
  orderStatuses: string[] | null;
};

function customerName(row: CustomerRow, source: 'WHOLESALE' | 'RETAIL'): string {
  const business = String(row.businessName || '').trim();
  const owner = String(row.ownerName || '').trim();
  if (source === 'RETAIL') return owner || business;
  return business || owner;
}

export function hitsFromCustomerRows(
  rows: CustomerRow[],
  consentByCustomer: Map<string, string | null>,
  ordersByCustomer: Map<string, OrderAgg>,
): { hits: AudienceHit[]; invalid: string[] } {
  const hits: AudienceHit[] = [];
  const invalid: string[] = [];
  for (const row of rows) {
    const source = audienceSourceForCustomerType(row.type);
    const consent = consentByCustomer.has(row.id);
    const orders = ordersByCustomer.get(row.id);
    const base = {
      source,
      customerId: row.id,
      name: customerName(row, source),
      city: row.city || undefined,
      province: row.province || undefined,
      customerSegment: row.segment || undefined,
      lastOrderAt: orders?.lastOrderAt ? new Date(orders.lastOrderAt).toISOString() : null,
      orderCount: Number(orders?.orderCount || 0),
      orderStatuses: orders?.orderStatuses || [],
      promoConsent: consent,
      consentSource: consent ? consentByCustomer.get(row.id) || null : null,
    };
    const primary = normalizeIranMobileStrict(row.phone);
    if (!primary) invalid.push(String(row.phone || ''));
    else hits.push({ ...base, phoneRaw: primary, phoneKind: 'PRIMARY' });

    const secondaryRaw = String(row.phone2 || '').trim();
    if (!secondaryRaw) continue;
    const secondary = normalizeIranMobileStrict(secondaryRaw);
    if (!secondary) {
      invalid.push(secondaryRaw);
      continue;
    }
    hits.push({ ...base, phoneRaw: secondary, phoneKind: 'SECONDARY' });
  }
  return { hits, invalid };
}

export function hitsFromSalesPartners(
  rows: Array<{
    id: string;
    phone: string;
    displayName?: string | null;
    status?: string | null;
    smsPromoConsent?: boolean | null;
    smsPromoConsentSource?: string | null;
  }>,
): { hits: AudienceHit[]; invalid: string[] } {
  const hits: AudienceHit[] = [];
  const invalid: string[] = [];
  for (const row of rows) {
    const phone = normalizeIranMobileStrict(row.phone);
    if (!phone) {
      invalid.push(String(row.phone || ''));
      continue;
    }
    const consented = row.smsPromoConsent !== false;
    hits.push({
      phoneRaw: phone,
      source: 'SALES_PARTNER',
      phoneKind: 'PRIMARY',
      salesPartnerId: row.id,
      name: String(row.displayName || '').trim(),
      partnerStatus: row.status || undefined,
      promoConsent: consented,
      consentSource: consented ? row.smsPromoConsentSource || PARTNER_CONSENT_SOURCE_DEFAULT : null,
      orderCount: 0,
      orderStatuses: [],
    });
  }
  return { hits, invalid };
}

export function hitsFromReferrals(
  rows: Array<{
    id: string;
    phone: string;
    displayName?: string | null;
    status?: string | null;
    smsPromoConsent?: boolean | null;
    smsPromoConsentSource?: string | null;
  }>,
): { hits: AudienceHit[]; invalid: string[] } {
  const hits: AudienceHit[] = [];
  const invalid: string[] = [];
  for (const row of rows) {
    const phone = normalizeIranMobileStrict(row.phone);
    if (!phone) {
      invalid.push(String(row.phone || ''));
      continue;
    }
    const consented = row.smsPromoConsent !== false;
    hits.push({
      phoneRaw: phone,
      source: 'WHOLESALE_REFERRAL',
      phoneKind: 'PRIMARY',
      referralPartnerId: row.id,
      name: String(row.displayName || '').trim(),
      referralStatus: row.status || undefined,
      promoConsent: consented,
      consentSource: consented ? row.smsPromoConsentSource || PARTNER_CONSENT_SOURCE_DEFAULT : null,
      orderCount: 0,
      orderStatuses: [],
    });
  }
  return { hits, invalid };
}

function channelPredicate(channel: 'WHOLESALE' | 'RETAIL'): string {
  return customerChannelSql('c', channel);
}

export function buildCustomerQuery(input: {
  channel: 'WHOLESALE' | 'RETAIL';
  q?: string | null;
  phone?: string | null;
  limit?: number;
}): { sql: string; params: unknown[] } {
  const q = input.q?.trim() ? likeContains(input.q.trim()) : null;
  const phone = input.phone ? normalizeIranMobileStrict(input.phone) : null;
  const sql = `
    SELECT c.id AS "id", c.phone AS "phone", c."phone2" AS "phone2",
           c."businessName" AS "businessName", c."ownerName" AS "ownerName",
           c.type AS "type", c.segment AS "segment",
           c.province AS "province", c.city AS "city"
    FROM customers c
    WHERE c."deletedAt" IS NULL
      AND ${channelPredicate(input.channel)}
      AND (
        $1::text IS NULL
        OR c.phone ILIKE $1 ESCAPE '\\'
        OR COALESCE(c."phone2", '') ILIKE $1 ESCAPE '\\'
        OR c."businessName" ILIKE $1 ESCAPE '\\'
        OR c."ownerName" ILIKE $1 ESCAPE '\\'
        OR ($2::text IS NOT NULL AND (c.phone = $2 OR c."phone2" = $2))
      )
    ORDER BY c."createdAt" DESC
    LIMIT $3
  `;
  return { sql, params: [q, phone, Math.min(input.limit || SEARCH_CAP, SEARCH_CAP)] };
}

export function buildPartnerQuery(table: 'sales_partner_profiles' | 'wholesale_referral_partners', input: {
  q?: string | null;
  phone?: string | null;
  limit?: number;
}): { sql: string; params: unknown[] } {
  const q = input.q?.trim() ? likeContains(input.q.trim()) : null;
  const phone = input.phone ? normalizeIranMobileStrict(input.phone) : null;
  const sql = `
    SELECT id AS "id", phone AS "phone", "displayName" AS "displayName", status AS "status",
           "smsPromoConsent" AS "smsPromoConsent", "smsPromoConsentSource" AS "smsPromoConsentSource"
    FROM ${table}
    WHERE (
      $1::text IS NULL
      OR phone ILIKE $1 ESCAPE '\\'
      OR "displayName" ILIKE $1 ESCAPE '\\'
      OR ($2::text IS NOT NULL AND phone = $2)
    )
    ORDER BY "createdAt" DESC
    LIMIT $3
  `;
  return { sql, params: [q, phone, Math.min(input.limit || SEARCH_CAP, SEARCH_CAP)] };
}

export function assertUserInputNotInSql(sql: string, raw: string) {
  if (raw && sql.includes(raw)) {
    throw new Error('user input was interpolated into SQL');
  }
}

async function customerHits(
  db: AudienceDb,
  channel: 'WHOLESALE' | 'RETAIL',
  opts: { q?: string | null; phone?: string | null },
): Promise<{ hits: AudienceHit[]; invalid: string[] }> {
  const built = buildCustomerQuery({ channel, ...opts });
  if (opts.q) assertUserInputNotInSql(built.sql, opts.q);
  const rows = await db.query<CustomerRow>(built.sql, built.params);
  const ids = rows.map((row) => row.id).filter(Boolean);
  const consentByCustomer = new Map<string, string | null>();
  const ordersByCustomer = new Map<string, OrderAgg>();
  if (ids.length) {
    const consents = await db.query<{ customerId: string; source: string | null }>(
      `SELECT "customerId" AS "customerId", source AS "source"
       FROM marketing_consents
       WHERE channel = 'SMS' AND status = 'GRANTED' AND "customerId" = ANY($1::uuid[])`,
      [ids],
    );
    for (const row of consents) consentByCustomer.set(row.customerId, row.source || null);
    const orders = await db.query<OrderAgg>(
      `SELECT o."customerId" AS "customerId",
              COUNT(*) FILTER (WHERE o.status = ANY($2::text[]))::int AS "orderCount",
              MAX(o."createdAt") FILTER (WHERE o.status = ANY($2::text[])) AS "lastOrderAt",
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT o.status), NULL) AS "orderStatuses"
       FROM orders o
       WHERE o."deletedAt" IS NULL AND o."customerId" = ANY($1::uuid[])
       GROUP BY o."customerId"`,
      [ids, [...SETTLED_ORDER_STATUSES]],
    );
    for (const row of orders) ordersByCustomer.set(row.customerId, row);
  }
  return hitsFromCustomerRows(rows, consentByCustomer, ordersByCustomer);
}

export async function loadSourceHits(
  db: AudienceDb,
  source: AudienceSource,
  opts: { q?: string | null; phone?: string | null },
): Promise<{ hits: AudienceHit[]; invalid: string[] }> {
  if (source === 'WHOLESALE' || source === 'RETAIL') return customerHits(db, source, opts);
  if (source === 'SALES_PARTNER') {
    const built = buildPartnerQuery('sales_partner_profiles', opts);
    if (opts.q) assertUserInputNotInSql(built.sql, opts.q);
    const rows = await db.query(built.sql, built.params);
    return hitsFromSalesPartners(rows as never);
  }
  const built = buildPartnerQuery('wholesale_referral_partners', opts);
  if (opts.q) assertUserInputNotInSql(built.sql, opts.q);
  const rows = await db.query(built.sql, built.params);
  return hitsFromReferrals(rows as never);
}

export async function loadSuppressionPhones(db: AudienceDb, phones: string[]): Promise<{
  optedOut: string[];
  blacklisted: string[];
}> {
  if (!phones.length) return { optedOut: [], blacklisted: [] };
  const [suppressed, unsub, blacklist] = await Promise.all([
    db.query<{ phoneNormalized: string }>(
      `SELECT "phoneNormalized" AS "phoneNormalized" FROM marketing_suppressions WHERE "phoneNormalized" = ANY($1::text[])`,
      [phones],
    ),
    db.query<{ phoneNormalized: string }>(
      `SELECT "phoneNormalized" AS "phoneNormalized" FROM sms_unsubscribe
       WHERE "phoneNormalized" = ANY($1::text[]) AND "resubscribedAt" IS NULL`,
      [phones],
    ),
    db.query<{ phoneNormalized: string; expiresAt: string | null; scope: string | null }>(
      `SELECT "phoneNormalized" AS "phoneNormalized", "expiresAt" AS "expiresAt", scope AS "scope"
       FROM sms_blacklist WHERE "phoneNormalized" = ANY($1::text[])`,
      [phones],
    ),
  ]);
  const optedOut = [
    ...suppressed.map((row) => row.phoneNormalized),
    ...unsub.map((row) => row.phoneNormalized),
  ];
  const blacklisted = blacklist.filter((row) => isBlacklistActive(row)).map((row) => row.phoneNormalized);
  return { optedOut, blacklisted };
}

export async function countSource(db: AudienceDb, source: AudienceSource): Promise<number> {
  if (source === 'WHOLESALE' || source === 'RETAIL') {
    const rows = await db.query<{ count: string }>(
      `SELECT COUNT(*)::int AS "count" FROM customers c
       WHERE c."deletedAt" IS NULL AND ${channelPredicate(source)}`,
    );
    return Number(rows[0]?.count || 0);
  }
  const table = source === 'SALES_PARTNER' ? 'sales_partner_profiles' : 'wholesale_referral_partners';
  const rows = await db.query<{ count: string }>(`SELECT COUNT(*)::int AS "count" FROM ${table}`);
  return Number(rows[0]?.count || 0);
}
