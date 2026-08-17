import { NextResponse } from 'next/server';
import { getServerApiBase } from '@/lib/server-api';

export const revalidate = 600;

export async function GET() {
  const url = `${getServerApiBase()}/feeds/google-merchant.xml`;
  try {
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) {
      return new NextResponse(`Google Merchant feed upstream ${res.status}`, {
        status: 502,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
    const xml = await res.text();
    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
      },
    });
  } catch {
    return new NextResponse('Google Merchant feed unavailable', {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
