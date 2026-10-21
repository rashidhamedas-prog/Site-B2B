/**
 * Validate the production GA4 purchase payload against Google's MP validation server.
 *
 *   npx ts-node --transpile-only scripts/ga4-mp-validate.ts [--channel RETAIL|WHOLESALE] [--invalid]
 *
 * Builds the body with the same `buildPurchaseBodyChecked` the service uses, runs the
 * local validator, then (only if GA4_MP_<CHANNEL>_API_SECRET is set) POSTs it to
 * /debug/mp/collect with validation_behavior=ENFORCE_RECOMMENDATIONS. Events sent
 * there never reach reports. Exit 1 on any local or remote validation message.
 * `--invalid` sends a deliberately broken body and expects both validators to reject it.
 * Never prints the secret or the full URL.
 */
import {
  buildPurchaseBodyChecked,
  mpDebugUrl,
  resolveGa4MpConfig,
  validatePurchaseBody,
  type Ga4Channel,
} from '../src/modules/payment/ga4-mp';

type ValidationMessage = { fieldPath?: string; description?: string; validationCode?: string };

const args = process.argv.slice(2);
const invalidMode = args.includes('--invalid');
const chIdx = args.indexOf('--channel');
const channel: Ga4Channel = chIdx >= 0 && args[chIdx + 1] === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';

const FIXTURE_TXN = 'ORD-2026-00012-A3F9C1';

function fixtureBody(nowMs: number) {
  return buildPurchaseBodyChecked({
    clientId: '1234567890.1761000000',
    sessionId: '1761000000',
    transactionId: FIXTURE_TXN,
    valueIrr: 32_500_000,
    shippingIrr: 1_000_000,
    eventTimeMs: nowMs - 10 * 60_000,
    nowMs,
    items: [
      { sku: 'SKU-1', productName: 'مانتو کتان', color: 'مشکی', size: '38', unitPrice: 31_500_000, quantity: 1 },
    ],
  });
}

/** Missing client_id, lowercase currency, fractional value, item without id/name. */
function brokenBody(nowMs: number): Record<string, unknown> {
  return {
    client_id: '',
    timestamp_micros: nowMs * 1000,
    events: [
      {
        name: 'purchase',
        params: {
          transaction_id: FIXTURE_TXN,
          currency: 'usd',
          value: 12.5,
          engagement_time_msec: 1,
          items: [{ price: 1, quantity: 1 }],
        },
      },
    ],
  };
}

async function main(): Promise<number> {
  const nowMs = Date.now();
  let body: Record<string, unknown>;
  let localErrors: string[];
  if (invalidMode) {
    body = brokenBody(nowMs);
    const r = validatePurchaseBody(body, { transactionId: FIXTURE_TXN, nowMs });
    localErrors = r.ok ? [] : r.errors;
  } else {
    const built = fixtureBody(nowMs);
    body = (built.body ?? {}) as Record<string, unknown>;
    localErrors = built.body ? [] : built.errors;
  }

  console.log(`mode=${invalidMode ? 'invalid' : 'valid'} channel=${channel}`);
  console.log(`local: ${localErrors.length ? `REJECTED ${localErrors.join(', ')}` : 'OK'}`);
  if (invalidMode && !localErrors.length) {
    console.log('FAIL: local validator accepted a broken payload');
    return 1;
  }
  if (!invalidMode && localErrors.length) return 1;

  const cfg = resolveGa4MpConfig(channel);
  if (!cfg.apiSecret) {
    console.log(`remote: SKIPPED (GA4_MP_${channel}_API_SECRET not set)`);
    return 0;
  }

  const url = mpDebugUrl(cfg);
  if (!url.includes('/debug/mp/collect')) throw new Error('refusing to call a non-debug endpoint');
  let messages: ValidationMessage[];
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, validation_behavior: 'ENFORCE_RECOMMENDATIONS' }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => ({}))) as { validationMessages?: ValidationMessage[] };
    console.log(`remote: measurement_id=${cfg.measurementId} http=${res.status}`);
    messages = Array.isArray(json.validationMessages) ? json.validationMessages : [];
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : '';
    console.log(`remote: ERROR ${name === 'AbortError' || name === 'TimeoutError' ? 'timeout' : 'network'}`);
    return 1;
  }
  for (const m of messages) {
    console.log(`  - ${m.validationCode ?? '?'} ${m.fieldPath ?? ''}: ${m.description ?? ''}`);
  }
  if (invalidMode) {
    if (!messages.length) {
      console.log('FAIL: validation server returned no messages for a broken payload');
      return 1;
    }
    console.log(`remote: REJECTED as expected (${messages.length} messages; /mp/collect would still answer 2xx)`);
    return 0;
  }
  console.log(messages.length ? `remote: REJECTED (${messages.length} messages)` : 'remote: OK (no validationMessages)');
  return messages.length ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch(() => {
    console.log('FAIL: internal');
    process.exit(1);
  });
