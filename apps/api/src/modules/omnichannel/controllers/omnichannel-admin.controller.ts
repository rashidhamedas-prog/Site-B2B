import {
  Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OmnichannelAdminGuard } from '../guards/omnichannel-admin.guard';
import { OmnichannelService } from '../services/omnichannel.service';
import { OmnichannelHealthService } from '../services/omnichannel-health';
import {
  ActorReasonDto,
  BulkWithdrawPublicationsDto,
  ClearWaitingOutboxDto,
  ReviveConnectorDisabledDto,
  CreateConnectionDto,
  CreateDestinationDto,
  CreatePublicationDto,
  CreateTemplateDto,
  PatchConnectionDto,
  PatchDestinationDto,
  PatchMediaAltDto,
  PatchConnectionPublishSettingsDto,
  PatchDestinationPublishSettingsDto,
  PatchOmnichannelSettingsDto,
  PatchTemplateDto,
  PreviewDto,
  PutSecretDto,
  RequeueByCategoryDto,
} from '../dto/omnichannel.dto';
import { assertNoPlaintextSecrets } from '../omnichannel-secrets';
import {
  areOmnichannelConnectorsEnabled,
  isOmnichannelAutoPublishEnabled,
  isOmnichannelFreePostEnabled,
} from '../omnichannel.constants';
import { providerReadiness } from '../provider-capabilities';

type Authed = { omnichannelActor?: { id: string } };

@ApiTags('omnichannel')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard, OmnichannelAdminGuard)
@Roles('ADMIN')
@Controller({ path: 'omnichannel', version: '1' })
export class OmnichannelAdminController {
  constructor(
    private readonly svc: OmnichannelService,
    private readonly health: OmnichannelHealthService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'سلامت خواندنی کانال‌ها (heartbeat، kill-switch api/worker، کارت provider)' })
  getHealth() {
    return this.health.getHealth();
  }

  @Get('status')
  @ApiOperation({ summary: 'وضعیت پرچم Omnichannel' })
  async status(@Query('destinationId') destinationId?: string) {
    await this.svc.ensureProductTemplates();
    const [settings, outbox, diagnosis] = await Promise.all([
      this.svc.getSettings(),
      this.svc.outboxMetrics(destinationId),
      this.svc.diagnoseGateBlock(destinationId),
    ]);
    const scoped = diagnosis.scopedPublish;
    return {
      autoPublish: isOmnichannelAutoPublishEnabled(),
      connectors: areOmnichannelConnectorsEnabled(),
      /** Free-caption mode. Default false. Does not open a second Telegram client. */
      freePost: isOmnichannelFreePostEnabled(),
      phase: 8,
      retailCanaryLimit: 10,
      wholesaleCanaryLimit: 10,
      outbox,
      /** SUCCEEDED CREATE deliveries since Tehran day start (scoped when destinationId set). */
      sentToday: diagnosis.sentToday,
      /** Why auto-publish may be idle — for admin AttentionStrip. */
      gateBlockReason: diagnosis.gateBlockReason,
      /** DEAD outbox by eventType (channel vs all). */
      outboxDeadByEventType: diagnosis.outboxDeadByEventType,
      scopedDestinationId: destinationId || null,
      /** Per-platform capability matrix + boolean readiness (enabled flag, token present). Never token values. */
      providers: providerReadiness(),
      /** Write-only token inventory: source + fingerprint, never the secret. */
      secrets: await this.svc.listSecretStatuses(),
      ...settings,
      // When a destination is selected, operator metrics must not use stale global leftovers.
      ...(scoped
        ? {
            autoPublishMode: scoped.autoPublishMode,
            autoDailyCap: scoped.autoDailyCap,
            autoMinGapSeconds: scoped.autoMinGapSeconds,
            quietStartHour: scoped.quietStartHour,
            quietEndHour: scoped.quietEndHour,
            withdrawAction: scoped.withdrawAction,
            settingsSource: scoped.settingsSource,
          }
        : {}),
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

  @Get('connections/:id/publish-settings')
  @ApiOperation({ summary: 'قواعد انتشار این ربات (جدا از ربات‌ها و پلتفرم‌های دیگر)' })
  getConnectionPublishSettings(@Param('id') id: string) {
    assertNoPlaintextSecrets({ id });
    return this.svc.getConnectionPublishSettings(id);
  }

  @Patch('connections/:id/publish-settings')
  @ApiOperation({
    summary: 'منسوخ — قواعد باید روی هر مقصد ذخیره شود',
    deprecated: true,
  })
  patchConnectionPublishSettings(
    @Param('id') id: string,
    @Body() body: PatchConnectionPublishSettingsDto,
    @Req() req: Authed,
  ) {
    assertNoPlaintextSecrets({ id, ...body });
    return this.svc.patchConnectionPublishSettings(id, body, req.omnichannelActor);
  }

  @Delete('connections/:id')
  @ApiOperation({ summary: 'حذف ربات از پنل؛ پست داخل پیام‌رسان سر جایش می‌ماند' })
  deleteConnection(@Param('id') id: string, @Req() req: Authed) {
    assertNoPlaintextSecrets({ id });
    return this.svc.deleteConnection(id, req.omnichannelActor);
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

  @Get('destinations/:id/publish-settings')
  @ApiOperation({ summary: 'قواعد انتشار این مقصد (جدا از سایر کانال‌های همان ربات)' })
  getDestinationPublishSettings(@Param('id') id: string) {
    assertNoPlaintextSecrets({ id });
    return this.svc.getDestinationPublishSettings(id);
  }

  @Patch('destinations/:id/publish-settings')
  @ApiOperation({ summary: 'ذخیره قواعد انتشار فقط برای این مقصد' })
  patchDestinationPublishSettings(
    @Param('id') id: string,
    @Body() body: PatchDestinationPublishSettingsDto,
    @Req() req: Authed,
  ) {
    assertNoPlaintextSecrets({ id, ...body });
    return this.svc.patchDestinationPublishSettings(id, body, req.omnichannelActor);
  }

  @Patch('destinations/:id')
  patchDestination(@Param('id') id: string, @Body() body: PatchDestinationDto) {
    return this.svc.patchDestination(id, body);
  }

  @Delete('destinations/:id')
  @ApiOperation({ summary: 'حذف کانال از پنل؛ پست داخل پیام‌رسان سر جایش می‌ماند' })
  deleteDestination(@Param('id') id: string, @Req() req: Authed) {
    assertNoPlaintextSecrets({ id });
    return this.svc.deleteDestination(id, req.omnichannelActor);
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
  listTemplates(@Query('destinationId') destinationId?: string) {
    return this.svc.listTemplates(destinationId);
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
  listPublications(@Query('destinationId') destinationId?: string) {
    return this.svc.listPublications(destinationId);
  }

  @Get('deliveries')
  listDeliveries(@Query('destinationId') destinationId?: string) {
    return this.svc.listDeliveries(destinationId);
  }

  @Get('outbox')
  listOutbox(@Query('destinationId') destinationId?: string) {
    return this.svc.listOutbox(destinationId);
  }

  @Post('outbox/clear-waiting')
  @ApiOperation({ summary: 'خالی کردن کل صف انتظار (لغو نرم؛ بدون حذف ردیف)' })
  clearWaitingOutbox(@Body() body: ClearWaitingOutboxDto, @Req() req: Authed) {
    assertNoPlaintextSecrets(body);
    return this.svc.clearWaitingOutbox(body, req.omnichannelActor);
  }

  @Post('outbox/revive-connector-disabled')
  @ApiOperation({ summary: 'بازتلاش رویدادهای متوقف که فقط به‌خاطر خاموشی کانکتور مرده بودند' })
  reviveConnectorDisabled(@Body() body: ReviveConnectorDisabledDto, @Req() req: Authed) {
    assertNoPlaintextSecrets(body);
    return this.svc.reviveConnectorDisabledDead(body, req.omnichannelActor);
  }

  @Post('publications/requeue-by-category')
  @ApiOperation({ summary: 'ارسال مجدد همه محصولات یک دسته به کانال‌های آماده' })
  requeueByCategory(@Body() body: RequeueByCategoryDto, @Req() req: Authed) {
    assertNoPlaintextSecrets(body);
    return this.svc.requeueByCategory(body, req.omnichannelActor);
  }

  @Get('audits')
  listAudits(@Query('destinationId') destinationId?: string) {
    return this.svc.listAudits(destinationId);
  }

  @Post('deliveries/:id/retry')
  retryDelivery(@Param('id') id: string, @Body() body: ActorReasonDto, @Req() req: Authed) {
    return this.svc.retryDelivery(id, req.omnichannelActor, body.reason);
  }

  @Post('deliveries/:id/reapprove')
  @ApiOperation({ summary: 'تأیید مجدد ارسال متوقف‌شده (HOLD)' })
  reapproveDelivery(@Param('id') id: string, @Body() body: ActorReasonDto, @Req() req: Authed) {
    return this.svc.reapproveDelivery(id, req.omnichannelActor, body.reason);
  }

  @Post('publications/bulk-withdraw')
  @ApiOperation({ summary: 'برداشتن گروهی انتشارها از کانال (ادمین)' })
  bulkWithdrawPublications(
    @Body() body: BulkWithdrawPublicationsDto,
    @Req() req: Authed,
  ) {
    assertNoPlaintextSecrets(body);
    return this.svc.bulkWithdraw(body.ids, req.omnichannelActor, body.reason);
  }

  @Post('publications/:id/withdraw')
  withdraw(@Param('id') id: string, @Body() body: ActorReasonDto, @Req() req: Authed) {
    assertNoPlaintextSecrets(body);
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
