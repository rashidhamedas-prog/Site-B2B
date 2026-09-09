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
  VENDOR_ROLE,
  canVendorLogin,
  parseAcceptSlaHours,
  parseSettlementHoldDays,
  parseVendorName,
  toPublicVendor,
  vendorOwnsResource,
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
    return { data: rows.map(toPublicVendor) };
  }

  async getByIdForAdmin(id: string) {
    const row = await this.vendorRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('همکار پیدا نشد');
    return toPublicVendor(row);
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
      const user = await this.userRepo.findOne({ where: { id: row.userId } });
      if (user) {
        user.isActive = canVendorLogin(dto.status);
        await this.userRepo.save(user);
      }
    }
    await this.vendorRepo.save(row);
    return toPublicVendor(row);
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

  private policyMessage(err: unknown): string {
    const code = err instanceof Error ? err.message : '';
    if (code === 'INVALID_SLA') return 'مهلت قبول سفارش باید بین ۱ تا ۱۶۸ ساعت باشد';
    if (code === 'INVALID_HOLD') return 'hold تسویه باید بین ۰ تا ۹۰ روز باشد';
    if (code === 'INVALID_NAME') return 'نام همکار معتبر نیست';
    return 'اطلاعات همکار معتبر نیست';
  }
}
