/**
 * PR-14 pure FSM transitions for wholesale order-taker bots.
 * Live price/stock/MOQ come from callers (catalog); no hardcoded prices.
 */

import type { BotConversationState } from '../entities/omnichannel-bot-conversation.entity';
import { classifySensitive, SENSITIVE_CUSTOMER_COPY, ensureSensitiveTag } from './bot-sensitive';

export const BOT_MENU_COPY =
  'سلام! به ربات سفارش عمده خوش آمدید.\n'
  + '۱) محصولات\n۲) سفارش\n۳) پیگیری\n۴) پشتیبانی\n'
  + 'کد کالا را بفرستید یا عدد منو را انتخاب کنید.';

export const BOT_MOQ_REJECT_COPY =
  'تعداد کمتر از حداقل سفارش مجاز است. لطفاً تعداد را اصلاح کنید.';

export type FsmContext = {
  state: BotConversationState;
  statePayload: Record<string, unknown>;
  tags: string[];
  /** Prior PFI/order for this provider+customer */
  hasPriorPfi: boolean;
  /** Live catalog row when known */
  catalog?: {
    productId?: string;
    sku: string;
    name: string;
    minOrderQty: number;
    stock: number;
    unitPrice: number;
    variants?: Array<{ id: string; color: string; size: string; stock: number }>;
  } | null;
};

export type FsmResult = {
  state: BotConversationState;
  statePayload: Record<string, unknown>;
  tags: string[];
  reply: string;
  /** When true, create PFI via order+invoice services */
  createPfi?: boolean;
  /** Forward compact summary to ownerChatId */
  forwardOwner?: boolean;
  /** Skip FSM advance (e.g. rate limit already handled) */
  noAdvance?: boolean;
};

function payload(ctx: FsmContext): Record<string, unknown> {
  return { ...(ctx.statePayload || {}) };
}

function parseMenuChoice(text: string): 'PRODUCT_LOOKUP' | 'TRACK' | 'SUPPORT' | 'ORDER' | null {
  const t = text.trim();
  if (/^(1|۱|محصول)/i.test(t)) return 'PRODUCT_LOOKUP';
  if (/^(2|۲|سفارش)/i.test(t)) return 'ORDER';
  if (/^(3|۳|پیگیری)/i.test(t)) return 'TRACK';
  if (/^(4|۴|پشتیبانی)/i.test(t)) return 'SUPPORT';
  return null;
}

/** Normalize Persian/Arabic digits and strip start= payload (REQ-C9). */
export function parseStartSku(text: unknown): string | null {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const normalized = raw
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const m =
    normalized.match(/^\/start(?:\s+|=)([A-Za-z0-9_-]{2,64})$/i)
    || normalized.match(/^start=([A-Za-z0-9_-]{2,64})$/i);
  return m ? m[1] : null;
}

export function assertQtyMeetsMoq(qty: number, minOrderQty: number): boolean {
  const moq = Math.max(1, Math.floor(Number(minOrderQty) || 1));
  const q = Math.floor(Number(qty) || 0);
  return q >= moq;
}

export function transitionBotOrderFsm(ctx: FsmContext, inboundText: string): FsmResult {
  const text = String(inboundText || '').trim();
  const tags = Array.isArray(ctx.tags) ? [...ctx.tags] : [];

  // Sensitive classifier on free text (except already held)
  if (ctx.state !== 'SENSITIVE_HOLD' && ctx.state !== 'MENU') {
    const sens = classifySensitive({ text, hasPriorPfi: ctx.hasPriorPfi });
    if (sens.sensitive && sens.reason === 'keyword') {
      return {
        state: 'SENSITIVE_HOLD',
        statePayload: payload(ctx),
        tags: ensureSensitiveTag(tags),
        reply: SENSITIVE_CUSTOMER_COPY,
        forwardOwner: true,
      };
    }
  }

  switch (ctx.state) {
    case 'MENU': {
      const startSku = parseStartSku(text);
      if (startSku) {
        return {
          state: 'PRODUCT_LOOKUP',
          statePayload: { ...payload(ctx), sku: startSku },
          tags,
          reply: `در حال بررسی کد ${startSku}…`,
        };
      }
      const choice = parseMenuChoice(text);
      if (choice === 'TRACK') {
        return {
          state: 'TRACK',
          statePayload: payload(ctx),
          tags,
          reply: 'شماره پیش‌فاکتور (PFI-…) یا سفارش را بفرستید.',
        };
      }
      if (choice === 'SUPPORT') {
        return {
          state: 'SUPPORT',
          statePayload: payload(ctx),
          tags,
          reply: 'پیام پشتیبانی شما ثبت شد. کارشناس پاسخ می‌دهد.',
          forwardOwner: true,
        };
      }
      if (choice === 'PRODUCT_LOOKUP' || choice === 'ORDER') {
        return {
          state: 'PRODUCT_LOOKUP',
          statePayload: payload(ctx),
          tags,
          reply: 'کد کالا (SKU) را بفرستید.',
        };
      }
      if (/^[A-Za-z0-9_-]{2,64}$/.test(text)) {
        return {
          state: 'PRODUCT_LOOKUP',
          statePayload: { ...payload(ctx), sku: text },
          tags,
          reply: `در حال بررسی کد ${text}…`,
        };
      }
      return {
        state: 'MENU',
        statePayload: payload(ctx),
        tags,
        reply: BOT_MENU_COPY,
      };
    }

    case 'PRODUCT_LOOKUP': {
      const cat = ctx.catalog;
      if (!cat) {
        return {
          state: 'PRODUCT_LOOKUP',
          statePayload: { ...payload(ctx), sku: text || payload(ctx).sku },
          tags,
          reply: 'کالا یافت نشد. کد دیگری بفرستید یا «منو» را بزنید.',
        };
      }
      const variants = cat.variants || [];
      const p = {
        ...payload(ctx),
        productId: cat.productId || payload(ctx).productId,
        sku: cat.sku,
        productName: cat.name,
        minOrderQty: cat.minOrderQty,
        unitPrice: cat.unitPrice,
        stock: cat.stock,
      };
      if (variants.length > 1) {
        const lines = variants
          .slice(0, 12)
          .map((v, i) => `${i + 1}) ${v.color}/${v.size} — موجودی ${v.stock}`)
          .join('\n');
        return {
          state: 'VARIANT',
          statePayload: { ...p, variants: variants.map((v) => v.id) },
          tags,
          reply: `${cat.name}\nقیمت: ${cat.unitPrice}\nموجودی: ${cat.stock}\nحداقل سفارش: ${cat.minOrderQty}\n\nرنگ/سایز را انتخاب کنید:\n${lines}`,
        };
      }
      return {
        state: 'QTY',
        statePayload: {
          ...p,
          variantId: variants[0]?.id || null,
        },
        tags,
        reply: `${cat.name}\nقیمت: ${cat.unitPrice}\nموجودی: ${cat.stock}\nحداقل سفارش: ${cat.minOrderQty}\n\nتعداد را بفرستید.`,
      };
    }

    case 'VARIANT': {
      const idx = Math.floor(Number(text.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))) || 0) - 1;
      const ids = Array.isArray(payload(ctx).variants) ? (payload(ctx).variants as string[]) : [];
      const variantId = ids[idx] || (ctx.catalog?.variants || [])[idx]?.id;
      if (!variantId) {
        return {
          state: 'VARIANT',
          statePayload: payload(ctx),
          tags,
          reply: 'انتخاب نامعتبر است. شماره رنگ/سایز را بفرستید.',
        };
      }
      return {
        state: 'QTY',
        statePayload: { ...payload(ctx), variantId },
        tags,
        reply: `تعداد را بفرستید (حداقل ${payload(ctx).minOrderQty || 1}).`,
      };
    }

    case 'QTY': {
      const qty = Math.floor(
        Number(
          text
            .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
            .replace(/[^\d]/g, ''),
        ) || 0,
      );
      const moq = Math.max(1, Number(payload(ctx).minOrderQty) || 1);
      if (!assertQtyMeetsMoq(qty, moq)) {
        return {
          state: 'QTY',
          statePayload: payload(ctx),
          tags,
          reply: `${BOT_MOQ_REJECT_COPY} (حداقل ${moq})`,
        };
      }
      return {
        state: 'CUSTOMER_INFO',
        statePayload: { ...payload(ctx), qty },
        tags,
        reply: 'نام، موبایل، شهر و نام فروشگاه را در یک پیام بفرستید.',
      };
    }

    case 'CUSTOMER_INFO': {
      const phoneMatch = text.match(/(09\d{9})/);
      if (!phoneMatch) {
        return {
          state: 'CUSTOMER_INFO',
          statePayload: payload(ctx),
          tags,
          reply: 'شماره موبایل معتبر (09…) یافت نشد. دوباره بفرستید.',
        };
      }
      const sens = classifySensitive({ text, hasPriorPfi: ctx.hasPriorPfi });
      if (sens.sensitive) {
        return {
          state: 'SENSITIVE_HOLD',
          statePayload: {
            ...payload(ctx),
            customerPhoneMasked: `${phoneMatch[1].slice(0, 4)}***${phoneMatch[1].slice(-2)}`,
            customerInfo: text.slice(0, 200),
          },
          tags: ensureSensitiveTag(tags),
          reply: SENSITIVE_CUSTOMER_COPY,
          forwardOwner: true,
        };
      }
      return {
        state: 'SUMMARY',
        statePayload: {
          ...payload(ctx),
          customerPhoneMasked: `${phoneMatch[1].slice(0, 4)}***${phoneMatch[1].slice(-2)}`,
          customerPhone: phoneMatch[1],
          customerInfo: text.slice(0, 200),
        },
        tags,
        reply:
          `خلاصه سفارش:\nکد: ${payload(ctx).sku}\nتعداد: ${payload(ctx).qty}\n`
          + `برای تأیید «تأیید» و برای انصراف «انصراف» بفرستید.`,
      };
    }

    case 'SUMMARY': {
      if (/^(انصراف|لغو|cancel)/i.test(text)) {
        return {
          state: 'MENU',
          statePayload: {},
          tags,
          reply: BOT_MENU_COPY,
        };
      }
      if (!/^(تأیید|تاييد|تایید|ok|yes|بلی|بله)/i.test(text)) {
        return {
          state: 'SUMMARY',
          statePayload: payload(ctx),
          tags,
          reply: 'برای ادامه «تأیید» یا «انصراف» بفرستید.',
        };
      }
      return {
        state: 'PFI_CREATED',
        statePayload: payload(ctx),
        tags,
        reply: 'در حال صدور پیش‌فاکتور…',
        createPfi: true,
        forwardOwner: true,
      };
    }

    case 'PFI_CREATED':
      return {
        state: 'MENU',
        statePayload: payload(ctx),
        tags,
        reply: BOT_MENU_COPY,
      };

    case 'SENSITIVE_HOLD':
      return {
        state: 'SENSITIVE_HOLD',
        statePayload: payload(ctx),
        tags: ensureSensitiveTag(tags),
        reply: SENSITIVE_CUSTOMER_COPY,
        forwardOwner: false,
      };

    case 'TRACK':
      return {
        state: 'TRACK',
        statePayload: { ...payload(ctx), trackQuery: text.slice(0, 64) },
        tags,
        reply: 'پیگیری ثبت شد. در صورت نیاز کارشناس اعلام می‌کند.',
        forwardOwner: true,
      };

    case 'SUPPORT':
      return {
        state: 'SUPPORT',
        statePayload: payload(ctx),
        tags,
        reply: 'پیام شما ثبت شد.',
        forwardOwner: true,
      };

    default:
      return {
        state: 'MENU',
        statePayload: {},
        tags,
        reply: BOT_MENU_COPY,
      };
  }
}
