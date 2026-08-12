import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentAttemptEntity } from './entities/payment-attempt.entity';
import { PaymentLedgerEntryEntity } from './entities/payment-ledger-entry.entity';
import { RefundEntity } from './entities/refund.entity';
import { OrderEntity } from '../order/entities/order.entity';
import { InvoiceEntity } from '../invoice/entities/invoice.entity';
import { SettingsService } from '../settings/settings.service';
import { AffiliatePostbackService } from '../affiliate/affiliate-postback.service';
import { ZarinPalAdapter } from './adapters/zarinpal.adapter';
import { assertPositiveFiniteIrr, toPublicPaymentDto, PaymentPublicDto } from './dto/payment-public.dto';
import { PaymentMetrics, maskMobile } from './payment-metrics';

interface CreatePaymentInput {
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

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(PaymentEntity)
    private readonly repo: Repository<PaymentEntity>,
    @InjectRepository(PaymentAttemptEntity)
    private readonly attemptRepo: Repository<PaymentAttemptEntity>,
    @InjectRepository(PaymentLedgerEntryEntity)
    private readonly ledgerRepo: Repository<PaymentLedgerEntryEntity>,
    @InjectRepository(RefundEntity)
    private readonly refundRepo: Repository<RefundEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepo: Repository<InvoiceEntity>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
    private readonly affiliatePostback: AffiliatePostbackService,
    private readonly zarinpal: ZarinPalAdapter,
    private readonly metrics: PaymentMetrics,
  ) {}

  /** Safe structured fields for start/verify logs (no raw mobile/email). */
  private paymentLogCtx(fields: {
    event: string;
    paymentId?: string | null;
    orderId?: string | null;
    providerCode?: string;
    mobile?: string | null;
    extra?: Record<string, unknown>;
  }): string {
    return JSON.stringify({
      event: fields.event,
      paymentId: fields.paymentId ?? undefined,
      orderId: fields.orderId ?? undefined,
      providerCode: fields.providerCode ?? 'ZARINPAL',
      mobileMasked: maskMobile(fields.mobile),
      ...(fields.extra ?? {}),
    });
  }

  metricsSnapshot() {
    return this.metrics.snapshot();
  }

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
    const mid = merchantId || '00000000-0000-0000-0000-000000000000';
    const callbackBase = isRetail
      ? (cfg.retailCallbackUrl ||
          `${(process.env.NEXT_PUBLIC_RETAIL_URL || 'https://www.poshaktaranom.ir').replace(/\/$/, '')}/payment/callback`)
      : (cfg.callbackUrl || this.callbackBase);
    return { sandbox, merchantId: mid, enabled, callbackBase, channel };
  }

  get callbackBase(): string {
    return this.config.get(
      'PAYMENT_CALLBACK_URL',
      'https://poshaktaranom.com/payment/callback',
    );
  }

  async findAll(): Promise<PaymentPublicDto[]> {
    const rows = await this.repo.find({ order: { createdAt: 'DESC' }, take: 200 });
    return rows.map((p) => toPublicPaymentDto(p));
  }

  async findOne(id: string): Promise<PaymentEntity> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('پرداخت یافت نشد');
    return p;
  }

  async findOnePublic(id: string): Promise<PaymentPublicDto> {
    return toPublicPaymentDto(await this.findOne(id));
  }

  /**
   * Start or retry gateway payment for an order/invoice.
   * Failed starts leave a FAILED attempt and allow a new start for the same order.
   */
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
      if (['CANCELLED', 'DELETED', 'PAID', 'CONFIRMED'].includes(order.status)) {
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
      amount = Number(input.amount);
    } else {
      throw new BadRequestException('سفارش یا فاکتور برای پرداخت الزامی است');
    }

    if (!amount || amount < 10000) {
      throw new BadRequestException('مبلغ پرداخت نامعتبر است (حداقل ۱۰۰۰ تومان)');
    }

    const gw = await this.resolveGateway(channel);
    if (!gw.enabled) {
      this.metrics.incr('payment_failure_total');
      throw new BadRequestException(
        channel === 'RETAIL'
          ? 'پرداخت آنلاین فروشگاه تکی غیرفعال است یا مرچنت کد تکی تنظیم نشده'
          : 'پرداخت آنلاین عمده غیرفعال است یا مرچنت کد عمده تنظیم نشده',
      );
    }
    if ((!gw.merchantId || gw.merchantId.startsWith('00000000')) && !gw.sandbox) {
      throw new BadRequestException(
        channel === 'RETAIL'
          ? 'مرچنت کد زرین‌پال فروشگاه تکی را در تنظیمات پرداخت وارد کنید'
          : 'مرچنت کد زرین‌پال عمده را در تنظیمات پرداخت وارد کنید',
      );
    }

    // Reuse existing PENDING payment with authority for same order when still valid.
    if (input.orderId) {
      const existing = await this.repo.findOne({
        where: { orderId: input.orderId, status: 'PENDING' as any },
        order: { createdAt: 'DESC' },
      });
      if (existing?.authority) {
        const caps = this.zarinpal.getCapabilities();
        if (caps.pay) {
          const sandbox = gw.sandbox;
          const startPayBase = sandbox
            ? 'https://sandbox.zarinpal.com/pg/StartPay'
            : 'https://payment.zarinpal.com/pg/StartPay';
          this.metrics.incr('payment_start_total');
          this.logger.log(
            this.paymentLogCtx({
              event: 'payment.start.reuse',
              paymentId: existing.id,
              orderId: input.orderId,
              providerCode: 'ZARINPAL',
              mobile: input.mobile,
              extra: { sandbox, channel },
            }),
          );
          return {
            paymentId: existing.id,
            authority: existing.authority,
            redirectUrl: `${startPayBase}/${existing.authority}`,
            gateway: 'ZARINPAL',
            sandbox,
          };
        }
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
      attemptCount: 0,
    });
    await this.repo.save(payment);

    const callbackUrl = `${gw.callbackBase}${gw.callbackBase.includes('?') ? '&' : '?'}paymentId=${payment.id}`;
    payment.callbackUrl = callbackUrl;

    const attemptNo = (payment.attemptCount || 0) + 1;
    const attempt = this.attemptRepo.create({
      paymentId: payment.id,
      providerCode: 'ZARINPAL',
      attemptNo,
      amount,
      currency: 'IRR',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      sanitizedRequest: { channel, orderId: input.orderId, invoiceId: input.invoiceId },
    });
    await this.attemptRepo.save(attempt);

    try {
      const created = await this.zarinpal.createPayment({
        amountIrr: amount,
        callbackUrl,
        description: payment.description || 'پرداخت سفارش پوشاک ترنم',
        merchantId: gw.merchantId,
        sandbox: gw.sandbox,
        mobile: input.mobile,
        email: input.email,
        orderId: input.orderId,
      });

      payment.authority = created.providerToken;
      payment.attemptCount = attemptNo;
      payment.meta = { ...(payment.meta ?? {}), channel, request: created.rawSanitized };
      await this.repo.save(payment);

      attempt.status = 'REDIRECTED';
      attempt.providerToken = created.providerToken;
      attempt.sanitizedResponse = created.rawSanitized;
      await this.attemptRepo.save(attempt);

      this.metrics.incr('payment_start_total');
      this.logger.log(
        this.paymentLogCtx({
          event: 'payment.start.ok',
          paymentId: payment.id,
          orderId: input.orderId,
          providerCode: 'ZARINPAL',
          mobile: input.mobile,
          extra: { sandbox: gw.sandbox, channel, attemptNo },
        }),
      );

      return {
        paymentId: payment.id,
        authority: created.providerToken,
        redirectUrl: created.redirectUrl,
        gateway: 'ZARINPAL',
        sandbox: gw.sandbox,
      };
    } catch (err: any) {
      const norm = this.zarinpal.normalizeProviderError(err);
      this.metrics.incr('payment_failure_total');
      this.logger.error(
        this.paymentLogCtx({
          event: 'payment.start.failed',
          paymentId: payment.id,
          orderId: input.orderId,
          providerCode: 'ZARINPAL',
          mobile: input.mobile,
          extra: { code: norm.code, message: norm.message, attemptNo },
        }),
      );
      payment.status = 'FAILED';
      payment.attemptCount = attemptNo;
      payment.meta = { ...(payment.meta ?? {}), requestException: norm };
      await this.repo.save(payment);
      attempt.status = 'FAILED';
      attempt.sanitizedResponse = { error: norm };
      await this.attemptRepo.save(attempt);
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        norm.code === 'PROVIDER_TIMEOUT'
          ? 'زمان اتصال به درگاه به پایان رسید؛ می‌توانید دوباره تلاش کنید'
          : 'اتصال به درگاه پرداخت برقرار نشد؛ می‌توانید دوباره تلاش کنید',
      );
    }
  }

  /**
   * Race-safe verify: lock payment row, CAS PENDING→PAID, invoice+ledger+order in one txn.
   * Duplicate callbacks return alreadyVerified without side effects.
   */
  async verify(paymentId: string, authority: string, status: string): Promise<PaymentPublicDto> {
    // Fast path outside txn for terminal states
    const preview = await this.findOne(paymentId);
    const providerCode = String(preview.gateway || 'ZARINPAL');
    this.logger.log(
      this.paymentLogCtx({
        event: 'payment.verify.begin',
        paymentId,
        orderId: preview.orderId,
        providerCode,
        extra: { statusHint: status || undefined },
      }),
    );
    if (preview.status === 'PAID') {
      this.metrics.incr('callback_duplicate_total');
      this.logger.log(
        this.paymentLogCtx({
          event: 'payment.verify.duplicate',
          paymentId,
          orderId: preview.orderId,
          providerCode,
        }),
      );
      return toPublicPaymentDto(preview, { ok: true, alreadyVerified: true });
    }
    if (preview.status === 'CANCELLED' || preview.status === 'REFUNDED') {
      this.logger.log(
        this.paymentLogCtx({
          event: 'payment.verify.terminal',
          paymentId,
          orderId: preview.orderId,
          providerCode,
          extra: { paymentStatus: preview.status },
        }),
      );
      return toPublicPaymentDto(preview, { ok: false, cancelled: true });
    }

    if (authority && preview.authority && authority !== preview.authority) {
      throw new BadRequestException('شناسه تراکنش نامعتبر است');
    }

    if (status && status !== 'OK') {
      await this.repo.update(paymentId, {
        status: 'CANCELLED',
        meta: { ...(preview.meta ?? {}), callbackStatus: status },
      } as any);
      const cancelled = await this.findOne(paymentId);
      this.metrics.incr('payment_failure_total');
      this.logger.log(
        this.paymentLogCtx({
          event: 'payment.verify.cancelled',
          paymentId,
          orderId: preview.orderId,
          providerCode,
          extra: { callbackStatus: status },
        }),
      );
      return toPublicPaymentDto(cancelled, { ok: false, cancelled: true });
    }

    const authToUse = preview.authority;
    if (!authToUse) throw new BadRequestException('تراکنش authority ندارد');

    const channel =
      preview.meta?.channel === 'RETAIL' ||
      (preview.callbackUrl || '').includes('poshaktaranom.ir')
        ? 'RETAIL'
        : 'WHOLESALE';
    const gw = await this.resolveGateway(channel);

    const verifyResult = await this.zarinpal.verifyReturn({
      amountIrr: Number(preview.amount),
      providerToken: authToUse,
      merchantId: gw.merchantId,
      sandbox: gw.sandbox,
    });

    if (!verifyResult.success) {
      await this.repo.update(paymentId, {
        status: 'FAILED',
        meta: { ...(preview.meta ?? {}), verify: verifyResult.rawSanitized, verifyError: verifyResult.errorMessage },
      } as any);
      const failed = await this.findOne(paymentId);
      this.metrics.incr('payment_failure_total');
      this.logger.warn(
        this.paymentLogCtx({
          event: 'payment.verify.failed',
          paymentId,
          orderId: preview.orderId,
          providerCode,
          extra: { error: verifyResult.errorMessage },
        }),
      );
      return toPublicPaymentDto(failed, {
        ok: false,
        error: verifyResult.errorMessage ?? 'تایید پرداخت ناموفق بود',
      });
    }

    let shouldFirePostback = false;
    let orderIdForPostback: string | null = null;

    const applied = await this.dataSource.transaction(async (manager) => {
      const payRepo = manager.getRepository(PaymentEntity);
      const invRepo = manager.getRepository(InvoiceEntity);
      const orderRepo = manager.getRepository(OrderEntity);
      const ledgerRepo = manager.getRepository(PaymentLedgerEntryEntity);

      const locked = await payRepo.findOne({
        where: { id: paymentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('پرداخت یافت نشد');

      if (locked.status === 'PAID') {
        return { already: true as const, payment: locked };
      }
      if (locked.status === 'CANCELLED' || locked.status === 'REFUNDED') {
        return { already: false as const, cancelled: true as const, payment: locked };
      }

      // CAS: only PENDING/FAILED (retry after soft fail) → PAID
      const cas = await manager
        .createQueryBuilder()
        .update(PaymentEntity)
        .set({
          status: 'PAID',
          refId: verifyResult.providerRefId || locked.refId,
          paidAt: new Date(),
          meta: { ...(locked.meta ?? {}), verify: verifyResult.rawSanitized },
        } as any)
        .where('id = :id AND status IN (:...statuses)', {
          id: paymentId,
          statuses: ['PENDING', 'FAILED'],
        })
        .execute();

      if (!cas.affected) {
        const again = await payRepo.findOne({ where: { id: paymentId } });
        return { already: again?.status === 'PAID', payment: again! };
      }

      const payment = await payRepo.findOne({ where: { id: paymentId } });
      if (!payment) throw new NotFoundException('پرداخت یافت نشد');

      await ledgerRepo.save(
        ledgerRepo.create({
          paymentId: payment.id,
          orderId: payment.orderId || null,
          invoiceId: payment.invoiceId || null,
          entryType: 'CAPTURE',
          amount: Number(payment.amount),
          currency: 'IRR',
          correlationId: payment.refId || payment.authority || payment.id,
          meta: { note: 'gateway_verify' },
        }),
      );

      if (payment.orderId) {
        await orderRepo.update(payment.orderId, {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
        } as any);
        orderIdForPostback = payment.orderId;
      }

      if (payment.invoiceId) {
        const inv = await invRepo.findOne({
          where: { id: payment.invoiceId },
          lock: { mode: 'pessimistic_write' },
        });
        if (inv) {
          const nextPaid = Number(inv.paidAmount || 0) + Number(payment.amount);
          const total = Number(inv.total) || 0;
          if (nextPaid - Number(payment.amount) >= total) {
            // already fully paid before this — still record but clamp
          }
          await invRepo.update(inv.id, {
            paidAmount: nextPaid,
            status: nextPaid >= total ? 'PAID' : 'PARTIALLY_PAID',
          } as any);
        }
      }

      // Mark postback slot inside txn (CAS) so only one winner fires outside
      if (payment.orderId && !payment.postbackFiredAt) {
        const pb = await manager
          .createQueryBuilder()
          .update(PaymentEntity)
          .set({ postbackFiredAt: new Date() })
          .where('id = :id AND "postbackFiredAt" IS NULL', { id: payment.id })
          .execute();
        shouldFirePostback = (pb.affected || 0) > 0;
      }

      return { already: false as const, payment };
    });

    if ((applied as any).cancelled) {
      this.logger.log(
        this.paymentLogCtx({
          event: 'payment.verify.terminal',
          paymentId,
          orderId: applied.payment.orderId,
          providerCode,
          extra: { paymentStatus: applied.payment.status },
        }),
      );
      return toPublicPaymentDto(applied.payment, { ok: false, cancelled: true });
    }
    if (applied.already) {
      this.metrics.incr('callback_duplicate_total');
      this.logger.log(
        this.paymentLogCtx({
          event: 'payment.verify.duplicate',
          paymentId,
          orderId: applied.payment.orderId,
          providerCode,
        }),
      );
      return toPublicPaymentDto(applied.payment, { ok: true, alreadyVerified: true });
    }

    this.metrics.incr('payment_success_total');
    this.logger.log(
      this.paymentLogCtx({
        event: 'payment.verify.ok',
        paymentId,
        orderId: applied.payment.orderId,
        providerCode,
        extra: { refId: applied.payment.refId || undefined },
      }),
    );

    if (shouldFirePostback && orderIdForPostback) {
      this.affiliatePostback.fireForOrder(orderIdForPostback, 'paid').catch((err) => {
        this.logger.warn(
          this.paymentLogCtx({
            event: 'payment.postback.failed',
            paymentId,
            orderId: orderIdForPostback,
            providerCode,
            extra: { message: err?.message || String(err) },
          }),
        );
      });
    }

    return toPublicPaymentDto(applied.payment, {
      ok: true,
      alreadyVerified: false,
    });
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

  async recordManual(input: {
    amount: number;
    customerId?: string;
    orderId?: string;
    invoiceId?: string;
    refId?: string;
    description?: string;
    actorId?: string;
    reason?: string;
  }): Promise<PaymentPublicDto> {
    const amount = assertPositiveFiniteIrr(input.amount);

    return this.dataSource.transaction(async (manager) => {
      const payRepo = manager.getRepository(PaymentEntity);
      const invRepo = manager.getRepository(InvoiceEntity);
      const ledgerRepo = manager.getRepository(PaymentLedgerEntryEntity);

      if (input.invoiceId) {
        const inv = await invRepo.findOne({
          where: { id: input.invoiceId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!inv) throw new NotFoundException('فاکتور یافت نشد');
        const paid = Number(inv.paidAmount || 0);
        const total = Number(inv.total) || 0;
        if (paid + amount > total) {
          throw new BadRequestException('مبلغ از مانده فاکتور بیشتر است');
        }
        const nextPaid = paid + amount;
        await invRepo.update(inv.id, {
          paidAmount: nextPaid,
          status: nextPaid >= total ? 'PAID' : 'PARTIALLY_PAID',
        } as any);
      }

      const payment = await payRepo.save(
        payRepo.create({
          amount,
          gateway: 'MANUAL',
          status: 'PAID',
          customerId: input.customerId,
          orderId: input.orderId,
          invoiceId: input.invoiceId,
          refId: input.refId,
          description: input.description ?? input.reason ?? 'ثبت دستی پرداخت',
          paidAt: new Date(),
          meta: { actorId: input.actorId, reason: input.reason },
        }),
      );

      await ledgerRepo.save(
        ledgerRepo.create({
          paymentId: payment.id,
          orderId: input.orderId || null,
          invoiceId: input.invoiceId || null,
          entryType: 'MANUAL_PAYMENT',
          amount: amount,
          currency: 'IRR',
          correlationId: input.refId || payment.id,
          actorUserId: input.actorId || null,
          meta: { note: input.reason || input.description || 'manual' },
        }),
      );

      return toPublicPaymentDto(payment, { ok: true });
    });
  }

  async requestRefund(input: {
    paymentId: string;
    amount: number;
    reason?: string;
    idempotencyKey: string;
    requestedBy?: string;
    channel?: 'WALLET' | 'PROVIDER' | 'MANUAL';
  }): Promise<RefundEntity> {
    const amount = assertPositiveFiniteIrr(input.amount);
    if (!input.idempotencyKey?.trim()) {
      throw new BadRequestException('idempotencyKey الزامی است');
    }

    return this.dataSource.transaction(async (manager) => {
      const payRepo = manager.getRepository(PaymentEntity);
      const refundRepo = manager.getRepository(RefundEntity);
      const ledgerRepo = manager.getRepository(PaymentLedgerEntryEntity);

      const existing = await refundRepo.findOne({
        where: {
          paymentId: input.paymentId,
          idempotencyKey: input.idempotencyKey.trim(),
        },
      });
      if (existing) return existing;

      const payment = await payRepo.findOne({
        where: { id: input.paymentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment) throw new NotFoundException('پرداخت یافت نشد');
      if (payment.status !== 'PAID') {
        throw new BadRequestException('فقط پرداخت موفق قابل استرداد است');
      }
      if (amount > Number(payment.amount)) {
        throw new BadRequestException('مبلغ استرداد بیشتر از پرداخت است');
      }

      const channel = input.channel || 'WALLET';
      if (channel === 'PROVIDER') {
        throw new BadRequestException('استرداد مستقیم درگاه هنوز برای این پذیرنده فعال نیست');
      }

      try {
        const refund = await refundRepo.save(
          refundRepo.create({
            paymentId: payment.id,
            amount,
            reason: input.reason,
            status: 'SUCCEEDED',
            refundChannel: channel,
            idempotencyKey: input.idempotencyKey.trim(),
            requestedBy: input.requestedBy,
            completedAt: new Date(),
          }),
        );

        await ledgerRepo.save(
          ledgerRepo.create({
            paymentId: payment.id,
            orderId: payment.orderId || null,
            invoiceId: payment.invoiceId || null,
            entryType: 'REFUND',
            amount: -amount,
            currency: 'IRR',
            correlationId: refund.id,
            actorUserId: input.requestedBy || null,
            meta: { refundId: refund.id, note: input.reason || 'refund' },
          }),
        );

        return refund;
      } catch (err: any) {
        if (String(err?.code) === '23505' || /unique/i.test(String(err?.message))) {
          const again = await refundRepo.findOne({
            where: {
              paymentId: input.paymentId,
              idempotencyKey: input.idempotencyKey.trim(),
            },
          });
          if (again) return again;
          throw new ConflictException('درخواست استرداد تکراری است');
        }
        throw err;
      }
    });
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
