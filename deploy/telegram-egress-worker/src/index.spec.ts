import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { handleTelegramEgress, redactBotSecrets, resolveBotRoute, type Env } from './index.ts';

const TOKEN = '123456789:AA-test-token-not-real';

function callsOf(impl: typeof fetch & { calls?: Array<{ url: string; init: RequestInit }> }) {
  return impl.calls || [];
}

function mockFetch(status = 200, responseBody = '{"ok":true,"result":{}}', contentType = 'application/json'): typeof fetch & {
  calls: Array<{ url: string; init: RequestInit }>;
} {
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchImpl.calls.push({ url: String(url), init: init || {} });
    return new Response(responseBody, { status, headers: { 'Content-Type': contentType } });
  }) as typeof fetch & { calls: Array<{ url: string; init: RequestInit }> };
  fetchImpl.calls = [];
  return fetchImpl;
}

async function read(res: Response): Promise<{ status: number; body: string; type: string | null }> {
  return {
    status: res.status,
    body: await res.text(),
    type: res.headers.get('Content-Type'),
  };
}

describe('resolveBotRoute', () => {
  it('accepts a single /bot{token}/{method} path', () => {
    assert.deepEqual(resolveBotRoute(`/bot${TOKEN}/sendMessage`), { token: TOKEN, method: 'sendMessage' });
    assert.deepEqual(resolveBotRoute(`/bot${TOKEN}/getMe/`), { token: TOKEN, method: 'getMe' });
  });

  it('rejects traversal, host injection, and extra segments', () => {
    for (const path of [
      `/bot${TOKEN}/../../@evil.com/getMe`,
      `/bot${TOKEN}/..%2f..%2fgetMe`,
      `/@evil.com/bot${TOKEN}/getMe`,
      `//evil.com/bot${TOKEN}/getMe`,
      `/bot${TOKEN}/getMe/extra`,
      `/file/bot${TOKEN}/photo.jpg`,
      `/bot${TOKEN}/getMe%0d%0aX`,
      `/https://evil.com/bot${TOKEN}/getMe`,
      `/bot../getMe`,
      `/bot${TOKEN}/sendMessage?x=1`,
    ]) {
      assert.equal(resolveBotRoute(path), null, path);
    }
  });
});

describe('redactBotSecrets', () => {
  it('redacts /bot…/ segments and bare tokens', () => {
    const raw = `https://api.telegram.org/bot${TOKEN}/sendMessage token ${TOKEN}`;
    const redacted = redactBotSecrets(raw);
    assert.equal(redacted.includes(TOKEN), false);
    assert.match(redacted, /\/bot\[redacted\]\/sendMessage/);
    assert.match(redacted, /\[redacted-token\]/);
  });
});

describe('handleTelegramEgress', () => {
  it('forwards POST method, body, and Content-Type and returns upstream status/body', async () => {
    const fetchImpl = mockFetch(200, '{"ok":true,"result":{"message_id":5}}');
    const res = await handleTelegramEgress(
      new Request(`https://egress.example/bot${TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: '{"chat_id":1,"text":"ping"}',
      }),
      {},
      { fetchImpl },
    );
    const out = await read(res);
    assert.equal(out.status, 200);
    assert.equal(out.body, '{"ok":true,"result":{"message_id":5}}');
    assert.match(out.type || '', /application\/json/);
    const call = callsOf(fetchImpl)[0];
    assert.equal(call.url, `https://api.telegram.org/bot${TOKEN}/sendMessage`);
    assert.equal(call.init.method, 'POST');
    assert.equal((call.init.headers as Record<string, string>)['Content-Type'], 'application/json');
    const forwarded = new TextDecoder().decode(call.init.body as ArrayBuffer);
    assert.equal(forwarded, '{"chat_id":1,"text":"ping"}');
    assert.equal((call.init.headers as Record<string, string>)['x-taranom-egress-secret'], undefined);
  });

  it('allows requests when EGRESS_SECRET is unset', async () => {
    const fetchImpl = mockFetch();
    const res = await handleTelegramEgress(
      new Request(`https://egress.example/bot${TOKEN}/getMe`),
      {},
      { fetchImpl },
    );
    assert.equal(res.status, 200);
    assert.equal(callsOf(fetchImpl)[0].url, `https://api.telegram.org/bot${TOKEN}/getMe`);
    assert.equal(callsOf(fetchImpl)[0].init.method, 'GET');
  });

  it('requires x-taranom-egress-secret when EGRESS_SECRET is set', async () => {
    const env: Env = { EGRESS_SECRET: 'shared-secret' };
    const fetchImpl = mockFetch();
    const missing = await handleTelegramEgress(new Request(`https://egress.example/bot${TOKEN}/getMe`), env, { fetchImpl });
    assert.equal(missing.status, 401);
    const wrong = await handleTelegramEgress(
      new Request(`https://egress.example/bot${TOKEN}/getMe`, { headers: { 'x-taranom-egress-secret': 'nope' } }),
      env,
      { fetchImpl },
    );
    assert.equal(wrong.status, 401);
    assert.equal(callsOf(fetchImpl).length, 0);
    const ok = await handleTelegramEgress(
      new Request(`https://egress.example/bot${TOKEN}/getMe`, { headers: { 'x-taranom-egress-secret': 'shared-secret' } }),
      env,
      { fetchImpl },
    );
    assert.equal(ok.status, 200);
    assert.equal(callsOf(fetchImpl).length, 1);
  });

  it('rejects dot-dot and host injection before fetch', async () => {
    const fetchImpl = mockFetch();
    for (const path of [
      `/bot${TOKEN}/../../@evil.com/x`,
      `/bot${TOKEN}/..%2f..%2f@evil.com`,
      `/@evil.com/bot${TOKEN}/getMe`,
      `//evil.com/bot${TOKEN}/getMe`,
      `/file/bot${TOKEN}/photo.jpg`,
      `/bot${TOKEN}/getMe/extra`,
    ]) {
      const res = await handleTelegramEgress(new Request(`https://egress.example${path}`), {}, { fetchImpl });
      assert.equal(res.status, 404, path);
    }
    assert.equal(callsOf(fetchImpl).length, 0);
  });

  it('redacts the bot token in upstream error logs and the 502 body', async () => {
    const logs: string[] = [];
    const fetchImpl = (async () => {
      throw new Error(`connect https://api.telegram.org/bot${TOKEN}/sendMessage: refused`);
    }) as typeof fetch;
    const res = await handleTelegramEgress(
      new Request(`https://egress.example/bot${TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }),
      {},
      { fetchImpl, log: (message) => logs.push(message) },
    );
    const out = await read(res);
    assert.equal(out.status, 502);
    assert.equal(out.body.includes(TOKEN), false);
    assert.match(out.body, /\/bot\[redacted\]/);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].includes(TOKEN), false);
    assert.match(logs[0], /\/bot\[redacted\]/);
  });
});
