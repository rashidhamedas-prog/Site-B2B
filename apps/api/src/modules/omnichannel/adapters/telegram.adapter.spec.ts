/**
 * npx ts-node --transpile-only src/modules/omnichannel/adapters/telegram.adapter.spec.ts
 */
import { ConnectorDisabledError } from './channel-adapter';
import { assertNoSecretLeak, classifyTelegramHttpError, classifyTelegramThrow, redactProviderError, safeWorkerError } from './telegram-errors';
import { resolveTelegramToken, TELEGRAM_API, TelegramAdapter } from './telegram.adapter';
import { BaleAdapter } from './bale.adapter';
import { RubikaAdapter } from './rubika.adapter';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function jsonRes(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

async function main() {
  assert(classifyTelegramHttpError(401) === 'invalid_credential', '401');
  assert(classifyTelegramHttpError(429) === 'rate_limited', '429');
  assert(classifyTelegramHttpError(503) === 'provider_unavailable', '5xx');
  assert(classifyTelegramHttpError(409, 'already') === 'duplicate', 'duplicate');
  assert(classifyTelegramThrow({ name: 'AbortError' }) === 'timeout', 'timeout');

  const token = '123456:AA-test-token-not-real';
  assert(resolveTelegramToken('DATABASE_URL') === null, 'allowlist blocks DATABASE_URL');
  assert(redactProviderError(`https://api.telegram.org/bot${token}/sendMessage`) === 'https://api.telegram.org/bot[redacted]/sendMessage', 'bot path redacted');
  assert(!safeWorkerError(new Error(`failed ${token}`)).includes(token), 'worker error redacts token');
  assertNoSecretLeak('invalid_credential', token);
  let leak = false;
  try {
    assertNoSecretLeak(`bot ${token} failed`, token);
  } catch {
    leak = true;
  }
  assert(leak, 'token leak detector');

  const prevFlag = process.env.OMNICHANNEL_CONNECTORS_ENABLED;
  const prevTok = process.env.TELEGRAM_TEST_TOKEN;
  delete process.env.OMNICHANNEL_CONNECTORS_ENABLED;

  let disabled = false;
  try {
    await new TelegramAdapter().validateConnection('TELEGRAM_TEST_TOKEN');
  } catch (err) {
    disabled = err instanceof ConnectorDisabledError;
  }
  assert(disabled, 'telegram gated when flag off');

  process.env.OMNICHANNEL_CONNECTORS_ENABLED = 'true';
  let baleDisabled = false;
  let rubikaDisabled = false;
  try {
    await new BaleAdapter().validateConnection('BALE_BOT_TOKEN');
  } catch (err) {
    baleDisabled = err instanceof ConnectorDisabledError;
  }
  try {
    await new RubikaAdapter().validateConnection('RUBIKA_BOT_TOKEN');
  } catch (err) {
    rubikaDisabled = err instanceof ConnectorDisabledError;
  }
  assert(baleDisabled && rubikaDisabled, 'bale/rubika stay disabled even with connectors flag');

  const adapter = new TelegramAdapter();
  const calls: string[] = [];
  process.env.TELEGRAM_TEST_TOKEN = token;

  const missing = await adapter.validateConnection('NOT_A_REAL_REF');
  assert(missing.ok === false && missing.error === 'invalid_credential', 'missing secretRef');

  adapter.http = async (url) => {
    calls.push(String(url));
    return jsonRes(401, { ok: false, description: 'Unauthorized' });
  };
  const unauthorized = await adapter.validateConnection('TELEGRAM_TEST_TOKEN');
  assert(unauthorized.error === 'invalid_credential', '401 getMe');
  assert(calls[0].startsWith(`${TELEGRAM_API}/bot${token}/getMe`), 'official getMe URL');

  adapter.http = async () => jsonRes(429, { ok: false, description: 'Too Many Requests' });
  assert((await adapter.validateConnection('TELEGRAM_TEST_TOKEN')).error === 'rate_limited', '429');

  adapter.http = async () => jsonRes(503, { ok: false, description: 'down' });
  assert((await adapter.validateConnection('TELEGRAM_TEST_TOKEN')).error === 'provider_unavailable', '5xx');

  adapter.http = async () => {
    throw Object.assign(new Error('aborted'), { name: 'AbortError' });
  };
  assert((await adapter.validateConnection('TELEGRAM_TEST_TOKEN')).error === 'timeout', 'timeout');

  adapter.http = async (url) => {
    calls.push(String(url));
    return jsonRes(200, { ok: true, result: { message_id: 77 } });
  };
  const created = await adapter.create({
    secretRef: 'TELEGRAM_TEST_TOKEN',
    chatId: '-1001',
    text: 'سلام',
  });
  assert(created.providerMessageId === '77', 'create id');
  assert(calls.some((u) => u.endsWith('/sendMessage')), 'sendMessage');

  adapter.http = async () => jsonRes(409, { ok: false, description: 'message is not modified' });
  let duplicate = false;
  try {
    await adapter.create({ secretRef: 'TELEGRAM_TEST_TOKEN', chatId: '-1001', text: 'x' });
  } catch (err) {
    duplicate = classifyTelegramThrow(err) === 'duplicate';
    const msg = err instanceof Error ? err.message : String(err);
    assert(msg === 'duplicate', 'create throws classified code');
    assertNoSecretLeak(msg, token);
  }
  assert(duplicate, 'duplicate create');

  adapter.http = async () => jsonRes(401, { ok: false, description: `Unauthorized bot${token}` });
  let classified401 = false;
  try {
    await adapter.create({ secretRef: 'TELEGRAM_TEST_TOKEN', chatId: '-1001', text: 'x' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    classified401 = msg === 'invalid_credential';
    assertNoSecretLeak(msg, token);
  }
  assert(classified401, 'create 401 classified not raw');

  adapter.http = async (url) => {
    calls.push(String(url));
    return jsonRes(200, { ok: true, result: { message_id: 77 } });
  };
  const updated = await adapter.update({
    secretRef: 'TELEGRAM_TEST_TOKEN',
    chatId: '-1001',
    providerMessageId: '77',
    text: 'ویرایش',
  });
  assert(updated.providerMessageId === '77', 'update id');
  assert(calls.some((u) => u.endsWith('/editMessageText')), 'editMessageText');

  await adapter.delete({
    secretRef: 'TELEGRAM_TEST_TOKEN',
    chatId: '-1001',
    providerMessageId: '77',
  });
  assert(calls.some((u) => u.endsWith('/deleteMessage')), 'deleteMessage');

  if (prevFlag === undefined) delete process.env.OMNICHANNEL_CONNECTORS_ENABLED;
  else process.env.OMNICHANNEL_CONNECTORS_ENABLED = prevFlag;
  if (prevTok === undefined) delete process.env.TELEGRAM_TEST_TOKEN;
  else process.env.TELEGRAM_TEST_TOKEN = prevTok;

  console.log('telegram.adapter.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
