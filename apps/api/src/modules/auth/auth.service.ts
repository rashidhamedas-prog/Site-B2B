import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomInt } from 'crypto';
import { UserEntity } from './entities/user.entity';
import { CustomerEntity } from '../customer/entities/customer.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { NotificationService } from '../notification/notification.service';

/** True when the DB rejected an insert because the customer `code` already exists. */
function isDuplicateCodeError(err: unknown): boolean {
  const e = (err ?? {}) as {
    code?: string;
    detail?: string;
    driverError?: { code?: string; detail?: string };
  };
  const code = e.code ?? e.driverError?.code;
  const detail = e.detail ?? e.driverError?.detail ?? '';
  return code === '23505' && /\(code\)/i.test(detail);
}

function isDuplicatePhoneError(err: unknown): boolean {
  const e = (err ?? {}) as {
    code?: string;
    detail?: string;
    driverError?: { code?: string; detail?: string };
  };
  const code = e.code ?? e.driverError?.code;
  const detail = e.detail ?? e.driverError?.detail ?? '';
  return code === '23505' && /\(phone\)/i.test(detail);
}

function normalizePhone(raw: string): string {
  const digits = String(raw || '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '');
  if (digits.startsWith('98') && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith('9')) return `0${digits}`;
  return digits;
}

type OtpEntry = { code: string; expiresAt: number; attempts: number; name?: string };

@Injectable()
export class AuthService {
  private readonly otpStore = new Map<string, OtpEntry>();

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(CustomerEntity)
    private readonly customerRepo: Repository<CustomerEntity>,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
    @Optional() private readonly notifications?: NotificationService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.userRepo.findOne({
      where: { phone: dto.phone },
      withDeleted: true,
    });
    const existingCustomer = await this.customerRepo.findOne({
      where: { phone: dto.phone },
      withDeleted: true,
    });

    if (existingCustomer && !existingCustomer.deletedAt) {
      throw new ConflictException('این شماره قبلاً ثبت شده است');
    }

    if (existingUser && !existingUser.deletedAt) {
      const linkedCustomer = existingUser.customerId
        ? await this.customerRepo.findOne({
            where: { id: existingUser.customerId },
            withDeleted: true,
          })
        : null;
      if (linkedCustomer && !linkedCustomer.deletedAt) {
        throw new ConflictException('این شماره قبلاً ثبت شده است');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const customerData: Partial<CustomerEntity> = {
      businessName: dto.businessName,
      ownerName: dto.ownerName,
      phone: dto.phone,
      email: dto.email,
      province: dto.province,
      city: dto.city,
      businessType: dto.businessType ?? 'RETAIL',
      notes: dto.notes,
      status: 'PENDING',
      segment: 'C',
    };

    try {
      return await this.dataSource.transaction(async (manager) => {
        const customerRepo = manager.getRepository(CustomerEntity);
        const userRepo = manager.getRepository(UserEntity);

        let savedCustomer: CustomerEntity;
        if (existingCustomer?.deletedAt) {
          // Reactivate a previously soft-deleted customer with the same phone,
          // reusing its code to avoid violating unique constraints.
          await customerRepo.restore(existingCustomer.id);
          await customerRepo.update(existingCustomer.id, customerData);
          savedCustomer = await customerRepo.findOneOrFail({ where: { id: existingCustomer.id } });
        } else {
          savedCustomer = await this.createCustomerWithUniqueCode(customerData, manager);
        }

        if (existingUser) {
          if (existingUser.deletedAt) {
            await userRepo.restore(existingUser.id);
          }
          await userRepo.update(existingUser.id, {
            email: dto.email,
            passwordHash,
            customerId: savedCustomer.id,
            isActive: false,
            role: 'CUSTOMER',
          });
        } else {
          const user = userRepo.create({
            phone: dto.phone,
            email: dto.email,
            passwordHash,
            role: 'CUSTOMER',
            customerId: savedCustomer.id,
            isActive: false,
          });
          await userRepo.save(user);
        }

        return { message: 'ثبت‌نام با موفقیت انجام شد. منتظر تأیید ادمین باشید.' };
      });
    } catch (err) {
      if (isDuplicatePhoneError(err) || isDuplicateCodeError(err)) {
        throw new ConflictException('این شماره قبلاً ثبت شده است');
      }
      throw err;
    }
  }

  /**
   * Generates the next sequential customer code (TRN-#####) based on the highest
   * existing code — including soft-deleted rows, whose unique code constraint is
   * still enforced — and retries on the rare concurrent-insert collision.
   */
  private async createCustomerWithUniqueCode(
    data: Partial<CustomerEntity>,
    manager?: EntityManager,
  ): Promise<CustomerEntity> {
    const customerRepo = manager
      ? manager.getRepository(CustomerEntity)
      : this.customerRepo;

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = await this.nextCustomerCode(customerRepo);
      try {
        return await customerRepo.save(customerRepo.create({ ...data, code }));
      } catch (err) {
        if (isDuplicateCodeError(err) && attempt < 4) continue;
        throw err;
      }
    }
    throw new ConflictException('امکان ایجاد کد مشتری نبود، دوباره تلاش کنید');
  }

  private async nextCustomerCode(
    repo: Repository<CustomerEntity> = this.customerRepo,
  ): Promise<string> {
    const rows = await repo
      .createQueryBuilder('c')
      .withDeleted()
      .select('c.code', 'code')
      .where("c.code ~ '^TRN-[0-9]+$'")
      .getRawMany<{ code: string }>();
    const max = rows.reduce((m, r) => {
      const n = parseInt(r.code.slice(4), 10);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    return `TRN-${String(max + 1).padStart(5, '0')}`;
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (!user) throw new UnauthorizedException('شماره یا رمز عبور اشتباه است');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('شماره یا رمز عبور اشتباه است');

    if (user.role === 'CUSTOMER') {
      const customer = user.customerId
        ? await this.customerRepo.findOne({ where: { id: user.customerId } })
        : null;

      if (!user.isActive || !customer || customer.status !== 'ACTIVE') {
        if (customer?.status === 'PENDING') {
          throw new UnauthorizedException(
            'حساب شما هنوز تأیید نشده است. منتظر تأیید ادمین باشید.',
          );
        }
        throw new UnauthorizedException(
          'حساب شما غیرفعال است. با پشتیبانی تماس بگیرید.',
        );
      }
    } else if (!user.isActive) {
      throw new UnauthorizedException('شماره یا رمز عبور اشتباه است');
    }

    user.lastLoginAt = new Date();
    await this.userRepo.save(user);

    const token = this.jwtService.sign({ sub: user.id, phone: user.phone, role: user.role });
    return { accessToken: token, role: user.role };
  }

  async findById(id: string) {
    return this.userRepo.findOne({ where: { id } });
  }

  async getMyProfile(user: { sub: string; role: string; phone: string }) {
    const u = await this.userRepo.findOne({ where: { id: user.sub } });
    if (!u) return null;
    if (u.customerId) {
      const customer = await this.customerRepo.findOne({ where: { id: u.customerId } });
      if (customer) {
        return {
          userId: u.id,
          phone: u.phone,
          role: u.role,
          businessName: customer.businessName,
          ownerName: customer.ownerName,
          segment: customer.segment,
          customerCode: customer.code,
          creditLimit: customer.creditLimit ?? 0,
          totalSpent: 0,
          lastLoginAt: u.lastLoginAt,
        };
      }
    }
    return { userId: u.id, phone: u.phone, role: u.role, lastLoginAt: u.lastLoginAt };
  }

  async updateMyProfile(userId: string, data: { ownerName?: string; email?: string }) {
    const u = await this.userRepo.findOne({ where: { id: userId } });
    if (!u) throw new UnauthorizedException();
    if (data.email) await this.userRepo.update(userId, { email: data.email });
    if (u.customerId && data.ownerName) {
      await this.customerRepo.update(u.customerId, { ownerName: data.ownerName });
    }
    return { message: 'پروفایل بروزرسانی شد' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const u = await this.userRepo.findOne({ where: { id: userId } });
    if (!u) throw new UnauthorizedException();
    const valid = await bcrypt.compare(currentPassword, u.passwordHash);
    if (!valid) throw new BadRequestException('رمز عبور فعلی اشتباه است');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.userRepo.update(userId, { passwordHash });
    return { message: 'رمز عبور با موفقیت تغییر یافت' };
  }

  /** Sync user.isActive when admin changes customer status. */
  async syncUserActiveByCustomerId(customerId: string, status: string) {
    const user = await this.userRepo.findOne({ where: { customerId } });
    if (!user) return;
    await this.userRepo.update(user.id, { isActive: status === 'ACTIVE' });
  }

  /** Soft-delete user account when customer is removed. */
  async deactivateUserByCustomerId(customerId: string) {
    const user = await this.userRepo.findOne({ where: { customerId } });
    if (!user) return;
    await this.userRepo.update(user.id, { isActive: false });
    await this.userRepo.softDelete(user.id);
  }

  /** Retail (B2C) OTP — request code */
  async requestRetailOtp(rawPhone: string, name?: string) {
    const phone = normalizePhone(rawPhone);
    if (!/^09\d{9}$/.test(phone)) {
      throw new BadRequestException('شماره موبایل معتبر نیست');
    }

    const code = String(randomInt(100000, 999999));
    this.otpStore.set(phone, {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0,
      name: name?.trim() || undefined,
    });

    const sent = this.notifications
      ? await this.notifications.sendOtp(phone, code)
      : false;

    const res: { message: string; phone: string; sent: boolean; devCode?: string } = {
      message: sent ? 'کد تایید ارسال شد' : 'کد تایید آماده است (پیامک پیکربندی نشده)',
      phone,
      sent,
    };
    // Expose code when SMS did not actually send — needed for local/dev.
    if (!sent) res.devCode = code;
    return res;
  }

  /** Retail (B2C) OTP — verify and issue JWT; auto-create ACTIVE consumer customer */
  async verifyRetailOtp(rawPhone: string, code: string, name?: string) {
    const phone = normalizePhone(rawPhone);
    const entry = this.otpStore.get(phone) as (OtpEntry & { name?: string }) | undefined;
    if (!entry || entry.expiresAt < Date.now()) {
      throw new UnauthorizedException('کد منقضی شده یا یافت نشد. دوباره درخواست کنید.');
    }
    entry.attempts += 1;
    if (entry.attempts > 5) {
      this.otpStore.delete(phone);
      throw new UnauthorizedException('تعداد تلاش بیش از حد. دوباره کد بگیرید.');
    }
    if (entry.code !== String(code).trim()) {
      throw new UnauthorizedException('کد تایید نادرست است');
    }
    this.otpStore.delete(phone);

    const displayName = (name?.trim() || entry.name || 'خریدار ترنم').slice(0, 80);

    let user = await this.userRepo.findOne({ where: { phone }, withDeleted: true });
    let customer: CustomerEntity | null = null;

    if (user?.customerId) {
      customer = await this.customerRepo.findOne({ where: { id: user.customerId }, withDeleted: true });
    }
    if (!customer) {
      customer = await this.customerRepo.findOne({ where: { phone }, withDeleted: true });
    }

    await this.dataSource.transaction(async (manager) => {
      const customerRepo = manager.getRepository(CustomerEntity);
      const userRepo = manager.getRepository(UserEntity);

      if (customer?.deletedAt) {
        await customerRepo.restore(customer.id);
        customer = await customerRepo.findOneOrFail({ where: { id: customer.id } });
      }

      if (!customer) {
        customer = await this.createCustomerWithUniqueCode(
          {
            businessName: displayName,
            ownerName: displayName,
            phone,
            province: 'تهران',
            city: 'تهران',
            type: 'B2C',
            businessType: 'RETAIL',
            status: 'ACTIVE',
            segment: 'C',
            isActive: true,
            notes: 'مصرف‌کننده فروشگاه آنلاین (.ir)',
          },
          manager,
        );
      } else if (customer.type === 'B2C' || (customer.notes || '').includes('فروشگاه آنلاین')) {
        await customerRepo.update(customer.id, {
          status: 'ACTIVE',
          isActive: true,
          ownerName: customer.ownerName || displayName,
        });
        customer.status = 'ACTIVE';
      } else if (customer.status !== 'ACTIVE') {
        // B2B pending/blocked: do not silently approve wholesale, but allow retail JWT
        // by marking user active; orders still need findOne to succeed.
        await customerRepo.update(customer.id, {
          notes: `${customer.notes || ''}\n[B2C OTP ${new Date().toISOString().slice(0, 10)}]`.trim(),
        });
      }

      const otpPasswordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);

      if (user) {
        if (user.deletedAt) await userRepo.restore(user.id);
        await userRepo.update(user.id, {
          customerId: customer!.id,
          isActive: true,
          role: 'CUSTOMER',
          lastLoginAt: new Date(),
        });
        user = await userRepo.findOneOrFail({ where: { id: user.id } });
      } else {
        user = await userRepo.save(
          userRepo.create({
            phone,
            passwordHash: otpPasswordHash,
            role: 'CUSTOMER',
            customerId: customer!.id,
            isActive: true,
            lastLoginAt: new Date(),
          }),
        );
      }
    });

    // Refresh after transaction
    user = await this.userRepo.findOneOrFail({ where: { phone } });
    if (!user.customerId) {
      throw new BadRequestException('حساب مشتری ایجاد نشد');
    }

    const token = this.jwtService.sign({
      sub: user.id,
      phone: user.phone,
      role: user.role,
    });
    return {
      accessToken: token,
      role: user.role,
      customerId: user.customerId,
      channel: 'RETAIL',
    };
  }
}
