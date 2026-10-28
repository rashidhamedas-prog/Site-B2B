/**
 * PR-9 Composer: product search + dry plan orchestration.
 * Always dry for plan — loads liveRemote for dedupe with zero adapter calls.
 */
import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { ProductEntity } from '../../product/entities/product.entity';
import { ChannelConnectionEntity } from '../entities/channel-connection.entity';
import { ChannelDestinationEntity } from '../entities/channel-destination.entity';
import {
  assertComposerSendAllowed,
  buildComposerPlan,
  type ComposerDestinationMeta,
  type ComposerSendMode,
} from '../composer-plan';
import type { ComposerPlanDto } from '../dto/omnichannel.dto';
import { isOmnichannelProvider } from '../omnichannel.constants';
import { destinationCanPost, isCanarySettings } from '../oos-policy';
import { resolveDestinationPublishSettings } from '../destination-publish-settings';
import { OmnichannelService } from './omnichannel.service';

const SEARCH_LIMIT_MAX = 20;

@Injectable()
export class OmnichannelComposerService {
  constructor(
    private readonly omni: OmnichannelService,
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    @InjectRepository(ChannelDestinationEntity)
    private readonly destinations: Repository<ChannelDestinationEntity>,
    @InjectRepository(ChannelConnectionEntity)
    private readonly connections: Repository<ChannelConnectionEntity>,
  ) {}

  async searchProducts(query: {
    q?: string;
    channel?: string;
    limit?: number | string;
  }): Promise<{
    items: Array<{
      id: string;
      sku: string;
      name: string;
      thumbnailUrl: string | null;
      available: boolean;
    }>;
  }> {
    const channel = String(query.channel || '').toUpperCase();
    if (channel !== 'RETAIL' && channel !== 'WHOLESALE') {
      throw new BadRequestException('channel باید RETAIL یا WHOLESALE باشد');
    }
    const limit = Math.min(
      SEARCH_LIMIT_MAX,
      Math.max(1, Number(query.limit) || SEARCH_LIMIT_MAX),
    );
    const q = String(query.q || '').trim();
    const where = q
      ? [
          { sku: ILike(`%${escapeLike(q)}%`) },
          { name: ILike(`%${escapeLike(q)}%`) },
        ]
      : {};
    const rows = await this.products.find({
      where: where as never,
      select: ['id', 'sku', 'name', 'images', 'wholesaleStock', 'retailStock', 'status'],
      order: { sku: 'ASC' },
      take: limit,
    });
    return {
      items: rows.map((row) => {
        const stock = channel === 'WHOLESALE' ? row.wholesaleStock : row.retailStock;
        return {
          id: row.id,
          sku: row.sku,
          name: row.name,
          thumbnailUrl: firstImage(row.images),
          available: row.status === 'ACTIVE' && Number(stock) > 0,
        };
      }),
    };
  }

  /**
   * Always dry. Loads liveRemote + pending for dedupe. Never calls adapters.
   */
  async plan(dto: ComposerPlanDto) {
    const destinationIds = Array.isArray(dto.destinationIds)
      ? [...new Set(dto.destinationIds.map((id) => String(id).trim()).filter(Boolean))]
      : [];
    if (!destinationIds.length) {
      throw new BadRequestException('حداقل یک مقصد انتخاب کنید');
    }
    const sendMode = normalizeSendMode(dto.options?.sendMode);
    const scheduledAt = parseScheduledAt(dto.options?.scheduledAt);
    const preview = await this.omni.preview({
      ...dto.preview,
      destinationId: destinationIds[0],
    });
    const projection = preview.projection as {
      channel?: string;
      sourceType?: string;
      sourceId?: string;
      publishable?: boolean;
      rejectReason?: string | null;
    };
    if (projection.publishable === false) {
      throw new BadRequestException(projection.rejectReason || 'این منبع برای این کانال قابل انتشار نیست');
    }
    const channel = projection.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
    const sourceType = String(projection.sourceType || dto.preview.sourceType || 'PRODUCT');
    const sourceId = String(projection.sourceId || dto.preview.sourceId || '');

    const { liveRemote, pendingCreates } = await this.omni.loadComposerDedupeContext(
      sourceType,
      sourceId,
      channel,
    );

    const destRows = await this.destinations.find({
      where: { id: In(destinationIds), enabled: true },
    });
    if (destRows.length !== destinationIds.length) {
      throw new BadRequestException('یکی از مقصدها یافت نشد یا غیرفعال است');
    }
    const conns = await this.connections.find();
    const connById = new Map(conns.map((c) => [c.id, c]));
    const global = await this.omni.loadComposerStoredSettings();

    const metas: ComposerDestinationMeta[] = [];
    for (const destId of destinationIds) {
      const dest = destRows.find((d) => d.id === destId)!;
      const conn = connById.get(dest.connectionId);
      if (!conn || !isOmnichannelProvider(conn.provider) || conn.channel !== channel) {
        throw new BadRequestException('این مقصد به کانال فروش انتخاب‌شده تعلق ندارد');
      }
      if (conn.status !== 'ACTIVE') {
        throw new BadRequestException('ابتدا اتصال را روشن کنید');
      }
      if (!isCanarySettings(dest.settings) && !destinationCanPost(dest.settings)) {
        throw new BadRequestException('این مقصد هنوز بررسی نشده؛ اول «بررسی دسترسی ربات» را بزنید');
      }
      const resolved = resolveDestinationPublishSettings(
        dest.publishSettings,
        conn.publishSettings,
        global as never,
        channel,
      );
      const counters = await this.omni.composerCountersForDestination(dest.id, channel);
      const captionOverride = dto.options?.captionOverrides?.[dest.id];
      let renderedPreview = '';
      try {
        const per = await this.omni.preview({
          ...dto.preview,
          destinationId: dest.id,
          channel,
        });
        const text = String((per.rendered as { text?: string } | undefined)?.text || '');
        renderedPreview = typeof captionOverride === 'string' && captionOverride.trim()
          ? captionOverride.trim().slice(0, 4096)
          : text.slice(0, 4096);
      } catch {
        renderedPreview = typeof captionOverride === 'string' ? captionOverride.slice(0, 4096) : '';
      }
      metas.push({
        destinationId: dest.id,
        channel,
        provider: conn.provider,
        renderedPreview,
        quietStartHour: resolved.automation.quietStartHour,
        quietEndHour: resolved.automation.quietEndHour,
        sentToday: counters.sentToday,
        dailyCap: resolved.automation.dailyCap,
        lastScheduledAt: counters.lastScheduledAt,
        minGapSeconds: resolved.automation.minGapSeconds,
      });
    }

    const plan = buildComposerPlan({
      destinations: metas,
      liveRemote,
      pendingCreates,
      sendMode,
      scheduledAt,
    });

    // Plan endpoint never enqueues; surface quietConflict for UI. Live createPublication asserts.
    void assertComposerSendAllowed;
    return {
      dryRun: true,
      plan,
      includePriceDefaults: Object.fromEntries(
        destinationIds.map((id) => [id, dto.options?.includePrice?.[id] === true]),
      ),
    };
  }
}

function normalizeSendMode(value: unknown): ComposerSendMode {
  if (value === 'now' || value === 'scheduled' || value === 'next_slot') return value;
  return 'next_slot';
}

function parseScheduledAt(raw: unknown): Date | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

function firstImage(images: string[] | null | undefined): string | null {
  if (!Array.isArray(images) || !images.length) return null;
  const url = String(images[0] || '').trim();
  return url || null;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
