import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OmnichannelBotInboundService } from '../services/omnichannel-bot-inbound.service';

/**
 * Public order-bot webhooks — secret-validated; no JWT.
 * Bale first; Telegram stub behind OMNICHANNEL_ORDER_BOT_TELEGRAM=false.
 */
@ApiTags('omnichannel-bots')
@Controller({ path: 'omnichannel/bots', version: '1' })
export class OmnichannelBotWebhookController {
  constructor(private readonly inbound: OmnichannelBotInboundService) {}

  @Post('bale/webhook')
  @ApiOperation({ summary: 'Bale order-bot webhook (secret header; flag default OFF)' })
  async baleWebhook(
    @Body() body: unknown,
    @Headers('x-bale-bot-api-secret-token') baleSecret?: string,
    @Headers('x-telegram-bot-api-secret-token') tgSecret?: string,
    @Req() req?: { headers?: Record<string, string | string[] | undefined> },
  ) {
    const header =
      baleSecret
      || tgSecret
      || String(req?.headers?.['x-bale-bot-api-secret-token'] || '')
      || String(req?.headers?.['x-telegram-bot-api-secret-token'] || '');
    return this.inbound.handleBaleWebhook(body, header || undefined);
  }

  @Post('telegram/webhook')
  @ApiOperation({
    summary: 'Telegram order-bot webhook stub (OFF by default; no Worker/egress change)',
  })
  async telegramWebhook(
    @Body() body: unknown,
    @Headers('x-telegram-bot-api-secret-token') secret?: string,
  ) {
    return this.inbound.handleTelegramWebhook(body, secret);
  }
}
