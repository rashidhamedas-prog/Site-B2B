import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ShippingService } from './shipping.service';

@ApiTags('shipping')
@Controller('shipping')
export class ShippingController {
  constructor(private readonly svc: ShippingService) {}

  @Get('methods')
  methods() {
    return this.svc.methods();
  }

  @Get('quote')
  quote(
    @Query('pieces') pieces: number,
    @Query('orderTotal') orderTotal?: number,
    @Query('method') method?: string,
    @Query('province') province?: string,
  ) {
    return this.svc.quote({ pieces, orderTotal, method, province });
  }

  @Get('track/:code')
  track(@Param('code') code: string, @Query('method') method?: string) {
    return this.svc.trackingUrl(code, method ?? 'CHAPAR');
  }
}
