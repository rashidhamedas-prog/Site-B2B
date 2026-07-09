import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PaymentEntity } from './entities/payment.entity';
import { SettingsService } from '../settings/settings.service';

interface CreatePaymentInput {
  amount: number; // IRR
  orderId?: string;
  invoiceId?: string;
  customerId?: string;
  description?: string;
  mobile?: string;
  email?: string;
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
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  // Resolve gateway config live from DB settings (falls back to env).
  private async resolveGateway() {
    const cfg = await this.settings.payment();
    const sandbox = cfg.sandbox || !cfg.merchantId;
    const apiBase = sandbox
      ? 'https://sandbox.zarinpal.com/pg/v4/payment'
      : 'https://payment.zarinpal.com/pg/v4/payment';
    const startPayBase = sandbox
      ? 'https://sandbox.zarinpal.com/pg/StartPay'
      : 'https://payment.zarinpal.com/pg/StartPay';
    // ZarinPal sandbox accepts the all-zero merchant id for test transactions.
    const merchantId = cfg.merchantId || '00000000-0000-0000-0000-000000000000';
    return { sandbox, apiBase, startPayBase, merchantId, enabled: cfg.enabled };
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
    if (!input.amount || input.amount < 10000) {
      throw new BadRequestException('مبلغ پرداخت نامعتبر است (حداقل ۱۰۰۰ تومان)');
    }

    const gw = await this.resolveGateway();
    if (!gw.enabled) {
      throw new BadRequestException('پرداخت آنلاین در حال حاضر غیرفعال است');
    }

    const payment = this.repo.create({
      amount: input.amount,
      gateway: 'ZARINPAL',
      status: 'PENDING',
      orderId: input.orderId,
      invoiceId: input.invoiceId,
      customerId: input.customerId,
      description: input.description ?? 'پرداخت سفارش پوشاک ترنم',
    });
    await this.repo.save(payment);

    const callbackUrl = `${this.callbackBase}?paymentId=${payment.id}`;
    payment.callbackUrl = callbackUrl;

    try {
      const res = await fetch(`${gw.apiBase}/request.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          merchant_id: gw.merchantId,
          amount: Number(input.amount),
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
        payment.meta = { requestError: json };
        await this.repo.save(payment);
        throw new BadRequestException(errMsg);
      }

      payment.authority = authority;
      payment.meta = { request: json.data };
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
      payment.meta = { requestException: err.message };
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

    // User cancelled at the gateway.
    if (status && status !== 'OK') {
      payment.status = 'CANCELLED';
      payment.meta = { ...(payment.meta ?? {}), callbackStatus: status };
      await this.repo.save(payment);
      return { ok: false, cancelled: true, payment };
    }

    const authToUse = authority || payment.authority;
    const gw = await this.resolveGateway();
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
        payment.status = 'PAID';
        payment.refId = String(json.data.ref_id ?? '');
        payment.paidAt = new Date();
        payment.meta = { ...(payment.meta ?? {}), verify: json.data };
        await this.repo.save(payment);
        return { ok: true, payment, refId: payment.refId };
      }

      payment.status = 'FAILED';
      payment.meta = { ...(payment.meta ?? {}), verify: json };
      await this.repo.save(payment);
      return { ok: false, payment, error: json?.errors?.message ?? 'تایید پرداخت ناموفق بود' };
    } catch (err: any) {
      this.logger.error(`ZarinPal verify failed: ${err.message}`);
      payment.status = 'FAILED';
      payment.meta = { ...(payment.meta ?? {}), verifyException: err.message };
      await this.repo.save(payment);
      return { ok: false, payment, error: 'خطا در تایید پرداخت' };
    }
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
