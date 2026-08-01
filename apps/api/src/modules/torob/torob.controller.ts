import { Controller, Get, Query, UseGuards, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { TorobAuthGuard } from './torob-auth.guard';
import { TorobService } from './torob.service';

/**
 * Official Torob order-tracking endpoint.
 * Path MUST end with `/torob/v1/orders` (see Torob-Sync docs).
 * Public URL: https://www.poshaktaranom.ir/api/torob/v1/orders
 */
@ApiExcludeController()
@Controller({ path: 'torob/v1/orders', version: VERSION_NEUTRAL })
@UseGuards(TorobAuthGuard)
export class TorobController {
  constructor(private readonly torob: TorobService) {}

  @Get()
  async list(
    @Query('purchase_timestamp_gt') purchaseTimestampGt?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw == null || limitRaw === '' ? undefined : Number(limitRaw);
    return this.torob.listOrders(purchaseTimestampGt, limit);
  }
}
