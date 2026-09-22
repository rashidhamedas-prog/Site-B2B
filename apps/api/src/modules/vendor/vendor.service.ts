import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { UserEntity } from '../auth/entities/user.entity';
import { VendorEntity } from './entities/vendor.entity';
import { InviteVendorDto } from './dto/invite-vendor.dto';
import { PatchVendorDto } from './dto/patch-vendor.dto';
import {
  EMPTY_VENDOR_USAGE,
  VENDOR_ROLE,
  canVendorLogin,
  parseAcceptSlaHours,
  parseSettlementHoldDays,
  parseVendorName,
  toPublicVendor,
  vendorOwnsResource,
  vendorRemovalBlockers,
  type VendorUsage,
} from './vendor-policy';

@Injectable()
export class VendorService {
  constructor(
    @InjectRepository(VendorEntity)
    private readonly vendorRepo: Repository<VendorEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findByUserId(userId: string): Promise<VendorEntity | null> {
    return this.vendorRepo.findOne({ where: { userId } });
  }

  async list() {
    const rows = await this.vendorRepo.find({ order: { createdAt: 'DESC' }, take: 200 });
    const usage = await this.usageByVendor(rows.map((row) => row.id));
    return {
      data: rows.map((row) => ({
        ...toPublicVendor(row),
        usage: usage.get(row.id) ?? { ...EMPTY_VENDOR_USAGE },
      })),
    };
  }

  async getByIdForAdmin(id: string) {
    const row = await this.vendorRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('همکار پیدا نشد');
    const usage = await this.usageByVendor([id]);
    return { ...toPublicVendor(row), usage: usage.get(id) ?? { ...EMPTY_VENDOR_USAGE } };
  }

  async getMe(userId: string, actorVendorId?: string) {
    const row = await this.findByUserId(userId);
    if (!row) throw new NotFoundException('حساب همکار پیدا نشد');
    if (!vendorOwnsResource(actorVendorId, row.id)) {
      throw new ForbiddenException('دسترسی غیرمجاز');
    }
    return toPublicVendor(row);
  }

  async invite(dto: InviteVendorDto) {
    let name: string;
    let acceptSlaHours: number;
    let settlementHoldDays: number;
    try {
      name = parseVendorName(dto.name);
      acceptSlaHours = parseAcceptSlaHours(dto.acceptSlaHours);
      settlementHoldDays = parseSettlementHoldDays(dto.settlementHoldDays);
    } catch (err) {
      throw new BadRequestException(this.policyMessage(err));
    }

    const existing = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (existing) throw new ConflictException('این شماره قبلاً ثبت شده است');

    const initialPassword = randomBytes(12).toString('base64url');
    const passwordHash = await bcrypt.hash(initialPassword, 12);

    const saved = await this.dataSource.transaction(async (manager) => {
      const users = manager.getRepository(UserEntity);
      const vendors = manager.getRepository(VendorEntity);
      const user = await users.save(
        users.create({
          phone: dto.phone,
          passwordHash,
          role: VENDOR_ROLE,
          isActive: true,
        }),
      );
      const vendor = await vendors.save(
        vendors.create({
          name,
          phone: dto.phone,
          userId: user.id,
          status: 'INVITED',
          acceptSlaHours,
          settlementHoldDays,
          notes: dto.notes?.trim() || null,
          invitedAt: new Date(),
        }),
      );
      return vendor;
    });

    return {
      vendor: toPublicVendor(saved),
      initialPassword,
    };
  }

  async patch(id: string, dto: PatchVendorDto) {
    const row = await this.vendorRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('همکار پیدا نشد');

    if (dto.name !== undefined) {
      try {
        row.name = parseVendorName(dto.name);
      } catch {
        throw new BadRequestException('نام همکار معتبر نیست');
      }
    }
    if (dto.acceptSlaHours !== undefined) {
      try {
        row.acceptSlaHours = parseAcceptSlaHours(dto.acceptSlaHours);
      } catch {
        throw new BadRequestException('مهلت قبول سفارش باید بین ۱ تا ۱۶۸ ساعت باشد');
      }
    }
    if (dto.settlementHoldDays !== undefined) {
      try {
        row.settlementHoldDays = parseSettlementHoldDays(dto.settlementHoldDays);
      } catch {
        throw new BadRequestException('hold تسویه باید بین ۰ تا ۹۰ روز باشد');
      }
    }
    if (dto.notes !== undefined) {
      row.notes = dto.notes.trim() || null;
    }
    if (dto.status !== undefined) {
      row.status = dto.status;
    }

    const nextPhone = dto.phone !== undefined && dto.phone !== row.phone ? dto.phone : undefined;
    if (nextPhone) {
      const takenUser = await this.userRepo.findOne({ where: { phone: nextPhone } });
      if (takenUser && takenUser.id !== row.userId) {
        throw new ConflictException('این شماره قبلاً ثبت شده است');
      }
      const takenVendor = await this.vendorRepo.findOne({ where: { phone: nextPhone } });
      if (takenVendor && takenVendor.id !== row.id) {
        throw new ConflictException('این شماره قبلاً ثبت شده است');
      }
      row.phone = nextPhone;
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        const users = manager.getRepository(UserEntity);
        await manager.getRepository(VendorEntity).save(row);
        if (nextPhone || dto.status !== undefined) {
          const user = await users.findOne({ where: { id: row.userId } });
          if (user) {
            if (nextPhone) user.phone = nextPhone;
            if (dto.status !== undefined) user.isActive = canVendorLogin(dto.status);
            await users.save(user);
          }
        }
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) throw new ConflictException('این شماره قبلاً ثبت شده است');
      throw err;
    }

    const usage = await this.usageByVendor([row.id]);
    return { ...toPublicVendor(row), usage: usage.get(row.id) ?? { ...EMPTY_VENDOR_USAGE } };
  }

  async remove(id: string) {
    const row = await this.vendorRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('همکار پیدا نشد');

    const usage = (await this.usageByVendor([id])).get(id) ?? { ...EMPTY_VENDOR_USAGE };
    const blockers = vendorRemovalBlockers(usage);
    if (blockers.length > 0) {
      throw new ConflictException(
        `حذف ممکن نیست؛ این همکار ${blockers.join('، ')} دارد. برای قطع دسترسی، همکار را معلق کنید.`,
      );
    }

    const user = await this.userRepo.findOne({ where: { id: row.userId } });
    if (user && user.role !== VENDOR_ROLE) {
      throw new ConflictException('حساب ورود این همکار نقش دیگری دارد و حذف نمی‌شود. همکار را معلق کنید.');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(VendorEntity).delete({ id: row.id });
      if (user) await manager.getRepository(UserEntity).delete({ id: user.id });
    });

    return { deleted: true, id: row.id };
  }

  async rotatePassword(id: string) {
    const row = await this.vendorRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('همکار پیدا نشد');
    const user = await this.userRepo.findOne({ where: { id: row.userId } });
    if (!user) throw new NotFoundException('حساب همکار پیدا نشد');
    const initialPassword = randomBytes(12).toString('base64url');
    user.passwordHash = await bcrypt.hash(initialPassword, 12);
    user.passwordChangedAt = new Date();
    await this.userRepo.save(user);
    return { vendor: toPublicVendor(row), initialPassword };
  }

  private async usageByVendor(ids: string[]): Promise<Map<string, VendorUsage>> {
    const map = new Map<string, VendorUsage>();
    for (const id of ids) map.set(id, { ...EMPTY_VENDOR_USAGE });
    if (ids.length === 0) return map;

    const tables = [
      ['products', 'productCount'],
      ['fulfillment_orders', 'fulfillmentCount'],
      ['order_items', 'orderItemCount'],
      ['vendor_ledger_entries', 'ledgerCount'],
    ] as const;

    await Promise.all(
      tables.map(async ([table, key]) => {
        const rows: Array<{ id: string; n: number | string }> = await this.dataSource.query(
          `SELECT "vendorId" AS id, COUNT(*)::int AS n FROM ${table} WHERE "vendorId" = ANY($1::uuid[]) GROUP BY "vendorId"`,
          [ids],
        );
        for (const hit of rows) {
          const current = map.get(hit.id);
          if (current) current[key] = Number(hit.n) || 0;
        }
      }),
    );
    return map;
  }

  private isUniqueViolation(err: unknown): boolean {
    const e = (err ?? {}) as { code?: string; driverError?: { code?: string } };
    return e.code === '23505' || e.driverError?.code === '23505';
  }

  private policyMessage(err: unknown): string {
    const code = err instanceof Error ? err.message : '';
    if (code === 'INVALID_SLA') return 'مهلت قبول سفارش باید بین ۱ تا ۱۶۸ ساعت باشد';
    if (code === 'INVALID_HOLD') return 'hold تسویه باید بین ۰ تا ۹۰ روز باشد';
    if (code === 'INVALID_NAME') return 'نام همکار معتبر نیست';
    return 'اطلاعات همکار معتبر نیست';
  }
}
