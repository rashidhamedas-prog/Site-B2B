/**
 * npx ts-node --transpile-only src/modules/omnichannel/adapters/bale.adapter.spec.ts
 *
 * Mocked HTTP only. Asserts the adapter speaks the documented Bale Bot API (docs.bale.ai):
 * tapi.bale.ai paths, Markdown bold with spaces, no parse_mode / notification flags, 1024-char
 * album captions, buttons on a follow-up message for albums, getChatMembersCount, 48h delete.
 */
import { BALE_API, BaleAdapter, baleText, resolveBaleToken } from './bale.adapter';
import { ConnectorDisabledError } from './channel-adapter';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function jsonRes(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

type Call = { url: string; body: Record<string, unknown> };

function recorder(adapter: BaleAdapter, respond: (method: string, body: Record<string, unknown>) => unknown) {
  const calls: Call[] = [];
  adapter.http = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    calls.push({ url: href, body });
    const method = href.split('/').pop() || '';
    const out = respond(method, body);
    if (out instanceof Error) return jsonRes(400, { ok: false, description: out.message });
    return jsonRes(200, { ok: true, result: out });
  }) as typeof fetch;
  return calls;
}

async function main() {
  const prevFlag = process.env.OMNICHANNEL_CONNECTORS_ENABLED;
  const prevDisabled = process.env.OMNICHANNEL_DISABLED_PROVIDERS;
  const prevTok = process.env.BALE_TEST_TOKEN;
  const token = '987654321:bale-test-token-not-real';
  try {
    delete process.env.OMNICHANNEL_CONNECTORS_ENABLED;
    delete process.env.OMNICHANNEL_DISABLED_PROVIDERS;
    process.env.BALE_TEST_TOKEN = token;

    // text conversion
    assert(baleText('🌿 <b>مانتو کیان</b>\n💵 قیمت: <b>1/207/000</b> تومان', 'HTML') === '🌿 *مانتو کیان*\n💵 قیمت: *1/207/000* تومان', 'HTML bold → Markdown bold with spaces');
    assert(baleText('a_b *c* <x>', undefined) === 'a‗b ✱c✱ <x>', 'plain text neutralises markdown metacharacters and keeps <');
    assert(baleText('x &amp; y', 'HTML') === 'x & y', 'entities unescaped');

    // token allowlist
    assert(resolveBaleToken('TELEGRAM_BOT_TOKEN') === null, 'Bale never reads a TELEGRAM_ ref');
    assert(resolveBaleToken('BALE_TEST_TOKEN') === token, 'BALE_ ref resolves');

    // gate
    let disabled = false;
    try {
      await new BaleAdapter().validateConnection('BALE_TEST_TOKEN');
    } catch (err) {
      disabled = err instanceof ConnectorDisabledError;
    }
    assert(disabled, 'gated when flag off');

    process.env.OMNICHANNEL_CONNECTORS_ENABLED = 'true';
    const adapter = new BaleAdapter();

    // validateConnection
    let calls = recorder(adapter, (method) => (method === 'getMe' ? { id: 1, username: 'taranom_bot' } : new Error('x')));
    assert((await adapter.validateConnection('BALE_TEST_TOKEN')).ok === true, 'getMe ok');
    assert(calls[0].url === `${BALE_API}/bot${token}/getMe`, 'official Bale URL');
    assert((await adapter.validateConnection('NOPE')).error === 'invalid_credential', 'bad ref → invalid_credential');

    // inspectDestination: channel where bot is admin with post rights
    calls = recorder(adapter, (method) => {
      if (method === 'getMe') return { id: 77, username: 'taranom_bot' };
      if (method === 'getChat') return { id: 5555, type: 'channel', title: 'کانال ترنم', username: 'taranom' };
      if (method === 'getChatMember') return { status: 'administrator', can_post_messages: true, can_edit_messages: false, can_delete_messages: true };
      if (method === 'getChatMembersCount') return 1200;
      return new Error(`unexpected ${method}`);
    });
    const inspection = await adapter.inspectDestination('BALE_TEST_TOKEN', '@taranom');
    assert(inspection.ok && inspection.chatType === 'channel' && inspection.botIsAdmin === true, 'channel inspected');
    assert(inspection.canPost === true && inspection.canEdit === false && inspection.canDelete === true, 'rights mapped from getChatMember');
    assert(inspection.memberCount === 1200 && inspection.permissionCheck === 'api', 'getChatMembersCount (plural) used');
    assert(calls.some((c) => c.url.endsWith('/getChatMembersCount')), 'Bale member-count method name');
    assert(calls.find((c) => c.url.endsWith('/getChatMember'))?.body.user_id === 77, 'bot id passed to getChatMember');

    // inspectDestination: not found
    recorder(adapter, (method) => (method === 'getMe' ? { id: 77 } : new Error('Bad Request: chat not found')));
    assert((await adapter.inspectDestination('BALE_TEST_TOKEN', '123')).error === 'chat_not_found', 'chat not found mapped');

    // create: single photo → sendPhoto with caption + reply_markup, no parse_mode/disable_notification
    calls = recorder(adapter, (method) => ({ message_id: method === 'sendPhoto' ? 41 : 42 }));
    const single = await adapter.create({
      secretRef: 'BALE_TEST_TOKEN',
      chatId: '@taranom',
      channel: 'RETAIL',
      parseMode: 'HTML',
      text: '<b>مانتو</b> جدید',
      photoUrls: ['https://www.poshaktaranom.ir/uploads/a.jpg'],
      buttons: [{ label: 'خرید', url: 'https://www.poshaktaranom.ir/products/a' }],
      silent: true,
      protectContent: true,
      linkPreview: false,
    });
    assert(single.providerMessageId === '41', 'single photo id');
    assert(calls.length === 1 && calls[0].url.endsWith('/sendPhoto'), 'one sendPhoto call');
    const photoBody = calls[0].body;
    assert(photoBody.caption === '*مانتو* جدید', 'Markdown caption');
    assert(!('parse_mode' in photoBody) && !('disable_notification' in photoBody) && !('protect_content' in photoBody), 'undocumented params dropped');
    assert(JSON.stringify(photoBody.reply_markup).includes('"url":"https://www.poshaktaranom.ir/products/a"'), 'inline url button');

    // create: album → sendMediaGroup (caption ≤1024 on first item, no reply_markup) + follow-up message carrying buttons
    calls = recorder(adapter, (method) => (method === 'sendMediaGroup' ? [{ message_id: 51 }, { message_id: 52 }] : { message_id: 53 }));
    const album = await adapter.create({
      secretRef: 'BALE_TEST_TOKEN',
      chatId: '@taranom',
      channel: 'RETAIL',
      parseMode: 'HTML',
      text: '<b>کت</b>',
      photoUrls: ['https://www.poshaktaranom.ir/uploads/a.jpg', 'https://www.poshaktaranom.ir/uploads/b.jpg'],
      buttons: [{ label: 'خرید', url: 'https://www.poshaktaranom.ir/products/a' }],
    });
    assert(album.providerMessageId === '51,52,53', 'album ids + button message id');
    assert(calls[0].url.endsWith('/sendMediaGroup') && !('reply_markup' in calls[0].body), 'album has no reply_markup');
    const media = calls[0].body.media as Array<Record<string, unknown>>;
    assert(media.length === 2 && media[0].caption === '*کت*' && !('caption' in media[1]), 'caption only on first item');
    assert(calls[1].url.endsWith('/sendMessage') && 'reply_markup' in calls[1].body, 'buttons ride on follow-up sendMessage');

    // create: album with a caption > 1024 → caption moves to the follow-up message
    calls = recorder(adapter, (method) => (method === 'sendMediaGroup' ? [{ message_id: 61 }] : { message_id: 62 }));
    const long = 'ط'.repeat(1100);
    await adapter.create({
      secretRef: 'BALE_TEST_TOKEN',
      chatId: '@taranom',
      channel: 'RETAIL',
      text: long,
      photoUrls: ['https://www.poshaktaranom.ir/uploads/a.jpg', 'https://www.poshaktaranom.ir/uploads/b.jpg'],
    });
    assert(!('caption' in (calls[0].body.media as Array<Record<string, unknown>>)[0]), 'oversized caption not on album');
    assert(String(calls[1].body.text).length === 1100, 'overflow text in follow-up (≤4096)');

    // create: text only
    calls = recorder(adapter, () => ({ message_id: 71 }));
    await adapter.create({ secretRef: 'BALE_TEST_TOKEN', chatId: '@taranom', channel: 'RETAIL', text: 'سلام' });
    assert(calls[0].url.endsWith('/sendMessage') && calls[0].body.text === 'سلام', 'plain sendMessage');

    // update: caption edit on photo post keeps trailing ids
    calls = recorder(adapter, () => ({ message_id: 41 }));
    const updated = await adapter.update({
      secretRef: 'BALE_TEST_TOKEN',
      chatId: '@taranom',
      channel: 'RETAIL',
      parseMode: 'HTML',
      providerMessageId: '41,42',
      text: '<b>ویرایش</b>',
      photoUrls: ['https://www.poshaktaranom.ir/uploads/a.jpg'],
    });
    assert(updated.providerMessageId === '41,42' && calls[0].url.endsWith('/editMessageCaption'), 'editMessageCaption on first id');
    assert(calls[0].body.message_id === 41 && calls[0].body.caption === '*ویرایش*', 'numeric message_id + Markdown caption');

    // delete: 48h window → delete_window_expired; not found → skipped
    recorder(adapter, () => new Error("Bad Request: message can't be deleted"));
    let windowErr = '';
    try {
      await adapter.delete({ secretRef: 'BALE_TEST_TOKEN', chatId: '@taranom', providerMessageId: '41' });
    } catch (err) {
      windowErr = err instanceof Error ? err.message : '';
    }
    assert(windowErr === 'delete_window_expired', '48h delete window surfaced');
    recorder(adapter, () => new Error('Bad Request: message to delete not found'));
    await adapter.delete({ secretRef: 'BALE_TEST_TOKEN', chatId: '@taranom', providerMessageId: '41,42' });

    // discoverChats: getUpdates without offset
    calls = recorder(adapter, () => [
      { update_id: 1, channel_post: { chat: { id: 5555, type: 'channel', title: 'کانال ترنم', username: 'taranom' } } },
      { update_id: 2, message: { chat: { id: 9, type: 'private', first_name: 'x' } } },
    ]);
    const discovered = await adapter.discoverChats('BALE_TEST_TOKEN');
    assert(discovered.ok && discovered.chats.length === 1 && discovered.chats[0].chatId === '5555', 'channel discovered, private skipped');
    assert(!('offset' in calls[0].body), 'getUpdates never acknowledges updates');

    // per-provider kill switch
    process.env.OMNICHANNEL_DISABLED_PROVIDERS = 'BALE';
    let killed = false;
    try {
      await adapter.validateConnection('BALE_TEST_TOKEN');
    } catch (err) {
      killed = err instanceof ConnectorDisabledError;
    }
    assert(killed, 'OMNICHANNEL_DISABLED_PROVIDERS=BALE gates Bale');
  } finally {
    if (prevFlag === undefined) delete process.env.OMNICHANNEL_CONNECTORS_ENABLED;
    else process.env.OMNICHANNEL_CONNECTORS_ENABLED = prevFlag;
    if (prevDisabled === undefined) delete process.env.OMNICHANNEL_DISABLED_PROVIDERS;
    else process.env.OMNICHANNEL_DISABLED_PROVIDERS = prevDisabled;
    if (prevTok === undefined) delete process.env.BALE_TEST_TOKEN;
    else process.env.BALE_TEST_TOKEN = prevTok;
  }
  console.log('bale.adapter.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
