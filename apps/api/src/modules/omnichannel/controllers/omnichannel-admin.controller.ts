import {
  Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Put, Query, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OmnichannelAdminGuard } from '../guards/omnichannel-admin.guard';
import { OmnichannelRoleGuard } from '../guards/omnichannel-role.guard';
import {
  OmnichannelMinRole,
  RequiresGoRef,
} from '../decorators/omnichannel-role.decorator';
import { OmnichannelService } from '../services/omnichannel.service';
import { OmnichannelDeleteService } from '../services/omnichannel-delete.service';
import { OmnichannelEditService } from '../services/omnichannel-edit.service';
import { OmnichannelHealthService } from '../services/omnichannel-health';
import { OmnichannelCoverageService } from '../services/omnichannel-coverage.service';
import { OmnichannelComposerService } from '../services/omnichannel-composer.service';
import { OmnichannelSettingsService } from '../services/omnichannel-settings.service';
import { OmnichannelMediaService } from '../services/omnichannel-media.service';
import {
  ActorReasonDto,
  ClearWaitingOutboxDto,
  ReviveConnectorDisabledDto,
  ComposerPlanDto,
  CreateConnectionDto,
  CreateDestinationDto,
  CreatePublicationDto,
  CreateTemplateDto,
  GoRefDto,
  PatchConnectionDto,
  PatchDestinationDto,
  PatchMediaAltDto,
  PatchConnectionPublishSettingsDto,
  PatchDestinationPublishSettingsDto,
  PatchChannelSettingsDto,
  CopyChannelSettingsDto,
  ActivateTemplateDto,
  EmergencyHoldDto,
  PatchOmnichannelSettingsDto,
  PatchTemplateDto,
  PreviewDto,
  PutSecretDto,
  RequeueByCategoryDto,
  BulkWithdrawPublicationsDto,
} from '../dto/omnichannel.dto';
import {
  DeleteDeliveryMessagesDto,
  EditDeliveryDto,
  RevertDeliveryDto,
} from '../dto/omnichannel-delete-edit.dto';
import {
  CoverageAbsenceReasonDto,
  OutOfPanelIngestDto,
} from '../dto/omnichannel-coverage.dto';
import {
  MarkMediaNeedsReplaceDto,
  ScanMediaDto,
  ValidateMediaDto,
} from '../dto/omnichannel-media.dto';
import { assertNoPlaintextSecrets } from '../omnichannel-secrets';
import { isVaultStrictMessengers } from '../omnichannel-token-vault';
import {
  areOmnichannelConnectorsEnabled,
  isOmnichannelAutoPublishEnabled,
  isOmnichannelChannelSettingsUiEnabled,
  isOmnichannelComposerUiEnabled,
  isOmnichannelCoverageUiEnabled,
  isOmnichannelFreePostEnabled,
  isOmnichannelTemplatesUiEnabled,
  isOmnichannelMediaHealthUiEnabled,
} from '../omnichannel.constants';
import { providerReadiness } from '../provider-capabilities';
import {
  isOmnichannelRbacEnabled,
  roleMeetsMinimum,
  type OmnichannelRole,
} from '../omnichannel-rbac';

type Authed = {
  omnichannelActor?: { id: string; role?: string; omnichannelRole?: OmnichannelRole };
};

@ApiTags('omnichannel')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard, OmnichannelAdminGuard, OmnichannelRoleGuard)
@Roles('ADMIN')
@OmnichannelMinRole('VIEWER')
@Controller({ path: 'omnichannel', version: '1' })
export class OmnichannelAdminController {
  constructor(
    private readonly svc: OmnichannelService,
    private readonly deletes: OmnichannelDeleteService,
    private readonly edits: OmnichannelEditService,
    private readonly health: OmnichannelHealthService,
    private readonly coverage: OmnichannelCoverageService,
    private readonly composer: OmnichannelComposerService,
    private readonly channelSettings: OmnichannelSettingsService,
    private readonly media: OmnichannelMediaService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'سلامت خواندنی کانال‌ها (heartbeat، kill-switch api/worker، کارت provider)' })
  getHealth() {
    return this.health.getHealth();
  }

  @Get('status')
  @ApiOperation({ summary: 'وضعیت پرچم Omnichannel' })
  async status(
    @Query('destinationId') destinationId?: string,
    @Req() req?: Authed,
  ) {
    await this.svc.ensureProductTemplates();
    const [settings, outbox, diagnosis] = await Promise.all([
      this.svc.getSettings(),
      this.svc.outboxMetrics(destinationId),
      this.svc.diagnoseGateBlock(destinationId),
    ]);
    const scoped = diagnosis.scopedPublish;
    const rbacEnabled = isOmnichannelRbacEnabled();
    return {
      autoPublish: isOmnichannelAutoPublishEnabled(),
      connectors: areOmnichannelConnectorsEnabled(),
      /** Free-caption mode. Default false. Does not open a second Telegram client. */
      freePost: isOmnichannelFreePostEnabled(),
      /** PR-8 coverage matrix tab. Default false until staging validate. */
      coverageUi: isOmnichannelCoverageUiEnabled(),
      /** PR-9 composer wizard tab. Default false until validated. */
      composerUi: isOmnichannelComposerUiEnabled(),
      /** PR-10 channel settings tab. Default false until validated. */
      channelSettingsUi: isOmnichannelChannelSettingsUiEnabled(),
      /** PR-10 templates editor tab. Default false until validated. */
      templatesUi: isOmnichannelTemplatesUiEnabled(),
      /** PR-11 media health tab. Default false until staging validate. */
      mediaHealthUi: isOmnichannelMediaHealthUiEnabled(),
      phase: 11,
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
      rbacEnabled,
      /** Resolved omnichannel role for UI gates (scan button). Never secrets. */
      omnichannelRole: req?.omnichannelActor?.omnichannelRole || (rbacEnabled ? 'PUBLISHER' : 'OWNER'),
      /** Per-platform capability matrix + boolean readiness (enabled flag, token present). Never token values. */
      providers: providerReadiness(),
      /** Write-only token inventory: source + fingerprint, never the secret. */
      secrets: await this.svc.listSecretStatuses(),
      /** BALE/RUBIKA env-only rejected when true. Telegram exempt. Default false. */
      strictMessengers: isVaultStrictMessengers(),
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
  @OmnichannelMinRole('OWNER')
  @RequiresGoRef()
  @ApiOperation({ summary: 'ذخیره توکن ربات (فقط‌نوشتنی؛ مقدار برنمی‌گردد)' })
  putSecret(@Body() body: PutSecretDto, @Req() req: Authed) {
    return this.svc.putSecret(body, req.omnichannelActor);
  }

  @Delete('secrets/:secretRef')
  @OmnichannelMinRole('OWNER')
  @RequiresGoRef()
  @ApiOperation({ summary: 'حذف توکن ذخیره‌شده در پنل؛ توکن env سرور دست نمی‌خورد' })
  clearSecret(
    @Param('secretRef') secretRef: string,
    @Body() body: GoRefDto = {},
    @Req() req: Authed,
  ) {
    return this.svc.clearSecret(secretRef, req.omnichannelActor, body?.goRef);
  }

  @Get('settings')
  @ApiOperation({ summary: 'سیاست ناموجود و مقصد canary' })
  getSettings() {
    return this.svc.getSettings();
  }

  @Patch('settings')
  @OmnichannelMinRole('OWNER')
  @RequiresGoRef()
  @ApiOperation({ summary: 'ذخیره سیاست کالای ناموجود' })
  patchSettings(@Body() body: PatchOmnichannelSettingsDto, @Req() req: Authed) {
    return this.svc.patchSettings(body, req.omnichannelActor);
  }

  @Get('connections')
  listConnections() {
    return this.svc.listConnections();
  }

  @Post('connections')
  @OmnichannelMinRole('OWNER')
  @RequiresGoRef()
  createConnection(@Body() body: CreateConnectionDto, @Req() req: Authed) {
    return this.svc.createConnection(body, req.omnichannelActor);
  }

  @Patch('connections/:id')
  @OmnichannelMinRole('PUBLISHER')
  patchConnection(@Param('id') id: string, @Body() body: PatchConnectionDto, @Req() req: Authed) {
    return this.svc.patchConnection(id, body, req.omnichannelActor);
  }

  @Get('connections/:id/publish-settings')
  @ApiOperation({ summary: 'قواعد انتشار این ربات (جدا از ربات‌ها و پلتفرم‌های دیگر)' })
  getConnectionPublishSettings(@Param('id') id: string) {
    assertNoPlaintextSecrets({ id });
    return this.svc.getConnectionPublishSettings(id);
  }

  @Patch('connections/:id/publish-settings')
  @OmnichannelMinRole('OWNER')
  @RequiresGoRef()
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
  @OmnichannelMinRole('OWNER')
  @RequiresGoRef()
  @ApiOperation({ summary: 'حذف ربات از پنل؛ پست داخل پیام‌رسان سر جایش می‌ماند' })
  deleteConnection(
    @Param('id') id: string,
    @Body() body: GoRefDto = {},
    @Req() req: Authed,
  ) {
    assertNoPlaintextSecrets({ id });
    return this.svc.deleteConnection(id, req.omnichannelActor, body?.goRef);
  }

  @Post('connections/:id/test')
  @OmnichannelMinRole('PUBLISHER')
  testConnection(@Param('id') id: string, @Req() req: Authed) {
    assertNoPlaintextSecrets({ id });
    return this.svc.testConnection(id, req.omnichannelActor);
  }

  @Post('connections/:id/canary-ping')
  @OmnichannelMinRole('PUBLISHER')
  @ApiOperation({ summary: 'ارسال پیام آزمایشی UTF-8 فقط به مقصد canary' })
  pingCanary(@Param('id') id: string, @Body() body: ActorReasonDto, @Req() req: Authed) {
    assertNoPlaintextSecrets({ id, reason: body?.reason });
    return this.svc.pingCanary(id, req.omnichannelActor, body?.reason);
  }

  @Post('connections/:id/discover-chats')
  @OmnichannelMinRole('PUBLISHER')
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
  @OmnichannelMinRole('OWNER')
  @RequiresGoRef()
  createDestination(@Body() body: CreateDestinationDto, @Req() req: Authed) {
    return this.svc.createDestination(body, req.omnichannelActor);
  }

  @Get('destinations/:id/publish-settings')
  @ApiOperation({ summary: 'قواعد انتشار این مقصد (جدا از سایر کانال‌های همان ربات)' })
  getDestinationPublishSettings(@Param('id') id: string) {
    assertNoPlaintextSecrets({ id });
    return this.svc.getDestinationPublishSettings(id);
  }

  @Patch('destinations/:id/publish-settings')
  @OmnichannelMinRole('OWNER')
  @RequiresGoRef()
  @ApiOperation({ summary: 'ذخیره قواعد انتشار فقط برای این مقصد' })
  patchDestinationPublishSettings(
    @Param('id') id: string,
    @Body() body: PatchDestinationPublishSettingsDto,
    @Req() req: Authed,
  ) {
    assertNoPlaintextSecrets({ id, ...body });
    return this.svc.patchDestinationPublishSettings(id, body, req.omnichannelActor);
  }

  @Get('destinations/:id/channel-settings')
  @OmnichannelMinRole('VIEWER')
  @ApiOperation({ summary: 'تنظیمات محتوای این مقصد (جدا؛ بدون fallback سراسری)' })
  getChannelSettings(@Param('id') id: string) {
    assertNoPlaintextSecrets({ id });
    return this.channelSettings.getChannelSettings(id);
  }

  @Patch('destinations/:id/channel-settings')
  @OmnichannelMinRole('PUBLISHER')
  @ApiOperation({
    summary:
      'ذخیره تنظیمات کانال — محتوای Publisher بدون goRef؛ سیاست (سقف/سکوت/ownerChatId/قیمت) Owner+goRef در سرویس',
  })
  patchChannelSettings(
    @Param('id') id: string,
    @Body() body: PatchChannelSettingsDto,
    @Req() req: Authed,
  ) {
    assertNoPlaintextSecrets({ id, ...body });
    return this.channelSettings.patchChannelSettings(id, body, req.omnichannelActor);
  }

  @Post('destinations/:id/channel-settings/copy-from')
  @OmnichannelMinRole('OWNER')
  @RequiresGoRef()
  @ApiOperation({ summary: 'کپی مقدار از مقصد دیگر (بدون پیوند مشترک)' })
  copyChannelSettings(
    @Param('id') id: string,
    @Body() body: CopyChannelSettingsDto,
    @Req() req: Authed,
  ) {
    assertNoPlaintextSecrets({ id, ...body });
    return this.channelSettings.copyChannelSettingsFrom(id, body, req.omnichannelActor);
  }

  @Patch('destinations/:id/emergency-hold')
  @OmnichannelMinRole('OWNER')
  @RequiresGoRef()
  @ApiOperation({ summary: 'توقف اضطراری اتوماسیون این مقصد (Owner+goRef)' })
  patchEmergencyHold(
    @Param('id') id: string,
    @Body() body: EmergencyHoldDto,
    @Req() req: Authed,
  ) {
    assertNoPlaintextSecrets({ id, ...body });
    return this.channelSettings.patchEmergencyHold(id, body, req.omnichannelActor);
  }

  @Patch('destinations/:id')
  @OmnichannelMinRole('PUBLISHER')
  patchDestination(@Param('id') id: string, @Body() body: PatchDestinationDto, @Req() req: Authed) {
    return this.svc.patchDestination(id, body, req.omnichannelActor);
  }

  @Delete('destinations/:id')
  @OmnichannelMinRole('OWNER')
  @RequiresGoRef()
  @ApiOperation({ summary: 'حذف کانال از پنل؛ پست داخل پیام‌رسان سر جایش می‌ماند' })
  deleteDestination(
    @Param('id') id: string,
    @Body() body: GoRefDto = {},
    @Req() req: Authed,
  ) {
    assertNoPlaintextSecrets({ id });
    return this.svc.deleteDestination(id, req.omnichannelActor, body?.goRef);
  }

  @Post('destinations/:id/verify')
  @OmnichannelMinRole('PUBLISHER')
  @ApiOperation({ summary: 'بررسی دسترسی ربات در مقصد (getChat/getChatMember) و ذخیره نتیجه' })
  verifyDestination(@Param('id') id: string, @Req() req: Authed) {
    assertNoPlaintextSecrets({ id });
    return this.svc.verifyDestination(id, req.omnichannelActor);
  }

  @Post('destinations/:id/test-post')
  @OmnichannelMinRole('PUBLISHER')
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
  @OmnichannelMinRole('PUBLISHER')
  ensureTemplates() {
    return this.svc.ensureProductTemplates();
  }

  @Post('templates')
  @OmnichannelMinRole('PUBLISHER')
  createTemplate(@Body() body: CreateTemplateDto, @Req() req: Authed) {
    return this.svc.createTemplate(body, req.omnichannelActor);
  }

  @Patch('templates/:id')
  @OmnichannelMinRole('PUBLISHER')
  patchTemplate(@Param('id') id: string, @Body() body: PatchTemplateDto, @Req() req: Authed) {
    return this.svc.patchTemplate(id, body, req.omnichannelActor);
  }

  @Post('templates/:id/activate')
  @OmnichannelMinRole('OWNER')
  @RequiresGoRef()
  @ApiOperation({ summary: 'فعال‌سازی نسخه قالب این مقصد (Owner+goRef)' })
  activateTemplate(
    @Param('id') id: string,
    @Body() body: ActivateTemplateDto,
    @Req() req: Authed,
  ) {
    assertNoPlaintextSecrets({ id, ...body });
    return this.svc.activateTemplate(id, body, req.omnichannelActor);
  }

  @Post('preview')
  @OmnichannelMinRole('PUBLISHER')
  preview(@Body() body: PreviewDto) {
    assertNoPlaintextSecrets(body);
    return this.svc.preview(body);
  }

  @Get('composer/products')
  @OmnichannelMinRole('PUBLISHER')
  @ApiOperation({ summary: 'جستجوی محصول برای ویزارد انتشار (حداکثر ۲۰)' })
  composerProducts(
    @Query('q') q?: string,
    @Query('channel') channel?: string,
    @Query('limit') limit?: string,
  ) {
    return this.composer.searchProducts({ q, channel, limit });
  }

  @Post('composer/plan')
  @OmnichannelMinRole('PUBLISHER')
  @ApiOperation({ summary: 'برنامه خشک انتشار (dedupe از liveRemote؛ بدون adapter)' })
  composerPlan(@Body() body: ComposerPlanDto) {
    assertNoPlaintextSecrets(body);
    return this.composer.plan(body);
  }

  @Post('publications')
  @OmnichannelMinRole('PUBLISHER')
  createPublication(@Body() body: CreatePublicationDto, @Req() req: Authed) {
    assertNoPlaintextSecrets(body);
    return this.svc.createPublication(body, req.omnichannelActor);
  }

  @Get('publications')
  listPublications(
    @Query('destinationId') destinationId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    return this.svc.listPublications({ destinationId, page, limit, q });
  }

  @Get('deliveries')
  listDeliveries(@Query('destinationId') destinationId?: string) {
    return this.svc.listDeliveries(destinationId);
  }

  @Get('outbox')
  listOutbox(
    @Query('destinationId') destinationId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listOutbox({ destinationId, page, limit });
  }

  @Post('outbox/clear-waiting')
  @OmnichannelMinRole('OWNER')
  @RequiresGoRef()
  @ApiOperation({ summary: 'خالی کردن کل صف انتظار (لغو نرم؛ بدون حذف ردیف)' })
  clearWaitingOutbox(@Body() body: ClearWaitingOutboxDto, @Req() req: Authed) {
    assertNoPlaintextSecrets(body);
    return this.svc.clearWaitingOutbox(body, req.omnichannelActor);
  }

  @Post('outbox/revive-connector-disabled')
  @OmnichannelMinRole('OWNER')
  @RequiresGoRef()
  @ApiOperation({ summary: 'بازتلاش رویدادهای متوقف که فقط به‌خاطر خاموشی کانکتور مرده بودند' })
  reviveConnectorDisabled(@Body() body: ReviveConnectorDisabledDto, @Req() req: Authed) {
    assertNoPlaintextSecrets(body);
    return this.svc.reviveConnectorDisabledDead(body, req.omnichannelActor);
  }

  @Post('publications/requeue-by-category')
  @OmnichannelMinRole('PUBLISHER')
  @ApiOperation({ summary: 'ارسال مجدد همه محصولات یک دسته به کانال‌های آماده (dryRun=PUBLISHER؛ زنده=Owner)' })
  requeueByCategory(@Body() body: RequeueByCategoryDto, @Req() req: Authed) {
    assertNoPlaintextSecrets(body);
    if (body?.dryRun !== true) {
      const role = req.omnichannelActor?.omnichannelRole || 'VIEWER';
      if (!roleMeetsMinimum(role, 'OWNER')) {
        throw new ForbiddenException('ارسال زندهٔ دسته فقط برای نقش Owner مجاز است');
      }
    }
    return this.svc.requeueByCategory(body, req.omnichannelActor);
  }

  @Get('audits')
  listAudits(
    @Query('destinationId') destinationId?: string,
    @Query('source') source?: string,
  ) {
    return this.svc.listAudits(destinationId, source);
  }

  @Get('coverage')
  @OmnichannelMinRole('VIEWER')
  @ApiOperation({ summary: 'ماتریس پوشش محصول × کانال (خلاصه + صفحه)' })
  listCoverage(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('filter') filter?: string,
    @Query('channel') channel?: string,
  ) {
    return this.coverage.listCoverage({ page, limit, q, filter, channel });
  }

  @Get('coverage/duplicates')
  @OmnichannelMinRole('VIEWER')
  @ApiOperation({ summary: 'فهرست تخت تکرارها (REQ-E4 / پذیرش ۹ بله)' })
  listCoverageDuplicates(@Query('channel') channel?: string) {
    return this.coverage.listDuplicates(channel);
  }

  @Post('coverage/out-of-panel/ingest')
  @OmnichannelMinRole('OWNER')
  @RequiresGoRef()
  @ApiOperation({ summary: 'ورود دستی رخداد خارج از پنل (Owner+goRef؛ فقط audit)' })
  ingestOutOfPanel(@Body() body: OutOfPanelIngestDto, @Req() req: Authed) {
    assertNoPlaintextSecrets(body);
    return this.coverage.ingestOutOfPanel(body, req.omnichannelActor || { id: '' });
  }

  @Get('coverage/:productId')
  @OmnichannelMinRole('VIEWER')
  @ApiOperation({ summary: 'جزئیات پوشش یک محصول' })
  getCoverageDetail(
    @Param('productId') productId: string,
    @Query('channel') channel?: string,
  ) {
    return this.coverage.getCoverageDetail(productId, channel);
  }

  @Put('coverage/:productId/absence-reason')
  @OmnichannelMinRole('PUBLISHER')
  @ApiOperation({ summary: 'ثبت دلیل عدم‌پوشش' })
  setAbsenceReason(
    @Param('productId') productId: string,
    @Body() body: CoverageAbsenceReasonDto,
    @Req() req: Authed,
  ) {
    assertNoPlaintextSecrets(body);
    return this.coverage.setAbsenceReason(productId, body, req.omnichannelActor || { id: '' });
  }

  @Post('deliveries/:id/retry')
  @OmnichannelMinRole('PUBLISHER')
  retryDelivery(@Param('id') id: string, @Body() body: ActorReasonDto, @Req() req: Authed) {
    return this.svc.retryDelivery(id, req.omnichannelActor, body.reason);
  }

  @Post('deliveries/:id/reapprove')
  @OmnichannelMinRole('OWNER')
  @ApiOperation({ summary: 'تأیید مجدد ارسال متوقف‌شده (HOLD)' })
  reapproveDelivery(@Param('id') id: string, @Body() body: ActorReasonDto, @Req() req: Authed) {
    return this.svc.reapproveDelivery(id, req.omnichannelActor, body.reason);
  }

  @Get('deliveries/:deliveryId/delete-plan')
  @OmnichannelMinRole('VIEWER')
  @ApiOperation({ summary: 'پیش‌نمایش حذف پیام (backup + هشدار Bale ۴۸س)' })
  deletePlan(@Param('deliveryId') deliveryId: string) {
    return this.deletes.deletePlan(deliveryId);
  }

  @Post('deliveries/:deliveryId/messages/delete')
  @OmnichannelMinRole('OWNER')
  @RequiresGoRef()
  @ApiOperation({ summary: 'حذف پیام‌های ارسال (Owner+goRef وقتی RBAC؛ تأیید SKU)' })
  deleteMessages(
    @Param('deliveryId') deliveryId: string,
    @Body() body: DeleteDeliveryMessagesDto,
    @Req() req: Authed,
  ) {
    assertNoPlaintextSecrets(body);
    return this.deletes.deleteMessages(deliveryId, body, req.omnichannelActor || { id: '' });
  }

  @Post('deliveries/:deliveryId/edit')
  @OmnichannelMinRole('PUBLISHER')
  @ApiOperation({ summary: 'ویرایش کپشن همان messageId (Publisher+)' })
  editDelivery(
    @Param('deliveryId') deliveryId: string,
    @Body() body: EditDeliveryDto,
    @Req() req: Authed,
  ) {
    assertNoPlaintextSecrets(body);
    return this.edits.edit(deliveryId, body, req.omnichannelActor || { id: '' });
  }

  @Post('deliveries/:deliveryId/revert')
  @OmnichannelMinRole('PUBLISHER')
  @ApiOperation({ summary: 'بازگردانی کپشن از post_backup' })
  revertDelivery(
    @Param('deliveryId') deliveryId: string,
    @Body() body: RevertDeliveryDto,
    @Req() req: Authed,
  ) {
    assertNoPlaintextSecrets(body);
    return this.edits.revert(deliveryId, body, req.omnichannelActor || { id: '' });
  }

  @Post('publications/bulk-withdraw')
  @OmnichannelMinRole('OWNER')
  @RequiresGoRef()
  @ApiOperation({ summary: 'برداشتن گروهی انتشارها از کانال با backup قبل از DELETE' })
  bulkWithdrawPublications(
    @Body() body: BulkWithdrawPublicationsDto,
    @Req() req: Authed,
  ) {
    assertNoPlaintextSecrets(body);
    return this.svc.bulkWithdraw(body.ids, req.omnichannelActor, body.reason, body.goRef);
  }

  @Post('publications/:id/withdraw')
  @OmnichannelMinRole('OWNER')
  @RequiresGoRef()
  @ApiOperation({ summary: 'برداشت انتشار با backup قبل از DELETE (Owner+goRef)' })
  withdraw(@Param('id') id: string, @Body() body: ActorReasonDto, @Req() req: Authed) {
    assertNoPlaintextSecrets(body);
    return this.svc.withdraw(id, req.omnichannelActor, body.reason, body.goRef);
  }

  @Post('reconcile')
  @OmnichannelMinRole('OWNER')
  @RequiresGoRef()
  reconcile(@Body() body: ActorReasonDto, @Req() req: Authed) {
    return this.svc.reconcile(req.omnichannelActor, body.reason, body.goRef);
  }

  @Post('media/assert-deletable')
  @OmnichannelMinRole('PUBLISHER')
  assertMediaDeletable(@Body() body: { url: string }) {
    return this.svc.assertMediaDeletable(String(body?.url || ''));
  }

  @Post('media/validate')
  @OmnichannelMinRole('PUBLISHER')
  @ApiOperation({ summary: 'اعتبارسنجی تصویر کانال (EOI/decode/size) — بدون adapter' })
  validateMedia(@Body() body: ValidateMediaDto) {
    assertNoPlaintextSecrets(body);
    return this.media.validate(body);
  }

  @Post('media/scan')
  @OmnichannelMinRole('PUBLISHER')
  @ApiOperation({ summary: 'اسکن تکه‌ای سلامت رسانه رجیستری — بدون ارسال زنده' })
  scanMedia(@Body() body: ScanMediaDto, @Req() req: Authed) {
    assertNoPlaintextSecrets(body);
    return this.media.scan(body || {}, req.omnichannelActor);
  }

  @Get('media/health')
  @OmnichannelMinRole('VIEWER')
  @ApiOperation({ summary: 'خلاصه آخرین اسکن سلامت رسانه' })
  mediaHealth() {
    return this.media.health();
  }

  @Post('media/:id/mark-needs-replace')
  @OmnichannelMinRole('PUBLISHER')
  @ApiOperation({ summary: 'علامت نیاز به جایگزینی تصویر (بدون حذف خودکار)' })
  markMediaNeedsReplace(
    @Param('id') id: string,
    @Body() body: MarkMediaNeedsReplaceDto,
    @Req() req: Authed,
  ) {
    assertNoPlaintextSecrets(body);
    return this.media.markNeedsReplace(id, req.omnichannelActor, body?.reason);
  }

  @Get('media')
  listMedia(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.media.listMedia({ page, limit });
  }

  @Patch('media/:id')
  @OmnichannelMinRole('PUBLISHER')
  patchMedia(@Param('id') id: string, @Body() body: PatchMediaAltDto, @Req() req: Authed) {
    return this.svc.patchMediaAlt(id, body.altText, req.omnichannelActor);
  }
}
