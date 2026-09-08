import {
  Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { CustomerMarketingService } from './customer-marketing.service';
import type { MarketingChannel, MarketingMode } from './customer-marketing.constants';

@ApiTags('marketing')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@Controller({ path: 'marketing', version: '1' })
export class MarketingController {
  constructor(private readonly marketing: CustomerMarketingService) {}

  @Get('board')
  @ApiOperation({ summary: 'ستون‌های قیف بازاریابی' })
  board(@Query('channel') channel: MarketingChannel = 'RETAIL') {
    return this.marketing.board(channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL');
  }

  @Get('queue')
  @ApiOperation({ summary: 'کار امروز تماس و پیگیری' })
  queue(@Query('channel') channel?: MarketingChannel) {
    const ch = channel === 'WHOLESALE' || channel === 'RETAIL' ? channel : undefined;
    return this.marketing.queue(ch);
  }

  @Get('settings')
  settings() {
    return this.marketing.getSettings();
  }

  @Patch('settings')
  @AdminOnly()
  patchSettings(@Body() body: Record<string, unknown>, @Req() req: { user?: { sub?: string; role?: string } }) {
    return this.marketing.patchSettings(body, { id: req.user?.sub, role: req.user?.role });
  }

  @Get('templates')
  templates(@Query('channel') channel?: MarketingChannel) {
    const ch = channel === 'WHOLESALE' || channel === 'RETAIL' ? channel : undefined;
    return this.marketing.listTemplates(ch);
  }

  @Put('templates')
  upsertTemplate(@Body() body: {
    id?: string;
    channel: MarketingChannel;
    code: string;
    title: string;
    body: string;
    callScript?: string;
    medium?: 'SMS' | 'CALL';
    messageClass?: 'NURTURE' | 'PROMO';
    isActive?: boolean;
  }) {
    return this.marketing.upsertTemplate(body);
  }

  @Get('automations')
  automations() {
    return this.marketing.listAutomations();
  }

  @Patch('automations/:code')
  patchAutomation(
    @Param('code') code: string,
    @Body('mode') mode: MarketingMode,
    @Req() req: { user?: { sub?: string; role?: string } },
  ) {
    return this.marketing.patchAutomation(decodeURIComponent(code), mode, { id: req.user?.sub, role: req.user?.role });
  }

  @Post('automations/:code/canary')
  @AdminOnly()
  canary(
    @Param('code') code: string,
    @Req() req: { user?: { sub?: string; role?: string } },
  ) {
    return this.marketing.canaryScenario(decodeURIComponent(code), { id: req.user?.sub, role: req.user?.role });
  }

  @Get('dispatches')
  dispatches(@Query('channel') channel?: MarketingChannel) {
    const ch = channel === 'WHOLESALE' || channel === 'RETAIL' ? channel : undefined;
    return this.marketing.listDispatches(ch);
  }

  @Get('campaigns')
  campaigns() {
    return this.marketing.listCampaigns();
  }

  @Post('campaigns')
  createCampaign(
    @Body() body: { channel: MarketingChannel; title: string; templateId?: string; messageClass?: 'NURTURE' | 'PROMO' },
    @Req() req: { user?: { sub?: string; role?: string } },
  ) {
    return this.marketing.createCampaign(body, { id: req.user?.sub, role: req.user?.role });
  }

  @Post('campaigns/:id/canary')
  @AdminOnly()
  campaignCanary(@Param('id') id: string, @Req() req: { user?: { sub?: string; role?: string } }) {
    return this.marketing.campaignCanary(id, { id: req.user?.sub, role: req.user?.role });
  }

  @Post('campaigns/:id/go-live')
  @AdminOnly()
  goLive(@Param('id') id: string, @Req() req: { user?: { sub?: string; role?: string } }) {
    return this.marketing.goLiveCampaign(id, { id: req.user?.sub, role: req.user?.role });
  }
}
