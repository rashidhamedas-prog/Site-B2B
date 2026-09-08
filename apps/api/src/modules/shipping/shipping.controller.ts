import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { ShippingService } from './shipping.service';

@ApiTags('shipping')
@Controller('shipping')
export class ShippingController {
  constructor(private readonly svc: ShippingService) {}

  @Get('methods')
  @ApiQuery({ name: 'channel', required: false, enum: ['WHOLESALE', 'RETAIL'] })
  methods(@Query('channel') channel?: string) {
    return this.svc.methods(channel);
  }

  @Get('quote')
  @ApiQuery({ name: 'channel', required: false, enum: ['WHOLESALE', 'RETAIL'] })
  quote(
    @Query('pieces') pieces: number,
    @Query('orderTotal') orderTotal?: number,
    @Query('method') method?: string,
    @Query('province') province?: string,
    @Query('city') city?: string,
    @Query('channel') channel?: string,
  ) {
    return this.svc.quote({ pieces, orderTotal, method, province, city, channel });
  }

  @Get('track/:code')
  track(@Param('code') code: string, @Query('method') method?: string) {
    return this.svc.trackingUrl(code, method ?? 'CHAPAR');
  }
}
