import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SalesPartnerNoticeReceiptEntity } from './entities/sales-partner-notice-receipt.entity';
import { SalesPartnerNoticeEntity } from './entities/sales-partner-notice.entity';
import { SalesPartnerProfileEntity } from './entities/sales-partner-profile.entity';
import {
  noticeIsVisible,
  pickNoticeBanner,
  prepareSalesPartnerNotice,
  type NoticeDraftInput,
  type NoticeTone,
} from './sales-partner-notice-policy';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PartnerNotice = {
  id: string;
  title: string;
  body: string;
  linkLabel: string | null;
  linkUrl: string | null;
  tone: NoticeTone;
  publishedAt: string;
  expiresAt: string | null;
  seen: boolean;
  dismissed: boolean;
};

@Injectable()
export class SalesPartnerNoticeService {
  constructor(
    @InjectRepository(SalesPartnerNoticeEntity)
    private readonly notices: Repository<SalesPartnerNoticeEntity>,
    @InjectRepository(SalesPartnerNoticeReceiptEntity)
    private readonly receipts: Repository<SalesPartnerNoticeReceiptEntity>,
    @InjectRepository(SalesPartnerProfileEntity)
    private readonly profiles: Repository<SalesPartnerProfileEntity>,
  ) {}

  async publish(actorUserId: string, raw: NoticeDraftInput) {
    const now = new Date();
    const prepared = prepareSalesPartnerNotice(raw, now);
    if (prepared.ok === false) throw new BadRequestException(prepared.error);
    const audienceCount = await this.profiles.count({ where: { status: 'ACTIVE' } });
    const row = await this.notices.save(
      this.notices.create({
        ...prepared.value,
        audienceCount,
        publishedAt: now,
        archivedAt: null,
        createdByUserId: actorUserId || null,
      }),
    );
    return this.toAdmin(row, 0, 0);
  }

  async listAdmin() {
    const rows = await this.notices.find({ order: { publishedAt: 'DESC' }, take: 40 });
    const counts = await this.receiptCounts(rows.map((row) => row.id));
    return rows.map((row) => this.toAdmin(row, counts.get(row.id)?.seen ?? 0, counts.get(row.id)?.dismissed ?? 0));
  }

  async archive(id: string) {
    const row = await this.notices.findOne({ where: { id: this.requireUuid(id) } });
    if (!row) throw new NotFoundException('اطلاعیه پیدا نشد');
    if (!row.archivedAt) {
      row.archivedAt = new Date();
      await this.notices.save(row);
    }
    const counts = await this.receiptCounts([row.id]);
    return this.toAdmin(row, counts.get(row.id)?.seen ?? 0, counts.get(row.id)?.dismissed ?? 0);
  }

  async feed(salesPartnerId: string) {
    const now = new Date();
    const rows = await this.notices
      .createQueryBuilder('n')
      .where('n."archivedAt" IS NULL')
      .andWhere('n."publishedAt" <= :now', { now })
      .andWhere('(n."expiresAt" IS NULL OR n."expiresAt" > :now)', { now })
      .orderBy('n.publishedAt', 'DESC')
      .take(30)
      .getMany();
    const visible = rows.filter((row) => noticeIsVisible(row, now));
    const receipts = visible.length
      ? await this.receipts.find({
          where: { salesPartnerId, noticeId: In(visible.map((row) => row.id)) },
        })
      : [];
    const byNotice = new Map(receipts.map((receipt) => [receipt.noticeId, receipt]));
    const items: PartnerNotice[] = visible.map((row) => {
      const receipt = byNotice.get(row.id);
      return {
        ...this.toPartner(row),
        seen: Boolean(receipt?.seenAt),
        dismissed: Boolean(receipt?.dismissedAt),
      };
    });
    return {
      banner: pickNoticeBanner(items),
      items,
      unseenCount: items.filter((item) => !item.seen && !item.dismissed).length,
    };
  }

  async markSeen(salesPartnerId: string, noticeId: string) {
    await this.requireVisible(noticeId);
    await this.touchReceipt(salesPartnerId, noticeId, false);
    return { ok: true };
  }

  async dismiss(salesPartnerId: string, noticeId: string) {
    await this.requireVisible(noticeId);
    await this.touchReceipt(salesPartnerId, noticeId, true);
    return { ok: true };
  }

  private async touchReceipt(salesPartnerId: string, noticeId: string, dismiss: boolean) {
    const now = new Date();
    await this.receipts
      .createQueryBuilder()
      .insert()
      .into(SalesPartnerNoticeReceiptEntity)
      .values({
        salesPartnerId,
        noticeId,
        seenAt: now,
        dismissedAt: dismiss ? now : null,
      })
      .orIgnore()
      .execute();
    if (dismiss) {
      await this.receipts.update({ salesPartnerId, noticeId }, { dismissedAt: now });
    }
  }

  private async requireVisible(noticeId: string) {
    const row = await this.notices.findOne({ where: { id: this.requireUuid(noticeId) } });
    if (!row || !noticeIsVisible(row, new Date())) {
      throw new NotFoundException('این اطلاعیه در دسترس نیست');
    }
    return row;
  }

  private async receiptCounts(ids: string[]) {
    const map = new Map<string, { seen: number; dismissed: number }>();
    if (!ids.length) return map;
    const rows = await this.receipts.find({
      where: { noticeId: In(ids) },
      select: { noticeId: true, dismissedAt: true },
    });
    for (const row of rows) {
      const current = map.get(row.noticeId) ?? { seen: 0, dismissed: 0 };
      current.seen += 1;
      if (row.dismissedAt) current.dismissed += 1;
      map.set(row.noticeId, current);
    }
    return map;
  }

  private toPartner(row: SalesPartnerNoticeEntity) {
    const tone: NoticeTone = row.tone === 'urgent' || row.tone === 'important' ? row.tone : 'info';
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      linkLabel: row.linkUrl ? row.linkLabel || 'مشاهده' : null,
      linkUrl: row.linkUrl,
      tone,
      publishedAt: row.publishedAt.toISOString(),
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    };
  }

  private toAdmin(row: SalesPartnerNoticeEntity, seenCount: number, dismissedCount: number) {
    return {
      ...this.toPartner(row),
      audience: 'ACTIVE' as const,
      audienceCount: row.audienceCount,
      seenCount,
      dismissedCount,
      archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    };
  }

  private requireUuid(id: string) {
    if (!UUID_RE.test(id)) throw new NotFoundException('اطلاعیه پیدا نشد');
    return id;
  }
}
