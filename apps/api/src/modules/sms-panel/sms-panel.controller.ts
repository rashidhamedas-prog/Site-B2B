import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SmsPanelService } from './sms-panel.service';
import {
  SMS_ALL,
  SMS_MANAGERS,
  SMS_MARKETERS,
  SMS_SEND_SINGLE,
  SmsRoles,
  SmsRolesGuard,
} from './sms-roles';
import type { SmsMessageClass } from './domain/template';

@ApiTags('admin-sms')
@ApiBearerAuth()
@Controller('admin/sms')
@UseGuards(AuthGuard('jwt'), SmsRolesGuard)
export class SmsPanelController {
  constructor(private readonly sms: SmsPanelService) {}

  private actor(req: Request) {
    const user = (req as any).user || {};
    return {
      id: String(user.sub || user.id || ''),
      role: String(user.role || ''),
      ip: String(req.ip || ''),
      ua: String(req.headers['user-agent'] || ''),
    };
  }

  @Get('credit')
  @SmsRoles(...SMS_ALL)
  credit(@Query('force') force?: string) {
    return this.sms.getCredit(force === '1' || force === 'true');
  }

  @Post('send')
  @SmsRoles(...SMS_SEND_SINGLE)
  send(@Req() req: Request, @Body() body: any) {
    const a = this.actor(req);
    return this.sms.sendSingle({
      actorId: a.id,
      actorRole: a.role,
      to: body.to || body.phone,
      body: body.body || body.message,
      templateId: body.templateId,
      vars: body.vars || {},
      messageClass: (body.messageClass || 'TRANSACTIONAL') as SmsMessageClass,
      customerId: body.customerId,
      ip: a.ip,
    });
  }

  @Get('templates')
  @SmsRoles(...SMS_ALL)
  templates() {
    return this.sms.listTemplates();
  }

  @Post('templates')
  @SmsRoles(...SMS_MANAGERS)
  createTemplate(@Req() req: Request, @Body() body: any) {
    return this.sms.createTemplate(this.actor(req).id, body);
  }

  @Patch('templates/:id')
  @SmsRoles(...SMS_MANAGERS)
  updateTemplate(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.sms.updateTemplate(this.actor(req).id, id, body);
  }

  @Post('templates/:id/preview')
  @SmsRoles(...SMS_ALL)
  previewTemplate(@Param('id') id: string, @Body() body: any) {
    return this.sms.previewTemplate(id, body.vars || {});
  }

  @Get('lists')
  @SmsRoles(...SMS_MARKETERS)
  lists() {
    return this.sms.listLists();
  }

  @Post('lists')
  @SmsRoles(...SMS_MARKETERS)
  createList(@Req() req: Request, @Body() body: any) {
    return this.sms.createList(this.actor(req).id, body);
  }

  @Post('lists/:id/import')
  @SmsRoles(...SMS_MARKETERS)
  importList(@Param('id') id: string, @Body() body: any) {
    const phones = Array.isArray(body.phones)
      ? body.phones
      : String(body.csv || '')
          .split(/[\r\n,;]+/)
          .map((s) => s.trim())
          .filter(Boolean);
    return this.sms.importListMembers(id, phones);
  }

  @Get('lists/:id/members')
  @SmsRoles(...SMS_MARKETERS)
  members(@Param('id') id: string) {
    return this.sms.listMembers(id);
  }

  @Post('segments/preview')
  @SmsRoles(...SMS_MARKETERS)
  segmentPreview(@Body() body: any) {
    return { count: 0, filter: body.filter || {}, note: 'سگمنت پویا در نسخه بعدی کامل می‌شود' };
  }

  @Get('campaigns')
  @SmsRoles(...SMS_MARKETERS)
  campaigns() {
    return this.sms.listCampaigns();
  }

  @Post('campaigns')
  @SmsRoles(...SMS_MARKETERS)
  createCampaign(@Req() req: Request, @Body() body: any) {
    return this.sms.createCampaign(this.actor(req).id, body);
  }

  @Get('campaigns/:id')
  @SmsRoles(...SMS_MARKETERS)
  campaign(@Param('id') id: string) {
    return this.sms.getCampaign(id);
  }

  @Post('campaigns/:id/preview')
  @SmsRoles(...SMS_MARKETERS)
  previewCampaign(@Param('id') id: string) {
    return this.sms.previewCampaign(id);
  }

  @Post('campaigns/:id/prepare')
  @SmsRoles(...SMS_MARKETERS)
  prepare(@Req() req: Request, @Param('id') id: string) {
    return this.sms.prepareCampaign(this.actor(req).id, id);
  }

  @Post('campaigns/:id/confirm')
  @SmsRoles(...SMS_MARKETERS)
  confirm(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.sms.confirmCampaign(this.actor(req).id, id, body);
  }

  @Post('campaigns/:id/approve')
  @SmsRoles(...SMS_MANAGERS)
  approve(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.sms.approveCampaign(this.actor(req).id, id, body || {});
  }

  @Post('campaigns/:id/canary')
  @SmsRoles(...SMS_MARKETERS)
  canary(@Req() req: Request, @Param('id') id: string) {
    return this.sms.canaryCampaign(this.actor(req).id, id);
  }

  @Post('campaigns/:id/pause')
  @SmsRoles(...SMS_MARKETERS)
  pause(@Req() req: Request, @Param('id') id: string) {
    return this.sms.pauseCampaign(this.actor(req).id, id);
  }

  @Post('campaigns/:id/resume')
  @SmsRoles(...SMS_MARKETERS)
  resume(@Req() req: Request, @Param('id') id: string) {
    return this.sms.resumeCampaign(this.actor(req).id, id);
  }

  @Post('campaigns/:id/cancel')
  @SmsRoles(...SMS_MARKETERS)
  cancel(@Req() req: Request, @Param('id') id: string) {
    return this.sms.cancelCampaign(this.actor(req).id, id);
  }

  @Get('messages')
  @SmsRoles(...SMS_ALL)
  messages(
    @Query('campaignId') campaignId?: string,
    @Query('status') status?: string,
    @Query('phone') phone?: string,
  ) {
    return this.sms.listMessages({ campaignId, status, phone });
  }

  @Get('messages/:id')
  @SmsRoles(...SMS_ALL)
  async message(@Param('id') id: string) {
    const rows = await this.sms.listMessages({ take: 500 });
    const row = rows.find((r: any) => r.id === id);
    return row || { id, status: 'NOT_FOUND' };
  }

  @Get('reports/summary')
  @SmsRoles(...SMS_ALL)
  reports() {
    return this.sms.reportsSummary();
  }

  @Get('reports/export.csv')
  @SmsRoles(...SMS_ALL)
  async exportCsv() {
    const rows = await this.sms.listMessages({ take: 500 });
    const header = 'id,status,messageClass,phone,parts,createdAt\n';
    const lines = rows
      .map(
        (r: any) =>
          `${r.id},${r.status},${r.messageClass},${r.phoneNormalized},${r.parts},${r.createdAt?.toISOString?.() || ''}`,
      )
      .join('\n');
    return { csv: header + lines };
  }

  @Get('blacklist')
  @SmsRoles(...SMS_MANAGERS)
  blacklist() {
    return this.sms.listBlacklist();
  }

  @Post('blacklist')
  @SmsRoles(...SMS_MANAGERS)
  addBlacklist(@Req() req: Request, @Body() body: any) {
    return this.sms.addBlacklist(
      this.actor(req).id,
      body.phone,
      body.reason || 'manual',
      body.scope || 'ALL',
    );
  }

  @Delete('blacklist/:phone')
  @SmsRoles(...SMS_MANAGERS)
  delBlacklist(@Req() req: Request, @Param('phone') phone: string) {
    return this.sms.removeBlacklist(this.actor(req).id, phone);
  }

  @Post('blacklist/import')
  @SmsRoles(...SMS_MANAGERS)
  async importBlacklist(@Req() req: Request, @Body() body: any) {
    const phones = Array.isArray(body.phones) ? body.phones : [];
    let ok = 0;
    for (const p of phones.slice(0, 5000)) {
      await this.sms.addBlacklist(this.actor(req).id, p, body.reason || 'csv', body.scope || 'ALL');
      ok += 1;
    }
    return { ok };
  }

  @Get('unsubscribes')
  @SmsRoles(...SMS_MANAGERS)
  unsubscribes() {
    return this.sms.listUnsubscribes();
  }

  @Post('unsubscribes')
  @SmsRoles(...SMS_MANAGERS)
  addUnsub(@Req() req: Request, @Body() body: any) {
    return this.sms.addUnsubscribe(this.actor(req).id, body.phone, body.source || 'ADMIN');
  }

  @Delete('unsubscribes/:phone')
  @SmsRoles(...SMS_MANAGERS)
  delUnsub(@Req() req: Request, @Param('phone') phone: string) {
    return this.sms.removeUnsubscribe(this.actor(req).id, phone);
  }

  @Get('audit-log')
  @SmsRoles(...SMS_MANAGERS)
  audit() {
    return this.sms.listAudit();
  }

  @Get('settings')
  @SmsRoles(...SMS_MANAGERS)
  async getSettings() {
    const s = await this.sms.getPanelSettings();
    return this.sms.settingsPublicView(s);
  }

  @Patch('settings')
  @SmsRoles(...SMS_MANAGERS)
  async patchSettings(@Req() req: Request, @Body() body: any) {
    const a = this.actor(req);
    const s = await this.sms.patchPanelSettings(a.id, body, a.ip);
    return this.sms.settingsPublicView(s);
  }

  @Post('settings/probe')
  @SmsRoles(...SMS_MANAGERS)
  probe() {
    return this.sms.probe();
  }
}
