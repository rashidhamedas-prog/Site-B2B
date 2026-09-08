import { NextRequest, NextResponse } from 'next/server';

function callbackTarget(req: NextRequest, params: URLSearchParams): URL {
  const origin = (
    process.env.NEXT_PUBLIC_RETAIL_URL ||
    req.nextUrl.origin ||
    'https://www.poshaktaranom.ir'
  ).replace(/\/$/, '');
  const url = new URL(`${origin}/payment/callback`);
  params.forEach((value, key) => {
    if (value) url.searchParams.set(key, value);
  });
  return url;
}

async function collectParams(req: NextRequest): Promise<URLSearchParams> {
  const params = new URLSearchParams(req.nextUrl.searchParams);
  if (req.method === 'GET' || req.method === 'HEAD') return params;
  const contentType = req.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      const body = (await req.json()) as Record<string, unknown>;
      for (const [key, value] of Object.entries(body)) {
        if (value == null || value === '') continue;
        params.set(key, String(value));
      }
      return params;
    }
    const form = await req.formData();
    form.forEach((value, key) => {
      if (typeof value === 'string' && value) params.set(key, value);
    });
  } catch {
    try {
      const text = await req.text();
      const parsed = new URLSearchParams(text);
      parsed.forEach((value, key) => {
        if (value) params.set(key, value);
      });
    } catch {
      /* keep query params only */
    }
  }
  return params;
}

async function redirectToUi(req: NextRequest) {
  const params = await collectParams(req);
  return NextResponse.redirect(callbackTarget(req, params), 303);
}

export async function GET(req: NextRequest) {
  return redirectToUi(req);
}

export async function POST(req: NextRequest) {
  return redirectToUi(req);
}
