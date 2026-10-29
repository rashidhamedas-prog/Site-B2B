'use client';

/**
 * Owner-gated blast + clear-waiting with two confirm steps.
 * Never invents channel IDs; respects dailyRoom from dry-run preview.
 */

import { faNumber } from './admin-omnichannel-ui';
import { opsLabelFa } from './admin-omnichannel-labels';

export const CLEAR_WAITING_CONFIRM_PHRASE = 'خالی';

export type BlastPreview = {
  matched: number;
  hasMore: boolean;
  dailyRoom?: number;
  dailyCap?: number;
  sentToday?: number;
  minGapSeconds?: number;
};

export function canRunOwnerBlast(input: {
  rbacEnabled?: boolean;
  omnichannelRole?: string | null;
}): boolean {
  if (!input.rbacEnabled) return true; // ADMIN session; API still enforces when RBAC on
  return String(input.omnichannelRole || '').toUpperCase() === 'OWNER';
}

export function confirmClearWaiting(input: {
  pending: number;
  channelOnly: boolean;
  channelNames: string;
  visibleWaiting: number;
  reasonDefault: string;
}): { ok: true; reason: string } | { ok: false; error?: string } {
  if (input.pending <= 0) return { ok: false, error: 'صف انتظار از قبل خالی است' };
  const promptText = input.channelOnly
    ? `فقط رویدادهای ارسال کانال${input.channelNames ? ` (${input.channelNames})` : ''} لغو شود؟ پیامک و همکار فروش دست نخورده می‌مانند. در این فهرست حدود ${faNumber(input.visibleWaiting)} ردیف در انتظار دیده می‌شود (کل صف مشترک: ${faNumber(input.pending)}). حذف از دیتابیس نیست. دلیل را بنویسید:`
    : `همه ${faNumber(input.pending)} رویداد صف مشترک (شامل پیامک/جستجو/همکار) لغو شود؟ حذف از دیتابیس نیست. دلیل را بنویسید:`;
  const why = window.prompt(promptText, input.reasonDefault || 'پاک‌سازی صف انتظار');
  if (why == null) return { ok: false };
  const trimmed = why.trim();
  if (!trimmed) return { ok: false, error: 'دلیل خالی کردن صف الزامی است' };

  const phrase = window.prompt(
    `تأیید دوم: برای خالی کردن صف، عبارت «${CLEAR_WAITING_CONFIRM_PHRASE}» را تایپ کنید:`,
    '',
  );
  if (phrase == null) return { ok: false };
  if (phrase.trim() !== CLEAR_WAITING_CONFIRM_PHRASE) {
    return { ok: false, error: `برای تأیید باید دقیقاً «${CLEAR_WAITING_CONFIRM_PHRASE}» را بنویسید` };
  }

  const finalOk = window.confirm(
    input.channelOnly
      ? `تأیید نهایی: فقط ارسال کانال${input.channelNames ? ` (${input.channelNames})` : ''} لغو شود؟`
      : `تأیید نهایی: همه ${faNumber(input.pending)} رویداد صف مشترک لغو شود؟`,
  );
  if (!finalOk) return { ok: false };
  return { ok: true, reason: trimmed };
}

export function confirmBlastStart(input: {
  catName: string;
  channelLabel: string;
  preview: BlastPreview | null;
  connectorsOn: boolean;
}): { ok: true } | { ok: false; error?: string } {
  if (!input.connectorsOn) return { ok: false, error: 'ارسال از سرور خاموش است' };
  const room = input.preview?.dailyRoom;
  const cap = input.preview?.dailyCap;
  const sent = input.preview?.sentToday;
  const matched = input.preview?.matched;
  const gap = input.preview?.minGapSeconds;
  const countHint = matched != null ? faNumber(matched) : '؟';
  const roomLine =
    room != null && cap != null && sent != null
      ? `\nسقف امروز این مقصد: ${faNumber(sent)} از ${faNumber(cap)} · باقی‌مانده: ${faNumber(room)}`
      : '\n(ابتدا «شمارش محصولات» را بزنید تا سقف روزانه دیده شود)';
  const gapLine = gap != null ? `\nفاصلهٔ حداقل بین پست‌ها: ${faNumber(gap)} ثانیه` : '';
  const maxToday =
    room != null
      ? `\nدر این اجرا حداکثر ${faNumber(Math.min(matched ?? room, room))} پست جدید صف می‌شود (هرگز بیش از باقی‌ماندهٔ سقف).`
      : '';

  if (!window.confirm(
    `مرحله ۱ — ${opsLabelFa('blast')}: تا ${countHint} محصول «${input.catName}» در کانال ${input.channelLabel}؟${roomLine}${gapLine}${maxToday}`,
  )) {
    return { ok: false };
  }
  if (!window.confirm(
    room != null
      ? `مرحله ۲ — تأیید نهایی Owner: حداکثر ${faNumber(room)} پست امروز برای این مقصد. ادامه؟`
      : 'مرحله ۲ — تأیید نهایی Owner برای ارسال دسته‌ای. ادامه؟',
  )) {
    return { ok: false };
  }
  return { ok: true };
}

export function BlastOwnerGateHint({ allowed }: { allowed: boolean }) {
  if (allowed) return null;
  return (
    <p className="text-xs text-amber-800 mt-2">
      شروع {opsLabelFa('blast')} و خالی کردن صف فقط برای نقش Owner است.
    </p>
  );
}
