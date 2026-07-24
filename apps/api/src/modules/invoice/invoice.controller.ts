import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, ParseIntPipe, DefaultValuePipe, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InvoiceService } from './invoice.service';
import { UserEntity } from '../auth/entities/user.entity';

type JwtUser = { sub: string; role: string };

@ApiTags('invoices')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'invoices', version: '1' })
export class InvoiceController {
  constructor(
    private readonly invoiceService: InvoiceService,
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'صدور فاکتور' })
  create(@Body() body: any) {
    return this.invoiceService.create(body);
  }

  @Get()
  @ApiOperation({ summary: 'لیست فاکتورها' })
  async findAll(
    @Request() req: Express.Request & { user: JwtUser },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('customerId') customerId?: string,
  ) {
    if (req.user.role === 'CUSTOMER') {
      const user = await this.userRepo.findOne({ where: { id: req.user.sub } });
      return this.invoiceService.findAll(page, limit, user?.customerId ?? undefined);
    }
    return this.invoiceService.findAll(page, limit, customerId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoiceService.findOne(id);
  }

  @Patch(':id/send')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'ارسال فاکتور به مشتری' })
  send(@Param('id') id: string) {
    return this.invoiceService.send(id);
  }

  @Patch(':id/payment')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'ثبت پرداخت' })
  recordPayment(@Param('id') id: string, @Body('amount') amount: number) {
    return this.invoiceService.recordPayment(id, amount);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CUSTOMER')
  @ApiOperation({ summary: 'حذف فاکتور مشتری (soft-delete)' })
  async remove(
    @Param('id') id: string,
    @Request() req: Express.Request & { user: JwtUser },
  ) {
    let customerId: string | null | undefined;
    if (req.user.role === 'CUSTOMER') {
      const user = await this.userRepo.findOne({ where: { id: req.user.sub } });
      customerId = user?.customerId;
    }
    return this.invoiceService.remove(id, { role: req.user.role, customerId });
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'دانلود PDF فاکتور' })
  async downloadPdf(@Param('id') id: string, @Res() res: any) {
    const invoice = await this.invoiceService.findOne(id);
    const items = (invoice as any).items ?? [];

    const toman = (n: number) => Math.round(Number(n) / 10).toLocaleString('fa-IR');

    const itemRows = items.map((item: any) => `
      <tr>
        <td style="padding:8px;border:1px solid #e5e7eb;">${item.description ?? item.productName ?? '-'}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">${item.quantity ?? 1}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:left;">${toman(item.unitPrice ?? 0)} ت</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:left;">${toman(item.totalPrice ?? 0)} ت</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<title>فاکتور ${(invoice as any).invoiceNumber}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700&display=swap');
  * { font-family: 'Vazirmatn', Tahoma, sans-serif; box-sizing: border-box; }
  body { margin: 0; padding: 24px; font-size: 13px; color: #1f2937; background: #fff; }
  h1 { font-size: 20px; color: #1B5C4A; margin: 0 0 4px; }
  .header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 24px; border-bottom: 2px solid #1B5C4A; padding-bottom: 16px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 24px; }
  .meta-item { background: #f9fafb; border-radius: 8px; padding: 8px 12px; }
  .meta-label { font-size: 11px; color: #6b7280; margin-bottom: 2px; }
  .meta-value { font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #1B5C4A; color: #fff; padding: 10px 8px; text-align: right; }
  .totals { text-align: left; }
  .totals td { padding: 6px 8px; border: 1px solid #e5e7eb; }
  .total-row { background: #1B5C4A; color: #fff; font-weight: 700; }
  .footer { margin-top: 32px; text-align: center; color: #9ca3af; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>پوشاک ترنم</h1>
    <p style="color:#6b7280;margin:0;">تولیدی و فروش عمده پوشاک زنانه</p>
  </div>
  <div style="text-align:left;">
    <div style="font-size:18px;font-weight:bold;color:#1B5C4A;">فاکتور</div>
    <div style="font-size:16px;font-weight:bold;">${(invoice as any).invoiceNumber}</div>
    <div style="color:#6b7280;font-size:11px;">تاریخ: ${new Date((invoice as any).createdAt).toLocaleDateString('fa-IR')}</div>
  </div>
</div>

<div class="meta">
  <div class="meta-item"><div class="meta-label">مشتری</div><div class="meta-value">${(invoice as any).customer?.businessName ?? '-'}</div></div>
  <div class="meta-item"><div class="meta-label">وضعیت</div><div class="meta-value">${(invoice as any).status}</div></div>
  <div class="meta-item"><div class="meta-label">روش پرداخت</div><div class="meta-value">${(invoice as any).paymentTerms ?? 'نقدی'}</div></div>
  <div class="meta-item"><div class="meta-label">تلفن</div><div class="meta-value">۰۹۱۵ ۲۴۲ ۴۶۲۴</div></div>
</div>

<table>
  <thead>
    <tr>
      <th>شرح</th><th style="text-align:center;">تعداد</th><th style="text-align:left;">قیمت واحد</th><th style="text-align:left;">مجموع</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows || '<tr><td colspan="4" style="padding:12px;text-align:center;color:#9ca3af;">اقلامی ثبت نشده</td></tr>'}
  </tbody>
</table>

<table class="totals" style="width:280px;margin-right:auto;">
  <tr><td>جمع اقلام</td><td>${toman((invoice as any).subtotal ?? 0)} تومان</td></tr>
  <tr><td>تخفیف</td><td>${toman((invoice as any).discount ?? 0)} تومان</td></tr>
  <tr><td>هزینه ارسال</td><td>${(invoice as any).shippingFee ? toman((invoice as any).shippingFee) + ' تومان' : 'رایگان'}</td></tr>
  <tr><td>پرداخت شده</td><td>${toman((invoice as any).paidAmount ?? 0)} تومان</td></tr>
  <tr class="total-row"><td>مانده بدهی</td><td>${toman(((invoice as any).total ?? 0) - ((invoice as any).paidAmount ?? 0))} تومان</td></tr>
</table>

<div class="footer">
  پوشاک ترنم | مشهد — پاساژ کیمیا — طبقه منفی ۱ — پلاک ۱۳۳ | تلگرام: @toliditaranom
</div>
</body>
</html>`;

    res.header('Content-Type', 'text/html; charset=utf-8');
    res.header('Content-Disposition', `inline; filename="invoice-${(invoice as any).invoiceNumber}.html"`);
    res.send(html);
  }
}
