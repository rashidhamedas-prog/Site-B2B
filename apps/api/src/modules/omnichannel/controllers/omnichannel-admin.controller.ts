import {
  Body, Controller, Get, Param, Patch, Post, Req, UseGuards,
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
} from '../dto/omnichannel.dto';
import { assertNoPlaintextSecrets } from '../omnichannel-secrets';
import {
  areOmnichannelConnectorsEnabled,
  isOmnichannelAutoPublishEnabled,
} from '../omnichannel.constants';

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
    const settings = await this.svc.getSettings();
    return {
      autoPublish: isOmnichannelAutoPublishEnabled(),
      connectors: areOmnichannelConnectorsEnabled(),
      phase: 8,
      retailCanaryLimit: 10,
      wholesaleCanaryLimit: 10,
      outbox: await this.svc.outboxMetrics(),
      ...settings,
    };
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

  @Get('templates')
  listTemplates() {
    return this.svc.listTemplates();
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
