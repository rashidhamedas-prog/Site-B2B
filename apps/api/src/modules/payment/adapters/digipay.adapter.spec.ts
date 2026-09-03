/**
 * DigiPay UPG adapter unit checks (mocked fetch; no live money).
 * Prefer: npx ts-node --transpile-only src/modules/payment/adapters/digipay.adapter.spec.ts
 */
import { ConfigService } from '@nestjs/config';
import {
  DigiPayAdapter,
  classifyDigipayOauthFailure,
  digipayBasicAuthHeader,
  digipayCallbackIsSuccess,
  normalizeDigipayMobile,
} from './digipay.adapter';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function expectReject(fn: () => Promise<unknown>, msg: string) {
  let rejected = false;
  try {
    await fn();
  } catch {
    rejected = true;
  }
  assert(rejected, msg);
}

function adapter(env: Record<string, string> = {}) {
  return new DigiPayAdapter(
    new ConfigService({
      DIGIPAY_CLIENT_ID: 'test-client',
      DIGIPAY_CLIENT_SECRET: 'test-secret',
      DIGIPAY_USERNAME: 'user',
      DIGIPAY_PASSWORD: 'pass',
      DIGIPAY_SANDBOX: 'true',
      ...env,
    }),
  );
}

async function main() {
  assert(normalizeDigipayMobile('09123456789') === '09123456789', 'local mobile');
  assert(normalizeDigipayMobile('+989123456789') === '09123456789', 'plus98');
  assert(normalizeDigipayMobile('989123456789') === '09123456789', '98prefix');
  assert(normalizeDigipayMobile('9123456789') === '09123456789', 'missing0');
  let threw = false;
  try {
    normalizeDigipayMobile('123');
  } catch {
    threw = true;
  }
  assert(threw, 'reject short mobile');

  assert(
    digipayCallbackIsSuccess({ result: '0', trackingCode: 't' }) === true,
    'result 0 success',
  );
  assert(
    digipayCallbackIsSuccess({ result: '9007' }) === false,
    'nonzero result fail',
  );
  assert(
    digipayCallbackIsSuccess({ status: 'NOK' }) === false,
    'NOK fail',
  );
  assert(
    digipayCallbackIsSuccess({ trackingCode: 'abc' }) === true,
    'tracking without result is success-hint',
  );
  assert(
    digipayBasicAuthHeader('iuyriwy88', 'jhs65dfg') ===
      'Basic aXV5cml3eTg4OmpoczY1ZGZn',
    'basic auth matches DigiPay docs example',
  );

  const unconfigured = new DigiPayAdapter(
    new ConfigService({ DIGIPAY_CLIENT_ID: '', DIGIPAY_CLIENT_SECRET: '' }),
  );
  assert(unconfigured.isConfigured() === false, 'empty creds not configured');
  const placeholder = new DigiPayAdapter(
    new ConfigService({
      DIGIPAY_CLIENT_ID: 'CHANGE_ME',
      DIGIPAY_CLIENT_SECRET: 'CHANGE_ME',
      DIGIPAY_USERNAME: 'u',
      DIGIPAY_PASSWORD: 'p',
    }),
  );
  assert(placeholder.isConfigured() === false, 'placeholder not configured');

  const envEmpty = new DigiPayAdapter(
    new ConfigService({ DIGIPAY_CLIENT_ID: '', DIGIPAY_CLIENT_SECRET: '' }),
  );
  assert(envEmpty.isConfigured() === false, 'env empty not configured');
  assert(
    envEmpty.isConfigured({
      clientId: 'admin-id',
      clientSecret: 'admin-secret',
    }) === false,
    'client-only override still incomplete',
  );
  assert(
    envEmpty.isConfigured({
      clientId: 'admin-id',
      clientSecret: 'admin-secret',
      username: 'upg-user',
      password: 'upg-pass',
    }) === true,
    'admin override configures adapter with all four',
  );
  assert(
    envEmpty.isSandbox({ sandbox: false }) === false,
    'admin override sandbox false',
  );

  const spring = classifyDigipayOauthFailure({
    httpStatus: 401,
    json: {
      timestamp: '2026-09-03T00:00:00Z',
      status: 401,
      error: 'Unauthorized',
      path: '/digipay/api/oauth/token',
    },
  });
  assert(spring.failureClass === 'invalid_client', 'spring 401 is invalid_client');
  const grant = classifyDigipayOauthFailure({
    httpStatus: 401,
    json: { error: 'invalid_grant', error_description: 'bad user' },
  });
  assert(grant.failureClass === 'invalid_grant', 'invalid_grant class');

  const gw = adapter();
  assert(gw.code === 'DIGIPAY', 'code');
  assert(gw.getCapabilities().pay === true, 'pay cap');
  assert(gw.isSandbox() === true, 'sandbox from env');
  assert(
    gw.payRedirectUrl('v2:abc').includes('/web-pay/tgs/v2:abc'),
    'uat pay url',
  );

  const origFetch = globalThis.fetch;
  const calls: Array<{ url: string; body: string }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = typeof init?.body === 'string' ? init.body : '';
    calls.push({ url, body });
    if (url.includes('/oauth/token')) {
      return new Response(
        JSON.stringify({
          access_token: 'tok-1',
          token_type: 'bearer',
          expires_in: 3599,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (url.includes('/tickets/business')) {
      assert(body.includes('"cellNumber":"09123456789"'), 'ticket mobile');
      assert(body.includes('"providerId":"pay-1"'), 'ticket providerId');
      assert(body.includes('"amount":150000'), 'ticket amount IRR');
      return new Response(
        JSON.stringify({
          result: { status: 0, message: 'ok' },
          ticket: 'v2:ticket-1',
          redirectUrl: 'https://uatweb.mydigipay.info/web-pay/tgs/v2:ticket-1',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (url.includes('/purchases/verify')) {
      assert(body.includes('"trackingCode":"trk-9"'), 'verify tracking');
      assert(body.includes('"providerId":"pay-1"'), 'verify providerId');
      return new Response(
        JSON.stringify({
          result: { status: 0, message: 'ok' },
          trackingCode: 'trk-9',
          amount: 150000,
          rrn: 'rrn-1',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response(JSON.stringify({ error: 'unexpected' }), { status: 500 });
  }) as typeof fetch;

  try {
    const created = await gw.createPayment({
      amountIrr: 150000,
      callbackUrl: 'https://www.poshaktaranom.ir/payment/digipay/callback?paymentId=pay-1',
      description: 'test',
      merchantId: 'n/a',
      sandbox: true,
      mobile: '09123456789',
      metadata: { providerId: 'pay-1' },
    });
    assert(created.providerToken === 'v2:ticket-1', 'ticket stored as token');
    assert(created.redirectUrl.includes('v2:ticket-1'), 'redirect from API');

    await expectReject(
      () =>
        gw.createPayment({
          amountIrr: 150000,
          callbackUrl: 'https://example.com/cb',
          description: 't',
          merchantId: 'n/a',
          sandbox: true,
          metadata: { providerId: 'pay-1' },
        }),
      'mobile required',
    );

    const verified = await gw.verifyReturn({
      amountIrr: 150000,
      providerToken: 'v2:ticket-1',
      merchantId: 'n/a',
      sandbox: true,
      extra: { trackingCode: 'trk-9', providerId: 'pay-1', type: '11' },
    });
    assert(verified.success === true, 'verify ok');
    assert(verified.providerRefId === 'rrn-1', 'rrn as ref');

    const amountMismatch = await gw.verifyReturn({
      amountIrr: 999,
      providerToken: 'v2:ticket-1',
      merchantId: 'n/a',
      sandbox: true,
      extra: { trackingCode: 'trk-9', providerId: 'pay-1' },
    });
    assert(amountMismatch.success === false, 'amount mismatch fails closed');

    const missingTrk = await gw.verifyReturn({
      amountIrr: 150000,
      providerToken: 'v2:ticket-1',
      merchantId: 'n/a',
      sandbox: true,
    });
    assert(missingTrk.success === false, 'missing tracking fails');

    assert(calls.some((c) => c.url.includes('/oauth/token')), 'oauth called');

    const probeOk = await gw.probeConnection();
    assert(probeOk.ok === true, 'probe ok');
    assert(probeOk.stage === 'ready', 'probe ready');
    assert(!('access_token' in (probeOk as object)), 'probe has no token field');
  } finally {
    globalThis.fetch = origFetch;
  }

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        timestamp: 't',
        status: 401,
        error: 'Unauthorized',
        path: '/digipay/api/oauth/token',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )) as typeof fetch;
  try {
    const probeFail = await adapter().probeConnection();
    assert(probeFail.ok === false, 'probe fail');
    assert(probeFail.failureClass === 'invalid_client', 'probe classifies client');
    assert(probeFail.meta.clientIdLen > 0, 'probe meta lengths only');
  } finally {
    globalThis.fetch = origFetch;
  }

  console.log('digipay.adapter.spec.ts: PASS');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
