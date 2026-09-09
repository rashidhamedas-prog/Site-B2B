import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { InviteVendorDto } from './dto/invite-vendor.dto';
import { PatchVendorDto } from './dto/patch-vendor.dto';
import { VendorService } from './vendor.service';

@ApiTags('vendors')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@AdminOnly()
@Controller({ path: 'vendors', version: '1' })
export class VendorAdminController {
  constructor(private readonly vendors: VendorService) {}

  @Get()
  @ApiOperation({ summary: 'لیست همکاران (دعوت‌شده)' })
  list() {
    return this.vendors.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات همکار' })
  getOne(@Param('id') id: string) {
    return this.vendors.getByIdForAdmin(id);
  }

  @Post()
  @ApiOperation({ summary: 'دعوت همکار — رمز موقت فقط یک‌بار برمی‌گردد' })
  invite(@Body() dto: InviteVendorDto) {
    return this.vendors.invite(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'ویرایش SLA / hold / وضعیت همکار' })
  patch(@Param('id') id: string, @Body() dto: PatchVendorDto) {
    return this.vendors.patch(id, dto);
  }

  @Post(':id/rotate-password')
  @ApiOperation({ summary: 'رمز جدید همکار — فقط یک‌بار در پاسخ' })
  rotate(@Param('id') id: string) {
    return this.vendors.rotatePassword(id);
  }
}
