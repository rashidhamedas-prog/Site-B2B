import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from '../order/entities/order.entity';
import { CustomerEntity } from '../customer/entities/customer.entity';
import { InvoiceEntity } from '../invoice/entities/invoice.entity';
import { ProductVariantEntity } from '../product/entities/product-variant.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(OrderEntity) private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(CustomerEntity) private readonly customerRepo: Repository<CustomerEntity>,
    @InjectRepository(InvoiceEntity) private readonly invoiceRepo: Repository<InvoiceEntity>,
    @InjectRepository(ProductVariantEntity) private readonly variantRepo: Repository<ProductVariantEntity>,
  ) {}

  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalOrders, pendingOrders, thisMonthOrders, lastMonthOrders,
      totalCustomers, pendingCustomers, activeCustomers,
      recentOrders, lowStockVariants, topCustomersRaw,
      totalRevenue, thisMonthRevenue, outstandingInvoices,
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
        .getRawOne(),
      this.invoiceRepo.createQueryBuilder('i')
        .select('SUM(i.total - i.paidAmount)', 'sum')
        .where("i.status NOT IN ('PAID', 'CANCELLED')")
        .getRawOne(),
    ]);

    // enrich top customers with names
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
      })
    );

    const orderGrowth = lastMonthOrders > 0
      ? Math.round(((thisMonthOrders - lastMonthOrders) / lastMonthOrders) * 100)
      : thisMonthOrders > 0 ? 100 : 0;

    return {
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        thisMonth: thisMonthOrders,
        lastMonth: lastMonthOrders,
        growth: orderGrowth,
      },
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
        customerName: (o as any).customer?.businessName ?? 'نامشخص',
        city: (o as any).customer?.city ?? '',
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

  private async monthlyRevenueSeries(months: number) {
    const now = new Date();
    const out: Array<{ label: string; value: number }> = [];
    for (let i = months - 1; i >= 0; i -= 1) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const row = await this.orderRepo.createQueryBuilder('o')
        .select('SUM(o.total)', 'sum')
        .where('o.createdAt >= :start AND o.createdAt <= :end', { start, end })
        .andWhere("o.status NOT IN ('CANCELLED')")
        .getRawOne();
      out.push({
        label: start.toLocaleDateString('fa-IR', { month: 'short' }),
        value: Number(row?.sum) || 0,
      });
    }
    return out;
  }

  private async monthlyOrderSeries(months: number) {
    const now = new Date();
    const out: Array<{ label: string; value: number }> = [];
    for (let i = months - 1; i >= 0; i -= 1) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const count = await this.orderRepo.createQueryBuilder('o')
        .where('o.createdAt >= :start AND o.createdAt <= :end', { start, end })
        .getCount();
      out.push({
        label: start.toLocaleDateString('fa-IR', { month: 'short' }),
        value: count,
      });
    }
    return out;
  }
}
