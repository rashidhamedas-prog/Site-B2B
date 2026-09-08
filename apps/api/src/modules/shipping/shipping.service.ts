import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import {
  DEFAULT_POST_TARIFF,
  localPostFeeIrr,
  provinceCode,
  resolvePostZone,
  tapinCheckPrice,
  type PostTariff,
} from './iran-post-quote';
import {
  shippingPostForChannel,
  isInPersonMethod,
  type SaleChannel,
} from '../settings/shipping-channel';

// Shipping quotes + tracking links. Fees and per-method availability are
// user-configurable from the admin settings panel (DB), with env fallback.
// All amounts IRR.
@Injectable()
export class ShippingService {
  /** Fallback average manteau weight (kg) incl. packaging — overridden by settings.kgPerPiece */
  private static readonly KG_PER_PIECE_DEFAULT = 0.45;

  private static readonly METHOD_DEFS = [
    { id: 'CHAPAR', label: 'چاپار', estimatedDays: '۲ تا ۴ روز کاری' },
    { id: 'TIPAX', label: 'تیپاکس', estimatedDays: '۱ تا ۳ روز کاری' },
    { id: 'SNAPP', label: 'اسنپ‌باکس / پیک تهران', estimatedDays: 'همان روز' },
    { id: 'POST', label: 'پست پیشتاز', estimatedDays: '۳ تا ۵ روز کاری' },
    { id: 'PISHTAZ', label: 'پست پیشتاز', estimatedDays: '۳ تا ۵ روز کاری' },
    { id: 'TEHRAN_BIKE', label: 'پیک تهران', estimatedDays: 'همان روز' },
    { id: 'FREIGHT', label: 'باربری (سفارش حجمی)', estimatedDays: 'هماهنگی تلفنی' },
    { id: 'IN_PERSON', label: 'تحویل در محل', estimatedDays: 'هماهنگی برای مراجعه' },
  ];

  private normalizeMethod(method?: string) {
    const m = (method || 'CHAPAR').toUpperCase();
    if (m === 'PISHTAZ') return 'POST';
    if (m === 'TEHRAN_BIKE') return 'SNAPP';
    return m;
  }

  private normalizeChannel(channel?: string): SaleChannel {
    return String(channel || '').toUpperCase() === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
  }

  constructor(private readonly settings: SettingsService) {}

  async quote(input: {
    pieces: number;
    orderTotal?: number;
    method?: string;
    province?: string;
    city?: string;
    channel?: string;
  }) {
    const channel = this.normalizeChannel(input.channel);
    const cfg = await this.settings.shipping();
    const postCfg = shippingPostForChannel(await this.settings.get('shippingPost'), channel);
    const retail = cfg.retail ?? {
      baseFee: cfg.baseFee,
      perKgFee: cfg.perKgFee,
      freeThreshold: cfg.freeThreshold,
      kgPerPiece: cfg.kgPerPiece,
    };
    const wholesale = cfg.wholesale ?? {
      baseFee: cfg.baseFee,
      freeThreshold: cfg.freeThreshold,
    };
    const pieces = Math.max(1, Number(input.pieces) || 1);
    const kgPerPiece =
      Number(retail.kgPerPiece) > 0
        ? Number(retail.kgPerPiece)
        : ShippingService.KG_PER_PIECE_DEFAULT;
    const weightKg = Math.ceil(pieces * kgPerPiece * 10) / 10;
    const method = this.normalizeMethod(input.method);

    if (isInPersonMethod(method) || isInPersonMethod(input.method)) {
      const def =
        ShippingService.METHOD_DEFS.find((m) => m.id === 'IN_PERSON');
      return {
        method: input.method ?? 'IN_PERSON',
        normalizedMethod: 'IN_PERSON',
        channel,
        pieces,
        weightKg,
        kgPerPiece,
        baseFee: 0,
        perKgFee: 0,
        fee: 0,
        freeShipping: false,
        freeThreshold:
          channel === 'WHOLESALE' ? Number(wholesale.freeThreshold) || 0 : retail.freeThreshold,
        estimatedDays: def?.estimatedDays ?? 'هماهنگی برای مراجعه',
        province: input.province || null,
        city: input.city || null,
        postOnline: false,
        postSource: null,
        formula: 'in-person pickup (fee 0)',
      };
    }

    let fee =
      channel === 'WHOLESALE'
        ? Number(wholesale.baseFee) || 0
        : retail.baseFee + Math.ceil(weightKg) * retail.perKgFee;
    let formula =
      channel === 'WHOLESALE'
        ? 'wholesale.baseFee (flat)'
        : 'baseFee + ceil(weightKg) × perKgFee (weightKg from pieces × kgPerPiece)';
    let postSource: 'tapin' | 'local' | null = null;

    const postEnabled = postCfg.enabled === true;
    if (postEnabled && method === 'POST') {
      const originProvince = String(postCfg.originProvince || 'خراسان رضوی');
      const originCity = String(postCfg.originCity || 'مشهد');
      const destProvince = input.province || String(postCfg.originProvince || '');
      const destCity = input.city || '';
      const zone = resolvePostZone({
        originProvince,
        destProvince,
        originCity,
        destCity,
      });
      const tariff: PostTariff = {
        sameCityBase: Number(postCfg.sameCityBase) || DEFAULT_POST_TARIFF.sameCityBase,
        sameProvinceBase: Number(postCfg.sameProvinceBase) || DEFAULT_POST_TARIFF.sameProvinceBase,
        otherBase: Number(postCfg.otherBase) || DEFAULT_POST_TARIFF.otherBase,
        extraKgFee: Number(postCfg.extraKgFee) || DEFAULT_POST_TARIFF.extraKgFee,
        vatPercent: Number(postCfg.vatPercent) || DEFAULT_POST_TARIFF.vatPercent,
      };
      let usedLocal = true;
      const fromP = provinceCode(originProvince);
      const toP = provinceCode(destProvince);
      if (fromP && toP) {
        const live = await tapinCheckPrice({
          weightGrams: Math.round(weightKg * 1000),
          goodsPriceIrr: Number(input.orderTotal) || 0,
          fromProvince: fromP,
          toProvince: toP,
        });
        if (live) {
          fee = live.total;
          usedLocal = false;
          postSource = 'tapin';
          formula = 'tapin public پیشتاز check-price';
        }
      }
      if (usedLocal) {
        fee = localPostFeeIrr(weightKg, zone, tariff);
        postSource = 'local';
        formula = `پیشتاز محلی (${zone})`;
      }
    }

    if (channel === 'RETAIL' && method === 'SNAPP') {
      fee = Math.min(fee, retail.baseFee || fee);
    }
    const freeThreshold =
      channel === 'WHOLESALE' ? Number(wholesale.freeThreshold) || 0 : retail.freeThreshold;
    const freeShipping = !!input.orderTotal && Number(input.orderTotal) >= freeThreshold;
    if (freeShipping) fee = 0;

    const def =
      ShippingService.METHOD_DEFS.find((m) => m.id === (input.method ?? method)) ||
      ShippingService.METHOD_DEFS.find((m) => m.id === method);
    return {
      method: input.method ?? method,
      normalizedMethod: method,
      channel,
      pieces,
      weightKg,
      kgPerPiece,
      baseFee: channel === 'WHOLESALE' ? Number(wholesale.baseFee) || 0 : retail.baseFee,
      perKgFee: channel === 'WHOLESALE' ? 0 : retail.perKgFee,
      fee,
      freeShipping,
      freeThreshold,
      estimatedDays: def?.estimatedDays ?? '۲ تا ۴ روز کاری',
      province: input.province || null,
      city: input.city || null,
      postOnline: postEnabled && method === 'POST',
      postSource,
      formula,
    };
  }

  trackingUrl(trackingCode: string, method = 'CHAPAR') {
    const urls: Record<string, string> = {
      CHAPAR: `https://chaparapp.ir/tracking/${trackingCode}`,
      POST: `https://tracking.post.ir/?id=${trackingCode}`,
      TIPAX: `https://tipaxco.com/tracking?code=${trackingCode}`,
      SNAPP: `https://box.snapp.ir/tracking/${trackingCode}`,
    };
    return { trackingCode, method, url: urls[method] ?? urls.CHAPAR };
  }

  async methods(channel?: string) {
    const ch: SaleChannel = String(channel || '').toUpperCase() === 'RETAIL' ? 'RETAIL' : 'WHOLESALE';
    const cfg = await this.settings.shipping();
    const fromSettings = ch === 'RETAIL' ? cfg.retail?.companies : cfg.wholesale?.companies;
    if (Array.isArray(fromSettings)) {
      return fromSettings
        .filter((c: { isActive?: boolean }) => c?.isActive !== false)
        .map((c: { id: string; label: string }) => ({ id: String(c.id), label: String(c.label) }));
    }
    if (ch === 'WHOLESALE' && Array.isArray((cfg as { companies?: unknown[] }).companies)) {
      return ((cfg as { companies: Array<{ id: string; label: string; isActive?: boolean }> }).companies)
        .filter((c) => c?.isActive !== false)
        .map((c) => ({ id: String(c.id), label: String(c.label) }));
    }
    return ShippingService.METHOD_DEFS.filter((m) => cfg.methods[m.id] !== false);
  }
}
