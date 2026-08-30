import { NextResponse } from 'next/server';
import { getServerApiBase } from '@/lib/server-api-base';

const REACHABILITY = {
  api_version: 'torob_api_v3',
  current_page: 1,
  total: 0,
  max_pages: 1,
  products: [] as const,
};

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

export async function GET() {
  return NextResponse.json(REACHABILITY, { headers: NO_STORE });
}

export async function POST(request: Request) {
  const target = `${getServerApiBase().replace(/\/$/, '')}/torob_api/v3/products`;
  const headers = new Headers();
  headers.set('content-type', request.headers.get('content-type') || 'application/json');
  const token = request.headers.get('x-torob-token');
  const version = request.headers.get('x-torob-token-version');
  if (token) headers.set('x-torob-token', token);
  if (version) headers.set('x-torob-token-version', version);
  const requestId = request.headers.get('x-request-id');
  if (requestId) headers.set('x-request-id', requestId);

  const upstream = await fetch(target, {
    method: 'POST',
    headers,
    body: await request.text(),
    cache: 'no-store',
  });
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      ...NO_STORE,
    },
  });
}
