import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Query,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { TorobAuthGuard } from './torob-auth.guard';
import { TorobService } from './torob.service';

/**
 * Official Torob order-tracking endpoint.
 * Path MUST end with `/torob/v1/orders` (see Torob-Sync docs).
 * Public URL example: https://www.poshaktaranom.ir/api/torob/v1/orders
 */
@ApiExcludeController()
@Controller({ path: 'torob/v1/orders', version: VERSION_NEUTRAL })
@UseGuards(TorobAuthGuard)
export class TorobController {
  constructor(private readonly torob: TorobService) {}

  @Get()
  @Header('Content-Type', 'application/json; charset=utf-8')
  async list(
    @Query('purchase_timestamp_gt') purchaseTimestampGt?: string,
    @Query('limit') limitRaw?: string,
  ) {
    if (!purchaseTimestampGt?.trim()) {
      throw new BadRequestException('purchase_timestamp_gt is required');
    }
    const limit = Number(limitRaw);
    if (!Number.isFinite(limit) || limit < 1 || limit > 1000) {
      throw new BadRequestException('limit must be between 1 and 1000');
    }
    return this.torob.listOrders(purchaseTimestampGt.trim(), limit);
  }
}
