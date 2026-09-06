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
  process.env.OMNICHANNEL_DISABLED_PROVIDERS = 'BALE,RUBIKA';
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
  assert(baleDisabled && rubikaDisabled, 'bale/rubika honour the per-provider kill switch');
  delete process.env.OMNICHANNEL_DISABLED_PROVIDERS;

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

  calls.length = 0;
  adapter.http = async (url) => {
    calls.push(String(url));
    return jsonRes(200, { ok: true, result: { message_id: 88 } });
  };
  const photo = await adapter.create({
    secretRef: 'TELEGRAM_TEST_TOKEN',
    chatId: '-1001',
    channel: 'RETAIL',
    text: 'کپشن',
    photoUrls: ['https://www.poshaktaranom.ir/uploads/kian.jpg', 'https://evil.example/x.jpg'],
  });
  assert(photo.providerMessageId === '88', 'photo id');
  assert(calls.some((u) => u.endsWith('/sendPhoto')), 'sendPhoto for one allowlisted image');
  assert(!calls.some((u) => u.endsWith('/sendMediaGroup')), 'foreign URL dropped so album is not used');

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

  // --- post options: parse_mode, inline buttons, silent, protect, caption position ---
  const bodies: Array<{ url: string; body: Record<string, unknown> }> = [];
  adapter.http = async (url, init) => {
    bodies.push({ url: String(url), body: JSON.parse(String(init?.body || '{}')) });
    return jsonRes(200, { ok: true, result: [{ message_id: 1 }, { message_id: 2 }] });
  };
  const albumOpts = {
    secretRef: 'TELEGRAM_TEST_TOKEN',
    chatId: '-1001',
    channel: 'RETAIL',
    text: '<b>مانتو</b>',
    parseMode: 'HTML',
    silent: true,
    protectContent: true,
    captionAbove: true,
    buttons: [
      { label: 'خرید', url: 'https://www.poshaktaranom.ir/products/kian' },
      { label: 'بد', url: 'https://evil.example/x' },
    ],
    photoUrls: ['https://www.poshaktaranom.ir/uploads/a.jpg', 'https://www.poshaktaranom.ir/uploads/b.jpg'],
  };
  const album = await adapter.create(albumOpts);
  assert(album.providerMessageId === '1,2', 'album ids joined');
  const mg = bodies.find((b) => b.url.endsWith('/sendMediaGroup'));
  assert(!!mg, 'sendMediaGroup used for 2 photos');
  assert(mg!.body.disable_notification === true && mg!.body.protect_content === true, 'silent/protect on album');
  assert(!('reply_markup' in mg!.body), 'albums never carry reply_markup');
  const media = mg!.body.media as Array<Record<string, unknown>>;
  assert(media[0].parse_mode === 'HTML' && media[0].show_caption_above_media === true, 'caption parse_mode + above flag on first media');
  assert(!('caption' in media[1]), 'caption only on first media');

  bodies.length = 0;
  adapter.http = async (url, init) => {
    bodies.push({ url: String(url), body: JSON.parse(String(init?.body || '{}')) });
    return jsonRes(200, { ok: true, result: { message_id: 9 } });
  };
  await adapter.create({ ...albumOpts, photoUrls: ['https://www.poshaktaranom.ir/uploads/a.jpg'] });
  const sp = bodies.find((b) => b.url.endsWith('/sendPhoto'));
  assert(!!sp, 'sendPhoto for single photo');
  const kb = sp!.body.reply_markup as { inline_keyboard: Array<Array<{ text: string; url: string }>> };
  assert(kb.inline_keyboard.length === 1 && kb.inline_keyboard[0][0].url.includes('poshaktaranom.ir'), 'only allowlisted button survives');
  assert(sp!.body.parse_mode === 'HTML' && sp!.body.disable_notification === true, 'parse_mode + silent on photo');

  bodies.length = 0;
  await adapter.create({ ...albumOpts, photoUrls: [], parseMode: 'PLAIN', linkPreview: false });
  const sm = bodies.find((b) => b.url.endsWith('/sendMessage'));
  assert(!!sm && !('parse_mode' in sm!.body), 'PLAIN sends no parse_mode');
  assert((sm!.body.link_preview_options as { is_disabled: boolean }).is_disabled === true, 'link preview disabled by default');
  assert(!!sm!.body.reply_markup, 'text post carries the keyboard');

  // update: identical content → Telegram 400 "not modified" → classified duplicate for the worker
  adapter.http = async () => jsonRes(400, { ok: false, description: 'Bad Request: message is not modified' });
  let notModified = '';
  try {
    await adapter.update({ secretRef: 'TELEGRAM_TEST_TOKEN', chatId: '-1001', providerMessageId: '77,78', text: 'x' });
  } catch (err) {
    notModified = err instanceof Error ? err.message : '';
  }
  assert(notModified === 'duplicate', 'not-modified edit classified duplicate');

  bodies.length = 0;
  adapter.http = async (url, init) => {
    bodies.push({ url: String(url), body: JSON.parse(String(init?.body || '{}')) });
    return jsonRes(200, { ok: true, result: { message_id: 77 } });
  };
  const albumEdit = await adapter.update({
    secretRef: 'TELEGRAM_TEST_TOKEN', chatId: '-1001', providerMessageId: '77,78', text: 'کپشن جدید',
    photoUrls: ['https://www.poshaktaranom.ir/uploads/a.jpg', 'https://www.poshaktaranom.ir/uploads/b.jpg'],
    parseMode: 'HTML', buttons: [{ label: 'خرید', url: 'https://www.poshaktaranom.ir/p' }],
  });
  assert(albumEdit.providerMessageId === '77,78', 'album edit keeps all ids');
  const ec = bodies.find((b) => b.url.endsWith('/editMessageCaption'));
  assert(!!ec && ec!.body.message_id === 77 && !('reply_markup' in ec!.body), 'album caption edit without keyboard');

  // delete: already-gone message is a no-op so withdraw retries stay idempotent
  adapter.http = async () => jsonRes(400, { ok: false, description: 'Bad Request: message to delete not found' });
  await adapter.delete({ secretRef: 'TELEGRAM_TEST_TOKEN', chatId: '-1001', providerMessageId: '77' });

  // inspectDestination: channel where the bot is admin with post rights
  const inspectCalls: string[] = [];
  adapter.http = async (url) => {
    const u = String(url);
    inspectCalls.push(u);
    if (u.endsWith('/getMe')) return jsonRes(200, { ok: true, result: { id: 42, username: 'taranom_bot' } });
    if (u.endsWith('/getChat')) return jsonRes(200, { ok: true, result: { id: -1001, type: 'channel', title: 'ترنم', username: 'taranom' } });
    if (u.endsWith('/getChatMember')) {
      return jsonRes(200, { ok: true, result: { status: 'administrator', can_post_messages: true, can_edit_messages: true, can_delete_messages: false } });
    }
    if (u.endsWith('/getChatMemberCount')) return jsonRes(200, { ok: true, result: 1200 });
    return jsonRes(404, { ok: false, description: 'nope' });
  };
  const inspected = await adapter.inspectDestination('TELEGRAM_TEST_TOKEN', '@taranom');
  assert(inspected.ok && inspected.chatType === 'channel' && inspected.title === 'ترنم', 'inspect reads chat');
  assert(inspected.botIsAdmin === true && inspected.canPost === true && inspected.canDelete === false, 'inspect maps admin rights');
  assert(inspected.memberCount === 1200 && inspected.botUsername === 'taranom_bot', 'inspect member count + bot');
  assert(inspectCalls.every((u) => !u.includes('sendMessage')), 'inspect never sends');

  adapter.http = async (url) => {
    const u = String(url);
    if (u.endsWith('/getMe')) return jsonRes(200, { ok: true, result: { id: 42, username: 'taranom_bot' } });
    return jsonRes(400, { ok: false, description: 'Bad Request: chat not found' });
  };
  const missingChat = await adapter.inspectDestination('TELEGRAM_TEST_TOKEN', '@nope');
  assert(missingChat.ok === false && missingChat.error === 'chat_not_found', 'chat_not_found surfaced');

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
