/** Partner-editable slots inside the customer confirmation SMS. The legal lines and URL stay server-owned. */

export const SMS_CHANNELS = ['instagram', 'telegram', 'rubika', 'bale'] as const;
export type SmsChannel = (typeof SMS_CHANNELS)[number];

export const SMS_LIMITS = { shopName: 32, greeting: 40, handle: 24 } as const;

export const SMS_PREVIEW_URL = 'https://www.poshaktaranom.ir/confirm/sales-partner/…';

const CHANNEL_LABEL: Record<SmsChannel, string> = {
  instagram: 'اینستاگرام',
  telegram: 'تلگرام',
  rubika: 'روبیکا',
  bale: 'بله',
};

export type PartnerSmsIdentity = {
  shopName: string;
  greeting: string;
  channel: SmsChannel | '';
  handle: string;
};

const EMPTY: PartnerSmsIdentity = { shopName: '', greeting: '', channel: '', handle: '' };

function clean(raw: string | null | undefined): string {
  return String(raw || '')
    .replace(/[\u202A-\u202E\u2066-\u2069\u200B\u200D\u200E\u200F\uFEFF]/g, '')
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasForbiddenPayload(value: string): boolean {
  return /(https?:\/\/|www\.|t\.me\/|telegram\.me|wa\.me|instagram\.com|rubika\.ir|\.ir\b|\.com\b)/i.test(value)
    || /(?:\+?98|0)?9\d{9}/.test(value.replace(/[\s-]/g, ''))
    || /شبا|شماره\s*کارت|واریز|درگاه|رمز\s*یکبار|کد\s*ملی/.test(value)
    || /ترنم|taranom|poshaktaranom/i.test(value);
}

function shopNameError(value: string): string | null {
  if (!value) return null;
  if (value.length < 2 || value.length > SMS_LIMITS.shopName) return 'نام فروشگاه باید بین ۲ تا ۳۲ نویسه باشد';
  if (!/^[\u0600-\u06FFa-zA-Z0-9 \u200C._-]+$/.test(value)) return 'نام فروشگاه فقط حرف، عدد و خط تیره می‌پذیرد';
  if (hasForbiddenPayload(value)) return 'نام فروشگاه نمی‌تواند لینک، شماره یا نام پوشاک ترنم باشد';
  return null;
}

function greetingError(value: string): string | null {
  if (!value) return null;
  if (value.length > SMS_LIMITS.greeting) return 'جملهٔ معرفی حداکثر ۴۰ نویسه است';
  if (!/^[\u0600-\u06FFa-zA-Z0-9 \u200C.،!?-]+$/.test(value)) return 'جملهٔ معرفی نویسهٔ غیرمجاز دارد';
  if (hasForbiddenPayload(value)) return 'جملهٔ معرفی نمی‌تواند لینک، شماره یا ادعای پرداخت داشته باشد';
  return null;
}

function handleError(value: string): string | null {
  if (!value) return null;
  if (!/^[A-Za-z0-9._]{2,24}$/.test(value)) return 'شناسهٔ پیج فقط حروف انگلیسی، عدد، نقطه و زیرخط است';
  if (hasForbiddenPayload(value) || /taranom|poshaktaranom/i.test(value)) return 'این شناسه مجاز نیست';
  return null;
}

export function parsePartnerSmsIdentity(input: {
  shopName?: string | null;
  greeting?: string | null;
  channel?: string | null;
  handle?: string | null;
}): { ok: true; value: PartnerSmsIdentity } | { ok: false; error: string } {
  const shopName = clean(input.shopName);
  const greeting = clean(input.greeting);
  const channelRaw = clean(input.channel).toLowerCase();
  const handle = clean(input.handle).replace(/^@+/, '');
  const shopErr = shopNameError(shopName);
  if (shopErr) return { ok: false, error: shopErr };
  const greetErr = greetingError(greeting);
  if (greetErr) return { ok: false, error: greetErr };
  const channel = channelRaw && (SMS_CHANNELS as readonly string[]).includes(channelRaw)
    ? (channelRaw as SmsChannel)
    : '';
  if (channelRaw && !channel) return { ok: false, error: 'کانال را از فهرست انتخاب کنید' };
  const handleErr = handleError(handle);
  if (handleErr) return { ok: false, error: handleErr };
  if (channel && !handle) return { ok: false, error: 'شناسهٔ پیج یا کانال را هم بنویسید' };
  if (!channel && handle) return { ok: false, error: 'اول کانال را انتخاب کنید' };
  return { ok: true, value: { shopName, greeting, channel, handle } };
}

export function coercePartnerSmsIdentity(input: {
  shopName?: string | null;
  greeting?: string | null;
  channel?: string | null;
  handle?: string | null;
}): PartnerSmsIdentity {
  const parsed = parsePartnerSmsIdentity(input);
  return parsed.ok ? parsed.value : EMPTY;
}

export function composeCustomerConfirmationSms(input: {
  displayName: string;
  confirmUrl: string;
  shopName?: string | null;
  greeting?: string | null;
  channel?: string | null;
  handle?: string | null;
}): string {
  const identity = coercePartnerSmsIdentity(input);
  const shop = identity.shopName || clean(input.displayName) || 'همکار فروش';
  const lines: string[] = [];
  if (identity.greeting) lines.push(identity.greeting);
  let intro = `همکار فروش ${shop} یک سبد برای شما آماده کرده است.`;
  if (identity.channel && identity.handle) {
    intro += ` ${CHANNEL_LABEL[identity.channel]}: @${identity.handle}.`;
  }
  lines.push(intro);
  lines.push('تا زمانی که خودتان آن را تأیید نکنید سفارشی ثبت یا مبلغی دریافت نمی‌شود. پرداخت فقط به پوشاک ترنم است.');
  lines.push(input.confirmUrl);
  return lines.join('\n');
}

export function presentSmsProfile(input: {
  displayName: string;
  smsShopName?: string | null;
  smsGreeting?: string | null;
  smsChannel?: string | null;
  smsHandle?: string | null;
}) {
  const identity = coercePartnerSmsIdentity({
    shopName: input.smsShopName,
    greeting: input.smsGreeting,
    channel: input.smsChannel,
    handle: input.smsHandle,
  });
  return {
    shopName: identity.shopName,
    greeting: identity.greeting,
    channel: identity.channel,
    handle: identity.handle,
    preview: composeCustomerConfirmationSms({
      displayName: input.displayName,
      confirmUrl: SMS_PREVIEW_URL,
      ...identity,
    }),
    limits: SMS_LIMITS,
    channels: SMS_CHANNELS.map((id) => ({ id, label: CHANNEL_LABEL[id] })),
  };
}
