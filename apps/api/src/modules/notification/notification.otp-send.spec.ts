/**
 * OTP send path: empty/0 template → bulk; positive template → verify;
 * verify provider error → one bulk fallback. Never asserts OTP code in logs.
 */
import * as assert from 'node:assert/strict';
import { NotificationService } from './notification.service';

function smsCfg(partial: Record<string, unknown> = {}) {
  return {
    enabled: true,
    apiKey: 'TEST_KEY',
    lineNumber: '9982007567',
    otpTemplateId: 0,
    egressBaseUrl: '',
    egressSecret: '',
    templates: {},
    events: {},
    adminPhoneWholesale: '',
    adminPhoneWholesale2: '',
    adminPhoneRetail: '',
    adminPhoneRetail2: '',
    ...partial,
  };
}

async function withFetch(
  impl: typeof fetch,
  run: () => Promise<void>,
): Promise<void> {
  const prev = globalThis.fetch;
  (globalThis as any).fetch = impl;
  try {
    await run();
  } finally {
    (globalThis as any).fetch = prev;
  }
}

async function main() {
  const prevEnv = process.env.SMSIR_OTP_TEMPLATE_ID;
  delete process.env.SMSIR_OTP_TEMPLATE_ID;

  // --- bulk when template is 0 ---
  {
    const calls: Array<{ url: string; body: any }> = [];
    const settings = { sms: async () => smsCfg({ otpTemplateId: 0 }) } as any;
    const svc = new NotificationService(settings);
    await withFetch(async (input: any, init?: any) => {
      const url = String(typeof input === 'string' ? input : input.url);
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url, body });
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 1, message: 'موفق', data: {} }),
        text: async () => '',
      } as any;
    }, async () => {
      const r = await svc.sendOtpDetailed('09121234567', '654321');
      assert.ok(r.ok);
      assert.equal(calls.length, 1);
      assert.ok(calls[0]!.url.includes('/send/bulk'), '0 template → bulk');
      assert.ok(!calls[0]!.url.includes('/send/verify'));
      assert.ok(String(calls[0]!.body?.messageText || '').includes('654321'));
      assert.deepEqual(calls[0]!.body?.mobiles, ['09121234567']);
    });

    const status = await svc.status();
    assert.equal(status.otpTemplate, null);
  }

  // --- verify when template is positive ---
  {
    const calls: Array<{ url: string; body: any }> = [];
    const settings = { sms: async () => smsCfg({ otpTemplateId: 123456 }) } as any;
    const svc = new NotificationService(settings);
    await withFetch(async (input: any, init?: any) => {
      const url = String(typeof input === 'string' ? input : input.url);
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url, body });
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 1, message: 'موفق', data: {} }),
        text: async () => '',
      } as any;
    }, async () => {
      const r = await svc.sendOtpDetailed('09121234567', '111222');
      assert.ok(r.ok);
      assert.equal(calls.length, 1);
      assert.ok(calls[0]!.url.includes('/send/verify'), '123456 → verify');
      assert.equal(String(calls[0]!.body?.templateId), '123456');
      assert.equal(calls[0]!.body?.mobile, '09121234567');
    });

    const status = await svc.status();
    assert.equal(status.otpTemplate, '123456');
  }

  // --- verify provider error → one bulk fallback ---
  {
    const calls: string[] = [];
    const settings = { sms: async () => smsCfg({ otpTemplateId: 999 }) } as any;
    const svc = new NotificationService(settings);
    await withFetch(async (input: any) => {
      const url = String(typeof input === 'string' ? input : input.url);
      calls.push(url);
      if (url.includes('/send/verify')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 0, message: 'قالب نامعتبر' }),
          text: async () => '',
        } as any;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 1, message: 'موفق', data: {} }),
        text: async () => '',
      } as any;
    }, async () => {
      const r = await svc.sendOtpDetailed('09121234567', '333444');
      assert.ok(r.ok, 'bulk fallback succeeds');
      assert.equal(calls.length, 2);
      assert.ok(calls[0]!.includes('/send/verify'));
      assert.ok(calls[1]!.includes('/send/bulk'));
      // Result must not echo OTP code fields beyond transport ok
      assert.equal((r as any).code, undefined);
      assert.equal((r as any).token, undefined);
    });
  }

  // --- TIMEOUT on verify must NOT fall back to bulk ---
  {
    const calls: string[] = [];
    const settings = { sms: async () => smsCfg({ otpTemplateId: 999 }) } as any;
    const svc = new NotificationService(settings);
    await withFetch(async (input: any) => {
      const url = String(typeof input === 'string' ? input : input.url);
      calls.push(url);
      const err: any = new Error('aborted due to timeout');
      err.name = 'TimeoutError';
      throw err;
    }, async () => {
      const r = await svc.sendOtpDetailed('09121234567', '555666');
      assert.ok(!r.ok);
      assert.equal(r.errorCode, 'TIMEOUT');
      assert.equal(calls.length, 1);
      assert.ok(calls[0]!.includes('/send/verify'));
    });
  }

  if (prevEnv !== undefined) process.env.SMSIR_OTP_TEMPLATE_ID = prevEnv;
  else delete process.env.SMSIR_OTP_TEMPLATE_ID;

  console.log('notification.otp-send.spec.ts: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
