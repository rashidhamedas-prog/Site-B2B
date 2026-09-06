import {
  Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OmnichannelAdminGuard } from '../guards/omnichannel-admin.guard';
import { OmnichannelService } from '../services/omnichannel.service';
import {
  ActorReasonDto,
  CreateConnectionDto,
  CreateDestinationDto,
  CreatePublicationDto,
  CreateTemplateDto,
  PatchConnectionDto,
  PatchDestinationDto,
  PatchMediaAltDto,
  PatchOmnichannelSettingsDto,
  PatchTemplateDto,
  PreviewDto,
  PutSecretDto,
} from '../dto/omnichannel.dto';
import { assertNoPlaintextSecrets } from '../omnichannel-secrets';
import {
  areOmnichannelConnectorsEnabled,
  isOmnichannelAutoPublishEnabled,
} from '../omnichannel.constants';
import { providerReadiness } from '../provider-capabilities';

type Authed = { omnichannelActor?: { id: string } };

@ApiTags('omnichannel')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard, OmnichannelAdminGuard)
@Roles('ADMIN')
@Controller({ path: 'omnichannel', version: '1' })
export class OmnichannelAdminController {
  constructor(private readonly svc: OmnichannelService) {}

  @Get('status')
  @ApiOperation({ summary: 'وضعیت پرچم Omnichannel' })
  async status() {
    await this.svc.ensureProductTemplates();
    const settings = await this.svc.getSettings();
    return {
      autoPublish: isOmnichannelAutoPublishEnabled(),
      connectors: areOmnichannelConnectorsEnabled(),
      phase: 8,
      retailCanaryLimit: 10,
      wholesaleCanaryLimit: 10,
      outbox: await this.svc.outboxMetrics(),
      /** Per-platform capability matrix + boolean readiness (enabled flag, token present). Never token values. */
      providers: providerReadiness(),
      /** Write-only token inventory: source + fingerprint, never the secret. */
      secrets: await this.svc.listSecretStatuses(),
      ...settings,
    };
  }

  @Put('secrets')
  @ApiOperation({ summary: 'ذخیره توکن ربات (فقط‌نوشتنی؛ مقدار برنمی‌گردد)' })
  putSecret(@Body() body: PutSecretDto, @Req() req: Authed) {
    return this.svc.putSecret(body, req.omnichannelActor);
  }

  @Delete('secrets/:secretRef')
  @ApiOperation({ summary: 'حذف توکن ذخیره‌شده در پنل؛ توکن env سرور دست نمی‌خورد' })
  clearSecret(@Param('secretRef') secretRef: string, @Req() req: Authed) {
    return this.svc.clearSecret(secretRef, req.omnichannelActor);
  }

  @Get('settings')
  @ApiOperation({ summary: 'سیاست ناموجود و مقصد canary' })
  getSettings() {
    return this.svc.getSettings();
  }

  @Patch('settings')
  @ApiOperation({ summary: 'ذخیره سیاست کالای ناموجود' })
  patchSettings(@Body() body: PatchOmnichannelSettingsDto, @Req() req: Authed) {
    return this.svc.patchSettings(body, req.omnichannelActor);
  }

  @Get('connections')
  listConnections() {
    return this.svc.listConnections();
  }

  @Post('connections')
  createConnection(@Body() body: CreateConnectionDto) {
    return this.svc.createConnection(body);
  }

  @Patch('connections/:id')
  patchConnection(@Param('id') id: string, @Body() body: PatchConnectionDto) {
    return this.svc.patchConnection(id, body);
  }

  @Post('connections/:id/test')
  testConnection(@Param('id') id: string, @Req() req: Authed) {
    assertNoPlaintextSecrets({ id });
    return this.svc.testConnection(id, req.omnichannelActor);
  }

  @Post('connections/:id/canary-ping')
  @ApiOperation({ summary: 'ارسال پیام آزمایشی UTF-8 فقط به مقصد canary' })
  pingCanary(@Param('id') id: string, @Body() body: ActorReasonDto, @Req() req: Authed) {
    assertNoPlaintextSecrets({ id, reason: body?.reason });
    return this.svc.pingCanary(id, req.omnichannelActor, body?.reason);
  }

  @Post('connections/:id/discover-chats')
  @ApiOperation({ summary: 'چت‌هایی که ربات اخیراً دیده (getUpdates بدون تأیید) برای پیدا کردن شناسه کانال' })
  discoverChats(@Param('id') id: string, @Req() req: Authed) {
    assertNoPlaintextSecrets({ id });
    return this.svc.discoverChats(id, req.omnichannelActor);
  }

  @Get('destinations')
  listDestinations() {
    return this.svc.listDestinations();
  }

  @Post('destinations')
  createDestination(@Body() body: CreateDestinationDto) {
    return this.svc.createDestination(body);
  }

  @Patch('destinations/:id')
  patchDestination(@Param('id') id: string, @Body() body: PatchDestinationDto) {
    return this.svc.patchDestination(id, body);
  }

  @Post('destinations/:id/verify')
  @ApiOperation({ summary: 'بررسی دسترسی ربات در مقصد (getChat/getChatMember) و ذخیره نتیجه' })
  verifyDestination(@Param('id') id: string, @Req() req: Authed) {
    assertNoPlaintextSecrets({ id });
    return this.svc.verifyDestination(id, req.omnichannelActor);
  }

  @Post('destinations/:id/test-post')
  @ApiOperation({ summary: 'یک پیام آزمایشی به این مقصد؛ موفقیت به‌عنوان اثبات اجازه ارسال ذخیره می‌شود (روبیکا)' })
  testPostDestination(@Param('id') id: string, @Body() body: ActorReasonDto, @Req() req: Authed) {
    assertNoPlaintextSecrets({ id, reason: body?.reason });
    return this.svc.testPostDestination(id, req.omnichannelActor, body?.reason);
  }

  @Get('templates')
  listTemplates() {
    return this.svc.listTemplates();
  }

  @Post('templates/ensure')
  ensureTemplates() {
    return this.svc.ensureProductTemplates();
  }

  @Post('templates')
  createTemplate(@Body() body: CreateTemplateDto) {
    return this.svc.createTemplate(body);
  }

  @Patch('templates/:id')
  patchTemplate(@Param('id') id: string, @Body() body: PatchTemplateDto) {
    return this.svc.patchTemplate(id, body);
  }

  @Post('preview')
  preview(@Body() body: PreviewDto) {
    assertNoPlaintextSecrets(body);
    return this.svc.preview(body);
  }

  @Post('publications')
  createPublication(@Body() body: CreatePublicationDto, @Req() req: Authed) {
    assertNoPlaintextSecrets(body);
    return this.svc.createPublication(body, req.omnichannelActor);
  }

  @Get('publications')
  listPublications() {
    return this.svc.listPublications();
  }

  @Get('deliveries')
  listDeliveries() {
    return this.svc.listDeliveries();
  }

  @Get('outbox')
  listOutbox() {
    return this.svc.listOutbox();
  }

  @Get('audits')
  listAudits() {
    return this.svc.listAudits();
  }

  @Post('deliveries/:id/retry')
  retryDelivery(@Param('id') id: string, @Body() body: ActorReasonDto, @Req() req: Authed) {
    return this.svc.retryDelivery(id, req.omnichannelActor, body.reason);
  }

  @Post('publications/:id/withdraw')
  withdraw(@Param('id') id: string, @Body() body: ActorReasonDto, @Req() req: Authed) {
    return this.svc.withdraw(id, req.omnichannelActor, body.reason);
  }

  @Post('reconcile')
  reconcile(@Body() body: ActorReasonDto, @Req() req: Authed) {
    return this.svc.reconcile(req.omnichannelActor, body.reason);
  }

  @Post('media/assert-deletable')
  assertMediaDeletable(@Body() body: { url: string }) {
    return this.svc.assertMediaDeletable(String(body?.url || ''));
  }

  @Get('media')
  listMedia() {
    return this.svc.listMedia();
  }

  @Patch('media/:id')
  patchMedia(@Param('id') id: string, @Body() body: PatchMediaAltDto) {
    return this.svc.patchMediaAlt(id, body.altText);
  }
}
