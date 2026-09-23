import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { ProductEntity } from '../product/entities/product.entity';
import {
  SalesCommissionRuleEntity,
  SalesPartnerAuditEventEntity,
  SalesPartnerProductEligibilityEntity,
} from './entities';
import {
  assertCommissionRuleShape,
  assertPercent,
  commissionAmountIrr,
  selectCommissionRule,
  vendorDueFromRetailIrr,
  vendorSkuMarginIrr,
  type CommissionRule,
} from './sales-commission-policy';
import {
  factualFacts,
  humanStockBand,
  partnerCopyText,
  shortPartnerBlurb,
  stockBand,
} from './sales-partner-catalog-policy';
import { normalizeSalesPartnerCode, salesPartnerSharePath } from './sales-partner-attribution';
import { SalesPartnerService } from './sales-partner.service';

const PARTNER_PAGE_SIZE = 16;
const ADMIN_PAGE_SIZE = 20;

@Injectable()
export class SalesPartnerCatalogService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    @InjectRepository(SalesPartnerProductEligibilityEntity)
    private readonly eligibility: Repository<SalesPartnerProductEligibilityEntity>,
    @InjectRepository(SalesCommissionRuleEntity)
    private readonly rules: Repository<SalesCommissionRuleEntity>,
    @InjectRepository(SalesPartnerAuditEventEntity)
    private readonly audits: Repository<SalesPartnerAuditEventEntity>,
    private readonly program: SalesPartnerService,
  ) {}

  async partnerCatalog(salesPartnerId: string, page = 1) {
    const settings = await this.program.settings();
    const shareCode = await this.program.ensurePublicCode(salesPartnerId);
    const rows = await this.eligibility.find({ where: { eligible: true } });
    if (!rows.length) return { items: [], page: 1, pageSize: PARTNER_PAGE_SIZE };
    const products = await this.products.find({
      where: { id: In(rows.map((r) => r.productId)), status: 'ACTIVE', showOnRetail: true },
    });
    const rules = await this.loadRules();
    const now = new Date();
    const mapped = products
      .map((product) => this.toPartnerCard(product, rows, rules, salesPartnerId, now, settings.minMarginIrr, shareCode))
      .filter((row): row is NonNullable<typeof row> => !!row);
    const safePage = Math.max(1, Number(page) || 1);
    const start = (safePage - 1) * PARTNER_PAGE_SIZE;
    return {
      items: mapped.slice(start, start + PARTNER_PAGE_SIZE),
      page: safePage,
      pageSize: PARTNER_PAGE_SIZE,
      total: mapped.length,
    };
  }

  async partnerProduct(salesPartnerId: string, productId: string) {
    const settings = await this.program.settings();
    const elig = await this.eligibility.findOne({ where: { productId, eligible: true } });
    if (!elig) throw new NotFoundException('این محصول برای همکاران بازاریاب فعال نیست');
    const product = await this.products.findOne({
      where: { id: productId, status: 'ACTIVE', showOnRetail: true },
      relations: ['variants'],
    });
    if (!product) throw new NotFoundException('محصول پیدا نشد');
    const rules = await this.loadRules();
    const shareCode = await this.program.ensurePublicCode(salesPartnerId);
    const card = this.toPartnerCard(product, [elig], rules, salesPartnerId, new Date(), settings.minMarginIrr, shareCode);
    if (!card) throw new NotFoundException('این محصول فعلاً قابل فروش نیست');
    const colors = [...new Set((product.variants || []).map((v) => v.color).filter(Boolean))];
    const sizes = [...new Set((product.variants || []).map((v) => v.size).filter(Boolean))];
    return {
      ...card,
      facts: factualFacts({
        fabricType: product.specs?.fabricType || product.fabric || null,
        color: colors[0] || null,
        sizeType: product.sizeType,
      }),
      colors,
      sizes,
      variants: (product.variants || []).map((v) => ({
        id: v.id,
        color: v.color,
        size: v.size,
        stockBand: stockBand(v.retailStock),
        stockLabel: humanStockBand(stockBand(v.retailStock)),
      })),
    };
  }

  async adminCandidates(query?: string, page = 1) {
    const settings = await this.program.settings();
    const safePage = Math.max(1, Number(page) || 1);
    const where = query?.trim()
      ? [{ status: 'ACTIVE', showOnRetail: true, name: ILike(`%${query.trim().slice(0, 60)}%`) }]
      : [{ status: 'ACTIVE', showOnRetail: true }];
    const [products, total] = await this.products.findAndCount({
      where,
      order: { updatedAt: 'DESC' },
      take: ADMIN_PAGE_SIZE,
      skip: (safePage - 1) * ADMIN_PAGE_SIZE,
    });
    const eligs = products.length
      ? await this.eligibility.find({ where: { productId: In(products.map((p) => p.id)) } })
      : [];
    const rules = await this.loadRules();
    return {
      items: products.map((product) => {
        const elig = eligs.find((row) => row.productId === product.id);
        const price = Number(product.retailPrice || 0);
        const previewPercent = selectCommissionRule(rules, {
          productId: product.id,
          categoryId: product.categoryId || null,
          lineTotalAfterDiscountIrr: price,
        }, 'preview', new Date())?.percent ?? 0;
        const vendor = !!product.vendorId;
        const vendorDue = vendor ? vendorDueFromRetailIrr(price, product.commissionPercent) : 0;
        const margin = vendor
          ? vendorSkuMarginIrr({ retailNetIrr: price, vendorDueIrr: vendorDue, partnerPercent: previewPercent })
          : price - commissionAmountIrr(price, previewPercent);
        return {
          productId: product.id,
          name: product.name,
          slug: product.slug,
          priceIrr: price,
          vendorSku: vendor,
          eligible: elig?.eligible === true,
          allowedImageKeys: elig?.allowedImageKeys ?? null,
          previewCommissionPercent: previewPercent,
          marginIrr: margin,
          minMarginIrr: settings.minMarginIrr,
          canEnable: !vendor || margin >= settings.minMarginIrr,
        };
      }),
      page: safePage,
      pageSize: ADMIN_PAGE_SIZE,
      total,
    };
  }

  async setEligibility(productId: string, actorId: string, input: {
    eligible: boolean;
    allowedImageKeys?: string[];
    partnerPercent?: number;
  }) {
    const product = await this.products.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('محصول پیدا نشد');
    const settings = await this.program.settings();
    let marginCheck: Record<string, unknown> | null = null;
    if (input.eligible && product.vendorId) {
      const retailNet = Number(product.retailPrice || 0);
      const vendorDue = vendorDueFromRetailIrr(retailNet, product.commissionPercent);
      const partnerPercent = assertPercent(input.partnerPercent ?? 0);
      const margin = vendorSkuMarginIrr({ retailNetIrr: retailNet, vendorDueIrr: vendorDue, partnerPercent });
      marginCheck = { retailNetIrr: retailNet, marginIrr: margin, minMarginIrr: settings.minMarginIrr, partnerPercent };
      if (margin < settings.minMarginIrr) {
        throw new BadRequestException('حاشیه این کالای تأمین‌کننده برای برنامه بازاریاب کافی نیست');
      }
    }
    let row = await this.eligibility.findOne({ where: { productId } });
    if (!row) row = this.eligibility.create({ productId, eligible: false });
    row.eligible = input.eligible;
    if (input.allowedImageKeys) row.allowedImageKeys = input.allowedImageKeys.slice(0, 12);
    row.marginCheck = marginCheck;
    row.updatedBy = actorId;
    await this.eligibility.save(row);
    await this.audit(actorId, input.eligible ? 'eligibility.enabled' : 'eligibility.disabled', 'eligibility', productId, {
      eligible: row.eligible,
    });
    return { productId, eligible: row.eligible };
  }

  async listRules() {
    const rows = await this.rules.find({ order: { createdAt: 'DESC' }, take: 100 });
    return rows.map((row) => ({
      id: row.id,
      scope: row.scope,
      percent: row.percent,
      active: row.active,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      productId: row.productId,
      categoryId: row.categoryId,
      salesPartnerId: row.salesPartnerId,
      note: row.note,
      version: row.version,
      createdAt: row.createdAt,
    }));
  }

  async createRule(actorId: string, input: {
    scope: string;
    percent: number;
    productId?: string | null;
    categoryId?: string | null;
    salesPartnerId?: string | null;
    note?: string;
  }) {
    let scope: ReturnType<typeof assertCommissionRuleShape>;
    try {
      scope = assertCommissionRuleShape(input);
    } catch {
      throw new BadRequestException('قانون پورسانت ناقص یا نامعتبر است');
    }
    const percent = assertPercent(input.percent);
    const row = this.rules.create({
      scope,
      percent,
      active: true,
      productId: input.productId ?? null,
      categoryId: input.categoryId ?? null,
      salesPartnerId: input.salesPartnerId ?? null,
      createdBy: actorId,
      note: input.note?.slice(0, 240) ?? null,
      version: 1,
    });
    await this.rules.save(row);
    await this.audit(actorId, 'commission_rule.created', 'rule', row.id, { scope, percent });
    return {
      id: row.id,
      scope: row.scope,
      percent: row.percent,
      active: row.active,
    };
  }

  async preview(salesPartnerId: string, productId: string, lineTotalIrr: number) {
    if (!Number.isInteger(lineTotalIrr) || lineTotalIrr < 0) {
      throw new BadRequestException('مبلغ نامعتبر است');
    }
    const rules = await this.loadRules();
    const product = await this.products.findOne({ where: { id: productId } });
    const rule = selectCommissionRule(rules, {
      productId,
      categoryId: product?.categoryId || null,
      lineTotalAfterDiscountIrr: lineTotalIrr,
    }, salesPartnerId, new Date());
    return {
      ruleId: rule?.id ?? null,
      scope: rule?.scope ?? null,
      percent: rule?.percent ?? 0,
      ruleVersion: rule?.version ?? 1,
      commissionIrr: commissionAmountIrr(lineTotalIrr, rule?.percent ?? 0),
    };
  }

  async resolveShareLink(code: string, slug: string) {
    const normalized = normalizeSalesPartnerCode(code);
    const safeSlug = String(slug || '').trim();
    if (!normalized || !safeSlug || safeSlug.length > 160 || safeSlug.includes('/') || safeSlug.includes('..')) {
      throw new NotFoundException('لینک فروش معتبر نیست');
    }
    const profile = await this.program.findActiveByPublicCode(normalized);
    if (!profile) throw new NotFoundException('لینک فروش معتبر نیست');
    const product = await this.products.findOne({
      where: { slug: safeSlug, status: 'ACTIVE', showOnRetail: true },
    });
    if (!product) throw new NotFoundException('محصول پیدا نشد');
    const elig = await this.eligibility.findOne({ where: { productId: product.id, eligible: true } });
    if (!elig) throw new NotFoundException('این محصول برای همکاران بازاریاب فعال نیست');
    const settings = await this.program.settings();
    const rules = await this.loadRules();
    const card = this.toPartnerCard(product, [elig], rules, profile.id, new Date(), settings.minMarginIrr, normalized);
    if (!card) throw new NotFoundException('این محصول فعلاً قابل فروش نیست');
    return { productId: product.id, slug: product.slug, code: normalized };
  }

  private toPartnerCard(
    product: ProductEntity,
    rows: SalesPartnerProductEligibilityEntity[],
    rules: CommissionRule[],
    salesPartnerId: string,
    now: Date,
    minMarginIrr: number,
    shareCode?: string | null,
  ) {
    const elig = rows.find((r) => r.productId === product.id);
    if (!elig?.eligible) return null;
    const price = Number(product.retailPrice || 0);
    if (!Number.isInteger(price) || price <= 0) return null;
    const rule = selectCommissionRule(rules, {
      productId: product.id,
      categoryId: product.categoryId || null,
      lineTotalAfterDiscountIrr: price,
    }, salesPartnerId, now);
    const percent = rule?.percent ?? 0;
    if (product.vendorId) {
      const vendorDue = vendorDueFromRetailIrr(price, product.commissionPercent);
      const margin = vendorSkuMarginIrr({ retailNetIrr: price, vendorDueIrr: vendorDue, partnerPercent: percent });
      if (margin < minMarginIrr) return null;
    }
    const images = (elig.allowedImageKeys?.length ? elig.allowedImageKeys : product.images || []).slice(0, 6);
    const origin = (process.env.NEXT_PUBLIC_RETAIL_URL || 'https://www.poshaktaranom.ir').replace(/\/$/, '');
    const productPath = product.slug ? `/products/${product.slug}` : `/products/${product.id}`;
    const productUrl = product.slug && shareCode
      ? `${origin}${salesPartnerSharePath(shareCode, product.slug)}`
      : productPath;
    const facts = factualFacts({
      fabricType: product.specs?.fabricType || product.fabric || null,
      sizeType: product.sizeType,
    });
    const priceToman = `${Math.round(price / 10).toLocaleString('fa-IR')} تومان`;
    const band = stockBand(product.retailStock);
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      blurb: shortPartnerBlurb(product.description),
      priceIrr: price,
      priceLabel: priceToman,
      stockBand: band,
      stockLabel: humanStockBand(band),
      estimatedCommissionIrr: commissionAmountIrr(price, percent),
      commissionPercent: percent,
      images,
      productUrl,
      copyText: partnerCopyText({
        name: product.name,
        facts,
        priceTomanLabel: priceToman,
        productUrl,
      }),
      updatedAt: product.updatedAt,
    };
  }

  async loadRules(): Promise<CommissionRule[]> {
    const rows = await this.rules.find();
    return rows.map((row) => ({
      id: row.id,
      scope: row.scope as CommissionRule['scope'],
      percent: row.percent,
      active: row.active,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      productId: row.productId,
      categoryId: row.categoryId,
      salesPartnerId: row.salesPartnerId,
      version: row.version,
    }));
  }

  private async audit(
    actorUserId: string | null,
    action: string,
    targetType: string,
    targetId: string,
    payload: Record<string, unknown>,
  ) {
    await this.audits.save(this.audits.create({ actorUserId, action, targetType, targetId, payload }));
  }
}
