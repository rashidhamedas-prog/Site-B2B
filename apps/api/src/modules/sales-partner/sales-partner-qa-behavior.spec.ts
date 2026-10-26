/**
 * Behavioral QA tests for B1/B2/B3/B6/B7 — call real service methods with mocks.
 * Plain ts-node; no Nest bootstrap / live DB.
 */
import { BadRequestException, ConflictException, HttpException, HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { allocatePayoutIrr } from './sales-partner-ledger-policy';
import {
  readPriorAttributionProductIds,
  signSalesPartnerAttributionToken,
} from './sales-partner-link-token';
import { resolveSalesPartnerAttrSecret } from './sales-partner-attr-secret';
import { SalesPartnerDraftService } from './sales-partner-draft.service';
import { SalesPartnerPayoutService } from './sales-partner-payout.service';
import { SalesPartnerService } from './sales-partner.service';
import { SALES_PARTNER_LOGIN_MAX_FAILS } from './sales-partner-login-lockout';
import { normalizePhone } from '../auth/phone.util';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const now = new Date('2026-10-26T12:00:00.000Z');
const availableAt = new Date('2026-10-01T00:00:00.000Z');

function stubRepo() {
  return {
    findOne: async () => null,
    find: async () => [],
    count: async () => 0,
    save: async (row: unknown) => row,
    create: (row: unknown) => row,
  };
}

async function main() {
  // ── B7: reverse restores exactly prior allocatable amount (no double-count) ──
  {
    const earnedId = 'earned-1';
    const payoutId = 'pay-1';
    const afterPayout = [
      {
        id: earnedId,
        amountIrr: 80_000,
        entryType: 'COMMISSION_EARNED' as const,
        availableAt,
        payoutId,
        bucket: 'available' as const,
        orderItemId: 'item-1',
      },
      {
        id: 'payout-ledger',
        amountIrr: -80_000,
        entryType: 'PAYOUT' as const,
        availableAt: now,
        payoutId,
        bucket: 'available' as const,
        orderItemId: null,
      },
    ];
    assert(allocatePayoutIrr(afterPayout, now).amountIrr === 0, 'B7 nothing open after payout');

    const afterReverse = [
      ...afterPayout,
      {
        id: 'rev-1',
        amountIrr: 80_000,
        entryType: 'PAYOUT_REVERSAL' as const,
        availableAt: now,
        payoutId: null,
        bucket: 'available' as const,
        orderItemId: null,
      },
    ];
    const again = allocatePayoutIrr(afterReverse, now);
    assert(again.amountIrr === 80_000, 'B7 re-allocate equals original payout amount');
    assert(again.entryIds.includes('rev-1'), 'B7 pays the reversal row');
    assert(!again.entryIds.includes(earnedId), 'B7 does not re-pay attached earned');
  }

  // ── B1: adminChangeAttribution updates draft + order, deletes orphan snapshots ──
  {
    const draftId = 'draft-b1';
    const orderId = 'order-b1';
    const oldPartner = 'partner-old';
    const nextPartner = 'partner-new';
    const lockedDraft: {
      id: string;
      convertedOrderId: string;
      salesPartnerId: string;
    } = {
      id: draftId,
      convertedOrderId: orderId,
      salesPartnerId: oldPartner,
    };
    const queries: string[] = [];
    const orderUpdates: Array<{ id: string; data: Record<string, unknown> }> = [];

    const drafts = {
      findOne: async () => ({
        id: draftId,
        convertedOrderId: orderId,
        salesPartnerId: lockedDraft.salesPartnerId,
      }),
    };
    const profiles = {
      findOne: async ({ where }: { where: { id: string } }) =>
        where.id === nextPartner ? { id: nextPartner, status: 'ACTIVE' } : null,
    };
    const ledger = { count: async () => 0 };
    const program = { recordAudit: async () => undefined };
    const dataSource = {
      transaction: async (fn: (manager: unknown) => Promise<void>) =>
        fn({
          query: async (sql: string) => {
            queries.push(sql);
          },
          findOne: async (_Entity: unknown, opts: { where: { id: string } }) =>
            opts.where.id === draftId ? lockedDraft : null,
          save: async (row: typeof lockedDraft) => {
            Object.assign(lockedDraft, row);
            return row;
          },
          update: async (_Entity: unknown, id: string, data: Record<string, unknown>) => {
            orderUpdates.push({ id, data });
          },
          getRepository: () => ({ count: async () => 0 }),
        }),
    };

    const svc = new SalesPartnerDraftService(
      drafts as never,
      stubRepo() as never,
      profiles as never,
      stubRepo() as never,
      stubRepo() as never,
      stubRepo() as never,
      stubRepo() as never,
      ledger as never,
      program as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => undefined } as never,
      dataSource as never,
    );

    await svc.adminChangeAttribution(
      draftId,
      nextPartner,
      'تصحيح انتساب سفارش برای تست QA',
      'admin-actor',
    );
    assert(lockedDraft.salesPartnerId === nextPartner, 'B1 draft.salesPartnerId updated');
    assert(
      orderUpdates.some((row) => row.id === orderId && row.data.salesPartnerId === nextPartner),
      'B1 order attribution updated',
    );
    assert(
      queries.some((sql) => /DELETE FROM sales_commission_snapshots/i.test(sql)),
      'B1 orphan snapshots deleted',
    );
  }

  // ── B2: confirm with wrong expectedAmountIrr → Conflict, no payout/ledger save ──
  {
    const partnerId = 'partner-b2';
    const open = [
      {
        id: 'entry-b2',
        amountIrr: '60000',
        entryType: 'COMMISSION_EARNED',
        availableAt,
        payoutId: null,
        bucket: 'available',
        orderItemId: 'item-b2',
        salesPartnerId: partnerId,
      },
    ];
    let payoutSaves = 0;
    let ledgerSaves = 0;
    let itemSaves = 0;

    const profiles = {
      findOne: async () => ({ id: partnerId, ibanChangedAt: null }),
    };
    const payouts = { findOne: async () => null };
    const program = {
      ibanCooldownHours: () => 72,
      settings: async () => ({ minPayoutIrr: 10_000 }),
    };
    const dataSource = {
      transaction: async (fn: (manager: unknown) => Promise<unknown>) =>
        fn({
          query: async () => undefined,
          getRepository: (Entity: { name?: string }) => {
            const name = String(Entity?.name || '');
            if (/PayoutItem/i.test(name)) {
              return {
                create: (row: unknown) => row,
                save: async () => {
                  itemSaves += 1;
                },
              };
            }
            if (/Ledger/i.test(name)) {
              return {
                find: async () => open,
                save: async () => {
                  ledgerSaves += 1;
                },
              };
            }
            return {
              findOne: async () => null,
              create: (row: unknown) => row,
              save: async (row: unknown) => {
                payoutSaves += 1;
                return { id: 'payout-new', ...(row as object) };
              },
            };
          },
        }),
    };

    const svc = new SalesPartnerPayoutService(
      payouts as never,
      stubRepo() as never,
      stubRepo() as never,
      profiles as never,
      program as never,
      dataSource as never,
    );

    let threw: unknown;
    try {
      await svc.confirm('admin-1', {
        salesPartnerId: partnerId,
        expectedAmountIrr: 100_000,
        bankReference: 'REF-1234',
        idempotencyKey: 'idem-b2',
      });
    } catch (err) {
      threw = err;
    }
    assert(threw instanceof ConflictException, 'B2 ConflictException on mismatch');
    assert(payoutSaves === 0 && ledgerSaves === 0 && itemSaves === 0, 'B2 no payout/ledger written');
  }

  // ── B3: updateIban auth + cooldown blocks confirm ──
  {
    const partnerId = 'partner-b3';
    const phone = '09151234567';
    const password = 'CorrectPass1!';
    const passwordHash = await bcrypt.hash(password, 4);
    let profileSaved = 0;
    const smsCalls: string[] = [];
    const profile: {
      id: string;
      userId: string;
      phone: string;
      status: string;
      ibanLast4: string | null;
      ibanFingerprint: string | null;
      ibanCipher: string | null;
      ibanChangedAt: Date | null;
      publicCode: string | null;
      displayName: string | null;
      applicationAnswers: Record<string, unknown> | null;
    } = {
      id: partnerId,
      userId: 'user-b3',
      phone,
      status: 'ACTIVE',
      ibanLast4: null,
      ibanFingerprint: null,
      ibanCipher: null,
      ibanChangedAt: null,
      publicCode: 'ab12cd34',
      displayName: 'Partner B3',
      applicationAnswers: null,
    };

    const store = new Map<string, string>();
    const redis = {
      isReady: true,
      get: async (key: string) => store.get(key) ?? null,
      incrWithTtl: async (key: string) => {
        const next = Number(store.get(key) || 0) + 1;
        store.set(key, String(next));
        return next;
      },
      del: async (key: string) => {
        store.delete(key);
      },
    };
    const profiles = {
      findOne: async () => profile,
      save: async (row: typeof profile) => {
        profileSaved += 1;
        Object.assign(profile, row);
        return row;
      },
    };
    const users = {
      findOne: async () => ({
        id: profile.userId,
        phone: normalizePhone(phone),
        passwordHash,
      }),
      save: async (row: unknown) => row,
    };
    const audits = {
      create: (row: unknown) => row,
      save: async () => undefined,
    };
    const otp = {
      consumeSessionGrant: async () => false,
      hasSessionGrant: async () => false,
    };
    const config = {
      get: (key: string) => {
        if (key === 'NODE_ENV' || key === 'APP_ENV') return 'development';
        if (key === 'JWT_SECRET') return 'test-jwt-secret-16+';
        if (key === 'SALES_PARTNER_IBAN_KEY') return 'dedicated-iban-key-16';
        if (key === 'SALES_PARTNER_IBAN_COOLDOWN_HOURS') return '72';
        return undefined;
      },
    };
    const notifications = {
      sendSms: async (to: string) => {
        smsCalls.push(to);
      },
    };

    const partnerSvc = new SalesPartnerService(
      profiles as never,
      stubRepo() as never,
      audits as never,
      stubRepo() as never,
      users as never,
      { sign: () => 'jwt' } as never,
      config as never,
      otp as never,
      redis as never,
      notifications as never,
    );

    let denied: unknown;
    try {
      await partnerSvc.updateIban(partnerId, 'IR120170000000123456789012');
    } catch (err) {
      denied = err;
    }
    assert(denied instanceof BadRequestException, 'B3 updateIban without auth fails');
    assert(profileSaved === 0, 'B3 no profile save without auth');

    await partnerSvc.updateIban(partnerId, 'IR120170000000123456789012', password);
    assert(profile.ibanChangedAt instanceof Date, 'B3 ibanChangedAt set');
    assert(profileSaved === 1, 'B3 profile saved with password');
    assert(smsCalls.length === 1, 'B3 sendSms called');

    const payouts = { findOne: async () => null };
    const program = {
      ibanCooldownHours: () => 72,
      settings: async () => ({ minPayoutIrr: 10_000 }),
    };
    let txEntered = 0;
    const payoutSvc = new SalesPartnerPayoutService(
      payouts as never,
      stubRepo() as never,
      stubRepo() as never,
      { findOne: async () => profile } as never,
      program as never,
      {
        transaction: async () => {
          txEntered += 1;
          throw new Error('should not enter txn during cooldown');
        },
      } as never,
    );
    let cooldownErr: unknown;
    try {
      await payoutSvc.confirm('admin-1', {
        salesPartnerId: partnerId,
        expectedAmountIrr: 60_000,
        bankReference: 'REF-COOL',
        idempotencyKey: 'idem-cool',
      });
    } catch (err) {
      cooldownErr = err;
    }
    assert(cooldownErr instanceof ConflictException, 'B3 confirm during cooldown → 409');
    assert(txEntered === 0, 'B3 confirm does not write during cooldown');
  }

  // ── B6: 5 fails then 6th correct still 429 (loginWithPassword + redis mock) ──
  {
    const phone = '09157654321';
    const password = 'CorrectPass1!';
    const passwordHash = await bcrypt.hash(password, 4);
    const store = new Map<string, string>();
    const redis = {
      isReady: true,
      get: async (key: string) => store.get(key) ?? null,
      incrWithTtl: async (key: string) => {
        const next = Number(store.get(key) || 0) + 1;
        store.set(key, String(next));
        return next;
      },
      del: async (key: string) => {
        store.delete(key);
      },
    };
    const users = {
      findOne: async () => ({
        id: 'user-b6',
        phone: normalizePhone(phone),
        passwordHash,
      }),
    };
    const svc = new SalesPartnerService(
      stubRepo() as never,
      stubRepo() as never,
      stubRepo() as never,
      stubRepo() as never,
      users as never,
      { sign: () => 'jwt' } as never,
      { get: () => undefined } as never,
      { consumeSessionGrant: async () => false } as never,
      redis as never,
    );

    const clientIp = '203.0.113.9';
    for (let i = 0; i < SALES_PARTNER_LOGIN_MAX_FAILS; i += 1) {
      let fail: unknown;
      try {
        await svc.loginWithPassword(phone, 'WrongPass1!', clientIp);
      } catch (err) {
        fail = err;
      }
      assert(fail instanceof HttpException, `B6 fail #${i + 1}`);
    }

    let locked: unknown;
    try {
      await svc.loginWithPassword(phone, password, clientIp);
    } catch (err) {
      locked = err;
    }
    assert(locked instanceof HttpException, 'B6 6th attempt throws');
    assert(
      (locked as HttpException).getStatus() === HttpStatus.TOO_MANY_REQUESTS,
      'B6 6th attempt 429 even with correct password',
    );
  }

  // ── B4: prior ids only from valid prior token (same code) ──
  {
    const secret = resolveSalesPartnerAttrSecret('attr-secret', 'jwt-fallback');
    assert(secret === 'attr-secret', 'B4 prefers SALES_PARTNER_ATTR_SECRET');
    const code = 'ab12cd34';
    const p1 = '11111111-1111-4111-8111-111111111111';
    const token = signSalesPartnerAttributionToken({ code, productIds: [p1], secret, now });
    const fromToken = readPriorAttributionProductIds({ token, code, secret, now });
    assert(fromToken.includes(p1), 'B4 prior from valid token');
    assert(
      readPriorAttributionProductIds({ token, code: 'zzzzzzzz', secret, now }).length === 0,
      'B4 prior rejected for other code',
    );
    assert(
      readPriorAttributionProductIds({ token: undefined, code, secret, now }).length === 0,
      'B4 free-form prior list not accepted without token',
    );
  }

  console.log('sales-partner-qa-behavior.spec.ts: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
