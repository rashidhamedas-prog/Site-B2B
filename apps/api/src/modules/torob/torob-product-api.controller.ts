import {
  Body,
  Controller,
  Header,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { TorobProductAuthGuard } from './torob-auth.guard';
import { TorobApiExceptionFilter } from './torob-exception.filter';
import { TorobProductApiService } from './torob-product-api.service';
import { torobProductMetrics } from './torob-metrics';

@ApiExcludeController()
@Controller({ path: 'torob_api/v3/products', version: '1' })
@UseGuards(TorobProductAuthGuard)
@UseFilters(TorobApiExceptionFilter)
export class TorobProductApiController {
  constructor(private readonly products: TorobProductApiService) {}

  @Post()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Content-Type', 'application/json; charset=utf-8')
  async productsEndpoint(@Body() body: unknown, @Req() req: { headers?: Record<string, unknown> }) {
    const started = Date.now();
    const correlationId = String(req.headers?.['x-request-id'] || randomUUID());
    torobProductMetrics.recordRequest();
    try {
      const result = await this.products.handleRaw(body);
      torobProductMetrics.recordStatus(200, Date.now() - started);
      console.log(
        JSON.stringify({
          msg: 'torob_product_api',
          correlationId,
          status: 200,
          latencyMs: Date.now() - started,
          total: result.total,
          page: result.current_page,
        }),
      );
      return result;
    } catch (err) {
      const status = (err as { status?: number }).status === 400 ? 400 : 500;
      torobProductMetrics.recordStatus(status, Date.now() - started);
      console.log(
        JSON.stringify({
          msg: 'torob_product_api',
          correlationId,
          status,
          latencyMs: Date.now() - started,
        }),
      );
      throw err;
    }
  }
}
