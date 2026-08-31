import {
  Controller,
  Get,
  Header,
  Query,
  Req,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { TorobAuthGuard } from './torob-auth.guard';
import { TorobService } from './torob.service';

/** Panel "تست و ذخیره" is GET without JWT and expects 200, not catalog/order data. */
export const TOROB_ORDERS_REACHABILITY = { success: true as const, data: [] as const };

export function isTorobOrderPanelProbe(headers: Record<string, unknown> | undefined): boolean {
  return !String(headers?.['x-torob-token'] || '').trim();
}

/**
 * Official Torob order-tracking endpoint.
 * Path MUST end with `/torob/v1/orders` (see Torob-Sync docs).
 * Public URL: https://www.poshaktaranom.ir/api/torob/v1/orders
 */
@ApiExcludeController()
@Controller({ path: 'torob/v1/orders', version: VERSION_NEUTRAL })
export class TorobController {
  constructor(private readonly torob: TorobService) {}

  @Get()
  @UseGuards(TorobAuthGuard)
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Content-Type', 'application/json; charset=utf-8')
  async list(
    @Req() req: { headers?: Record<string, unknown>; torobOrderProbe?: boolean },
    @Query('purchase_timestamp_gt') purchaseTimestampGt?: string,
    @Query('limit') limitRaw?: string,
  ) {
    if (req.torobOrderProbe || isTorobOrderPanelProbe(req.headers)) {
      return TOROB_ORDERS_REACHABILITY;
    }
    const limit = limitRaw == null || limitRaw === '' ? undefined : Number(limitRaw);
    return this.torob.listOrders(purchaseTimestampGt, limit);
  }
}
