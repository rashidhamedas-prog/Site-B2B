import { Controller, ForbiddenException, Get, Query, Req, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CustomerService } from './customer.service';

type JwtUser = { sub?: string; customerId?: string; role?: string };

@ApiTags('account-wallet')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('CUSTOMER', 'ADMIN')
@Controller({ path: 'account/wallet', version: '1' })
export class CustomerSelfController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @ApiOperation({ summary: 'کیف پول مشتری جاری' })
  async mine(
    @Req() req: { user?: JwtUser },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const customerId = req.user?.customerId;
    if (!customerId) throw new ForbiddenException('حساب مشتری متصل نیست');
    return this.customerService.listWallet(customerId, page, limit);
  }
}
