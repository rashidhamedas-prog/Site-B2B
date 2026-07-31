import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PaymentEntity } from './entities/payment.entity';
import { OrderEntity } from '../order/entities/order.entity';
import { InvoiceEntity } from '../invoice/entities/invoice.entity';
import { SettingsService } from '../settings/settings.service';
import { AffiliatePostbackService } from '../affiliate/affiliate-postback.service';

interface CreatePaymentInput {
  /** Ignored when orderId/invoiceId present — amount resolved from DB */
  amount?: number;
  orderId?: string;
  invoiceId?: string;
  customerId?: string;
  description?: string;
  mobile?: string;
  email?: string;
  channel?: 'WHOLESALE' | 'RETAIL';
}

export interface StartResult {
  paymentId: string;
  authority: string;
  redirectUrl: string;
  gateway: string;
  sandbox: boolean;
}

// ZarinPal v4 REST gateway.
// Docs: https://docs.zarinpal.com/paymentGateway/
// Amounts are sent in IRR (Rial) — matches our BIGINT storage.
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(PaymentEntity)
    private readonly repo: Repository<PaymentEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepo: Repository<InvoiceEntity>,
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
    private readonly affiliatePostback: AffiliatePostbackService,
  ) {}

  // Resolve gateway config live from DB settings (falls back to env).
  private async resolveGateway(channel: 'WHOLESALE' | 'RETAIL' = 'WHOLESALE') {
    const cfg = await this.settings.payment();
    const isRetail = channel === 'RETAIL';
    const merchantId = (isRetail ? cfg.retailMerchantId : cfg.merchantId) || '';
    const sandbox = isRetail
      ? cfg.retailSandbox || !merchantId
      : cfg.sandbox || !merchantId;
    const enabled = isRetail
      ? !!cfg.retailEnabled && !!cfg.enabled
      : !!cfg.wholesaleEnabled && !!cfg.enabled;
    const apiBase = sandbox
      ? 'https://sandbox.zarinpal.com/pg/v4/payment'
      : 'https://payment.zarinpal.com/pg/v4/payment';
    const startPayBase = sandbox
      ? 'https://sandbox.zarinpal.com/pg/StartPay'
      : 'https://payment.zarinpal.com/pg/StartPay';
    // ZarinPal sandbox accepts the all-zero merchant id for test transactions.
    const mid = merchantId || '00000000-0000-0000-0000-000000000000';
    const callbackBase = isRetail
      ? (cfg.retailCallbackUrl ||
          `${(process.env.NEXT_PUBLIC_RETAIL_URL || 'https://www.poshaktaranom.ir').replace(/\/$/, '')}/payment/callback`)
      : (cfg.callbackUrl || this.callbackBase);
    return { sandbox, apiBase, startPayBase, merchantId: mid, enabled, callbackBase, channel };
  }

  get callbackBase(): string {
    return this.config.get(
      'PAYMENT_CALLBACK_URL',
      'https://poshaktaranom.com/payment/callback',
    );
  }

  async findAll(): Promise<PaymentEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' }, take: 200 });
  }

  async findOne(id: string): Promise<PaymentEntity> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('پرداخت یافت نشد');
    return p;
  }

  // Step 1 — create a payment request with ZarinPal, persist it, return redirect URL.
  async start(input: CreatePaymentInput): Promise<StartResult> {
    let amount = 0;
    let customerId = input.customerId;
    let channel: 'WHOLESALE' | 'RETAIL' = input.channel === 'RETAIL' ? 'RETAIL' : 'WHOLESALE';

    if (input.orderId) {
      const order = await this.orderRepo.findOne({ where: { id: input.orderId } });
      if (!order) throw new NotFoundException('سفارش یافت نشد');
      if (customerId && order.customerId !== customerId) {
        throw new ForbiddenException('این سفارش متعلق به شما نیست');
      }
      customerId = order.customerId;
      amount = Number(order.total) || 0;
      const t = String(order.type || '').toUpperCase();
      if (t === 'RETAIL' || t === 'RETAIL_WEBSITE') channel = 'RETAIL';
      if (['CANCELLED', 'DELETED', 'PAID'].includes(order.status)) {
        throw new BadRequestException('این سفارش قابل پرداخت نیست');
      }
    } else if (input.invoiceId) {
      const invoice = await this.invoiceRepo.findOne({ where: { id: input.invoiceId } });
      if (!invoice) throw new NotFoundException('فاکتور یافت نشد');
      if (customerId && invoice.customerId !== customerId) {
        throw new ForbiddenException('این فاکتور متعلق به شما نیست');
      }
      customerId = invoice.customerId;
      amount = Math.max(0, Number(invoice.total) - Number(invoice.paidAmount || 0));
    } else if (input.amount && input.amount >= 10000) {
      // Admin/manual path without order — rare; still validate minimum
      amount = Number(input.amount);
    } else {
      throw new BadRequestException('سفارش یا فاکتور برای پرداخت الزامی است');
    }

    if (!amount || amount < 10000) {
      throw new BadRequestException('مبلغ پرداخت نامعتبر است (حداقل ۱۰۰۰ تومان)');
    }

    const gw = await this.resolveGateway(channel);
    if (!gw.enabled) {
      throw new BadRequestException(
        channel === 'RETAIL'
          ? 'پرداخت آنلاین فروشگاه تکی غیرفعال است یا مرچنت کد تکی تنظیم نشده'
          : 'پرداخت آنلاین عمده غیرفعال است یا مرچنت کد عمده تنظیم نشده',
      );
    }
    if (!gw.merchantId || gw.merchantId.startsWith('00000000')) {
      if (!gw.sandbox) {
        throw new BadRequestException(
          channel === 'RETAIL'
            ? 'مرچنت کد زرین‌پال فروشگاه تکی را در تنظیمات پرداخت وارد کنید'
            : 'مرچنت کد زرین‌پال عمده را در تنظیمات پرداخت وارد کنید',
        );
      }
    }

    const payment = this.repo.create({
      amount,
      gateway: 'ZARINPAL',
      status: 'PENDING',
      orderId: input.orderId,
      invoiceId: input.invoiceId,
      customerId,
      description: input.description ?? 'پرداخت سفارش پوشاک ترنم',
      meta: { channel },
    });
    await this.repo.save(payment);

    const callbackUrl = `${gw.callbackBase}${gw.callbackBase.includes('?') ? '&' : '?'}paymentId=${payment.id}`;
    payment.callbackUrl = callbackUrl;

    try {
      const res = await fetch(`${gw.apiBase}/request.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          merchant_id: gw.merchantId,
          amount: Number(amount),
          callback_url: callbackUrl,
          description: payment.description,
          metadata: {
            mobile: input.mobile,
            email: input.email,
            orderId: input.orderId,
          },
        }),
      });
      const json: any = await res.json();

      const authority = json?.data?.authority;
      const code = json?.data?.code;
      if (!authority || (code !== 100 && code !== 101)) {
        const errMsg =
          json?.errors?.message ??
          (Array.isArray(json?.errors) ? json.errors[0]?.message : null) ??
          'خطا در ایجاد تراکنش پرداخت';
        payment.status = 'FAILED';
        payment.meta = { ...(payment.meta ?? {}), requestError: json };
        await this.repo.save(payment);
        throw new BadRequestException(errMsg);
      }

      payment.authority = authority;
      payment.meta = { ...(payment.meta ?? {}), channel, request: json.data };
      await this.repo.save(payment);

      return {
        paymentId: payment.id,
        authority,
        redirectUrl: `${gw.startPayBase}/${authority}`,
        gateway: 'ZARINPAL',
        sandbox: gw.sandbox,
      };
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`ZarinPal request failed: ${err.message}`);
      payment.status = 'FAILED';
      payment.meta = { ...(payment.meta ?? {}), requestException: err.message };
      await this.repo.save(payment);
      throw new BadRequestException('اتصال به درگاه پرداخت برقرار نشد');
    }
  }

  // Step 2 — verify the payment after the user returns from the gateway.
  async verify(paymentId: string, authority: string, status: string) {
    const payment = await this.findOne(paymentId);

    // Already finalized — idempotent return.
    if (payment.status === 'PAID') {
      return { ok: true, alreadyVerified: true, payment };
    }
    if (payment.status === 'CANCELLED' || payment.status === 'REFUNDED') {
      return { ok: false, cancelled: true, payment };
    }

    // Authority must match the stored gateway token when both are present.
    if (authority && payment.authority && authority !== payment.authority) {
      this.logger.warn(`Authority mismatch for payment ${paymentId}`);
      throw new BadRequestException('شناسه تراکنش نامعتبر است');
    }

    // User cancelled at the gateway.
    if (status && status !== 'OK') {
      payment.status = 'CANCELLED';
      payment.meta = { ...(payment.meta ?? {}), callbackStatus: status };
      await this.repo.save(payment);
      return { ok: false, cancelled: true, payment };
    }

    const authToUse = payment.authority;
    if (!authToUse) {
      throw new BadRequestException('تراکنش authority ندارد');
    }

    const channel =
      payment.meta?.channel === 'RETAIL' ||
      (payment.callbackUrl || '').includes('poshaktaranom.ir')
        ? 'RETAIL'
        : 'WHOLESALE';
    const gw = await this.resolveGateway(channel);
    try {
      const res = await fetch(`${gw.apiBase}/verify.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          merchant_id: gw.merchantId,
          amount: Number(payment.amount),
          authority: authToUse,
        }),
      });
      const json: any = await res.json();
      const code = json?.data?.code;

      // 100 = verified now, 101 = already verified previously.
      if (code === 100 || code === 101) {
        const refId = String(json.data.ref_id ?? '');
        // Re-check status to avoid double-apply under concurrent callbacks.
        const fresh = await this.findOne(paymentId);
        if (fresh.status === 'PAID') {
          return { ok: true, alreadyVerified: true, payment: fresh };
        }

        payment.status = 'PAID';
        payment.refId = refId || payment.refId;
        payment.paidAt = new Date();
        payment.meta = { ...(payment.meta ?? {}), verify: json.data };
        await this.repo.save(payment);

        if (payment.orderId) {
          await this.orderRepo.update(payment.orderId, {
            status: 'CONFIRMED',
            confirmedAt: new Date(),
          } as any);
          this.affiliatePostback.fireForOrder(payment.orderId, 'paid').catch((err) => {
            this.logger.warn(`Affiliate postback failed: ${err?.message || err}`);
          });
        }
        if (payment.invoiceId) {
          const inv = await this.invoiceRepo.findOne({ where: { id: payment.invoiceId } });
          if (inv) {
            const paidAmount = Number(inv.paidAmount || 0) + Number(payment.amount);
            const total = Number(inv.total) || 0;
            await this.invoiceRepo.update(inv.id, {
              paidAmount,
              status: paidAmount >= total ? 'PAID' : 'PARTIALLY_PAID',
            } as any);
          }
        }
        return { ok: true, payment, refId: payment.refId };
      }

      payment.status = 'FAILED';
      payment.meta = { ...(payment.meta ?? {}), verify: json };
      await this.repo.save(payment);
      return { ok: false, payment, error: json?.errors?.message ?? 'تایید پرداخت ناموفق بود' };
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`ZarinPal verify failed: ${err.message}`);
      payment.status = 'FAILED';
      payment.meta = { ...(payment.meta ?? {}), verifyException: err.message };
      await this.repo.save(payment);
      return { ok: false, payment, error: 'خطا در تایید پرداخت' };
    }
  }

  async cancelPendingForOrder(orderId: string) {
    const rows = await this.repo.find({ where: { orderId, status: 'PENDING' as any } });
    for (const p of rows) {
      p.status = 'CANCELLED';
      p.meta = { ...(p.meta ?? {}), cancelledWithOrder: true };
      await this.repo.save(p);
    }
    return { cancelled: rows.length };
  }

  // Manual payment record (card-to-card / cash) entered by an admin.
  async recordManual(input: {
    amount: number;
    customerId?: string;
    orderId?: string;
    invoiceId?: string;
    refId?: string;
    description?: string;
  }): Promise<PaymentEntity> {
    const payment = this.repo.create({
      amount: input.amount,
      gateway: 'MANUAL',
      status: 'PAID',
      customerId: input.customerId,
      orderId: input.orderId,
      invoiceId: input.invoiceId,
      refId: input.refId,
      description: input.description ?? 'ثبت دستی پرداخت',
      paidAt: new Date(),
    });
    return this.repo.save(payment);
  }

  async summary() {
    const rows = await this.repo.find();
    const paid = rows.filter((p) => p.status === 'PAID');
    const totalPaid = paid.reduce((s, p) => s + Number(p.amount), 0);
    return {
      totalPaid,
      countPaid: paid.length,
      countPending: rows.filter((p) => p.status === 'PENDING').length,
      countFailed: rows.filter((p) => p.status === 'FAILED').length,
      count: rows.length,
    };
  }
}
