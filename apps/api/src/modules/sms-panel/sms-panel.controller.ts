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
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SmsPanelService } from './sms-panel.service';
import { SegmentService } from './audience/segment.service';
import { masksAudiencePhone } from './audience/audience.types';
import {
  SmsApproveDto,
  SmsConfirmDto,
  SmsCreateCampaignDto,
  SmsSendDto,
  SmsTemplateDto,
} from './sms-panel.dto';
import {
  SMS_ALL,
  SMS_MANAGERS,
  SMS_MARKETERS,
  SMS_SEND_SINGLE,
  SmsRoles,
  SmsRolesGuard,
} from './sms-roles';

const smsBodyPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: false,
  transform: true,
});

@ApiTags('admin-sms')
@ApiBearerAuth()
@Controller('admin/sms')
@UseGuards(AuthGuard('jwt'), SmsRolesGuard)
export class SmsPanelController {
  constructor(
    private readonly sms: SmsPanelService,
    private readonly segments: SegmentService,
  ) {}

  private actor(req: Request) {
    const user = (req as any).user || {};
    return {
      id: String(user.sub || user.id || ''),
      role: String(user.role || ''),
      ip: String(req.ip || ''),
      ua: String(req.headers['user-agent'] || ''),
    };
  }

  @Get('audience/sources')
  @SmsRoles(...SMS_ALL)
  audienceSources() {
    return this.sms.listAudienceSources();
  }

  @Get('audience/contacts')
  @SmsRoles(...SMS_ALL)
  audienceContacts(
    @Req() req: Request,
    @Query('q') q?: string,
    @Query('source') source?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.sms.searchAudienceContacts({
      q,
      source,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      role: this.actor(req).role,
    });
  }

  @Get('audience/contacts/:phone')
  @SmsRoles(...SMS_ALL)
  audienceContact(@Req() req: Request, @Param('phone') phone: string) {
    return this.sms.getAudienceContact(decodeURIComponent(phone), this.actor(req).role);
  }

  @Get('credit')
  @SmsRoles(...SMS_ALL)
  credit(@Query('force') force?: string) {
    return this.sms.getCredit(force === '1' || force === 'true');
  }

  @Post('send')
  @SmsRoles(...SMS_SEND_SINGLE)
  @UsePipes(smsBodyPipe)
  send(@Req() req: Request, @Body() body: SmsSendDto) {
    const a = this.actor(req);
    return this.sms.sendSingle({
      actorId: a.id,
      actorRole: a.role,
      to: body.to,
      body: body.body,
      templateId: body.templateId,
      vars: body.vars || {},
      messageClass: body.messageClass,
      customerId: body.customerId,
      salesPartnerId: body.salesPartnerId,
      contactPhone: body.contactPhone,
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
  @UsePipes(smsBodyPipe)
  createTemplate(@Req() req: Request, @Body() body: SmsTemplateDto) {
    return this.sms.createTemplate(this.actor(req).id, body);
  }

  @Patch('templates/:id')
  @SmsRoles(...SMS_MANAGERS)
  @UsePipes(smsBodyPipe)
  updateTemplate(@Req() req: Request, @Param('id') id: string, @Body() body: Partial<SmsTemplateDto>) {
    return this.sms.updateTemplate(this.actor(req).id, id, body);
  }

  @Post('templates/:id/preview')
  @SmsRoles(...SMS_ALL)
  previewTemplate(
    @Param('id') id: string,
    @Body() body: { vars?: Record<string, string>; fallbacks?: Record<string, string>; sources?: string[] },
  ) {
    return this.sms.previewTemplate(id, body.vars || {}, body.fallbacks || {}, body.sources || []);
  }

  @Get('lists')
  @SmsRoles(...SMS_MARKETERS)
  lists() {
    return this.sms.listLists();
  }

  @Post('lists')
  @SmsRoles(...SMS_MARKETERS)
  createList(@Req() req: Request, @Body() body: { name: string; description?: string; type?: string }) {
    return this.sms.createList(this.actor(req).id, body);
  }

  @Post('lists/:id/import')
  @SmsRoles(...SMS_MARKETERS)
  importList(@Param('id') id: string, @Body() body: { phones?: string[]; csv?: string }) {
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
  members(@Req() req: Request, @Param('id') id: string) {
    return this.sms.listMembers(id, this.actor(req).role);
  }

  @Get('audience/fields')
  @SmsRoles(...SMS_MARKETERS)
  audienceFields() {
    return this.segments.fields();
  }

  @Post('segments/preview')
  @SmsRoles(...SMS_MARKETERS)
  segmentPreview(
    @Req() req: Request,
    @Body() body: { sources?: string[]; rules?: unknown; text?: string; templateId?: string; messageClass?: string },
  ) {
    return this.segments.preview(body, this.actor(req).role);
  }

  @Get('segments')
  @SmsRoles(...SMS_MARKETERS)
  segmentList() {
    return this.segments.list();
  }

  @Post('segments')
  @SmsRoles(...SMS_MARKETERS)
  segmentCreate(@Req() req: Request, @Body() body: { name?: string; sources?: string[]; rules?: unknown }) {
    return this.segments.create(this.actor(req).id, body);
  }

  @Patch('segments/:id')
  @SmsRoles(...SMS_MARKETERS)
  segmentUpdate(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { name?: string; sources?: string[]; rules?: unknown },
  ) {
    return this.segments.update(this.actor(req).id, id, body);
  }

  @Delete('segments/:id')
  @SmsRoles(...SMS_MARKETERS)
  segmentDelete(@Req() req: Request, @Param('id') id: string) {
    return this.segments.remove(this.actor(req).id, id);
  }

  @Get('campaigns')
  @SmsRoles(...SMS_MARKETERS)
  campaigns() {
    return this.sms.listCampaigns();
  }

  @Post('campaigns')
  @SmsRoles(...SMS_MARKETERS)
  @UsePipes(smsBodyPipe)
  createCampaign(@Req() req: Request, @Body() body: SmsCreateCampaignDto) {
    const a = this.actor(req);
    return this.sms.createCampaign(a.id, body, a.role);
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
  @UsePipes(smsBodyPipe)
  confirm(@Req() req: Request, @Param('id') id: string, @Body() body: SmsConfirmDto) {
    return this.sms.confirmCampaign(this.actor(req).id, id, body);
  }

  @Post('campaigns/:id/approve')
  @SmsRoles(...SMS_MANAGERS)
  @UsePipes(smsBodyPipe)
  approve(@Req() req: Request, @Param('id') id: string, @Body() body: SmsApproveDto) {
    return this.sms.approveCampaign(this.actor(req).id, id, body || {});
  }

  @Post('campaigns/:id/canary')
  @SmsRoles(...SMS_MARKETERS)
  canary(@Req() req: Request, @Param('id') id: string) {
    const a = this.actor(req);
    return this.sms.canaryCampaign(a.id, id, a.role);
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
    @Req() req: Request,
    @Query('campaignId') campaignId?: string,
    @Query('status') status?: string,
    @Query('phone') phone?: string,
    @Query('source') source?: string,
    @Query('segmentId') segmentId?: string,
  ) {
    const a = this.actor(req);
    return this.sms.listMessages({
      campaignId,
      status,
      phone,
      source,
      segmentId,
      mask: masksAudiencePhone(a.role),
    });
  }

  @Get('messages/:id')
  @SmsRoles(...SMS_ALL)
  message(@Param('id') id: string) {
    return this.sms.getMessage(id);
  }

  @Get('reports/summary')
  @SmsRoles(...SMS_ALL)
  reports(@Query('source') source?: string, @Query('segmentId') segmentId?: string) {
    return this.sms.reportsSummary({ source, segmentId });
  }

  @Get('reports/export.csv')
  @SmsRoles(...SMS_ALL)
  async exportCsv(@Req() req: Request, @Query('source') source?: string) {
    const a = this.actor(req);
    const rows = await this.sms.listMessages({
      take: 500,
      source,
      mask: masksAudiencePhone(a.role),
    });
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
  addBlacklist(@Req() req: Request, @Body() body: { phone: string; reason?: string; scope?: string }) {
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
    return this.sms.removeBlacklist(this.actor(req).id, decodeURIComponent(phone));
  }

  @Post('blacklist/import')
  @SmsRoles(...SMS_MANAGERS)
  async importBlacklist(@Req() req: Request, @Body() body: { phones?: string[]; reason?: string; scope?: string }) {
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
  addUnsub(@Req() req: Request, @Body() body: { phone: string; source?: string }) {
    return this.sms.addUnsubscribe(this.actor(req).id, body.phone, body.source || 'ADMIN');
  }

  @Delete('unsubscribes/:phone')
  @SmsRoles(...SMS_MANAGERS)
  delUnsub(@Req() req: Request, @Param('phone') phone: string) {
    return this.sms.removeUnsubscribe(this.actor(req).id, decodeURIComponent(phone));
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
  async patchSettings(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const a = this.actor(req);
    const s = await this.sms.patchPanelSettings(a.id, body as any, a.ip);
    return this.sms.settingsPublicView(s);
  }

  @Post('settings/probe')
  @SmsRoles(...SMS_MANAGERS)
  probe() {
    return this.sms.probe();
  }
}
