import { revalidatePath, revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ADMIN_ROLE_KEY, ADMIN_TOKEN_KEY, canEnterAdmin } from '@/lib/admin-session';
import { canAccessStaffModule, isStaffRole } from '@/lib/staff-access';
import { getServerApiBase } from '@/lib/server-api-base';
import { cmsCacheTags, storefrontPathsForCms, type CmsChannel } from '@/lib/cms/revalidate-storefront';

export const dynamic = 'force-dynamic';

function asChannel(value: unknown): CmsChannel | null {
  return value === 'RETAIL' || value === 'WHOLESALE' ? value : null;
}

async function assertContentStaff(req: Request): Promise<boolean> {
  const header = req.headers.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const jar = await cookies();
  const cookieToken = jar.get(ADMIN_TOKEN_KEY)?.value;
  const token = bearer || cookieToken;
  const roleHint = jar.get(ADMIN_ROLE_KEY)?.value;
  if (!token || !canEnterAdmin(token, roleHint)) return false;
  try {
    const meRes = await fetch(`${getServerApiBase()}/auth/me/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!meRes.ok) return false;
    const me = (await meRes.json()) as { role?: string };
    return isStaffRole(me.role) && canAccessStaffModule(me.role, 'content');
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!(await assertContentStaff(req))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let body: { channel?: unknown; pageKey?: unknown } = {};
  try {
    body = (await req.json()) as { channel?: unknown; pageKey?: unknown };
  } catch {
    body = {};
  }
  const channel = asChannel(body.channel);
  const pageKey = typeof body.pageKey === 'string' && body.pageKey.trim() ? body.pageKey.trim() : 'home';
  if (!channel) {
    return NextResponse.json({ ok: false, error: 'channel' }, { status: 400 });
  }

  for (const tag of cmsCacheTags(channel, pageKey)) {
    revalidateTag(tag);
  }
  const paths = storefrontPathsForCms(channel, pageKey);
  for (const path of paths) {
    revalidatePath(path);
  }

  return NextResponse.json({ ok: true, paths });
}
