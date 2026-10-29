import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OmnichannelBotInboundService } from '../services/omnichannel-bot-inbound.service';
import { checkBotRateLimit } from '../bots/bot-rate-limit';

/**
 * Public order-bot webhooks — secret-validated; no JWT.
 * Bale first; Telegram stub behind OMNICHANNEL_ORDER_BOT_TELEGRAM=false.
 * Light in-process throttle per provider (fail-open on allow).
 */
@ApiTags('omnichannel-bots')
@Controller({ path: 'omnichannel/bots', version: '1' })
export class OmnichannelBotWebhookController {
  constructor(private readonly inbound: OmnichannelBotInboundService) {}

  private throttle(provider: string): { ok: true } | { ok: false; ignored: string } {
    const hit = checkBotRateLimit({
      provider,
      customerChatId: `webhook:${provider}`,
      perMinute: 120,
      burst: 180,
    });
    if (!hit.allowed) return { ok: false, ignored: 'webhook_rate_limited' };
    return { ok: true };
  }

  @Post('bale/webhook')
  @ApiOperation({ summary: 'Bale order-bot webhook (secret header; flag default OFF)' })
  async baleWebhook(
    @Body() body: unknown,
    @Headers('x-bale-bot-api-secret-token') baleSecret?: string,
    @Headers('x-telegram-bot-api-secret-token') tgSecret?: string,
    @Req() req?: { headers?: Record<string, string | string[] | undefined> },
  ) {
    const gate = this.throttle('BALE');
    if (gate.ok === false) return { ok: true, ignored: gate.ignored };
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
    const gate = this.throttle('TELEGRAM');
    if (gate.ok === false) return { ok: true, ignored: gate.ignored };
    return this.inbound.handleTelegramWebhook(body, secret);
  }
}
