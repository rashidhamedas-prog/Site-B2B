#!/usr/bin/env node
/**
 * Verifies a Torob Product API v3 endpoint.
 * Token is read from TOROB_VERIFY_TOKEN and never printed.
 */
const endpoint = process.env.TOROB_VERIFY_URL;
const token = process.env.TOROB_VERIFY_TOKEN;
const version = process.env.TOROB_VERIFY_TOKEN_VERSION || '1';
const metaUrl = process.env.TOROB_VERIFY_PDP_URL;

if (!endpoint) {
  console.error('Set TOROB_VERIFY_URL');
  process.exit(2);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function post(body) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Torob-Token-Version': version,
  };
  if (token) headers['X-Torob-Token'] = token;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    redirect: 'manual',
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { response, json, text };
}

const empty = await post({});
if (empty.response.status !== 400 || !empty.json?.error) fail('empty body must be 400 {error}');

const list = await post({ page: 1, sort: 'date_added_desc' });
if (token && list.response.status === 401) fail('valid token rejected');
if (list.response.status >= 300 && list.response.status < 400) fail('endpoint redirected');
const type = list.response.headers.get('content-type') || '';
if (list.response.ok && !type.includes('application/json')) fail('Content-Type must be JSON');

if (list.response.ok) {
  const body = list.json;
  if (body.api_version !== 'torob_api_v3') fail('api_version');
  for (const key of ['current_page', 'total', 'max_pages']) {
    if (!Number.isInteger(body[key])) fail(`${key} must be int`);
  }
  if (body.total === 0 && body.max_pages !== 1) fail('max_pages must be 1 when total=0');
  if (!Array.isArray(body.products) || body.products.length > 100) fail('page size');
  for (const product of body.products) {
    if (!product.page_unique || !/^https:\/\//.test(product.page_url)) fail('absolute page_url');
    if (!Number.isInteger(product.current_price)) fail('current_price int');
    if (!Array.isArray(product.image_links) || !product.image_links[0]?.startsWith('https://')) {
      fail('image_links');
    }
    if (product.spec == null || typeof product.spec !== 'object' || Array.isArray(product.spec)) {
      fail('spec object');
    }
  }
}

if (metaUrl) {
  const page = await fetch(metaUrl, {
    headers: { 'User-Agent': 'TorobBot' },
    redirect: 'manual',
  });
  const html = await page.text();
  const head = html.split(/<\/head>/i)[0] || '';
  for (const name of ['product_price', 'availability', 'product_name', 'product_id']) {
    if (!new RegExp(`<meta[^>]+name=["']${name}["']`, 'i').test(head)) {
      fail(`missing meta ${name} in head`);
    }
  }
}

console.log('torob contract verifier passed');
