/**
 * npx ts-node --transpile-only src/modules/omnichannel/adapters/rubika.adapter.spec.ts
 *
 * Mocked HTTP only. Asserts the adapter speaks the documented Rubika Bot API v3
 * (rubika.ir/botapi): {status,data} envelope, sendMessage + metadata.meta_data_parts (UTF-16),
 * requestSendFile → upload_url → multipart → sendFile, string message ids, getChat-only inspect.
 */
import { ConnectorDisabledError } from './channel-adapter';
import {
  RUBIKA_API,
  RubikaAdapter,
  classifyRubikaFailure,
  resolveRubikaToken,
  rubikaCaption,
  rubikaChatTypeFromId,
  rubikaMessage,
} from './rubika.adapter';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function jsonRes(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

type Call = { url: string; body: Record<string, unknown> | FormData | null; init?: RequestInit };

/** Routes botapi calls to `respond(method, body)`; other URLs (image download, upload_url) to `other`. */
function recorder(
  adapter: RubikaAdapter,
  respond: (method: string, body: Record<string, unknown>) => unknown,
  other?: (url: string, init?: RequestInit) => Response,
) {
  const calls: Call[] = [];
  adapter.http = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    if (!href.startsWith(RUBIKA_API)) {
      calls.push({ url: href, body: init?.body instanceof FormData ? init.body : null, init });
      if (!other) throw new Error(`unexpected url ${href}`);
      return other(href, init);
    }
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    calls.push({ url: href, body });
    const method = href.split('/').pop() || '';
    const out = respond(method, body);
    if (out instanceof Error) return jsonRes(200, { status: out.message, data: null });
    return jsonRes(200, { status: 'OK', data: out });
  }) as typeof fetch;
  return calls;
}

async function main() {
  const prevFlag = process.env.OMNICHANNEL_CONNECTORS_ENABLED;
  const prevDisabled = process.env.OMNICHANNEL_DISABLED_PROVIDERS;
  const prevTok = process.env.RUBIKA_TEST_TOKEN;
  const token = 'RUBIKA-test-token-not-real-ABCDEF';
  try {
    delete process.env.OMNICHANNEL_CONNECTORS_ENABLED;
    delete process.env.OMNICHANNEL_DISABLED_PROVIDERS;
    process.env.RUBIKA_TEST_TOKEN = token;

    // pure helpers
    assert(rubikaChatTypeFromId('c0AbC') === 'channel' && rubikaChatTypeFromId('g0x') === 'group' && rubikaChatTypeFromId('u0x') === 'private', 'chat type from id prefix');
    const msg = rubikaMessage('🌿 <b>مانتو</b> &amp; کت', 'HTML', [{ label: 'خرید', url: 'https://www.poshaktaranom.ir/p/a' }]);
    assert(msg.text === '🌿 مانتو & کت\n\n🔗 خرید: https://www.poshaktaranom.ir/p/a', 'text + link line');
    assert(msg.parts.length === 2 && msg.parts[0].type === 'Bold' && msg.parts[0].from_index === 3 && msg.parts[0].length === 5, 'emoji counts 2 UTF-16 units → bold at 3');
    assert(msg.parts[1].type === 'Link' && msg.parts[1].link_url === 'https://www.poshaktaranom.ir/p/a', 'link part on the label');
    assert(msg.text.slice(msg.parts[1].from_index, msg.parts[1].from_index + msg.parts[1].length) === 'خرید', 'link part covers exactly the label');
    for (const part of msg.parts) assert(part.from_index + part.length <= msg.text.length, 'parts stay inside text');
    assert(rubikaMessage('plain *x*', undefined, []).parts.length === 0, 'PLAIN mode: no metadata');
    assert(rubikaCaption('<b>کت</b> &lt;3', 'HTML', [{ label: 'خرید', url: 'https://x.ir/a' }]) === 'کت <3\n\n🔗 خرید: https://x.ir/a', 'caption is plain (sendFile has no metadata)');
    assert(classifyRubikaFailure(200, 'INVALID_INPUT') === 'validate_failed', 'INVALID_INPUT');
    assert(classifyRubikaFailure(200, 'INVALID_ACCESS') === 'invalid_credential', 'INVALID_ACCESS');
    assert(classifyRubikaFailure(429, undefined) === 'rate_limited', '429');
    assert(classifyRubikaFailure(502, undefined) === 'provider_unavailable', '5xx');

    assert(resolveRubikaToken('BALE_BOT_TOKEN') === null, 'Rubika never reads a BALE_ ref');
    assert(resolveRubikaToken('RUBIKA_TEST_TOKEN') === token, 'RUBIKA_ ref resolves');

    let disabled = false;
    try {
      await new RubikaAdapter().validateConnection('RUBIKA_TEST_TOKEN');
    } catch (err) {
      disabled = err instanceof ConnectorDisabledError;
    }
    assert(disabled, 'gated when flag off');

    process.env.OMNICHANNEL_CONNECTORS_ENABLED = 'true';
    const adapter = new RubikaAdapter();

    // validateConnection
    let calls = recorder(adapter, (method) => (method === 'getMe' ? { bot: { bot_id: 'b0x', username: 'taranom_bot' } } : new Error('INVALID_INPUT')));
    assert((await adapter.validateConnection('RUBIKA_TEST_TOKEN')).ok === true, 'getMe ok');
    assert(calls[0].url === `${RUBIKA_API}/${token}/getMe`, 'official v3 URL shape /v3/{token}/{method}');
    recorder(adapter, () => new Error('INVALID_ACCESS'));
    assert((await adapter.validateConnection('RUBIKA_TEST_TOKEN')).error === 'invalid_credential', 'INVALID_ACCESS → invalid_credential');

    // inspectDestination: channel → getChat only, permission unknown until test post
    calls = recorder(adapter, (method) => {
      if (method === 'getMe') return { bot: { bot_id: 'b0x', username: 'taranom_bot' } };
      if (method === 'getChat') return { chat: { chat_id: 'c0AbC', chat_type: 'Channel', title: 'کانال ترنم', username: 'taranom' } };
      return new Error('INVALID_INPUT');
    });
    const inspection = await adapter.inspectDestination('RUBIKA_TEST_TOKEN', 'c0AbC');
    assert(inspection.ok && inspection.chatType === 'channel' && inspection.title === 'کانال ترنم', 'channel resolved via getChat');
    assert(inspection.canPost === undefined && inspection.permissionCheck === 'test_post', 'no getChatMember → test post required');
    assert(!calls.some((c) => c.url.endsWith('/getChatMember')), 'never calls an undocumented method');
    recorder(adapter, (method) => (method === 'getMe' ? { bot: {} } : new Error('INVALID_INPUT')));
    assert((await adapter.inspectDestination('RUBIKA_TEST_TOKEN', 'c0nope')).error === 'chat_not_found', 'bad chat → chat_not_found');
    recorder(adapter, (method) => (method === 'getMe' ? { bot: {} } : { chat: { chat_id: 'u0x', chat_type: 'User', first_name: 'علی' } }));
    const priv = await adapter.inspectDestination('RUBIKA_TEST_TOKEN', 'u0x');
    assert(priv.chatType === 'private' && priv.canPost === true && priv.permissionCheck === 'api', 'private chat needs no proof');

    // create: text with metadata + silent
    calls = recorder(adapter, () => ({ message_id: '1755000000000' }));
    const text = await adapter.create({
      secretRef: 'RUBIKA_TEST_TOKEN',
      chatId: 'c0AbC',
      channel: 'RETAIL',
      parseMode: 'HTML',
      text: '<b>مانتو</b>',
      buttons: [{ label: 'خرید', url: 'https://www.poshaktaranom.ir/p/a' }],
      silent: true,
    });
    assert(text.providerMessageId === '1755000000000', 'string message id kept verbatim');
    assert(calls[0].url.endsWith('/sendMessage'), 'sendMessage');
    const sendBody = calls[0].body as Record<string, unknown>;
    const meta = sendBody.metadata as { meta_data_parts: Array<Record<string, unknown>> };
    assert(meta.meta_data_parts.length === 2 && meta.meta_data_parts[0].type === 'Bold', 'metadata.meta_data_parts on the wire');
    assert(sendBody.disable_notification === true && !('inline_keypad' in sendBody) && !('parse_mode' in sendBody), 'documented params only');

    // create: photo → download → requestSendFile → upload_url multipart → sendFile with plain caption
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    calls = recorder(
      adapter,
      (method) => {
        if (method === 'requestSendFile') return { upload_url: 'https://upload.rubika.ir/u/abc' };
        if (method === 'sendFile') return { message_id: '1755000000001' };
        return new Error('INVALID_INPUT');
      },
      (url) => {
        if (url.startsWith('https://www.poshaktaranom.ir/')) {
          return { ok: true, status: 200, headers: new Headers({ 'content-type': 'image/jpeg' }), arrayBuffer: async () => bytes.buffer } as unknown as Response;
        }
        return jsonRes(200, { status: 'OK', data: { file_id: 'F123' } });
      },
    );
    const photo = await adapter.create({
      secretRef: 'RUBIKA_TEST_TOKEN',
      chatId: 'c0AbC',
      channel: 'RETAIL',
      parseMode: 'HTML',
      text: '<b>کت</b> جدید',
      photoUrls: ['https://www.poshaktaranom.ir/uploads/a.jpg', 'https://www.poshaktaranom.ir/uploads/b.jpg'],
      buttons: [{ label: 'خرید', url: 'https://www.poshaktaranom.ir/p/a' }],
    });
    assert(photo.providerMessageId === '1755000000001', 'sendFile message id');
    const order = calls.map((c) => c.url.replace(`${RUBIKA_API}/${token}/`, ''));
    assert(order[0].startsWith('https://www.poshaktaranom.ir/uploads/a.jpg'), 'downloads only the first photo (no album on Rubika)');
    assert(order[1] === 'requestSendFile' && (calls[1].body as Record<string, unknown>).type === 'Image', 'requestSendFile type Image');
    assert(order[2] === 'https://upload.rubika.ir/u/abc' && calls[2].body instanceof FormData && calls[2].init?.method === 'POST', 'multipart POST to upload_url');
    assert((calls[2].body as FormData).has('file'), 'multipart field is `file`');
    assert(order[3] === 'sendFile', 'sendFile after upload');
    const fileBody = calls[3].body as Record<string, unknown>;
    assert(fileBody.file_id === 'F123' && fileBody.text === 'کت جدید\n\n🔗 خرید: https://www.poshaktaranom.ir/p/a', 'plain caption + link line');
    assert(!('metadata' in fileBody), 'sendFile carries no metadata');
    assert(!calls.some((c) => c.url.includes('/uploads/b.jpg')), 'second photo dropped, not sent as a second message');

    // create: image too large / non-image → falls back to text message
    calls = recorder(
      adapter,
      () => ({ message_id: '2' }),
      () => ({ ok: true, status: 200, headers: new Headers({ 'content-type': 'text/html' }), arrayBuffer: async () => new ArrayBuffer(4) } as unknown as Response),
    );
    await adapter.create({ secretRef: 'RUBIKA_TEST_TOKEN', chatId: 'c0AbC', channel: 'RETAIL', text: 'x', photoUrls: ['https://www.poshaktaranom.ir/uploads/a.jpg'] });
    assert(calls.some((c) => c.url.endsWith('/sendMessage')) && !calls.some((c) => c.url.endsWith('/requestSendFile')), 'non-image → text fallback');

    // update / delete
    calls = recorder(adapter, () => ({}));
    const upd = await adapter.update({ secretRef: 'RUBIKA_TEST_TOKEN', chatId: 'c0AbC', providerMessageId: '1755000000000', parseMode: 'HTML', text: '<b>ویرایش</b>' });
    assert(upd.providerMessageId === '1755000000000' && calls[0].url.endsWith('/editMessageText'), 'editMessageText');
    assert((calls[0].body as Record<string, unknown>).message_id === '1755000000000' && (calls[0].body as Record<string, unknown>).text === 'ویرایش', 'string id + plain text');
    calls = recorder(adapter, () => ({}));
    await adapter.delete({ secretRef: 'RUBIKA_TEST_TOKEN', chatId: 'c0AbC', providerMessageId: '1,2' });
    assert(calls.length === 2 && calls.every((c) => c.url.endsWith('/deleteMessage')), 'deleteMessage per id');
    recorder(adapter, () => new Error('INVALID_INPUT'));
    await adapter.delete({ secretRef: 'RUBIKA_TEST_TOKEN', chatId: 'c0AbC', providerMessageId: '9' });

    // discoverChats: channel ids from updates + forwards, titles via getChat
    calls = recorder(adapter, (method, body) => {
      if (method === 'getUpdates') {
        return {
          updates: [
            { type: 'NewMessage', chat_id: 'u0user', new_message: { forwarded_from: { type_from: 'Channel', from_chat_id: 'c0FWD' } } },
            { type: 'NewMessage', chat_id: 'g0grp', new_message: {} },
            { type: 'NewMessage', chat_id: 'u0user2', new_message: {} },
          ],
          next_offset_id: 'n1',
        };
      }
      if (method === 'getChat') return { chat: { chat_id: body.chat_id, chat_type: String(body.chat_id).startsWith('c0') ? 'Channel' : 'Group', title: `عنوان ${body.chat_id}` } };
      return new Error('INVALID_INPUT');
    });
    const found = await adapter.discoverChats('RUBIKA_TEST_TOKEN');
    assert(found.ok && found.chats.map((c) => c.chatId).sort().join(',') === 'c0FWD,g0grp', 'forwarded channel + group found, users skipped');
    assert(found.chats.find((c) => c.chatId === 'c0FWD')?.title === 'عنوان c0FWD', 'titles resolved via getChat');
    assert(!('offset_id' in (calls[0].body as Record<string, unknown>)), 'getUpdates without offset_id');

    process.env.OMNICHANNEL_DISABLED_PROVIDERS = 'RUBIKA';
    let killed = false;
    try {
      await adapter.validateConnection('RUBIKA_TEST_TOKEN');
    } catch (err) {
      killed = err instanceof ConnectorDisabledError;
    }
    assert(killed, 'OMNICHANNEL_DISABLED_PROVIDERS=RUBIKA gates Rubika');
  } finally {
    if (prevFlag === undefined) delete process.env.OMNICHANNEL_CONNECTORS_ENABLED;
    else process.env.OMNICHANNEL_CONNECTORS_ENABLED = prevFlag;
    if (prevDisabled === undefined) delete process.env.OMNICHANNEL_DISABLED_PROVIDERS;
    else process.env.OMNICHANNEL_DISABLED_PROVIDERS = prevDisabled;
    if (prevTok === undefined) delete process.env.RUBIKA_TEST_TOKEN;
    else process.env.RUBIKA_TEST_TOKEN = prevTok;
  }
  console.log('rubika.adapter.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
