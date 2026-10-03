import { getServerApiBase } from '@/lib/server-api-base';

export function paymentCallbackUiUrl(origin: string, params: URLSearchParams): URL {
  const base = origin.replace(/\/$/, '');
  const url = new URL(`${base}/payment/callback`);
  params.forEach((value, key) => {
    if (value) url.searchParams.set(key, value);
  });
  return url;
}

export async function collectCallbackParams(req: Request): Promise<URLSearchParams> {
  const url = new URL(req.url);
  const params = new URLSearchParams(url.searchParams);
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

export function verifyBodyFromCallbackParams(params: URLSearchParams): Record<string, string> | null {
  const paymentId = params.get('paymentId') ?? params.get('providerId') ?? '';
  if (!paymentId) return null;
  const authority = params.get('Authority') ?? params.get('authority') ?? '';
  const trackingCode = params.get('trackingCode') ?? params.get('tracking_code') ?? '';
  const providerId = params.get('providerId') ?? params.get('provider_id') ?? '';
  const result = params.get('result') ?? '';
  const type = params.get('type') ?? '';
  const stateParam = params.get('state') ?? '';
  const transactionId = params.get('transactionId') ?? params.get('transaction_id') ?? '';
  const callbackAmount = params.get('amount') ?? '';
  const status = params.get('Status') ?? params.get('status') ?? stateParam;
  const body: Record<string, string> = {
    paymentId,
    authority,
    status: status || (trackingCode || result === '0' || stateParam === 'OK' ? 'OK' : ''),
  };
  if (trackingCode) body.trackingCode = trackingCode;
  if (providerId) body.providerId = providerId;
  if (result) body.result = result;
  if (type) body.type = type;
  if (stateParam) body.state = stateParam;
  if (transactionId) body.transactionId = transactionId;
  if (callbackAmount) body.amount = callbackAmount;
  return body;
}

/** PSP return hits the server first so capture does not depend on shopper JS. */
export async function capturePaymentFromCallbackParams(params: URLSearchParams): Promise<void> {
  const body = verifyBodyFromCallbackParams(params);
  if (!body) return;
  const res = await fetch(`${getServerApiBase()}/payments/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`payment verify HTTP ${res.status}`);
  }
}
