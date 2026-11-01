/**
 * OTP dispatch + manual credentials behavior (mocked service, no live SMS/DB).
 */
import assert from 'node:assert/strict';
import { BadRequestException, HttpException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { SalesPartnerService } from './sales-partner.service';
import { applicationFieldsAfterOtp } from './sales-partner-policy';
import { generateValidSalesPartnerTempPassword } from './sales-partner-welcome-sms';
import { auditPayloadForSmsAttempt, buildCredentialsSmsAttempt } from './sales-partner-sms-attempt';

function assertCond(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const phone = '09121234567';

assertCond(
  applicationFieldsAfterOtp({
    displayName: 'A',
    socialHandles: null,
    answers: null,
    pendingRevision: null,
    status: 'PENDING_OTP',
  }).status === 'PENDING_REVIEW',
  'after otp → PENDING_REVIEW not APPROVED',
);

const tempPassword = generateValidSalesPartnerTempPassword(phone);
assertCond(tempPassword.length >= 8, 'temp password length');
const hash = bcrypt.hashSync(tempPassword, 12);
assertCond(bcrypt.compareSync(tempPassword, hash), 'bcrypt 12');

const credAttempt = buildCredentialsSmsAttempt(phone, true);
assertCond(!JSON.stringify(auditPayloadForSmsAttempt(credAttempt)).includes(tempPassword), 'no password in audit');

async function runIssueOtp503RecordsAttempt() {
  const updates: unknown[] = [];
  const audits: Array<{ action: string; payload: Record<string, unknown> }> = [];
  const notifications = {
    sendOtpDetailed: async () => ({
      ok: false,
      errorCode: 'PROVIDER' as const,
      errorMessage: 'reject',
      via: 'direct' as const,
      durationMs: 3,
    }),
  };
  const svc = Object.create(SalesPartnerService.prototype) as SalesPartnerService;
  Object.assign(svc, {
    otp: {
      issue: async () => ({ code: '123456' }),
      ttlSeconds: () => 120,
      clear: async () => {},
      clearCooldown: async () => {},
      cooldownSeconds: () => 60,
    },
    notifications,
    config: { get: (key: string) => (key === 'NODE_ENV' ? 'production' : undefined) },
    logger: { warn: () => {} },
    applications: { update: async (_id: string, patch: unknown) => updates.push(patch) },
    audit: async (_actor: unknown, action: string, _t: string, _id: string, payload: Record<string, unknown>) => {
      audits.push({ action, payload });
    },
  });

  let threw = false;
  try {
    await (svc as any).issueOtp(phone, 'N', 'sales_partner_apply', 'app-1', 'admin-1');
  } catch (err) {
    threw = err instanceof HttpException && err.getStatus() === 503;
  }
  assertCond(threw, 'production hard-fail 503');
  assertCond(updates.length === 1, 'attempt persisted before 503');
  assertCond(audits.some((a) => a.action === 'application.otp_dispatch'), 'otp_dispatch audit');
  assertCond(!JSON.stringify(audits).includes('123456'), 'no otp code in audit');
}

async function runManualVerifyRollbackOnSmsFail() {
  let txCalls = 0;
  const svc = Object.create(SalesPartnerService.prototype) as SalesPartnerService;
  Object.assign(svc, {
    config: {
      get: (key: string) =>
        key === 'NODE_ENV' ? 'production' : key === 'NEXT_PUBLIC_RETAIL_URL' ? 'https://www.poshaktaranom.ir' : undefined,
    },
    applications: {
      findOne: async () => ({
        id: 'app-1',
        phone,
        displayName: 'N',
        status: 'PENDING_OTP',
      }),
      update: async () => {},
    },
    users: {
      manager: {
        transaction: async (fn: (manager: unknown) => Promise<unknown>) => {
          txCalls += 1;
          const manager = {
            findOne: async (_entity: unknown, opts: { where?: { status?: string } }) => {
              if (opts?.where?.status === 'PENDING_OTP') {
                return {
                  id: 'app-1',
                  phone,
                  displayName: 'N',
                  status: 'PENDING_OTP',
                  socialHandles: null,
                  answers: null,
                  pendingRevision: null,
                  profileId: null,
                };
              }
              return {
                id: 'user-1',
                phone,
                role: 'CUSTOMER',
                isActive: true,
                deletedAt: null,
                passwordHash: 'x',
              };
            },
            create: (_entity: unknown, row: unknown) => row,
            save: async (row: unknown) => row,
          };
          return fn(manager);
        },
      },
    },
    notifications: {
      salesPartnerWelcome: async () => false,
    },
    audit: async () => {},
    emit: async () => {},
  });

  let failed = false;
  try {
    await svc.manualVerifyApplicationCredentials('app-1', 'admin-1');
  } catch (err) {
    failed = err instanceof BadRequestException;
  }
  assertCond(failed, 'sms fail rolls back via transaction throw');
  assertCond(txCalls === 1, 'single transaction');
}

void (async () => {
  await runIssueOtp503RecordsAttempt();
  await runManualVerifyRollbackOnSmsFail();
  console.log('sales-partner-otp-dispatch.spec.ts: ok');
})();
