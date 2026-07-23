import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from '../order/entities/order.entity';
import { OrderItemEntity } from '../order/entities/order-item.entity';
import { CustomerEntity } from '../customer/entities/customer.entity';
import { InvoiceEntity } from '../invoice/entities/invoice.entity';
import { ProductVariantEntity } from '../product/entities/product-variant.entity';
import { ProductEntity } from '../product/entities/product.entity';

export type ReportPeriod = 'week' | 'month' | 'quarter' | 'year';

const CANCELLED = 'CANCELLED';
const EXCLUDE_REVENUE = ['PENDING_REVIEW', 'CANCELLED'];

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(OrderEntity) private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity) private readonly itemRepo: Repository<OrderItemEntity>,
    @InjectRepository(CustomerEntity) private readonly customerRepo: Repository<CustomerEntity>,
    @InjectRepository(InvoiceEntity) private readonly invoiceRepo: Repository<InvoiceEntity>,
    @InjectRepository(ProductVariantEntity) private readonly variantRepo: Repository<ProductVariantEntity>,
  ) {}

  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [
      totalOrders, pendingOrders, thisMonthOrders, lastMonthOrders,
      totalCustomers, pendingCustomers, activeCustomers,
      recentOrders, lowStockVariants, topCustomersRaw,
      totalRevenue, thisMonthRevenue, outstandingInvoices,
      statusRows,
    ] = await Promise.all([
      this.orderRepo.count(),
      this.orderRepo.count({ where: { status: 'PENDING_REVIEW' } }),
      this.orderRepo.createQueryBuilder('o')
        .where('o.createdAt >= :start', { start: startOfMonth })
        .getCount(),
      this.orderRepo.createQueryBuilder('o')
        .where('o.createdAt >= :start AND o.createdAt <= :end', { start: startOfLastMonth, end: endOfLastMonth })
        .getCount(),
      this.customerRepo.count(),
      this.customerRepo.count({ where: { status: 'PENDING' } }),
      this.customerRepo.count({ where: { status: 'ACTIVE', isActive: true } }),
      this.orderRepo.find({ relations: ['customer'], order: { createdAt: 'DESC' }, take: 6 }),
      this.variantRepo.createQueryBuilder('v').where('v.stock < 10').orderBy('v.stock', 'ASC').take(5).getMany(),
      this.orderRepo.createQueryBuilder('o')
        .select('o.customerId', 'customerId')
        .addSelect('SUM(o.total)', 'totalSpend')
        .addSelect('COUNT(o.id)', 'orderCount')
        .where("o.status NOT IN ('CANCELLED')")
        .groupBy('o.customerId')
        .orderBy('SUM(o.total)', 'DESC')
        .limit(5)
        .getRawMany(),
      this.orderRepo.createQueryBuilder('o')
        .select('SUM(o.total)', 'sum')
        .where("o.status NOT IN ('PENDING_REVIEW', 'CANCELLED')")
        .getRawOne(),
      this.orderRepo.createQueryBuilder('o')
        .select('SUM(o.total)', 'sum')
        .where('o.createdAt >= :start', { start: startOfMonth })
        .andWhere("o.status NOT IN ('CANCELLED')")
        .getRawOne(),
      this.invoiceRepo.createQueryBuilder('i')
        .select('SUM(i.total - i.paidAmount)', 'sum')
        .where("i.status NOT IN ('PAID', 'CANCELLED')")
        .getRawOne(),
      this.orderRepo.createQueryBuilder('o')
        .select('o.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('o.status')
        .getRawMany(),
    ]);

    const topCustomers = await Promise.all(
      topCustomersRaw.map(async (r) => {
        const customer = await this.customerRepo.findOne({ where: { id: r.customerId } });
        return {
          id: r.customerId,
          businessName: customer?.businessName ?? 'نامشخص',
          city: customer?.city ?? '',
          segment: customer?.segment ?? 'C',
          totalSpend: Number(r.totalSpend) || 0,
          orderCount: Number(r.orderCount) || 0,
        };
      }),
    );

    const orderGrowth = lastMonthOrders > 0
      ? Math.round(((thisMonthOrders - lastMonthOrders) / lastMonthOrders) * 100)
      : thisMonthOrders > 0 ? 100 : 0;

    const ordersByStatus: Record<string, number> = {};
    for (const row of statusRows) {
      ordersByStatus[row.status] = Number(row.count) || 0;
    }

    return {
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        thisMonth: thisMonthOrders,
        lastMonth: lastMonthOrders,
        growth: orderGrowth,
      },
      ordersByStatus,
      customers: {
        total: totalCustomers,
        pending: pendingCustomers,
        active: activeCustomers,
      },
      revenue: {
        total: Number(totalRevenue?.sum) || 0,
        thisMonth: Number(thisMonthRevenue?.sum) || 0,
        outstanding: Number(outstandingInvoices?.sum) || 0,
      },
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: (o as OrderEntity & { customer?: CustomerEntity }).customer?.businessName ?? 'نامشخص',
        city: (o as OrderEntity & { customer?: CustomerEntity }).customer?.city ?? '',
        total: o.total,
        status: o.status,
        createdAt: o.createdAt,
      })),
      lowStock: lowStockVariants.map((v) => ({
        id: v.id,
        color: v.color,
        size: v.size,
        stock: v.stock,
        productId: v.productId,
      })),
      topCustomers,
      monthlyRevenue: await this.monthlyRevenueSeries(6),
      monthlyOrders: await this.monthlyOrderSeries(6),
    };
  }

  async getReports(period: ReportPeriod = 'month') {
    const bounds = this.periodBounds(period);
    const { start, end, prevStart, prevEnd } = bounds;

    const [revenueNow, revenuePrev, ordersNow, ordersPrev, customersNow, customersPrev] = await Promise.all([
      this.sumRevenue(start, end),
      this.sumRevenue(prevStart, prevEnd),
      this.countOrders(start, end),
      this.countOrders(prevStart, prevEnd),
      this.countNewCustomers(start, end),
      this.countNewCustomers(prevStart, prevEnd),
    ]);

    const avgOrder = ordersNow > 0 ? Math.round(revenueNow / ordersNow) : 0;
    const avgOrderPrev = ordersPrev > 0 ? Math.round(revenuePrev / ordersPrev) : 0;

    const [series, byCity, bySegment, byFabric, topProducts] = await Promise.all([
      this.revenueSeries(period, bounds),
      this.salesByCity(start, end),
      this.customersBySegment(),
      this.salesByFabric(start, end),
      this.topProducts(start, end, prevStart, prevEnd),
    ]);

    return {
      period,
      kpis: {
        revenue: { value: revenueNow, change: this.pctChange(revenueNow, revenuePrev) },
        orders: { value: ordersNow, change: this.pctChange(ordersNow, ordersPrev) },
        avgOrder: { value: avgOrder, change: this.pctChange(avgOrder, avgOrderPrev) },
        newCustomers: { value: customersNow, change: this.pctChange(customersNow, customersPrev) },
      },
      series,
      byCity,
      bySegment,
      byFabric,
      topProducts,
    };
  }

  private pctChange(current: number, previous: number): number {
    if (previous > 0) return Math.round(((current - previous) / previous) * 100);
    return current > 0 ? 100 : 0;
  }

  private periodBounds(period: ReportPeriod) {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    let start: Date;

    switch (period) {
      case 'week':
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - 6);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        break;
      case 'quarter': {
        const q = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), (q - 3) * 3, 1);
        break;
      }
      case 'year':
        start = new Date(now.getFullYear() - 3, 0, 1);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    }

    const duration = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - duration);
    return { start, end, prevStart, prevEnd };
  }

  private async sumRevenue(start: Date, end: Date): Promise<number> {
    const row = await this.orderRepo.createQueryBuilder('o')
      .select('SUM(o.total)', 'sum')
      .where('o.createdAt >= :start AND o.createdAt <= :end', { start, end })
      .andWhere('o.status NOT IN (:...ex)', { ex: EXCLUDE_REVENUE })
      .getRawOne();
    return Number(row?.sum) || 0;
  }

  private async countOrders(start: Date, end: Date): Promise<number> {
    return this.orderRepo.createQueryBuilder('o')
      .where('o.createdAt >= :start AND o.createdAt <= :end', { start, end })
      .andWhere('o.status != :cancelled', { cancelled: CANCELLED })
      .getCount();
  }

  private async countNewCustomers(start: Date, end: Date): Promise<number> {
    return this.customerRepo.createQueryBuilder('c')
      .where('c.createdAt >= :start AND c.createdAt <= :end', { start, end })
      .getCount();
  }

  private async revenueSeries(period: ReportPeriod, bounds: { start: Date; end: Date }) {
    const now = new Date();
    const out: Array<{ label: string; value: number }> = [];

    if (period === 'week') {
      for (let i = 6; i >= 0; i -= 1) {
        const day = new Date(now);
        day.setHours(0, 0, 0, 0);
        day.setDate(day.getDate() - i);
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);
        const value = await this.sumRevenue(day, dayEnd);
        out.push({
          label: day.toLocaleDateString('fa-IR', { weekday: 'short' }),
          value,
        });
      }
      return out;
    }

    if (period === 'month') {
      for (let i = 11; i >= 0; i -= 1) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
        out.push({
          label: start.toLocaleDateString('fa-IR', { month: 'short' }),
          value: await this.sumRevenue(start, end),
        });
      }
      return out;
    }

    if (period === 'quarter') {
      const q = Math.floor(now.getMonth() / 3);
      for (let i = 3; i >= 0; i -= 1) {
        const start = new Date(now.getFullYear(), (q - i) * 3, 1);
        const end = new Date(now.getFullYear(), (q - i) * 3 + 3, 0, 23, 59, 59, 999);
        out.push({
          label: `Q${((q - i + 4) % 4) + 1}`,
          value: await this.sumRevenue(start, end),
        });
      }
      return out;
    }

    // year
    for (let i = 3; i >= 0; i -= 1) {
      const y = now.getFullYear() - i;
      const start = new Date(y, 0, 1);
      const end = new Date(y, 11, 31, 23, 59, 59, 999);
      const cappedEnd = end > bounds.end ? bounds.end : end;
      out.push({
        label: start.toLocaleDateString('fa-IR', { year: 'numeric' }),
        value: await this.sumRevenue(start, cappedEnd),
      });
    }
    return out;
  }

  private async salesByCity(start: Date, end: Date) {
    const rows = await this.orderRepo.createQueryBuilder('o')
      .innerJoin('o.customer', 'c')
      .select("COALESCE(NULLIF(TRIM(c.city), ''), 'نامشخص')", 'city')
      .addSelect('COUNT(o.id)', 'count')
      .addSelect('SUM(o.total)', 'revenue')
      .where('o.createdAt >= :start AND o.createdAt <= :end', { start, end })
      .andWhere('o.status NOT IN (:...ex)', { ex: EXCLUDE_REVENUE })
      .groupBy("COALESCE(NULLIF(TRIM(c.city), ''), 'نامشخص')")
      .orderBy('SUM(o.total)', 'DESC')
      .limit(8)
      .getRawMany();

    return rows.map((r) => ({
      city: r.city as string,
      count: Number(r.count) || 0,
      revenue: Number(r.revenue) || 0,
    }));
  }

  private async customersBySegment() {
    const rows = await this.customerRepo.createQueryBuilder('c')
      .select("COALESCE(NULLIF(TRIM(c.segment), ''), 'C')", 'segment')
      .addSelect('COUNT(*)', 'count')
      .groupBy("COALESCE(NULLIF(TRIM(c.segment), ''), 'C')")
      .getRawMany();

    const labels: Record<string, string> = {
      A: 'سگمنت A (VIP)',
      B: 'سگمنت B (نقره‌ای)',
      C: 'سگمنت C (عادی)',
    };
    const colors: Record<string, string> = {
      A: '#1B5C4A',
      B: '#C9A84C',
      C: '#94a3b8',
    };

    return rows
      .map((r) => {
        const seg = String(r.segment || 'C').toUpperCase();
        return {
          label: labels[seg] ?? `سگمنت ${seg}`,
          value: Number(r.count) || 0,
          color: colors[seg] ?? '#64748b',
          segment: seg,
        };
      })
      .filter((x) => x.value > 0)
      .sort((a, b) => a.segment.localeCompare(b.segment));
  }

  private async salesByFabric(start: Date, end: Date) {
    const rows = await this.itemRepo.createQueryBuilder('i')
      .innerJoin('i.order', 'o')
      .innerJoin(ProductVariantEntity, 'v', 'v.id = i.productVariantId')
      .innerJoin(ProductEntity, 'p', 'p.id = v.productId')
      .select(
        "COALESCE(NULLIF(TRIM(p.specs->>'fabricType'), ''), NULLIF(TRIM(p.fabric), ''), 'نامشخص')",
        'fabric',
      )
      .addSelect('SUM(i.quantity)', 'qty')
      .addSelect('SUM(i.totalPrice)', 'revenue')
      .where('o.createdAt >= :start AND o.createdAt <= :end', { start, end })
      .andWhere('o.status NOT IN (:...ex)', { ex: EXCLUDE_REVENUE })
      .groupBy("COALESCE(NULLIF(TRIM(p.specs->>'fabricType'), ''), NULLIF(TRIM(p.fabric), ''), 'نامشخص')")
      .orderBy('SUM(i.totalPrice)', 'DESC')
      .limit(6)
      .getRawMany();

    const palette = ['#1B5C4A', '#C9A84C', '#64748b', '#3b82f6', '#8b5cf6', '#f59e0b'];
    return rows.map((r, idx) => ({
      label: r.fabric as string,
      value: Number(r.revenue) || 0,
      qty: Number(r.qty) || 0,
      color: palette[idx % palette.length],
    }));
  }

  private async topProducts(start: Date, end: Date, prevStart: Date, prevEnd: Date) {
    const rows = await this.itemRepo.createQueryBuilder('i')
      .innerJoin('i.order', 'o')
      .innerJoin(ProductVariantEntity, 'v', 'v.id = i.productVariantId')
      .innerJoin(ProductEntity, 'p', 'p.id = v.productId')
      .select('p.id', 'productId')
      .addSelect('p.name', 'name')
      .addSelect(
        "COALESCE(NULLIF(TRIM(p.specs->>'fabricType'), ''), NULLIF(TRIM(p.fabric), ''), '—')",
        'fabric',
      )
      .addSelect('SUM(i.quantity)', 'sold')
      .addSelect('SUM(i.totalPrice)', 'revenue')
      .where('o.createdAt >= :start AND o.createdAt <= :end', { start, end })
      .andWhere('o.status NOT IN (:...ex)', { ex: EXCLUDE_REVENUE })
      .groupBy('p.id')
      .addGroupBy('p.name')
      .addGroupBy("COALESCE(NULLIF(TRIM(p.specs->>'fabricType'), ''), NULLIF(TRIM(p.fabric), ''), '—')")
      .orderBy('SUM(i.totalPrice)', 'DESC')
      .limit(10)
      .getRawMany();

    const result = [];
    for (let idx = 0; idx < rows.length; idx += 1) {
      const r = rows[idx];
      const prevSoldRow = await this.itemRepo.createQueryBuilder('i')
        .innerJoin('i.order', 'o')
        .innerJoin(ProductVariantEntity, 'v', 'v.id = i.productVariantId')
        .select('SUM(i.quantity)', 'sold')
        .where('v.productId = :pid', { pid: r.productId })
        .andWhere('o.createdAt >= :start AND o.createdAt <= :end', { start: prevStart, end: prevEnd })
        .andWhere('o.status NOT IN (:...ex)', { ex: EXCLUDE_REVENUE })
        .getRawOne();
      const sold = Number(r.sold) || 0;
      const prevSold = Number(prevSoldRow?.sold) || 0;
      const growth = this.pctChange(sold, prevSold);
      result.push({
        rank: idx + 1,
        productId: r.productId as string,
        name: r.name as string,
        fabric: r.fabric as string,
        sold,
        revenue: Number(r.revenue) || 0,
        growth,
      });
    }
    return result;
  }

  private async monthlyRevenueSeries(months: number) {
    const now = new Date();
    const out: Array<{ label: string; value: number }> = [];
    for (let i = months - 1; i >= 0; i -= 1) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      out.push({
        label: start.toLocaleDateString('fa-IR', { month: 'short' }),
        value: await this.sumRevenue(start, end),
      });
    }
    return out;
  }

  private async monthlyOrderSeries(months: number) {
    const now = new Date();
    const out: Array<{ label: string; value: number }> = [];
    for (let i = months - 1; i >= 0; i -= 1) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      out.push({
        label: start.toLocaleDateString('fa-IR', { month: 'short' }),
        value: await this.countOrders(start, end),
      });
    }
    return out;
  }
}
