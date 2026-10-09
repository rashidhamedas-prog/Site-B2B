/** Max products per admin category requeue request. */
export const REQUEUE_BY_CATEGORY_MAX = 100;

/** Floor spacing between staggered messenger posts (seconds). */
export const REQUEUE_GAP_FLOOR_SECONDS = 5;

export const CLEAR_WAITING_ERROR = 'cancelled_by_admin';
export const CLEAR_WAITING_STALE_ERROR = 'cancelled_by_admin_stale_lock';

/**
 * Schedule the i-th product in a blast so the worker respects min-gap without
 * relying on automation daily_cap / quiet hours.
 */
export function staggeredAvailableAt(
  index: number,
  gapSeconds: number,
  now = new Date(),
): Date {
  const gap = Math.max(REQUEUE_GAP_FLOOR_SECONDS, Math.floor(Number(gapSeconds) || 0));
  const i = Math.max(0, Math.floor(index));
  return new Date(now.getTime() + i * gap * 1000);
}

export function normalizeClearWaitingInput(body: {
  reason?: unknown;
  confirm?: unknown;
}): { ok: true; reason: string } | { error: string } {
  if (body?.confirm !== true) {
    return { error: 'برای خالی کردن صف، تأیید صریح (confirm: true) لازم است' };
  }
  const reason = String(body?.reason ?? '').trim();
  if (!reason) {
    return { error: 'دلیل خالی کردن صف الزامی است' };
  }
  if (reason.length > 240) {
    return { error: 'دلیل حداکثر ۲۴۰ نویسه است' };
  }
  return { ok: true, reason };
}

export function normalizeRequeueByCategoryInput(body: {
  channel?: unknown;
  categoryId?: unknown;
  reason?: unknown;
  confirm?: unknown;
  dryRun?: unknown;
  destinationId?: unknown;
  offset?: unknown;
}):
  | {
      ok: true;
      channel: 'RETAIL' | 'WHOLESALE';
      categoryId: string;
      reason: string;
      dryRun: boolean;
      destinationId?: string;
      offset: number;
    }
  | { error: string } {
  const channel = String(body?.channel || '').toUpperCase();
  if (channel !== 'RETAIL' && channel !== 'WHOLESALE') {
    return { error: 'کانال باید RETAIL یا WHOLESALE باشد' };
  }
  const categoryId = String(body?.categoryId || '').trim();
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(categoryId)) {
    return { error: 'شناسه دسته نامعتبر است' };
  }
  const dryRun = body?.dryRun === true;
  if (!dryRun && body?.confirm !== true) {
    return { error: 'برای ارسال واقعی، تأیید صریح (confirm: true) لازم است' };
  }
  const reason = String(body?.reason ?? '').trim();
  if (!reason) {
    return { error: 'دلیل ارسال مجدد الزامی است' };
  }
  if (reason.length > 240) {
    return { error: 'دلیل حداکثر ۲۴۰ نویسه است' };
  }
  const destinationId = body?.destinationId
    ? String(body.destinationId).trim()
    : undefined;
  if (destinationId && !uuid.test(destinationId)) {
    return { error: 'شناسه مقصد نامعتبر است' };
  }
  const offset = Math.max(0, Math.floor(Number(body?.offset) || 0));
  return {
    ok: true,
    channel,
    categoryId,
    reason,
    dryRun,
    destinationId: destinationId || undefined,
    offset,
  };
}
