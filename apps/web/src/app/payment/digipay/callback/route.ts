import { NextRequest, NextResponse } from 'next/server';
import {
  capturePaymentFromCallbackParams,
  collectCallbackParams,
  paymentCallbackUiUrl,
} from '@/lib/payment-callback-capture';

function callbackOrigin(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_RETAIL_URL ||
    req.nextUrl.origin ||
    'https://www.poshaktaranom.ir'
  ).replace(/\/$/, '');
}

async function redirectToUi(req: NextRequest) {
  const params = await collectCallbackParams(req);
  try {
    await capturePaymentFromCallbackParams(params);
  } catch {
    /* UI /payments/verify is idempotent and retries */
  }
  return NextResponse.redirect(paymentCallbackUiUrl(callbackOrigin(req), params), 303);
}

export async function GET(req: NextRequest) {
  return redirectToUi(req);
}

export async function POST(req: NextRequest) {
  return redirectToUi(req);
}
