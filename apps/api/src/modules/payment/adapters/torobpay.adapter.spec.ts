/**
 * TorobPay CPG adapter unit checks (mocked fetch; no live money).
 * Prefer: npx ts-node --transpile-only src/modules/payment/adapters/torobpay.adapter.spec.ts
 */
import { ConfigService } from '@nestjs/config';
import {
  TorobPayAdapter,
  buildTorobpayBalancedCart,
  classifyTorobpayOauthFailure,
  compactTorobpayTransactionId,
  composeTorobpayAddress,
  normalizeTorobpayMobile,
  normalizeTorobpayPostal,
  torobpayBasicAuthHeader,
  torobpayCallbackIsSuccess,
} from './torobpay.adapter';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function adapter(env: Record<string, string> = {}) {
  return new TorobPayAdapter(
    new ConfigService({
      TOROBPAY_CLIENT_ID: 'test-client',
      TOROBPAY_CLIENT_SECRET: 'test-secret',
      TOROBPAY_USERNAME: 'shop.example',
      TOROBPAY_PASSWORD: 'pass',
      TOROBPAY_SANDBOX: 'false',
      ...env,
    }),
  );
}

const checkout = {
  address: 'خیابان نمونه ۱۲',
  postalCode: '1234567890',
  fullName: 'علی رضایی',
  city: 'مشهد',
  province: 'خراسان رضوی',
  phone: '09123456789',
  shippingAmount: 0,
  cartItems: [{ id: 'sku-1', name: 'شومیز', count: 1, amount: 2500000 }],
};

async function main() {
  assert(normalizeTorobpayMobile('09123456789') === '09123456789', 'local mobile');
  assert(normalizeTorobpayPostal('۹۱۷۳۵۱۲۳۴۵') === '9173512345', 'persian postal');
  assert(normalizeTorobpayPostal('9173512345') === '9173512345', 'latin postal');
  assert(normalizeTorobpayMobile('+989123456789') === '09123456789', 'plus98');
  assert(normalizeTorobpayMobile('9123456789') === '09123456789', 'missing0');
  let threw = false;
  try {
    normalizeTorobpayMobile('123');
  } catch {
    threw = true;
  }
  assert(threw, 'reject short mobile');

  assert(compactTorobpayTransactionId('a76bec09-11cb-4faa-be4f-c1a1f96affd2') === 'a76bec0911cb4faabe4fc1a1f96affd2', 'compact uuid');
  assert(composeTorobpayAddress({ street: '۱۲۳', city: 'مشهد', province: 'خراسان رضوی' }).includes('مشهد'), 'compose short street');
  let addrThrew = false;
  try {
    composeTorobpayAddress({ street: 'اب', city: '', province: '' });
  } catch {
    addrThrew = true;
  }
  assert(addrThrew, 'reject tiny address');
  const cart = buildTorobpayBalancedCart({
    amountIrr: 14300000,
    transactionId: 'pay-1',
    description: 'شومیز',
  });
  assert(cart.amount === 14300000, 'payable amount');
  assert(cart.cartList[0].shippingAmount === 0, 'no split shipping');
  assert(cart.cartList[0].cartItems[0].amount === 14300000, 'single line equals payable');
  assert(cart.cartList[0].cartItems[0].category === 'general', 'latin category');
  assert(!('commissionType' in cart.cartList[0].cartItems[0]), 'omit commission');

  assert(torobpayCallbackIsSuccess({ state: 'OK' }) === true, 'state OK');
  assert(torobpayCallbackIsSuccess({ status: 'FAILED' }) === false, 'FAILED');
  assert(
    torobpayBasicAuthHeader('test-client', 'secret') ===
      `Basic ${Buffer.from('test-client:secret', 'utf8').toString('base64')}`,
    'basic auth',
  );

  const unconfigured = new TorobPayAdapter(new ConfigService({ TOROBPAY_CLIENT_ID: '' }));
  assert(unconfigured.isConfigured() === false, 'empty not configured');
  const placeholder = new TorobPayAdapter(
    new ConfigService({
      TOROBPAY_CLIENT_ID: 'CHANGE_ME',
      TOROBPAY_CLIENT_SECRET: 'CHANGE_ME',
      TOROBPAY_USERNAME: 'u',
      TOROBPAY_PASSWORD: 'p',
    }),
  );
  assert(placeholder.isConfigured() === false, 'CHANGE_ME not configured');
  assert(adapter().isConfigured() === true, 'four fields configured');
  assert(adapter().code === 'TOROBPAY', 'code');

  const invalidClient = classifyTorobpayOauthFailure({
    httpStatus: 404,
    json: { error_code: 1017 },
  });
  assert(invalidClient.failureClass === 'invalid_client', '1017 client');
  const inactive = classifyTorobpayOauthFailure({
    httpStatus: 403,
    json: { error_code: 1099 },
  });
  assert(inactive.failureClass === 'merchant_inactive', '1099 inactive');

  const gw = adapter();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/oauth/token')) {
      return new Response(JSON.stringify({ access_token: 'jwt-test' }), { status: 200 });
    }
    if (url.includes('/offer/v1/eligible')) {
      return new Response(
        JSON.stringify({ successful: true, response: { eligible: true } }),
        { status: 200 },
      );
    }
    if (url.includes('/payment/v1/token')) {
      const body = JSON.parse(String(init?.body || '{}'));
      (globalThis.fetch as { lastTokenBody?: string }).lastTokenBody = JSON.stringify(body);
      assert(body.paymentMethodTypeDto === 'ONLINE_CREDIT', 'method');
      assert(body.transactionId === 'pay-1', 'txn');
      assert(Array.isArray(body.cartList) && body.cartList.length === 1, 'one cart');
      return new Response(
        JSON.stringify({
          successful: true,
          response: {
            paymentToken: 'tok-1',
            paymentPageUrl: 'https://cpg.torobpay.com/pay?payment_token=tok-1',
          },
        }),
        { status: 200 },
      );
    }
    if (url.includes('/payment/v1/verify')) {
      return new Response(
        JSON.stringify({ successful: true, response: { transactionId: 'txn-1' } }),
        { status: 200 },
      );
    }
    if (url.includes('/payment/v1/settle')) {
      return new Response(JSON.stringify({ successful: true, response: {} }), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;

  try {
    const probe = await gw.probeConnection();
    assert(probe.ok === true, 'probe ok');
    assert(probe.stage === 'ready', 'probe ready');
    assert(probe.eligible === true, 'eligible');
    assert(!('access_token' in probe), 'probe no token');

    const created = await gw.createPayment({
      amountIrr: 2500000,
      callbackUrl: 'https://www.poshaktaranom.ir/payment/torobpay/callback?paymentId=pay-1',
      description: 'تست',
      merchantId: 'n/a',
      sandbox: false,
      mobile: '09123456789',
      orderId: 'ord-1',
      metadata: { providerId: 'pay-1' },
      torobpayCheckout: checkout,
    });
    assert(created.providerToken === 'tok-1', 'token');
    assert(created.redirectUrl.includes('payment_token=tok-1'), 'page url');
    const tokenBody = JSON.parse(String((globalThis.fetch as any).lastTokenBody || '{}'));
    assert(tokenBody.cartList[0].cartItems[0].amount === 2500000, 'balanced amount');
    assert(tokenBody.cartList[0].shippingAmount === 0, 'token shipping collapsed');
    assert(tokenBody.cartList[0].cartItems[0].category === 'general', 'token category');
    assert(tokenBody.discountAmount == null, 'no discount field');
    assert(tokenBody.cartList[0].cartItems[0].commissionType == null, 'no commission on token');

    const verified = await gw.verifyReturn({
      amountIrr: 2500000,
      providerToken: 'tok-1',
      merchantId: 'n/a',
      sandbox: false,
    });
    assert(verified.success === true, 'verify+settle');
    assert(verified.providerRefId === 'txn-1', 'ref');

    const mismatch = await gw.verifyReturn({
      amountIrr: 2500000,
      providerToken: 'tok-1',
      merchantId: 'n/a',
      sandbox: false,
      extra: { amount: '1000' },
    });
    assert(mismatch.success === false, 'amount mismatch');

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/oauth/token')) {
        return new Response(JSON.stringify({ access_token: 'jwt-test' }), { status: 200 });
      }
      if (url.includes('/payment/v1/token')) {
        return new Response(
          JSON.stringify({
            successful: false,
            errorData: { errorCode: 1011, message: "can't create order" },
          }),
          { status: 400 },
        );
      }
      return new Response('{}', { status: 404 });
    }) as typeof fetch;
    let tokenErr = '';
    try {
      await gw.createPayment({
        amountIrr: 2500000,
        callbackUrl: 'https://www.poshaktaranom.ir/payment/torobpay/callback?paymentId=pay-1',
        description: 'تست',
        merchantId: 'n/a',
        sandbox: false,
        mobile: '09123456789',
        orderId: 'ord-1',
        metadata: { providerId: 'pay-3' },
        torobpayCheckout: checkout,
      });
    } catch (e) {
      tokenErr = e instanceof Error ? e.message : String(e);
    }
    assert(tokenErr.includes('ترب‌پی نتوانست سفارش را ثبت کند'), '1011 mapped for shopper');
    assert(!tokenErr.includes('1042'), '1011 not confused with 1042');

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/oauth/token')) {
        return new Response(JSON.stringify({ access_token: 'jwt-test' }), { status: 200 });
      }
      if (url.includes('/payment/v1/token')) {
        return new Response(
          JSON.stringify({
            successful: false,
            errorData: { errorCode: 1042, message: 'invalid cart amount' },
          }),
          { status: 400 },
        );
      }
      return new Response('{}', { status: 404 });
    }) as typeof fetch;
    tokenErr = '';
    try {
      await gw.createPayment({
        amountIrr: 2500000,
        callbackUrl: 'https://www.poshaktaranom.ir/payment/torobpay/callback?paymentId=pay-1',
        description: 'تست',
        merchantId: 'n/a',
        sandbox: false,
        mobile: '09123456789',
        orderId: 'ord-1',
        metadata: { providerId: 'pay-4' },
        torobpayCheckout: checkout,
      });
    } catch (e) {
      tokenErr = e instanceof Error ? e.message : String(e);
    }
    assert(tokenErr.includes('1042'), 'token error code surfaced');
    assert(tokenErr.includes('invalid cart amount'), 'token error message surfaced');
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('torobpay.adapter.spec.ts: PASS');
}

void main();
