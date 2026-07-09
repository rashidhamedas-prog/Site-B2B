import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

// Shipping quotes + tracking links. Fees and per-method availability are
// user-configurable from the admin settings panel (DB), with env fallback.
// All amounts IRR.
@Injectable()
export class ShippingService {
  // Average manteau weight ~ 0.45 kg incl. packaging.
  private static readonly KG_PER_PIECE = 0.45;

  private static readonly METHOD_DEFS = [
    { id: 'CHAPAR', label: 'چاپار', estimatedDays: '۲ تا ۴ روز کاری' },
    { id: 'TIPAX', label: 'تیپاکس', estimatedDays: '۱ تا ۳ روز کاری' },
    { id: 'SNAPP', label: 'اسنپ‌باکس (درون‌شهری مشهد)', estimatedDays: 'همان روز' },
    { id: 'POST', label: 'پست پیشتاز', estimatedDays: '۳ تا ۵ روز کاری' },
    { id: 'FREIGHT', label: 'باربری (سفارش حجمی)', estimatedDays: 'هماهنگی تلفنی' },
  ];

  constructor(private readonly settings: SettingsService) {}

  async quote(input: { pieces: number; orderTotal?: number; method?: string }) {
    const cfg = await this.settings.shipping();
    const pieces = Math.max(1, Number(input.pieces) || 1);
    const weightKg = Math.ceil(pieces * ShippingService.KG_PER_PIECE * 10) / 10;

    let fee = cfg.baseFee + Math.ceil(weightKg) * cfg.perKgFee;
    const freeShipping =
      !!input.orderTotal && Number(input.orderTotal) >= cfg.freeThreshold;
    if (freeShipping) fee = 0;

    const def = ShippingService.METHOD_DEFS.find((m) => m.id === (input.method ?? 'CHAPAR'));
    return {
      method: input.method ?? 'CHAPAR',
      pieces,
      weightKg,
      fee,
      freeShipping,
      freeThreshold: cfg.freeThreshold,
      estimatedDays: def?.estimatedDays ?? '۲ تا ۴ روز کاری',
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

  // Only methods the admin has enabled in settings.
  async methods() {
    const cfg = await this.settings.shipping();
    return ShippingService.METHOD_DEFS.filter((m) => cfg.methods[m.id] !== false);
  }
}
